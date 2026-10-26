import { SemanticBadge } from "@/components/resume/semantic-badges/semantic-badge";

export function TemplateIdentityBadge({
  id,
  version,
  className,
}: { className?: string } & { id: string; version: string }) {
  return (
    <SemanticBadge
      appearance={{ label: `${id}@${version}`, variant: "outline" }}
      className={className}
    />
  );
}
