"use client";

import { type RefObject, useState } from "react";

import { ResumeColorPicker } from "@/components/resume/resume-color-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type ResumeColor, type Variant } from "@/types-and-constants/resume";

export function ResumeIdentityDialog({
  resume,
  close,
  save,
  returnFocus,
}: {
  resume: Variant;
  close: () => void;
  save: (id: string, name: string, color: ResumeColor) => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const [name, setName] = useState(resume.name);
  const [color, setColor] = useState(resume.color);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        finalFocus={() =>
          returnFocus.current?.isConnected ? returnFocus.current : undefined
        }
      >
        <DialogHeader>
          <DialogTitle>Rename &amp; color</DialogTitle>
          <DialogDescription>
            Make this resume easy to recognize in your workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) save(resume.id, name, color);
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="resume-identity-name">
                Resume name
              </FieldLabel>
              <Input
                id="resume-identity-name"
                autoFocus
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <ResumeColorPicker value={color} onChange={setColor} />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
