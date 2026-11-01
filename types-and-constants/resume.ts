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

export type ProfileOrderItem = ProfileSelection["order"][number];

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
  order: [
    { kind: "field", field: "city" },
    { kind: "field", field: "country" },
    { kind: "field", field: "email" },
    { kind: "field", field: "phone" },
  ],
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

export const linkTypes = [
  "website",
  "behance",
  "dribbble",
  "github",
  "gitlab",
  "google-scholar",
  "instagram",
  "linkedin",
  "medium",
  "tiktok",
  "x-twitter",
  "youtube",
] as const;

export type LinkType = ResumeLink["type"];

export const linkTypeNames: Record<LinkType, string> = {
  website: "Website / other",
  behance: "Behance",
  dribbble: "Dribbble",
  github: "GitHub",
  gitlab: "GitLab",
  "google-scholar": "Google Scholar",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  medium: "Medium",
  tiktok: "TikTok",
  "x-twitter": "X (Twitter)",
  youtube: "YouTube",
};
