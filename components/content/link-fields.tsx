"use client";

import { useId } from "react";

import { LinkIcon } from "@/components/content/link-icon";
import { TextField } from "@/components/editor/fields";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { urlError } from "@/lib/url-validation";
import {
  linkTypeNames,
  linkTypes,
  type ResumeLink,
} from "@/types-and-constants/resume";
import type { EditGroup } from "@/types-and-constants/workspace";

const linkTypeItems = linkTypes.map((type) => ({
  value: type,
  label: (
    <>
      <span className="inline-flex size-4 shrink-0 items-center justify-center">
        <LinkIcon type={type} />
      </span>
      {linkTypeNames[type]}
    </>
  ),
}));

/** Common shared fields; all edits use the owner's existing undoable update. */
export function LinkFields({
  link,
  onChange,
}: {
  link: ResumeLink;
  onChange: (link: ResumeLink, group?: EditGroup) => void;
}) {
  const id = useId();
  return (
    <FieldGroup className="gap-3">
      <Field>
        <FieldLabel htmlFor={id}>Link type</FieldLabel>
        <Select
          items={linkTypeItems}
          value={link.type}
          onValueChange={(type) => {
            if (type && linkTypes.includes(type)) onChange({ ...link, type });
          }}
        >
          <SelectTrigger id={id} size="sm" className="max-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {linkTypeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <TextField
        fieldKey={`links.${link.id}.label`}
        label="Link label (optional)"
        value={link.label}
        maxLength={200}
        onChange={(label, group) => onChange({ ...link, label }, group)}
        placeholder="Professional profile"
        hint="A blank label displays the link address."
      />
      <TextField
        fieldKey={`links.${link.id}.url`}
        label="Link address"
        value={link.url}
        maxLength={2_000}
        onChange={(url, group) => onChange({ ...link, url }, group)}
        error={urlError(link.url)}
        placeholder="https://example.com"
      />
      <div className="flex items-center gap-2">
        <FieldDescription>Shared across resumes</FieldDescription>
        <InfoHint label="shared links">
          Labels, types and addresses are shared across resumes. Inclusion
          applies to both output languages.
        </InfoHint>
      </div>
    </FieldGroup>
  );
}
