import { cn } from "cn";
import * as React from "react";

type TextareaProps = React.ComponentProps<"textarea"> & {
  appearance?: "content" | "utility";
};

function Textarea({
  className,
  appearance = "content",
  placeholder,
  ...props
}: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-appearance={appearance}
      data-empty={
        props.value == null ? undefined : String(props.value).length === 0
      }
      placeholder={placeholder ?? " "}
      className={cn(
        "form-control flex field-sizing-content min-h-16 w-full rounded-lg px-2.5 py-2 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
