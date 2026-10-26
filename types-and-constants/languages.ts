export const locales = ["en-US", "pt-BR"] as const;

export type Locale = (typeof locales)[number];

export const supportedLanguages = {
  "en-US": {
    name: "English",
    flags: {
      "1x1": "/flags/1x1/us.svg",
      "4x3": "/flags/4x3/us.svg",
    },
  },
  "pt-BR": {
    name: "Portuguese",
    flags: {
      "1x1": "/flags/1x1/br.svg",
      "4x3": "/flags/4x3/br.svg",
    },
  },
} as const satisfies Record<
  Locale,
  { name: string; flags: Record<"1x1" | "4x3", string> }
>;

export const languageNames = {
  "en-US": supportedLanguages["en-US"].name,
  "pt-BR": supportedLanguages["pt-BR"].name,
} as const;
