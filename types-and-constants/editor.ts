import type { Locale } from "@/types-and-constants/languages";
import type { ResumeDocument, Variant } from "@/types-and-constants/resume";
import type { WorkspaceEdit } from "@/types-and-constants/workspace";

export type ConfirmAction = (
  title: string,
  description: string,
  action: () => void,
  returnFocus?: HTMLElement | null,
) => void;

export type Confirmation = {
  title: string;
  description: string;
  action: () => void;
  returnFocus?: HTMLElement | null;
};

export type EditorProps = {
  document: ResumeDocument;
  locale: Locale;
  variant: Variant;
  update: WorkspaceEdit;
  confirm: ConfirmAction;
};
