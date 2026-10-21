import type {
  Locale,
  ResumeDocument,
  Section,
  Variant,
} from "@/types-and-constants/resume";
import type { WorkspaceEdit } from "@/types-and-constants/workspace";

export const librarySectionLabels: Record<Section["kind"], string> = {
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  custom: "Custom section",
};

export type ConfirmAction = (
  title: string,
  description: string,
  action: () => void,
) => void;

export type Confirmation = {
  title: string;
  description: string;
  action: () => void;
};

export type EditorProps = {
  document: ResumeDocument;
  locale: Locale;
  variant: Variant;
  update: WorkspaceEdit;
  confirm: ConfirmAction;
};
