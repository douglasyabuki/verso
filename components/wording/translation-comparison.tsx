"use client";

import { CheckCheck } from "lucide-react";
import { useState } from "react";

import { TranslationFeedbackBadge } from "@/components/shared/semantic-badges/translation-feedback-badge";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { TranslationReference } from "@/components/wording/translation-reference";
import type { Locale } from "@/types-and-constants/languages";
import { locales } from "@/types-and-constants/languages";
import type { ReviewSnapshot } from "@/types-and-constants/resume";

type ComparisonVersion = ReviewSnapshot & { source?: "shared" | "override" };
type ComparisonReview = Record<
  Locale,
  { needsReview: boolean; reviewedCounterpart: ComparisonVersion | null }
>;

/** Identify only comparison metadata so undo or another confirmation invalidates stale success feedback.
 * @param review Both language review records.
 * @returns Stable identity independent of unrelated wording properties.
 * @example comparisonIdentity(value)
 */
function comparisonIdentity(review: ComparisonReview): string {
  return JSON.stringify(
    locales.map((locale) => [
      review[locale].needsReview,
      review[locale].reviewedCounterpart,
    ]),
  );
}

export function TranslationComparison({
  target,
  reference,
  snapshot,
  needsReview,
  owner,
  onConfirm,
  review,
}: {
  target: ComparisonVersion;
  reference: ComparisonVersion;
  snapshot: ComparisonVersion | null;
  needsReview: boolean;
  owner: string;
  onConfirm: () => boolean;
  review: ComparisonReview;
}) {
  const [feedback, setFeedback] = useState({
    version: "",
    accepted: false,
  });
  const version = JSON.stringify([target, reference, owner]);
  const identity = `${version}:${comparisonIdentity(review)}`;
  const populated = target.spans.some((span) => span.text.trim());
  const pairPopulated =
    populated && reference.spans.some((span) => span.text.trim());
  const confirm = () => {
    const accepted = onConfirm();
    const checked = {
      ...review,
      [target.locale]: { needsReview: false, reviewedCounterpart: reference },
      [reference.locale]: {
        needsReview: false,
        reviewedCounterpart: target,
      },
    };
    setFeedback({
      accepted,
      version: accepted
        ? `${version}:${comparisonIdentity(checked)}`
        : identity,
    });
  };
  return (
    <div className="flex flex-col gap-3">
      <TranslationReference
        snapshot={snapshot}
        current={reference}
        target={target}
        needsReview={needsReview}
      />
      <div className="flex flex-wrap items-center gap-2">
        {pairPopulated && (
          <Button
            size="sm"
            className="h-auto self-start whitespace-normal"
            onClick={confirm}
          >
            <CheckCheck data-icon="inline-start" />
            Confirm both languages mean the same
          </Button>
        )}
        {pairPopulated && (
          <InfoHint label="translation confirmation">
            {`Confirm that English and Portuguese convey the same information. This clears translation reminders for ${owner} without changing the text. Reviews for other resumes and shared text changes stay separate. You can still download a resume with review reminders.`}
          </InfoHint>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {feedback.version === identity && (
          <TranslationFeedbackBadge
            state={feedback.accepted ? "accepted" : "rejected"}
            owner={owner}
          />
        )}
      </p>
    </div>
  );
}
