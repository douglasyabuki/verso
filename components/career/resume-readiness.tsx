"use client";

import { CircleAlert, ListChecks } from "lucide-react";
import { useId, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DisclosureChevron,
  DisclosureLabel,
  disclosureTriggerClassName,
} from "@/components/ui/disclosure";
import { assessResumeOutput } from "@/lib/career/readiness";
import type {
  CareerDocument,
  CareerResume,
  ResumeOutputTarget,
} from "@/types-and-constants/career";

/** Present saved-content readiness using the existing Issues disclosure and controls. */
export function ResumeReadiness({
  document,
  resume,
  onIssue,
}: {
  document: CareerDocument;
  resume: CareerResume;
  onIssue: (target: ResumeOutputTarget) => void;
}) {
  const id = useId();
  const assessment = useMemo(
    () => assessResumeOutput(document, resume.id),
    [document, resume.id],
  );
  return (
    <section
      aria-label="Active resume readiness"
      className="flex min-w-0 flex-col gap-2 border-t pt-3"
    >
      <p className="text-xs wrap-anywhere text-muted-foreground">
        {resume.name || "Untitled resume"} ({resume.language}) · Saved content
        only
      </p>
      <Collapsible defaultOpen>
        <div className="flex flex-wrap items-center gap-2">
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className={disclosureTriggerClassName}
              />
            }
          >
            <DisclosureChevron />
            <ListChecks aria-hidden="true" />
            <DisclosureLabel>
              Issues ({assessment.issues.length})
            </DisclosureLabel>
          </CollapsibleTrigger>
          <span role="status" aria-live="polite" aria-atomic="true">
            {assessment.ready ? (
              <Badge variant="outline">Ready for PDF</Badge>
            ) : (
              <Badge variant="destructive">
                <CircleAlert data-icon="inline-start" />
                {assessment.issues.length} blocking
              </Badge>
            )}
          </span>
        </div>
        <CollapsibleContent>
          {!assessment.ready && (
            <ul className="mt-3 flex max-h-64 flex-col gap-3 overflow-y-auto">
              {assessment.issues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex flex-col items-start gap-1 text-sm"
                >
                  <p id={`${id}-${issue.id}`} className="wrap-anywhere">
                    {issue.message}
                  </p>
                  {issue.target && (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-describedby={`${id}-${issue.id}`}
                      onClick={() => {
                        if (issue.target) onIssue(issue.target);
                      }}
                    >
                      Edit wording
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
