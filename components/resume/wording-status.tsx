import { ReviewStatusBadge } from "@/components/resume/semantic-badges/review-status-badge";

export function WordingStatus({
  missing = false,
  review = false,
  library = false,
  showHelp = true,
}: {
  missing?: boolean;
  review?: boolean;
  library?: boolean;
  showHelp?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {missing && <ReviewStatusBadge state="missing" />}
      {review && <ReviewStatusBadge state="translation" />}
      {library && <ReviewStatusBadge state="library" />}
      {!missing && !review && !library && (
        <ReviewStatusBadge state="unflagged" showHelp={showHelp} />
      )}
    </span>
  );
}
