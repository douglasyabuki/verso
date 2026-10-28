import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";
import * as React from "react";

type InputProps = React.ComponentProps<"input"> & {
  appearance?: "content" | "utility";
};

function Input({
  className,
  type,
  appearance = "content",
  placeholder,
  ...props
}: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-appearance={appearance}
      data-empty={
        props.value == null ? undefined : String(props.value).length === 0
      }
      placeholder={placeholder ?? " "}
      className={cn(
        "form-control h-8 w-full min-w-0 rounded-lg px-2.5 py-1 text-sm file:inline-flex file:h-6 file:border-0 file:bg-card file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
