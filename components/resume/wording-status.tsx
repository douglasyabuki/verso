import { CircleAlert, Languages, Library, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function WordingStatus({
  missing = false,
  review = false,
  library = false,
}: {
  missing?: boolean;
  review?: boolean;
  library?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {missing && (
        <Badge variant="attention">
          <CircleAlert data-icon="inline-start" />
          Missing text
        </Badge>
      )}
      {review && (
        <Badge variant="attention">
          <Languages data-icon="inline-start" />
          Needs comparison
        </Badge>
      )}
      {library && (
        <Badge variant="attention">
          <Library data-icon="inline-start" />
          Library changed
        </Badge>
      )}
      {!missing && !review && !library && (
        <Badge variant="outline">
          <Minus data-icon="inline-start" />
          No review flagged
        </Badge>
      )}
    </span>
  );
}
