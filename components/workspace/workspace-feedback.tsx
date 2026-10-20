"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/workspace/use-workspace";

export function WorkspaceFeedback() {
  const { state, controller } = useWorkspace();
  if (!state.sessionOnly && !state.error && !state.conflict) return null;
  const stored = state.conflict;
  return (
    <Alert
      className="shrink-0 rounded-none border-x-0 border-t-0"
      variant={state.error && !state.sessionOnly ? "destructive" : "default"}
    >
      <AlertTitle>
        {state.sessionOnly
          ? "Session only — changes are not saved in this browser"
          : state.conflict
            ? "Browser saving paused"
            : "Saving unavailable"}
      </AlertTitle>
      <AlertDescription>
        <p>
          {state.error ||
            "Export JSON to keep your work. Existing stored data is untouched."}
        </p>
        {stored && (
          <p>
            Stored version:{" "}
            {stored.snapshot
              ? `${stored.snapshot.document.profile.name || "Untitled profile"} · revision ${stored.snapshot.document.revision} · ${stored.savedAt}`
              : stored.error || "No stored workspace"}
            .
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {stored?.snapshot && (
            <Button
              size="sm"
              variant="outline"
              disabled={state.saving}
              onClick={() => void controller.loadReviewed()}
            >
              Load reviewed stored version
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={state.saving}
            onClick={controller.reviewOverwrite}
          >
            {state.sessionOnly
              ? "Resume browser saving…"
              : "Review and retry saving…"}
          </Button>
          {!state.sessionOnly && (
            <Button
              size="sm"
              variant="outline"
              disabled={state.saving}
              onClick={controller.useInThisTab}
            >
              Use in this tab only…
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
