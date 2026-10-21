import type { ConfirmAction } from "@/components/resume/fields";
import type { Locale, ResumeDocument, Variant } from "@/lib/resume/model";
import type { WorkspaceEdit } from "@/lib/workspace/controller";

export type EditorProps = {
  document: ResumeDocument;
  locale: Locale;
  variant: Variant;
  update: WorkspaceEdit;
  confirm: ConfirmAction;
};
