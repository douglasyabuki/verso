"use client";

import { useState } from "react";

import { CertificationDatesEditor } from "@/components/content/certification-dates-editor";
import { CheckField, TextField } from "@/components/editor/fields";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { WordingField } from "@/components/wording/wording-field";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { dateErrors } from "@/lib/review/validation";
import type { EditorProps } from "@/types-and-constants/editor";
import type { Entry, Section } from "@/types-and-constants/resume";
import type { Issue } from "@/types-and-constants/review";
import { entryTerminology } from "@/types-and-constants/sections";
import type { EditGroup } from "@/types-and-constants/workspace";

type EntryFieldsProps = Pick<EditorProps, "document" | "locale" | "update"> & {
  entry: Entry;
  section: Section;
  errors: Issue[];
  issueTarget?: Issue["target"];
  changeEntry: (change: (entry: Entry) => void, group?: EditGroup) => void;
};

export function EntryFields(props: EntryFieldsProps) {
  const { state } = useWorkspace();
  return (
    <TailoredFields
      key={`${props.entry.id}:${state.textHistoryEpoch}`}
      {...props}
    />
  );
}

function TailoredFields({
  entry,
  section,
  document,
  locale,
  update,
  errors,
  changeEntry,
  issueTarget,
}: EntryFieldsProps) {
  const terms = entryTerminology[section.kind];
  const skills = section.kind === "skills";
  const certification = section.kind === "certifications";
  const education = section.kind === "education";
  const projects = section.kind === "projects";
  const organizationFirst = section.kind === "experience" || education;
  const locationInMain = !skills && !certification && !projects;
  const technologiesInMain = !education && !certification;
  const additionalHasContent =
    (skills &&
      !!(
        entry.organization ||
        entry.city ||
        entry.country ||
        entry.start ||
        entry.end ||
        entry.ongoing
      )) ||
    (certification &&
      !!(
        entry.city ||
        entry.country ||
        entry.start ||
        entry.end ||
        entry.ongoing ||
        entry.technologies.some((value) => value.trim())
      )) ||
    (education && entry.technologies.some((value) => value.trim())) ||
    (projects && !!(entry.city || entry.country));
  const additionalIssue =
    issueTarget?.entryId === entry.id &&
    ((!locationInMain &&
      ["city", "country"].some(
        (field) => issueTarget.fieldKey === `entries.${entry.id}.${field}`,
      )) ||
      ((skills || certification) &&
        ["start", "end"].some(
          (field) => issueTarget.fieldKey === `entries.${entry.id}.${field}`,
        )));
  const [additionalOpen, setAdditionalOpen] = useState(
    !!additionalHasContent || !!additionalIssue,
  );
  const countryError = errors.find(
    (error) => error.path === `entries.${entry.id}.country`,
  )?.message;
  const datesErrors = dateErrors(entry);
  const dateIssue = datesErrors.start ?? datesErrors.end;
  const additionalHasErrors =
    ((skills || certification) && !!(countryError || dateIssue)) ||
    (projects && !!countryError);
  const organization = (
    <TextField
      fieldKey={`entries.${entry.id}.organization`}
      label={terms.organization}
      value={entry.organization}
      onChange={(organization, group) =>
        changeEntry((target) => {
          target.organization = organization;
        }, group)
      }
      hint="Shared across languages. Optional; leave empty when it does not apply."
    />
  );
  const location = (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <TextField
        fieldKey={`entries.${entry.id}.city`}
        label="City"
        value={entry.city}
        maxLength={200}
        onChange={(city, group) =>
          changeEntry((target) => {
            target.city = city;
          }, group)
        }
      />
      <TextField
        fieldKey={`entries.${entry.id}.country`}
        label="Country code"
        value={entry.country}
        maxLength={2}
        placeholder="BR"
        error={countryError}
        onChange={(country, group) =>
          changeEntry((target) => {
            target.country = country.toUpperCase();
          }, group)
        }
        description="Two letters. The PDF shows the country name in the selected language."
      />
    </FieldGroup>
  );
  const dates = (
    <FieldSet>
      <FieldLegend>
        {certification
          ? "Original date range"
          : education
            ? "Attendance dates"
            : section.kind === "experience"
              ? "Employment dates"
              : section.kind === "projects"
                ? "Project dates"
                : "Dates"}
      </FieldLegend>
      <FieldDescription>
        {certification
          ? "These original facts are independent of certification dates. They remain visible in the PDF, and setup never changes them."
          : "Optional shared facts. Enter a year or a year and month, for example 2024 or 2024-06."}
      </FieldDescription>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <TextField
          fieldKey={`entries.${entry.id}.start`}
          label="Start date"
          value={entry.start}
          maxLength={7}
          placeholder="YYYY or YYYY-MM"
          error={datesErrors.start}
          onChange={(start, group) =>
            changeEntry((target) => {
              target.start = start;
            }, group)
          }
        />
        {(!entry.ongoing || entry.end) && (
          <TextField
            fieldKey={`entries.${entry.id}.end`}
            label={
              entry.ongoing
                ? "Original end date (hidden while ongoing)"
                : "End date"
            }
            value={entry.end}
            maxLength={7}
            placeholder="YYYY or YYYY-MM"
            error={datesErrors.end}
            onChange={(end, group) =>
              changeEntry((target) => {
                target.end = end;
              }, group)
            }
          />
        )}
      </FieldGroup>
      <CheckField
        label={terms.ongoing}
        checked={entry.ongoing}
        onChange={(ongoing) =>
          changeEntry((target) => {
            target.ongoing = ongoing;
          })
        }
      />
    </FieldSet>
  );
  const technologies = (
    <TextField
      fieldKey={`entries.${entry.id}.technologies`}
      label={skills ? "Shared tools / technologies" : "Technologies"}
      value={entry.technologies.join(", ")}
      maxLength={2000}
      onChange={(value, group) =>
        changeEntry((target) => {
          target.technologies = value
            .split(",")
            .map((value) => value.trim())
            .slice(0, 100);
        }, group)
      }
      description="Separate names with commas."
      hint="Shared across languages. Use the text fields below for details that need translation."
    />
  );
  return (
    <FieldGroup>
      {organizationFirst && organization}
      <WordingField
        document={document}
        path={`entries.${entry.id}.title`}
        locale={locale}
        update={update}
        label={terms.title}
        required
        errors={errors}
        description={`For example: ${terms.example}. Text is specific to each language.`}
      />
      {!skills && !organizationFirst && organization}
      {locationInMain && location}
      {!skills && !certification && dates}
      {technologiesInMain && technologies}
      {certification && (
        <>
          <TextField
            fieldKey={`entries.${entry.id}.certification.credentialId`}
            label="Credential ID"
            value={entry.certification?.credentialId ?? ""}
            hint="Optional identifier, shared across languages."
            onChange={(credentialId, group) =>
              changeEntry((target) => {
                target.certification = {
                  credentialId,
                  dates: target.certification?.dates ?? null,
                };
              }, group)
            }
          />
          <CertificationDatesEditor
            entry={entry}
            issueField={issueTarget?.fieldKey}
            onSave={(dates) =>
              changeEntry((target) => {
                target.certification = {
                  credentialId: target.certification?.credentialId ?? "",
                  dates,
                };
              })
            }
          />
        </>
      )}
      {(skills || certification || education || projects) && (
        <Collapsible
          open={additionalOpen || additionalHasErrors}
          onOpenChange={setAdditionalOpen}
        >
          <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
            Additional details
          </CollapsibleTrigger>
          <CollapsibleContent keepMounted>
            <FieldGroup className="mt-4">
              <FieldDescription>
                Populated fields remain visible in the PDF. Clear a value
                explicitly to remove it.
              </FieldDescription>
              {skills && organization}
              {!locationInMain && location}
              {(skills || certification) && dates}
              {!technologiesInMain && technologies}
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      )}
    </FieldGroup>
  );
}
