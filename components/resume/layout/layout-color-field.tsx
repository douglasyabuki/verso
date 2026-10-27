import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  bodyColors,
  headingColors,
  pdfColorPresets,
  type TemplateSettings,
} from "@/types-and-constants/output";

export function LayoutColorField({
  setting,
  value,
  explicit,
  id,
  disabled,
  source,
  change,
  reset,
}: {
  setting: "headingColor" | "bodyColor";
  value: TemplateSettings["headingColor"] | TemplateSettings["bodyColor"];
  explicit: boolean;
  id: string;
  disabled: boolean;
  source: string;
  change: (value: string) => void;
  reset?: () => void;
}) {
  const presets = setting === "headingColor" ? headingColors : bodyColors;
  return (
    <Field data-disabled={disabled}>
      <div className="flex items-center justify-between gap-2">
        <FieldTitle id={id}>
          {setting === "headingColor" ? "Headings & links" : "Body text"}
        </FieldTitle>
        {reset && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={reset}
          >
            Use default
          </Button>
        )}
      </div>
      <ToggleGroup
        multiple={false}
        variant="outline"
        size="sm"
        className="w-full flex-wrap justify-start"
        aria-labelledby={id}
        aria-describedby={`${id}-description`}
        data-issue-field={`settings.${setting}`}
        value={explicit ? [value] : []}
        disabled={disabled}
        onValueChange={(selection) => {
          const next = selection[0];
          if (next && !disabled && presets.some((preset) => preset === next))
            change(next);
        }}
      >
        {presets.map((preset) => (
          <ToggleGroupItem key={preset} value={preset}>
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full border border-current"
              style={{
                backgroundColor: pdfColorPresets[preset].hex ?? undefined,
              }}
            />
            {pdfColorPresets[preset].label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FieldDescription id={`${id}-description`}>
        {pdfColorPresets[value].label} · {source}
      </FieldDescription>
    </Field>
  );
}
