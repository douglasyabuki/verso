import type { Locale } from "@/types-and-constants/languages";
import type { ResumeDocument, Variant } from "@/types-and-constants/resume";
import type { WorkspaceEdit } from "@/types-and-constants/workspace";

export type ConfirmAction = (
  title: string,
  description: string,
  action: () => void,
  returnFocus?: HTMLElement | null,
  destructive?: boolean,
) => void;

export type Confirmation = {
  title: string;
  description: string;
  action: () => void;
  returnFocus?: HTMLElement | null;
  destructive?: boolean;
};

export type EditorProps = {
  document: ResumeDocument;
  locale: Locale;
  variant: Variant;
  update: WorkspaceEdit;
  confirm: ConfirmAction;
};
