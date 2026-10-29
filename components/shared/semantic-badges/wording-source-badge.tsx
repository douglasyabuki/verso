import { Library, Pencil } from "lucide-react";

import {
  type BadgeAppearance,
  SemanticBadge,
} from "@/components/shared/semantic-badges/semantic-badge";

const wordingSources = {
  shared: {
    label: "Shared text",
    icon: Library,
    variant: "outline",
    description:
      "Changes here update every resume that uses this text. Custom text stays specific to one resume and language.",
  },
  inherited: {
    label: "Uses shared text",
    icon: Library,
    variant: "outline",
    description:
      "This resume uses the shared text for this language. Edit it in Career details, or customize it for this resume.",
  },
  custom: {
    label: "Custom text for this resume",
    icon: Pencil,
    variant: "secondary",
    description:
      "Edits affect only this resume and language. The shared text stays unchanged.",
  },
} satisfies Record<string, BadgeAppearance & { description: string }>;

type WordingSourceProps = { source: keyof typeof wordingSources };

export function WordingSourceBadge({
  source,
  className,
}: WordingSourceProps & { className?: string }) {
  return (
    <SemanticBadge appearance={wordingSources[source]} className={className} />
  );
}

export function WordingSourceText({ source }: WordingSourceProps) {
  return wordingSources[source].label;
}
