import { cn } from "cn";

import { ReviewStatusBadge } from "@/components/shared/semantic-badges/review-status-badge";

export function WordingStatus({
  missing = false,
  review = false,
  sharedReview = false,
  showHelp = true,
  stacked = false,
}: {
  missing?: boolean;
  review?: boolean;
  sharedReview?: boolean;
  showHelp?: boolean;
  stacked?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex gap-1.5",
        stacked ? "flex-col items-start" : "flex-wrap items-center",
      )}
    >
      {missing && <ReviewStatusBadge state="missing" />}
      {review && <ReviewStatusBadge state="translation" />}
      {sharedReview && <ReviewStatusBadge state="shared-wording" />}
      {!missing && !review && !sharedReview && (
        <ReviewStatusBadge state="unflagged" showHelp={showHelp} />
      )}
    </span>
  );
}
