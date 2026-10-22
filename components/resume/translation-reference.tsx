import type { ReactNode } from "react";

import { equivalentSpans } from "@/lib/resume/spans";
import type { ReviewSnapshot } from "@/types-and-constants/resume";

function ReferenceWording({
  title,
  version,
}: {
  title: string;
  version: ReviewSnapshot;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm font-medium">
        {title} · {version.locale === "en-US" ? "English" : "Português"}
      </p>
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
}: {
  snapshot: ReviewSnapshot | null;
  current: ReviewSnapshot;
}) {
  const changed =
    snapshot &&
    (snapshot.locale !== current.locale ||
      !equivalentSpans(snapshot.spans, current.spans));
  return (
    <div className="flex flex-col gap-3">
      {!snapshot && (
        <p className="text-sm text-muted-foreground">
          No historical comparison available
        </p>
      )}
      <div className="grid gap-4 @2xl:grid-cols-2">
        {changed && (
          <ReferenceWording
            title="Counterpart at last review"
            version={snapshot}
          />
        )}
        <ReferenceWording title="Current counterpart" version={current} />
      </div>
    </div>
  );
}
