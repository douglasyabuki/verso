"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EditorProps } from "@/types-and-constants/editor";
import type { Section } from "@/types-and-constants/resume";
import {
  sectionIconIds,
  sectionIconLabels,
} from "@/types-and-constants/sections";

export function CareerSectionIconPicker({
  section,
  update,
  disabled,
}: {
  section: Section;
  update: EditorProps["update"];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftIcon, setDraftIcon] = useState(section.icon);

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setDraftIcon(section.icon);
        setOpen(nextOpen);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          disabled={open}
          render={
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon" disabled={disabled} />
              }
              aria-label="Change section icon"
              className="size-8 border-0 p-0"
            />
          }
        >
          <CareerSectionIcon
            kind={section.kind}
            icon={section.icon}
            className="size-8"
          />
        </TooltipTrigger>
        <TooltipContent>
          <Pencil aria-hidden="true" className="size-3" />
          Change section icon
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        className="max-h-(--available-height) max-w-(--available-width) overflow-y-auto"
      >
        <PopoverHeader>
          <PopoverTitle className="text-sm">Section icon</PopoverTitle>
          <PopoverDescription>
            Choose an icon for this section across Career details and your
            resumes.
          </PopoverDescription>
        </PopoverHeader>
        <ToggleGroup
          multiple={false}
          value={[draftIcon]}
          onValueChange={(values) => {
            const next = sectionIconIds.find((icon) => icon === values[0]);
            if (next) setDraftIcon(next);
          }}
          variant="outline"
          size="lg"
          className="grid w-full grid-cols-5"
          aria-label="Section icon"
          disabled={disabled}
        >
          {sectionIconIds.map((icon) => (
            <ToggleGroupItem
              key={icon}
              value={icon}
              aria-label={sectionIconLabels[icon]}
            >
              <CareerSectionIcon kind="custom" icon={icon} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {sectionIconLabels[draftIcon]}
        </p>
        <Separator />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={disabled || draftIcon === section.icon}
            onClick={() => {
              if (disabled) return;
              update((draft) => {
                const target = draft.sections.find(
                  (item) => item.id === section.id,
                );
                if (target?.kind === "custom") target.icon = draftIcon;
              });
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
