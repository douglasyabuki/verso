"use client";

import { getMarkRange } from "@tiptap/core";
import { isHistoryTransaction } from "@tiptap/pm/history";
import { EditorState, type Selection, TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Italic, Link, Unlink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createTextEditorExtensions,
  textAction,
  textBoundary,
} from "@/components/resume/text-editor-extensions";
import {
  editorContentToSpans,
  plainTextSlice,
  spansToEditorContent,
} from "@/components/resume/text-editor-model";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { equivalentSpans } from "@/lib/resume/spans";
import { urlError } from "@/lib/resume/validation";
import type { Span } from "@/types-and-constants/resume";
import type { EditGroup } from "@/types-and-constants/workspace";

type LinkEdit = {
  selection: Selection;
  from: number;
  to: number;
  href: string;
  linked: boolean;
};

export function TextEditor({
  id,
  fieldKey,
  label,
  spans,
  error,
  multiline,
  onChange,
}: {
  id: string;
  fieldKey: string;
  label: string;
  spans: Span[];
  error?: string;
  multiline: boolean;
  onChange: (spans: Span[], group?: EditGroup) => void;
}) {
  const { controller, state } = useWorkspace();
  const [rejections, setRejections] = useState(0);
  const [tool, setTool] = useState(0);
  const [linkEdit, setLinkEdit] = useState<LinkEdit | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string>();
  const urlInput = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);
  const epoch = useRef(state.textHistoryEpoch);
  const acceptedSpans = useRef(spans);
  const extensions = useMemo(
    () => createTextEditorExtensions(() => setRejections((count) => count + 1)),
    [],
  );

  const editor = useEditor({
    extensions,
    content: spansToEditorContent(spans),
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    enableInputRules: false,
    enablePasteRules: false,
    injectCSS: false,
    editorProps: {
      attributes: {
        id,
        "data-issue-field": fieldKey,
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        "aria-invalid": String(!!error),
        "aria-describedby": `${id}-instructions${error ? ` ${id}-error` : ""}`,
        spellcheck: "true",
        class: `w-full whitespace-pre-wrap break-words rounded-b-md px-3 py-2 text-sm outline-none ${multiline ? "min-h-24" : "min-h-16"} [&_em]:italic [&_a]:text-primary [&_a]:underline`,
      },
      handleKeyDown: (_view, event) => {
        if (event.isComposing || event.keyCode === 229) return false;
        if ((event.metaKey || event.ctrlKey) && !event.altKey) {
          const key = event.key.toLowerCase();
          if (key === "z" || (key === "y" && !event.shiftKey)) {
            event.preventDefault();
            if (key === "y" || event.shiftKey) editor?.commands.redo();
            else editor?.commands.undo();
            // Consume empty history commands too: native contenteditable history
            // must not resurrect content from before a workspace replacement.
            return true;
          }
          if (event.shiftKey) return false;
          if (event.key.toLowerCase() === "k") {
            event.preventDefault();
            openLink();
            return true;
          }
          if (event.key.toLowerCase() === "i") {
            event.preventDefault();
            emphasize();
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain");
        if (!text) return true;
        const { state } = view;
        const marks = state.storedMarks ?? state.selection.$from.marks();
        view.dispatch(
          state.tr
            .replaceSelection(plainTextSlice(text, state.schema, marks))
            .setMeta("uiEvent", "paste")
            .scrollIntoView(),
        );
        return true;
      },
      handleDOMEvents: {
        beforeinput: (_view, event) => {
          if (
            !event.isComposing &&
            (event.inputType === "insertParagraph" ||
              event.inputType === "insertLineBreak")
          ) {
            event.preventDefault();
            editor?.commands.setHardBreak();
            return true;
          }
          if (
            event.inputType !== "historyUndo" &&
            event.inputType !== "historyRedo"
          )
            return false;
          event.preventDefault();
          if (event.inputType === "historyUndo") editor?.commands.undo();
          else editor?.commands.redo();
          return true;
        },
      },
      handleClick: (_view, _pos, event) => {
        if ((event.target as HTMLElement).closest("a")) event.preventDefault();
        return false;
      },
    },
    onUpdate: ({ editor, transaction }) => {
      const next = editorContentToSpans(editor.state.doc);
      if (equivalentSpans(acceptedSpans.current, next)) return;
      acceptedSpans.current = next;
      const isolated =
        transaction.getMeta(textAction) ||
        transaction.getMeta("uiEvent") ||
        isHistoryTransaction(transaction);
      const composition = transaction.getMeta("composition");
      if (transaction.getMeta(textBoundary)) controller.endEditGroup();
      onChange(next, {
        key:
          composition !== undefined
            ? `${fieldKey}:composition:${composition}`
            : fieldKey,
        kind: isolated
          ? "isolated"
          : composition !== undefined
            ? "composition"
            : "typing",
      });
      setRejections(0);
    },
  });

  const selection = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor)
        return {
          linked: false,
          canLink: false,
          href: "",
          emphasized: false,
          mixed: false,
        };
      const { from, to, empty, $from } = editor.state.selection;
      const marks = editor.state.storedMarks ?? $from.marks();
      let emphasized =
        empty && marks.some((mark) => mark.type.name === "italic");
      let plain = false;
      let linked = empty && !!getMarkRange($from, editor.schema.marks.link);
      if (!empty)
        editor.state.doc.nodesBetween(from, to, (node) => {
          if (!node.isInline) return;
          if (node.marks.some((mark) => mark.type.name === "italic"))
            emphasized = true;
          else plain = true;
          if (node.marks.some((mark) => mark.type.name === "link"))
            linked = true;
        });
      return {
        linked,
        canLink: !empty || linked,
        emphasized,
        mixed: emphasized && plain,
      };
    },
  });

  useEffect(() => {
    if (!editor) return;
    const disabled = !!state.pending || state.replacing;
    editor.setEditable(!disabled, false);
    editor.view.dom.setAttribute("aria-disabled", String(disabled));
  }, [editor, state.pending, state.replacing]);

  useEffect(() => {
    if (!editor) return;
    const reset = epoch.current !== state.textHistoryEpoch;
    epoch.current = state.textHistoryEpoch;
    acceptedSpans.current = spans;
    if (
      !reset &&
      equivalentSpans(editorContentToSpans(editor.state.doc), spans)
    )
      return;
    const { anchor, head } = editor.state.selection;
    const doc = editor.schema.nodeFromJSON(spansToEditorContent(spans));
    const bound = (position: number) =>
      Math.max(1, Math.min(doc.content.size - 1, position));
    editor.view.updateState(
      EditorState.create({
        schema: editor.schema,
        doc,
        selection: TextSelection.create(doc, bound(anchor), bound(head)),
        plugins: editor.state.plugins,
      }),
    );
    editor.emit("transaction", {
      editor,
      transaction: editor.state.tr,
      appendedTransactions: [],
    });
    queueMicrotask(() => {
      returnFocus.current = false;
      setLinkEdit(null);
      setRejections(0);
    });
  }, [editor, spans, state.textHistoryEpoch]);

  const enabled = !!editor?.isEditable && !state.pending && !state.replacing;

  const currentLink = (): LinkEdit | null => {
    if (!editor) return null;
    const selection = editor.state.selection;
    const range = selection.empty
      ? getMarkRange(selection.$from, editor.schema.marks.link)
      : undefined;
    const from = range?.from ?? selection.from;
    const to = range?.to ?? selection.to;
    if (from === to) return null;
    let href = "";
    let linked = false;
    editor.state.doc.nodesBetween(from, to, (node) => {
      const mark = node.marks.find((mark) => mark.type.name === "link");
      if (mark) {
        if (!linked) href = mark.attrs.href;
        linked = true;
      }
    });
    return { selection, from, to, href, linked };
  };

  const openLink = () => {
    if (!enabled) return;
    const current = currentLink();
    if (!current) return;
    setLinkEdit(current);
    setLinkValue(current.href);
    setLinkError(undefined);
    returnFocus.current = true;
  };

  const emphasize = () => {
    if (!editor || !enabled) return;
    const previous = editor.state;
    const tr = editor.state.tr.setMeta(textAction, true);
    const { from, to, empty, $from } = editor.state.selection;
    const mark = editor.schema.marks.italic;
    if (empty) {
      const active = (editor.state.storedMarks ?? $from.marks()).some(
        (item) => item.type === mark,
      );
      if (active) tr.removeStoredMark(mark);
      else tr.addStoredMark(mark.create());
    } else {
      let all = true;
      editor.state.doc.nodesBetween(from, to, (node) => {
        if (node.isInline && !mark.isInSet(node.marks)) all = false;
      });
      if (all) tr.removeMark(from, to, mark);
      else tr.addMark(from, to, mark.create());
    }
    editor.view.dispatch(tr);
    if (editor.state !== previous) editor.view.focus();
  };

  const changeLink = (remove: boolean, target = linkEdit ?? currentLink()) => {
    if (!editor || !enabled || !target) return;
    if (!remove) {
      const error = !linkValue
        ? "Enter a complete link, such as https://example.com."
        : urlError(linkValue);
      if (error) {
        setLinkError(error);
        urlInput.current?.focus();
        return;
      }
    }
    const previous = editor.state;
    const tr = previous.tr.setMeta(textAction, true);
    if (remove) tr.removeMark(target.from, target.to, editor.schema.marks.link);
    else
      tr.addMark(
        target.from,
        target.to,
        editor.schema.marks.link.create({ href: linkValue }),
      );
    tr.setSelection(target.selection.map(tr.doc, tr.mapping));
    editor.view.dispatch(tr);
    // A filtered transaction leaves the exact EditorState and both history branches untouched.
    if (editor.state === previous) return;
    returnFocus.current = true;
    setLinkEdit(null);
    editor.view.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className="form-control rounded-md"
        data-slot="text-editor"
        data-appearance="content"
        data-empty={!spans.some((span) => span.text.length > 0)}
        data-disabled={!enabled}
        data-invalid={!!error}
      >
        <div
          role="toolbar"
          aria-label={`${label} formatting`}
          aria-controls={id}
          className="flex flex-wrap items-center gap-1 border-b border-field-filled p-1"
          onKeyDown={(event) => {
            const tools = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                "[data-text-tool]:not(:disabled)",
              ),
            ];
            const index = tools.indexOf(event.target as HTMLButtonElement);
            if (index < 0) return;
            let next: number;
            if (event.key === "ArrowRight") next = (index + 1) % tools.length;
            else if (event.key === "ArrowLeft")
              next = (index - 1 + tools.length) % tools.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = tools.length - 1;
            else return;
            event.preventDefault();
            setTool(Number(tools[next].dataset.textTool));
            tools[next].focus();
          }}
        >
          <Toggle
            data-text-tool="0"
            size="sm"
            disabled={!enabled}
            tabIndex={
              tool === 0 ||
              (tool === 1 && !selection?.canLink) ||
              (tool === 2 && !selection?.linked)
                ? 0
                : -1
            }
            pressed={!!selection?.emphasized && !selection?.mixed}
            aria-pressed={selection?.mixed ? "mixed" : !!selection?.emphasized}
            aria-label="Italic"
            title="Italic (Ctrl/Command+I)"
            onFocus={() => setTool(0)}
            onPressedChange={emphasize}
          >
            <Italic data-icon="inline-start" />
            Italic
          </Toggle>
          <Popover
            open={!!linkEdit}
            triggerId={`${id}-link-trigger`}
            onOpenChange={(open, details) => {
              if (open) openLink();
              else {
                returnFocus.current = details.reason === "escape-key";
                setLinkEdit(null);
              }
            }}
          >
            <PopoverTrigger
              id={`${id}-link-trigger`}
              render={<Button variant="ghost" size="sm" />}
              data-text-tool="1"
              disabled={!enabled || !selection?.canLink}
              tabIndex={tool === 1 && selection?.canLink ? 0 : -1}
              onFocus={() => setTool(1)}
              title="Add or edit link (Ctrl/Command+K)"
            >
              <Link data-icon="inline-start" />
              {selection?.linked ? "Edit link" : "Add link"}
            </PopoverTrigger>
            <PopoverContent
              initialFocus={urlInput}
              finalFocus={() =>
                returnFocus.current && editor ? editor.view.dom : false
              }
            >
              <PopoverTitle>
                {linkEdit?.linked ? "Edit link" : "Add link"}
              </PopoverTitle>
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  changeLink(false);
                }}
              >
                <Field data-invalid={!!linkError}>
                  <FieldLabel htmlFor={`${id}-url`}>Link address</FieldLabel>
                  <Input
                    ref={urlInput}
                    id={`${id}-url`}
                    value={linkValue}
                    maxLength={2_000}
                    onChange={(event) => {
                      setLinkValue(event.target.value);
                      setLinkError(undefined);
                    }}
                    aria-invalid={!!linkError}
                    aria-describedby={`${id}-url-help`}
                    placeholder="https://example.com"
                    autoComplete="off"
                  />
                  {linkError ? (
                    <FieldError id={`${id}-url-help`}>{linkError}</FieldError>
                  ) : (
                    <FieldDescription id={`${id}-url-help`}>
                      Use https, http, mailto, or tel.
                    </FieldDescription>
                  )}
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm">
                    Apply
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      returnFocus.current = true;
                      setLinkEdit(null);
                    }}
                  >
                    Cancel
                  </Button>
                  {linkEdit?.linked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => changeLink(true)}
                    >
                      Remove link
                    </Button>
                  )}
                </div>
              </form>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            data-text-tool="2"
            disabled={!enabled || !selection?.linked}
            tabIndex={tool === 2 && selection?.linked ? 0 : -1}
            onFocus={() => setTool(2)}
            onClick={() => changeLink(true)}
          >
            <Unlink data-icon="inline-start" />
            Remove link
          </Button>
        </div>
        <EditorContent editor={editor} />
      </div>
      <FieldDescription id={`${id}-instructions`}>
        Select text to emphasize it or add a link. Pasted content uses plain
        text.
      </FieldDescription>
      <div role="status" aria-live="polite" aria-atomic="true">
        {rejections > 0 && (
          <FieldError>
            This edit adds more text formatting than the editor can support. Try
            pasting as plain text or making a smaller edit. Your text,
            selection, and undo history have been kept.
            <span className="sr-only"> Rejected edit {rejections}.</span>
          </FieldError>
        )}
      </div>
    </div>
  );
}
