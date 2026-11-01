import type { z } from "zod";

import type { documentSchema } from "@/lib/resume/model";
import type { Locale } from "@/types-and-constants/languages";

export const resumeColors = [
  "indigo",
  "emerald",
  "amber",
  "rose",
  "sky",
  "violet",
] as const;

export type ResumeDocument = z.infer<typeof documentSchema>;

export type ProfileSelection =
  ResumeDocument["variants"][number]["profileSelection"];

export const profileContactFields = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
] as const;

export const defaultProfileSelection: ProfileSelection = {
  email: true,
  phone: true,
  city: true,
  country: true,
  hiddenLinkIds: [],
};

export type Section = ResumeDocument["sections"][number];

export type Entry = Section["entries"][number];

export type CertificationDates = NonNullable<
  NonNullable<Entry["certification"]>["dates"]
>;

export type ResumeLink = ResumeDocument["profile"]["links"][number];

export type LocalizedText = ResumeDocument["profile"]["summary"];

export type ReviewSnapshot = NonNullable<
  LocalizedText[Locale]["reviewedCounterpart"]
>;

export type Span = LocalizedText[Locale]["spans"][number];

export type VariantWording = NonNullable<
  ResumeDocument["variants"][number]["wording"]["summary"]
>;

export type EffectiveSnapshot = NonNullable<
  VariantWording["review"][Locale]["reviewedCounterpart"]
>;

export type Variant = ResumeDocument["variants"][number];

export type ResumeColor = Variant["color"];

export type CareerTarget =
  | { kind: "profile" }
  | { kind: "summary" }
  | { kind: "section"; sectionId: string };

export type DocumentUpdate = (draft: ResumeDocument) => void;

export type LocalizedFieldDescriptor = {
  sharedReview?: Record<Locale, boolean>;
  path: string;
  label: string;
  source: string;
  sectionId: string;
  value: LocalizedText;
  multiline: boolean;
  required: boolean;
};
