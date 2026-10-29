import { FileText } from "lucide-react";

import type { ResumeColor } from "@/types-and-constants/resume";

export function ResumeIcon({ color }: { color: ResumeColor }) {
  return (
    <FileText
      aria-hidden="true"
      className="resume-color text-(--resume-color)"
      data-resume-color={color}
    />
  );
}
