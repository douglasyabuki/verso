import { ReviewStatusBadge } from "@/components/shared/semantic-badges/review-status-badge";

export function WordingStatus({
  missing = false,
  review = false,
  sharedReview = false,
  showHelp = true,
}: {
  missing?: boolean;
  review?: boolean;
  sharedReview?: boolean;
  showHelp?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {missing && <ReviewStatusBadge state="missing" />}
      {review && <ReviewStatusBadge state="translation" />}
      {sharedReview && <ReviewStatusBadge state="shared-wording" />}
      {!missing && !review && !sharedReview && (
        <ReviewStatusBadge state="unflagged" showHelp={showHelp} />
      )}
    </span>
  );
}
