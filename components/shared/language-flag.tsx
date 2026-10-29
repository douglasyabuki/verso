import { cva, type VariantProps } from "class-variance-authority";
import Image from "next/image";

import type { Locale } from "@/types-and-constants/languages";
import { supportedLanguages } from "@/types-and-constants/languages";

const languageFlagVariants = cva("shrink-0 ring-1 ring-foreground/10", {
  variants: {
    ratio: {
      "1x1": "size-5",
      "4x3": "h-3.75 w-5",
    },
    rounded: {
      true: "rounded-full",
      false: "",
    },
  },
  defaultVariants: {
    ratio: "4x3",
    rounded: false,
  },
});

export function LanguageFlag({
  locale,
  ratio,
  rounded,
  className,
}: {
  locale: Locale;
  className?: string;
} & VariantProps<typeof languageFlagVariants>) {
  const flagRatio = ratio ?? "4x3";

  return (
    <Image
      src={supportedLanguages[locale].flags[flagRatio]}
      alt=""
      aria-hidden="true"
      data-icon="inline-start"
      width={20}
      height={flagRatio === "1x1" ? 20 : 15}
      unoptimized
      className={languageFlagVariants({ ratio: flagRatio, rounded, className })}
    />
  );
}
