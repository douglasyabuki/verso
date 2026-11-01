"use client";

import { Mail, MapPin, Smartphone } from "lucide-react";
import { type ReactNode, useId } from "react";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { LinkIcon } from "@/components/content/link-icon";
import { SortableItemLayout } from "@/components/editor/sortable-item-layout";
import { SortableList, SortableRow } from "@/components/editor/sortable-list";
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
import { InfoHint } from "@/components/ui/info-hint";
import { linkLabel, resolveLink } from "@/lib/content/links";
import { profileItemId, profileItemIncluded } from "@/lib/content/profile";
import { reorderVisible } from "@/lib/ordering";
import { displayLocation } from "@/lib/output/render";
import type { EditorProps } from "@/types-and-constants/editor";
import { profileContactFields } from "@/types-and-constants/resume";

const profileFieldIcons = {
  city: MapPin,
  country: MapPin,
  email: Mail,
  phone: Smartphone,
};

export function ProfileSelection({
  document,
  variant,
  locale,
  update,
}: Pick<EditorProps, "document" | "variant" | "locale" | "update">) {
  const included = variant.profileSelection.order.filter((item) =>
    profileItemIncluded(item, variant),
  );
  const excluded = variant.profileSelection.order.filter(
    (item) => !profileItemIncluded(item, variant),
  );
  const cards = [...included, ...excluded].map((item) => {
    const link =
      item.kind === "link"
        ? document.profile.links.find((link) => link.id === item.linkId)
        : undefined;
    const resolved = link ? resolveLink(link) : undefined;
    const Icon =
      item.kind === "field" ? profileFieldIcons[item.field] : undefined;
    return {
      item,
      id: profileItemId(item),
      label:
        item.kind === "field"
          ? profileContactFields.find(({ key }) => key === item.field)!.label
          : link
            ? linkLabel(link, document.profile.links.indexOf(link))
            : "Untitled link",
      value:
        item.kind === "field"
          ? item.field === "country"
            ? displayLocation("", document.profile.country, locale)
            : document.profile[item.field]
          : (resolved?.address ?? ""),
      icon: Icon ? (
        <Icon aria-hidden="true" className="size-4 shrink-0" />
      ) : resolved ? (
        <LinkIcon type={resolved.type} className="size-4 shrink-0" />
      ) : undefined,
      checked: profileItemIncluded(item, variant),
    };
  });
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
          Choose and order the contact details shown in both languages of this
          resume. Edit your information in Career details &gt; Profile. New
          links are included automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <div className="flex items-center gap-2">
              <FieldTitle>Full name</FieldTitle>
              <InfoHint label="full name">Always included.</InfoHint>
            </div>
            <FieldDescription className="wrap-anywhere">
              {document.profile.name || "Not provided"}
            </FieldDescription>
          </Field>
          <SortableList
            scope={`variant:${variant.id}:profile`}
            revision={document}
            contextKey={locale}
            items={cards
              .filter((card) => card.checked)
              .map(({ id, label }) => ({ id, label }))}
            onReorder={(source, target) =>
              update((draft) => {
                const resume = draft.variants.find(
                  (item) => item.id === variant.id,
                );
                if (resume)
                  reorderVisible(
                    resume.profileSelection.order,
                    included.map(profileItemId),
                    source,
                    target,
                    profileItemId,
                  );
              })
            }
          >
            <div className="flex flex-col gap-3">
              {cards.map((card) => (
                <SortableRow
                  key={card.id}
                  id={card.id}
                  label={card.label}
                  surface="standard"
                  className="flex flex-col gap-3 rounded-lg border py-3"
                >
                  {({ dragHandle, orderButtons }) => (
                    <SortableItemLayout dragHandle={dragHandle}>
                      <div className="flex items-start gap-2">
                        <ContactChoice
                          label={card.label}
                          value={card.value}
                          icon={card.icon}
                          checked={card.checked}
                          onChange={(included) =>
                            update((draft) => {
                              const resume = draft.variants.find(
                                (item) => item.id === variant.id,
                              );
                              if (!resume) return;
                              if (card.item.kind === "field")
                                resume.profileSelection[card.item.field] =
                                  included;
                              else {
                                const linkId = card.item.linkId;
                                const remaining =
                                  resume.profileSelection.hiddenLinkIds.filter(
                                    (id) => id !== linkId,
                                  );
                                resume.profileSelection.hiddenLinkIds = included
                                  ? remaining
                                  : [...remaining, linkId];
                              }
                            })
                          }
                        />
                        <div className="flex h-7 shrink-0 items-center gap-2">
                          {orderButtons}
                        </div>
                      </div>
                    </SortableItemLayout>
                  )}
                </SortableRow>
              ))}
            </div>
          </SortableList>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function ContactChoice({
  label,
  value,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  value: string;
  checked: boolean;
  onChange: (included: boolean) => void;
}) {
  const id = useId();
  return (
    <Field className="min-w-0 flex-1">
      <FieldContent className="min-w-0">
        <div className="flex items-start gap-2">
          <FieldLabel
            htmlFor={id}
            className="min-w-0 flex-1 py-1 wrap-anywhere"
          >
            {icon}
            {label}
          </FieldLabel>
          <div className="flex h-7 shrink-0 items-center gap-2">
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={onChange}
              aria-describedby={`${id}-value`}
            />
          </div>
        </div>
        <FieldDescription id={`${id}-value`} className="wrap-anywhere">
          {value || "Not provided"}
        </FieldDescription>
      </FieldContent>
    </Field>
  );
}
