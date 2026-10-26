import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { WordingSourceText } from "@/components/resume/semantic-badges/wording-source-badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InfoHint } from "@/components/ui/info-hint";
import { equivalentSpans } from "@/lib/resume/spans";
import { languageNames } from "@/types-and-constants/languages";
import type { ReviewSnapshot } from "@/types-and-constants/resume";

function ReferenceWording({
  title,
  version,
}: {
  title: string;
  version: ReviewSnapshot & { source?: "shared" | "override" };
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <p className="text-sm font-medium">
        {title} · {languageNames[version.locale]}
      </p>
      {version.source && (
        <p className="text-xs text-muted-foreground">
          <WordingSourceText
            source={version.source === "override" ? "custom" : "inherited"}
          />
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {needsReview
            ? changed
              ? `${languageNames[current.locale]} changed since comparison`
              : "Translation comparison requested"
            : "No review flagged"}
        </span>
        <InfoHint label="comparison status" size="sm">
          No review flag does not mean the wording has been explicitly verified.
          Compare the same information in both languages; no edit is required if
          it already matches.
        </InfoHint>
      </div>
      <div className="grid gap-3 @2xl:grid-cols-2">
        <ReferenceWording
          title="Editing above · read-only copy"
          version={target}
        />
        <ReferenceWording title="Reference · read only" version={current} />
      </div>
      {snapshot ? (
        <Collapsible>
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" />}
            className="group"
          >
            <ChevronRight
              data-icon="inline-start"
              className="transition-transform group-data-panel-open:rotate-90"
            />
            Previous comparison
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2">
              <ReferenceWording
                title="Historical reference · read only"
                version={snapshot}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <p className="text-xs text-muted-foreground">No previous comparison</p>
      )}
    </div>
  );
}
