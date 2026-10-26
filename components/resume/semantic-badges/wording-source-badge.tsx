import { Library, Pencil } from "lucide-react";

import {
  type BadgeAppearance,
  SemanticBadge,
} from "@/components/resume/semantic-badges/semantic-badge";

const wordingSources = {
  library: {
    label: "Library text",
    icon: Library,
    variant: "outline",
    description:
      "Editing this language updates every resume that uses this library text.",
  },
  inherited: {
    label: "Uses library text",
    icon: Library,
    variant: "outline",
    description:
      "This resume uses the library text for this language. Edit it in the career library, or customize it for this resume.",
  },
  custom: {
    label: "Custom text for this resume",
    icon: Pencil,
    variant: "secondary",
    description:
      "Edits affect only this resume and language. The library text stays unchanged.",
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
