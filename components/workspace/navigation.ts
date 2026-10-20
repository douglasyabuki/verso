import { FolderOpen, Languages, Layers2, Settings2 } from "lucide-react";

export const views = [
  {
    id: "content",
    label: "Content",
    icon: FolderOpen,
    description: "Build your career library",
  },
  {
    id: "translations",
    label: "Translations",
    icon: Languages,
    description: "Two languages. One story.",
  },
  {
    id: "variants",
    label: "Variants",
    icon: Layers2,
    description: "Choose what matters for each resume",
  },
  {
    id: "template",
    label: "Template",
    icon: Settings2,
    description: "Give your story room to breathe",
  },
];
