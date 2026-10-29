"use client";

import { Plus, Trash2 } from "lucide-react";

import { TextField } from "@/components/editor/fields";
import { SortableItemLayout } from "@/components/editor/sortable-item-layout";
import { SortableList, SortableRow } from "@/components/editor/sortable-list";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { reorderVisible } from "@/lib/ordering";
import { urlError } from "@/lib/review/validation";
import type { ConfirmAction } from "@/types-and-constants/editor";
import type { ResumeDocument, ResumeLink } from "@/types-and-constants/resume";
import type { EditGroup } from "@/types-and-constants/workspace";

export function LinksEditor({
  links,
  document,
  scope,
  onChange,
  confirm,
}: {
  links: ResumeLink[];
  document: ResumeDocument;
  scope: string;
  onChange: (links: ResumeLink[], group?: EditGroup) => void;
  confirm: ConfirmAction;
}) {
  return (
    <FieldGroup className="gap-4">
      <SortableList
        scope={scope}
        revision={document}
        items={links.map((link, index) => ({
          id: link.id,
          label: link.label.trim() || `link ${index + 1}`,
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
              label={link.label.trim() || `link ${index + 1}`}
              className="list-item-surface flex flex-col gap-3 rounded-lg border py-3"
            >
              {({ dragHandle, orderButtons }) => (
                <SortableItemLayout dragHandle={dragHandle}>
                  <FieldGroup className="gap-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                        LINK {index + 1}
                      </span>
                      <div className="flex gap-1">
                        {orderButtons}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove link ${index + 1}`}
                          onClick={() =>
                            confirm(
                              "Remove this link?",
                              "This removes the shared link from every draft that uses it.",
                              () =>
                                onChange(
                                  links.filter((item) => item.id !== link.id),
                                ),
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <TextField
                      fieldKey={`links.${link.id}.label`}
                      label="Link label"
                      value={link.label}
                      maxLength={200}
                      onChange={(label, group) =>
                        onChange(
                          links.map((item) =>
                            item.id === link.id ? { ...item, label } : item,
                          ),
                          group,
                        )
                      }
                      placeholder="My website"
                    />
                    <TextField
                      fieldKey={`links.${link.id}.url`}
                      label="Link address"
                      value={link.url}
                      maxLength={2_000}
                      onChange={(url, group) =>
                        onChange(
                          links.map((item) =>
                            item.id === link.id ? { ...item, url } : item,
                          ),
                          group,
                        )
                      }
                      error={urlError(link.url)}
                      placeholder="https://example.com"
                    />
                  </FieldGroup>
                </SortableItemLayout>
              )}
            </SortableRow>
          ))}
        </div>
      </SortableList>
      <Button
        variant="outline"
        size="sm"
        disabled={links.length >= 30}
        onClick={() =>
          onChange([...links, { id: crypto.randomUUID(), label: "", url: "" }])
        }
      >
        <Plus data-icon="inline-start" />
        Add link
      </Button>
    </FieldGroup>
  );
}
