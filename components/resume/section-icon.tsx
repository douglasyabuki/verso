import {
  Award,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Code2,
  FileText,
  FlaskConical,
  FolderKanban,
  Globe,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Landmark,
  Languages,
  Lightbulb,
  type LucideIcon,
  MicVocal,
  Newspaper,
  Palette,
  Presentation,
  Rocket,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";

import type { Section } from "@/types-and-constants/resume";
import { defaultSectionIcons } from "@/types-and-constants/sections";

const sectionIcons = {
  "user-round": UserRound,
  "file-text": FileText,
  "briefcase-business": BriefcaseBusiness,
  "folder-kanban": FolderKanban,
  "graduation-cap": GraduationCap,
  "code-2": Code2,
  award: Award,
  "heart-handshake": HeartHandshake,
  languages: Languages,
  "mic-vocal": MicVocal,
  presentation: Presentation,
  "flask-conical": FlaskConical,
  landmark: Landmark,
  trophy: Trophy,
  newspaper: Newspaper,
  palette: Palette,
  wrench: Wrench,
  "users-round": UsersRound,
  handshake: Handshake,
  globe: Globe,
  lightbulb: Lightbulb,
  rocket: Rocket,
  target: Target,
  "badge-check": BadgeCheck,
  "book-open": BookOpen,
} satisfies Record<Section["icon"], LucideIcon>;

export function SectionIcon({
  kind,
  icon,
  ...props
}: {
  kind: Section["kind"] | "profile" | "summary";
  icon?: Section["icon"];
  className?: string;
  "data-icon"?: "inline-start";
}) {
  const Icon = sectionIcons[icon ?? defaultSectionIcons[kind]];

  return <Icon aria-hidden="true" {...props} />;
}
