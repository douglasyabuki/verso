import {
  Award,
  BriefcaseBusiness,
  Code2,
  FileText,
  FolderKanban,
  GraduationCap,
  UserRound,
} from "lucide-react";

import type { Section } from "@/types-and-constants/resume";

const sectionIcons = {
  profile: UserRound,
  summary: FileText,
  experience: BriefcaseBusiness,
  projects: FolderKanban,
  education: GraduationCap,
  skills: Code2,
  certifications: Award,
  custom: FileText,
};

export function SectionIcon({
  kind,
  ...props
}: {
  kind: Section["kind"] | "profile" | "summary";
  "data-icon"?: "inline-start";
}) {
  const Icon = sectionIcons[kind];

  return <Icon aria-hidden="true" {...props} />;
}
