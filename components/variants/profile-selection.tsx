import { useId } from "react";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { displayLocation } from "@/lib/output/render";
import type { EditorProps } from "@/types-and-constants/editor";
import { profileContactFields } from "@/types-and-constants/resume";

export function ProfileSelection({
  document,
  variant,
  locale,
  update,
}: Pick<EditorProps, "document" | "variant" | "locale" | "update">) {
  return (
    <Card
      tabIndex={-1}
      data-issue-field={`variants.${variant.id}.profileSelection`}
    >
      <CardHeader>
        <CardTitle
          size="section"
          className="flex items-center gap-2 [&>svg]:size-5 [&>svg]:shrink-0"
        >
          <CareerSectionIcon kind="profile" />
          Profile
        </CardTitle>
        <CardDescription>
          Choose what appears in both languages of this resume. Your information
          stays in Career details &gt; Profile. New links are included
          automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldTitle>Full name · Always included</FieldTitle>
            <FieldDescription className="wrap-anywhere">
              {document.profile.name || "Not provided"}
            </FieldDescription>
          </Field>
          {profileContactFields.map(({ key, label }) => (
            <ContactChoice
              key={key}
              label={label}
              value={
                key === "country"
                  ? displayLocation("", document.profile.country, locale)
                  : document.profile[key]
              }
              checked={variant.profileSelection[key]}
              onChange={(included) =>
                update((draft) => {
                  const resume = draft.variants.find(
                    (item) => item.id === variant.id,
                  );
                  if (resume) resume.profileSelection[key] = included;
                })
              }
            />
          ))}
          {document.profile.links.map((link) => (
            <ContactChoice
              key={link.id}
              label={link.label || "Untitled link"}
              value={link.url}
              checked={
                !variant.profileSelection.hiddenLinkIds.includes(link.id)
              }
              onChange={(included) =>
                update((draft) => {
                  const resume = draft.variants.find(
                    (item) => item.id === variant.id,
                  );
                  if (!resume) return;
                  const remaining =
                    resume.profileSelection.hiddenLinkIds.filter(
                      (id) => id !== link.id,
                    );
                  resume.profileSelection.hiddenLinkIds = included
                    ? remaining
                    : [...remaining, link.id];
                })
              }
            />
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function ContactChoice({
  label,
  value,
  checked,
  onChange,
}: {
  label: string;
  value: string;
  checked: boolean;
  onChange: (included: boolean) => void;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-value`}
      />
      <FieldContent className="min-w-0">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription id={`${id}-value`} className="wrap-anywhere">
          {value || "Not provided"}
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}
