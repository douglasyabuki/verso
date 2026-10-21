"use client";

import { useId, useState } from "react";

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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { certificationDateErrors } from "@/lib/resume/certification";
import type { CertificationDates, Entry } from "@/types-and-constants/resume";

export function CertificationDatesEditor({
  entry,
  onSave,
  issueField,
}: {
  entry: Entry;
  issueField?: string;
  onSave: (dates: CertificationDates | null) => void;
}) {
  const { state } = useWorkspace();
  return (
    <DateSetup
      key={`${entry.id}:${state.textHistoryEpoch}:${JSON.stringify(entry.certification?.dates ?? null)}`}
      entry={entry}
      issueField={issueField}
      onSave={onSave}
    />
  );
}

function DateSetup({
  entry,
  onSave,
  issueField,
}: {
  entry: Entry;
  issueField?: string;
  onSave: (dates: CertificationDates | null) => void;
}) {
  const committed = entry.certification?.dates ?? null;
  const [open, setOpen] = useState(
    !!issueField?.startsWith(`entries.${entry.id}.certification.`),
  );
  const [issued, setIssued] = useState(committed?.issued ?? "");
  const [expirationKind, setExpirationKind] = useState<
    CertificationDates["expiration"]["kind"]
  >(committed?.expiration.kind ?? "unspecified");
  const [expires, setExpires] = useState(
    committed?.expiration.kind === "date" ? committed.expiration.date : "",
  );
  const [attempted, setAttempted] = useState(!!issueField);
  const id = useId();
  const errors = attempted
    ? certificationDateErrors(issued, expirationKind, expires)
    : {};
  const save = () => {
    setAttempted(true);
    if (
      Object.keys(certificationDateErrors(issued, expirationKind, expires))
        .length
    )
      return;
    const dates: CertificationDates = {
      issued,
      expiration:
        expirationKind === "date"
          ? { kind: "date", date: expires }
          : { kind: expirationKind },
    };
    if (JSON.stringify(dates) !== JSON.stringify(committed)) onSave(dates);
    setOpen(false);
  };
  return (
    <FieldGroup>
      <FieldDescription>
        {committed
          ? "Certification dates are set. Any retained range also appears as Additional dates in the PDF."
          : "Only the retained date range appears in the PDF. Setup changes nothing until you save."}
      </FieldDescription>
      {committed && (
        <FieldDescription>
          Issue date: {committed.issued || "Unspecified"}. Expiration:{" "}
          {committed.expiration.kind === "date"
            ? committed.expiration.date
            : committed.expiration.kind === "never"
              ? "No expiration"
              : "Unspecified"}
          .
        </FieldDescription>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setIssued(committed?.issued ?? "");
            setExpirationKind(committed?.expiration.kind ?? "unspecified");
            setExpires(
              committed?.expiration.kind === "date"
                ? committed.expiration.date
                : "",
            );
            setAttempted(false);
          }
          setOpen(next);
        }}
      >
        <DialogTrigger render={<Button variant="outline" />}>
          {committed ? "Edit certification dates" : "Set certification dates"}
        </DialogTrigger>
        <DialogContent
          initialFocus={
            issueField
              ? () =>
                  document.querySelector<HTMLElement>(
                    `[data-issue-field="${CSS.escape(issueField)}"]`,
                  )
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle>Certification dates</DialogTitle>
            <DialogDescription>
              Use YYYY or YYYY-MM, between 1900 and 2299. Your retained date
              range stays unchanged.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.issued}>
              <FieldLabel htmlFor={`${id}-issued`}>
                Issue date (optional)
              </FieldLabel>
              <Input
                id={`${id}-issued`}
                data-issue-field={`entries.${entry.id}.certification.issued`}
                value={issued}
                maxLength={100}
                placeholder="2024 or 2024-12"
                onChange={(event) => setIssued(event.target.value)}
                aria-invalid={!!errors.issued}
                aria-describedby={
                  errors.issued ? `${id}-issued-error` : undefined
                }
              />
              {errors.issued && (
                <FieldError id={`${id}-issued-error`}>
                  {errors.issued}
                </FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor={id}>Expiration status</FieldLabel>
              <NativeSelect
                id={id}
                value={expirationKind}
                onChange={(event) =>
                  setExpirationKind(event.target.value as typeof expirationKind)
                }
              >
                <NativeSelectOption value="unspecified">
                  Unspecified
                </NativeSelectOption>
                <NativeSelectOption value="never">
                  No expiration
                </NativeSelectOption>
                <NativeSelectOption value="date">
                  Expiration date
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            {expirationKind === "date" && (
              <Field data-invalid={!!errors.expiration}>
                <FieldLabel htmlFor={`${id}-expires`}>
                  Expiration date
                </FieldLabel>
                <Input
                  id={`${id}-expires`}
                  data-issue-field={`entries.${entry.id}.certification.expiration`}
                  value={expires}
                  maxLength={100}
                  placeholder="2027 or 2027-12"
                  onChange={(event) => setExpires(event.target.value)}
                  aria-invalid={!!errors.expiration}
                  aria-describedby={
                    errors.expiration ? `${id}-expires-error` : undefined
                  }
                />
                {errors.expiration && (
                  <FieldError id={`${id}-expires-error`}>
                    {errors.expiration}
                  </FieldError>
                )}
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save dates</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {committed && (
        <Button variant="outline" onClick={() => onSave(null)}>
          Use legacy dates only
        </Button>
      )}
    </FieldGroup>
  );
}
