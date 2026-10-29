import { Extension } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import { closeHistory, isHistoryTransaction } from "@tiptap/pm/history";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

import { editorContentToSpans } from "@/components/editor/text/text-editor-model";
import { urlError } from "@/lib/review/validation";

export const textAction = "verso.textAction";
export const textBoundary = "verso.textBoundary";

/** Create the restricted editor schema and a pre-application limit guard.
 * @param onRejected Announce a rejected transaction without editing document or history.
 * @returns Per-editor extensions; rejected transactions never reach history plugin state.
 * @example createTextEditorExtensions(() => announce("Formatting limit reached"));
 */
export function createTextEditorExtensions(onRejected: () => void) {
  const boundaryKey = new PluginKey<boolean>("versoTextBoundary");
  const guard = Extension.create({
    name: "versoTextGuard",
    priority: 1100,
    addProseMirrorPlugins() {
      let view: EditorView | undefined;
      return [
        new Plugin<boolean>({
          key: boundaryKey,
          state: {
            init: () => false,
            apply: (transaction, pending) => {
              if (transaction.getMeta(textAction)) return true;
              if (!transaction.docChanged) return pending;
              return (
                !!transaction.getMeta("uiEvent") ||
                isHistoryTransaction(transaction)
              );
            },
          },
          filterTransaction: (transaction, state) => {
            if (!transaction.docChanged) return true;
            const spans = editorContentToSpans(transaction.doc);
            if (
              spans.length > 100 ||
              spans.some((span) => span.href.length > 2_000)
            ) {
              onRejected();
              // Native typing/composition may already have changed the DOM. Reconcile
              // it against the untouched state, never by applying an inverse edit.
              queueMicrotask(() => {
                if (view && !view.isDestroyed) view.updateState(view.state);
              });
              return false;
            }
            const isolated =
              transaction.getMeta(textAction) ||
              transaction.getMeta("uiEvent") ||
              isHistoryTransaction(transaction);
            if (isolated || boundaryKey.getState(state)) {
              transaction.setMeta(textBoundary, true);
              closeHistory(transaction);
            }
            return true;
          },
          view: (editorView) => {
            view = editorView;
            return {
              destroy: () => {
                view = undefined;
              },
            };
          },
        }),
      ];
    },
  });

  return [
    Document.extend({ content: "paragraph" }),
    Paragraph,
    Text,
    HardBreak.extend({
      addCommands() {
        return {
          setHardBreak:
            () =>
            ({ state, tr, dispatch }) => {
              const marks = state.storedMarks ?? state.selection.$from.marks();
              if (dispatch)
                tr.replaceSelectionWith(
                  state.schema.nodes.hardBreak.create(null, null, marks),
                  false,
                )
                  .ensureMarks(marks)
                  .scrollIntoView();
              return true;
            },
        };
      },
      addKeyboardShortcuts() {
        return {
          ...this.parent?.(),
          Enter: () => this.editor.commands.setHardBreak(),
        };
      },
    }),
    Italic,
    Link.extend({
      renderHTML({ HTMLAttributes }) {
        const href: string = HTMLAttributes.href ?? "";
        // Legacy invalid URLs remain in the mark, but never become DOM URLs.
        return ["a", { href: href && !urlError(href) ? href : undefined }, 0];
      },
    }).configure({
      autolink: false,
      linkOnPaste: false,
      openOnClick: false,
      enableClickSelection: false,
      isAllowedUri: (href) => !!href && !urlError(href),
    }),
    UndoRedo.configure({ newGroupDelay: 1000 }),
    guard,
  ];
}
