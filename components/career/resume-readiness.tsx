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
  ResumeOutputIssue,
  ResumeOutputTarget,
} from "@/types-and-constants/career";

/** Present versioned output and Save issues in the PDF footer. */
export function ResumeReadiness({
  document,
  resume,
  onIssue,
  issues,
  draft = false,
  pending = false,
}: {
  document: CareerDocument;
  resume: CareerResume;
  onIssue: (target: ResumeOutputTarget) => void;
  issues?: ResumeOutputIssue[];
  draft?: boolean;
  pending?: boolean;
}) {
  const id = useId();
  const assessment = useMemo(
    () =>
      issues
        ? { issues, ready: !issues.length }
        : assessResumeOutput(document, resume.id),
    [document, resume.id, issues],
  );
  return (
    <section
      aria-label="Active resume readiness"
      className="flex min-w-0 shrink-0 flex-col border-t"
    >
      <Collapsible>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
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
          <span>
            {assessment.ready ? (
              <Badge variant="outline">
                {pending ? "Checking PDF" : "Ready for PDF"}
              </Badge>
            ) : (
              <Badge variant="destructive">
                <CircleAlert data-icon="inline-start" />
                {assessment.issues.length} blocking
              </Badge>
            )}
          </span>
        </div>
        <CollapsibleContent className="max-h-[40dvh] overflow-auto overscroll-contain border-t px-4 py-3">
          <p className="mb-3 text-xs wrap-anywhere text-muted-foreground">
            {resume.name || "Untitled resume"} ({resume.language}) ·{" "}
            {draft ? "Unsaved draft" : "Saved content"}
          </p>
          {!assessment.ready && (
            <ul className="flex flex-col gap-3">
              {assessment.issues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex flex-col items-start gap-1 text-sm"
                >
                  <p id={`${id}-${issue.id}`} className="wrap-anywhere">
                    <span className="block text-xs text-muted-foreground">
                      {issue.code === "invalid-draft"
                        ? "Save validation"
                        : "PDF readiness"}
                    </span>
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
                      {issue.target.destination.startsWith("resume-wording/") &&
                      issue.code !== "invalid-draft"
                        ? "Edit wording"
                        : "Go to field"}
                    </Button>
                  )}
                  {issue.wordingTarget && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onIssue(issue.wordingTarget!)}
                    >
                      Edit wording
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {assessment.ready && (
            <p className="text-sm">
              {pending ? "Checking for issues." : "No blocking issues."}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
