"use client";

import { Check, CheckCheck, CircleAlert } from "lucide-react";
import { useState } from "react";

import { TranslationReference } from "@/components/resume/translation-reference";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import type { Locale, ReviewSnapshot } from "@/types-and-constants/resume";
import { locales } from "@/types-and-constants/resume";

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
    message: "",
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
      message: accepted
        ? `Both languages confirmed for ${owner}.`
        : "Wording changed or confirmation is unavailable. Check the current pair and try again.",
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
            Confirm English and Portuguese match
          </Button>
        )}
        {pairPopulated && (
          <InfoHint label="translation confirmation">
            {`Confirmation records this comparison without changing text and clears both translation reminders for ${owner}. Other owners and library-change reminders are unaffected. Review reminders do not block valid downloads.`}
          </InfoHint>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {feedback.version === identity && feedback.message && (
          <Badge
            variant={feedback.accepted ? "success" : "destructive"}
            className="h-auto whitespace-normal"
          >
            {feedback.accepted ? (
              <Check data-icon="inline-start" />
            ) : (
              <CircleAlert data-icon="inline-start" />
            )}
            {feedback.message}
          </Badge>
        )}
      </p>
    </div>
  );
}
