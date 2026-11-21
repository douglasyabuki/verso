import {
  FileText,
  Languages,
  type LucideIcon,
  Save,
  Shuffle,
} from "lucide-react";

/** One product capability shown on the welcome page. Claims must match README.md. */
export type WelcomeFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/** Capabilities in presentation order. */
export const welcomeFeatures: WelcomeFeature[] = [
  {
    icon: Shuffle,
    title: "Write once, tailor every resume",
    description:
      "Keep experience, achievements, and links in one career record. Each resume picks its own content, order, wording, and layout without changing the others.",
  },
  {
    icon: Languages,
    title: "English and Brazilian Portuguese",
    description:
      "Each resume has one content language. PDF output is verified for English and Brazilian Portuguese.",
  },
  {
    icon: Save,
    title: "Nothing changes until you Save",
    description:
      "Explicit Save and Cancel, workspace Undo and Redo, and separate recovery for unsaved drafts.",
  },
  {
    icon: FileText,
    title: "PDFs built in your browser",
    description:
      "A bundled LaTeX compiler generates, previews, and downloads PDFs on your device. Unsaved text never enters a PDF.",
  },
];
