"use client";

import { CareerSectionIcon } from "@/components/content/career-section-icon";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type SectionIconId,
  sectionIconIds,
  sectionIconLabels,
} from "@/types-and-constants/section-icons";

/** Choose a custom section icon within its owning properties draft; form Save commits it. */
export function CareerSectionIconPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: SectionIconId;
  onChange: (icon: SectionIconId) => void;
  disabled?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="section-icon">Section icon</FieldLabel>
      <Popover>
        <PopoverTrigger
          id="section-icon"
          aria-label="Choose section icon"
          disabled={disabled}
          render={<Button variant="outline" />}
        >
          <CareerSectionIcon
            kind="custom"
            icon={value}
            data-icon="inline-start"
          />
          {sectionIconLabels[value]}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-(--available-height) max-w-(--available-width) overflow-y-auto"
        >
          <PopoverHeader>
            <PopoverTitle>Section icon</PopoverTitle>
            <PopoverDescription>
              Choose an icon shared across Career details and your resumes. Save
              section properties to apply it.
            </PopoverDescription>
          </PopoverHeader>
          <ToggleGroup
            multiple={false}
            value={[value]}
            onValueChange={(values) => {
              const icon = sectionIconIds.find((id) => id === values[0]);
              if (icon && !disabled) onChange(icon);
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
            {sectionIconLabels[value]}
          </p>
        </PopoverContent>
      </Popover>
      <FieldDescription>
        App icon only; does not change PDF appearance.
      </FieldDescription>
    </Field>
  );
}
