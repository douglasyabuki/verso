"use client";

import { Button } from "@/components/ui/button";
import { useWorkspaceEditor } from "@/hooks/workspace/use-workspace-editor";
import { resolveOwnerDestination } from "@/lib/workspace/destinations";

/** Render return links and unavailable-target feedback from navigation-owned review state. */
export function EditorReturnNavigation() {
  const { navigation, view, document } = useWorkspaceEditor();
  return (
    <>
      {(navigation.returnDestination ||
        (navigation.reviewContext && view !== "review")) && (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            navigation.open(
              navigation.reviewContext
                ? { kind: "review" }
                : navigation.returnDestination!,
              true,
            );
            navigation.setReturnDestination(null);
          }}
        >
          Return to{" "}
          {navigation.reviewContext
            ? "text to review"
            : navigation.returnDestination?.kind === "resume"
              ? "resume"
              : "previous page"}
        </Button>
      )}
      {navigation.reviewContext?.current &&
        !resolveOwnerDestination(
          document,
          navigation.reviewContext.current,
        ) && (
          <p role="status" className="text-sm text-muted-foreground">
            The current review item is unavailable because its content or resume
            was removed. Return to text to review to continue with the remaining
            work.
          </p>
        )}
    </>
  );
}
