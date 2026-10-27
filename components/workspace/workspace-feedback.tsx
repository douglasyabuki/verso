"use client";

import { CircleAlert } from "lucide-react";

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
      variant={state.error && !state.sessionOnly ? "destructive" : "attention"}
    >
      <CircleAlert aria-hidden="true" />
      <AlertTitle>
        {state.sessionOnly
          ? "Changes are kept only in this tab"
          : state.conflict
            ? "Browser saving paused"
            : "Saving unavailable"}
      </AlertTitle>
      <AlertDescription>
        <p>
          {state.sessionOnly && "Closing this tab can lose your changes. "}
          {state.error ||
            "Download a backup to keep your work. The version saved in this browser is unchanged."}
        </p>
        {stored && (
          <p>
            Saved in this browser:{" "}
            {stored.snapshot
              ? `${stored.snapshot.document.profile.name || "Untitled profile"} · revision ${stored.snapshot.document.revision} · ${stored.savedAt}`
              : stored.error || "No work saved in this browser"}
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
              Load the saved version shown above
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={state.saving}
            onClick={controller.reviewOverwrite}
          >
            {state.sessionOnly
              ? "Start saving in this browser…"
              : "Review saved version and retry…"}
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
