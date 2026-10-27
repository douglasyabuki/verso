import { layoutSettingIcons } from "@/components/resume/layout/layout-icon";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  pdfColorPresets,
  templateSettingLabels,
  type TemplateSettings,
  textColors,
} from "@/types-and-constants/output";

export function LayoutColorField({
  setting,
  value,
  id,
  disabled,
  source,
  change,
  reset,
}: {
  setting:
    | "headingColor"
    | "bodyColor"
    | "secondaryColor"
    | "linkColor"
    | "iconColor"
    | "dividerColor";
  value: TemplateSettings["headingColor"] | TemplateSettings["bodyColor"];
  explicit: boolean;
  id: string;
  disabled: boolean;
  source?: string;
  change: (value: string) => void;
  reset?: () => void;
}) {
  const presets = textColors;
  const Icon = layoutSettingIcons[setting];
  return (
    <Field data-disabled={disabled}>
      <div className="flex items-center justify-between gap-2">
        <FieldTitle id={id}>
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {templateSettingLabels[setting]}
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
        aria-describedby={source ? `${id}-description` : undefined}
        data-issue-field={`settings.${setting}`}
        value={[value]}
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
      {source && (
        <FieldDescription id={`${id}-description`}>{source}</FieldDescription>
      )}
    </Field>
  );
}
