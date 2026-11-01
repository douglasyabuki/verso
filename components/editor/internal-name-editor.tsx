"use client";

import { Pencil } from "lucide-react";
import { type ReactNode, type RefObject, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import type { EditGroup } from "@/types-and-constants/workspace";

/** Preserve the card title and commit organizational naming from a dialog as one undoable change. */
export function InternalNameEditor({
  fieldKey,
  value,
  label,
  onChange,
  children,
  actions,
}: {
  fieldKey: string;
  value?: string;
  label: string;
  onChange: (value: string, group?: EditGroup) => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {children}
      <div className="flex shrink-0 items-center gap-1">
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
          }}
        >
          <DialogTrigger
            render={<Button variant="ghost" size="icon-sm" />}
            aria-label={`Rename ${label}`}
            title={`Rename ${label}`}
          >
            <Pencil aria-hidden="true" />
          </DialogTrigger>
          <DialogContent initialFocus={input}>
            <DialogHeader className="place-items-start text-start">
              <DialogTitle>Rename item</DialogTitle>
              <DialogDescription>
                Make this item easy to recognize in your workspace.
              </DialogDescription>
            </DialogHeader>
            <InternalNameForm
              fieldKey={fieldKey}
              value={value}
              label={label}
              onChange={onChange}
              inputRef={input}
              close={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
        {actions}
      </div>
    </div>
  );
}

/** Reuse organizational naming from entry actions without leaving a menu open behind the form. */
export function InternalNameDialog({
  fieldKey,
  value,
  label,
  onChange,
  close,
  returnFocus,
}: {
  fieldKey: string;
  value?: string;
  label: string;
  onChange: (value: string, group?: EditGroup) => void;
  close: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent initialFocus={input} finalFocus={returnFocus}>
        <DialogHeader className="place-items-start text-start">
          <DialogTitle>Rename item</DialogTitle>
          <DialogDescription>
            Make this item easy to recognize in your workspace.
          </DialogDescription>
        </DialogHeader>
        <InternalNameForm
          fieldKey={fieldKey}
          value={value}
          label={label}
          onChange={onChange}
          inputRef={input}
          close={close}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Share the draft, help and explicit save/cancel behavior across naming surfaces. */
function InternalNameForm({
  fieldKey,
  value,
  label,
  onChange,
  inputRef,
  close,
}: {
  fieldKey: string;
  value?: string;
  label: string;
  onChange: (value: string, group?: EditGroup) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  close: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft !== (value ?? "")) onChange(draft);
        close();
      }}
    >
      <FieldGroup>
        <Field>
          <div className="flex items-center gap-2">
            <FieldLabel htmlFor={id}>Internal name</FieldLabel>
            <InfoHint label="internal name">
              For organization only. Shared across languages and resumes; does
              not appear in the PDF. Leave blank to use the default title from
              the content.
            </InfoHint>
          </div>
          <Input
            ref={inputRef}
            id={id}
            data-issue-field={fieldKey}
            value={draft}
            placeholder={label}
            maxLength={200}
            onChange={(event) => setDraft(event.target.value)}
          />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
