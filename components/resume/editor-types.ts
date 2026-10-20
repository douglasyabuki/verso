import type { ConfirmAction } from "@/components/resume/fields";
import type {
  DocumentUpdate,
  Locale,
  ResumeDocument,
  Variant,
} from "@/lib/resume/model";

export type EditorProps = {
  document: ResumeDocument;
  locale: Locale;
  variant: Variant;
  update: (change: DocumentUpdate) => void;
  confirm: ConfirmAction;
};
