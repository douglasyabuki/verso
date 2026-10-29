"use client";

import { useId } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type ResumeColor, resumeColors } from "@/types-and-constants/resume";

export function ResumeColorPicker({
  value,
  onChange,
}: {
  value: ResumeColor;
  onChange: (color: ResumeColor) => void;
}) {
  const labelId = useId();

  return (
    <Field>
      <FieldLabel id={labelId}>Color</FieldLabel>
      <ToggleGroup
        multiple={false}
        aria-labelledby={labelId}
        value={[value]}
        onValueChange={(values) => {
          const color = resumeColors.find((item) => item === values[0]);
          if (color) onChange(color);
        }}
      >
        {resumeColors.map((color) => (
          <ToggleGroupItem
            key={color}
            value={color}
            aria-label={color}
            title={color}
          >
            <span
              className="resume-color size-4 rounded-full bg-(--resume-color)"
              data-resume-color={color}
            />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}
