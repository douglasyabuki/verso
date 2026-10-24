import type { ReactNode } from "react";

import { equivalentSpans } from "@/lib/resume/spans";
import type { ReviewSnapshot } from "@/types-and-constants/resume";
import { languageNames } from "@/types-and-constants/resume";

function ReferenceWording({
  title,
  version,
}: {
  title: string;
  version: ReviewSnapshot & { source?: "shared" | "override" };
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm font-medium">
        {title} · {languageNames[version.locale]}
      </p>
      {version.source && (
        <p className="text-xs text-muted-foreground">
          {version.source === "override"
            ? "Customized for this resume"
            : "Career library wording"}
        </p>
      )}
      <p
        lang={version.locale}
        className="text-sm wrap-anywhere whitespace-pre-wrap"
      >
        {version.spans.some((span) => span.text) ? (
          version.spans.map((span, index) => {
            let text: ReactNode = span.text;
            if (span.emphasis) text = <em>{text}</em>;
            return (
              <span key={index}>
                {text}
                {span.href && (
                  <span className="text-muted-foreground"> ({span.href})</span>
                )}
              </span>
            );
          })
        ) : (
          <span className="text-muted-foreground">Empty wording</span>
        )}
      </p>
    </div>
  );
}

export function TranslationReference({
  snapshot,
  current,
  target,
  needsReview,
}: {
  snapshot: (ReviewSnapshot & { source?: "shared" | "override" }) | null;
  current: ReviewSnapshot & { source?: "shared" | "override" };
  target: ReviewSnapshot & { source?: "shared" | "override" };
  needsReview: boolean;
}) {
  const changed =
    snapshot &&
    (snapshot.locale !== current.locale ||
      (!!snapshot.source &&
        !!current.source &&
        snapshot.source !== current.source) ||
      !equivalentSpans(snapshot.spans, current.spans));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {needsReview
          ? changed
            ? `${languageNames[current.locale]} changed since the recorded comparison. Check whether ${languageNames[target.locale]} still conveys the same information.`
            : `Check whether ${languageNames[target.locale]} conveys the same information as ${languageNames[current.locale]}. This wording is flagged for comparison.`
          : "No translation changes flagged. This does not mean the current wording has been explicitly checked."}
      </p>
      {snapshot && (
        <p className="text-sm text-muted-foreground">
          Previous comparison recorded. It is a historical reference, not
          approval of later edits.
        </p>
      )}
      {!snapshot && (
        <p className="text-sm text-muted-foreground">
          No previous comparison recorded. New or imported wording may not have
          a comparison history.
        </p>
      )}
      <div className="grid gap-4 @2xl:grid-cols-2">
        <ReferenceWording title="Current wording" version={target} />
        <ReferenceWording title="Compare with" version={current} />
        {snapshot && (
          <ReferenceWording
            title="Reference at previous comparison"
            version={snapshot}
          />
        )}
      </div>
    </div>
  );
}
