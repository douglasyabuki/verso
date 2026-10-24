"use client";

import { useState } from "react";

import { TranslationReference } from "@/components/resume/translation-reference";
import { Button } from "@/components/ui/button";
import type { Locale, ReviewSnapshot } from "@/types-and-constants/resume";
import { languageNames, locales } from "@/types-and-constants/resume";

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
  onConfirm: (both: boolean) => boolean;
  review: ComparisonReview;
}) {
  const [feedback, setFeedback] = useState({ version: "", message: "" });
  const version = JSON.stringify([target, reference, owner]);
  const identity = `${version}:${comparisonIdentity(review)}`;
  const populated = target.spans.some((span) => span.text.trim());
  const pairPopulated =
    populated && reference.spans.some((span) => span.text.trim());
  const confirm = (both: boolean) => {
    const accepted = onConfirm(both);
    const checked = {
      ...review,
      [target.locale]: { needsReview: false, reviewedCounterpart: reference },
    };
    if (both)
      checked[reference.locale] = {
        needsReview: false,
        reviewedCounterpart: target,
      };
    setFeedback({
      version: accepted
        ? `${version}:${comparisonIdentity(checked)}`
        : identity,
      message: accepted
        ? both
          ? `English and Portuguese comparison recorded for ${owner}. Both translation reminders cleared. Wording is unchanged.`
          : `${languageNames[target.locale]} comparison with ${languageNames[reference.locale]} recorded for ${owner}. Only the ${languageNames[target.locale]} translation reminder was cleared. Wording is unchanged.`
        : "Wording or its source changed, or this action is unavailable. Check the current pair and confirm again.",
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
      <p className="text-sm text-muted-foreground">
        Confirmation applies to {owner}. It clears a translation reminder and
        records the displayed comparison; it does not change text or PDF
        appearance. Unchanged wording can be confirmed. Translation reminders do
        not block valid downloads.
      </p>
      {populated && (
        <Button
          variant="outline"
          size="sm"
          className="h-auto self-start whitespace-normal"
          onClick={() => confirm(false)}
        >
          Confirm {languageNames[target.locale]} matches{" "}
          {languageNames[reference.locale]}
        </Button>
      )}
      {pairPopulated && (
        <>
          <p className="text-sm text-muted-foreground">
            Checked both languages? Confirm the pair to clear both translation
            reminders for this wording and owner. Other resumes and
            library-change reminders are unaffected.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-auto self-start whitespace-normal"
            onClick={() => confirm(true)}
          >
            Confirm English and Portuguese match
          </Button>
        </>
      )}
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {feedback.version === identity ? feedback.message : ""}
      </p>
    </div>
  );
}
