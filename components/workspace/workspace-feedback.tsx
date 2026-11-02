"use client";

import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
import { canCoordinate } from "@/stores/workspace/persistence";

export function WorkspaceFeedback() {
  const { state, controller } = useWorkspace();
  const shown = useRef(0);
  const actionable = useRef(new Map<string, number>());
  const generation = controller.getGeneration();
  useEffect(() => {
    const notice = state.notice;
    if (!notice || shown.current === notice.id) return;
    shown.current = notice.id;
    try {
      const id = toast.add({
        title: notice.title,
        description: notice.description,
        timeout: notice.action ? 15_000 : 4_000,
        actionProps: notice.action
          ? {
              children:
                notice.action === "undo" ? "Undo" : "Review previous work",
              onClick: () => controller.runNoticeAction(notice),
            }
          : undefined,
      });
      if (notice.action) actionable.current.set(id, notice.generation);
    } catch (error) {
      console.error("Notification unavailable", error);
    }
  }, [state.notice, controller]);
  useEffect(() => {
    for (const [id, noticeGeneration] of actionable.current) {
      if (noticeGeneration !== generation) {
        toast.close(id);
        actionable.current.delete(id);
      }
    }
  }, [generation]);
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
          {state.backupFailure &&
            state.backupFailure.document === state.document &&
            state.backupFailure.generation === controller.getGeneration() && (
              <Button
                size="sm"
                variant="outline"
                disabled={state.saving || !!state.pending}
                onClick={() => void controller.retryRecording()}
              >
                Retry recording
              </Button>
            )}
          {stored?.snapshot && (
            <Button
              size="sm"
              variant="outline"
              disabled={state.saving || !!state.pending}
              onClick={() => void controller.loadReviewed()}
            >
              Load the saved version shown above
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            aria-describedby={
              state.sessionOnly && !canCoordinate()
                ? "saving-coordination-reason"
                : undefined
            }
            disabled={state.saving || !!state.pending || !canCoordinate()}
            onClick={controller.reviewOverwrite}
          >
            {state.sessionOnly
              ? "Start saving in this browser…"
              : "Review saved version and retry…"}
          </Button>
          {state.sessionOnly && !canCoordinate() && (
            <p id="saving-coordination-reason">
              This browser cannot safely save changes across tabs.
            </p>
          )}
          {!state.sessionOnly && (
            <Button
              size="sm"
              variant="outline"
              disabled={state.saving || !!state.pending}
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
