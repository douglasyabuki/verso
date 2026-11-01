"use client";

import { Plus, Trash2 } from "lucide-react";

import { LinkFields } from "@/components/content/link-fields";
import { InternalNameEditor } from "@/components/editor/internal-name-editor";
import { SortableItemLayout } from "@/components/editor/sortable-item-layout";
import { SortableList, SortableRow } from "@/components/editor/sortable-list";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { linkLabel } from "@/lib/content/links";
import { reorderVisible } from "@/lib/ordering";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type { ResumeDocument, ResumeLink } from "@/types-and-constants/resume";
import type { EditGroup } from "@/types-and-constants/workspace";

export function LinksEditor({
  links,
  title,
  document,
  scope,
  onChange,
  confirm,
}: {
  links: ResumeLink[];
  title: string;
  document: ResumeDocument;
  scope: string;
  onChange: (links: ResumeLink[], group?: EditGroup) => void;
  confirm: ConfirmAction;
}) {
  return (
    <FieldSet>
      <FieldLegend className="w-full">
        <span className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            disabled={links.length >= 30}
            onClick={() =>
              onChange([
                ...links,
                {
                  id: crypto.randomUUID(),
                  label: "",
                  url: "",
                  type: "website",
                },
              ])
            }
          >
            <Plus data-icon="inline-start" />
            Add link
          </Button>
        </span>
      </FieldLegend>
      <SortableList
        scope={scope}
        revision={document}
        items={links.map((link, index) => ({
          id: link.id,
          label: linkLabel(link, index),
        }))}
        onReorder={(source, target) => {
          const reordered = [...links];
          reorderVisible(
            reordered,
            links.map((link) => link.id),
            source,
            target,
            (link) => link.id,
          );
          onChange(reordered);
        }}
      >
        <div className="flex flex-col gap-3">
          {links.map((link, index) => (
            <SortableRow
              key={link.id}
              id={link.id}
              label={linkLabel(link, index)}
              surface="standard"
              className="flex flex-col gap-3 rounded-lg border py-3"
            >
              {({ dragHandle, orderButtons }) => (
                <SortableItemLayout dragHandle={dragHandle}>
                  <FieldGroup className="gap-3">
                    <InternalNameEditor
                      fieldKey={`${scope}.${link.id}.internalName`}
                      value={link.internalName}
                      label={linkLabel(link, index)}
                      onChange={(internalName, group) =>
                        onChange(
                          links.map((item) =>
                            item.id === link.id
                              ? { ...item, internalName }
                              : item,
                          ),
                          group,
                        )
                      }
                      actions={
                        <div className="flex shrink-0 gap-1">
                          {orderButtons}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${linkLabel(link, index)}`}
                            onClick={() =>
                              confirm(
                                "Remove this link?",
                                "This removes the shared link from every draft that uses it.",
                                () =>
                                  onChange(
                                    links.filter((item) => item.id !== link.id),
                                  ),
                                undefined,
                                false,
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      }
                    >
                      <h3 className="min-w-0 flex-1 text-xs font-medium wrap-anywhere text-muted-foreground">
                        {linkLabel(link, index)}
                      </h3>
                    </InternalNameEditor>
                    <LinkFields
                      link={link}
                      onChange={(next, group) =>
                        onChange(
                          links.map((item) =>
                            item.id === link.id ? next : item,
                          ),
                          group,
                        )
                      }
                    />
                  </FieldGroup>
                </SortableItemLayout>
              )}
            </SortableRow>
          ))}
        </div>
      </SortableList>
    </FieldSet>
  );
}
