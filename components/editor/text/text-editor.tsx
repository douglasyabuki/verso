"use client";
import { TextEditorCore } from "@/components/editor/text/text-editor-core";
import { useWorkspace } from "@/hooks/workspace/use-workspace";
/** Adapt the controlled text editor to the retained workspace. */
export function TextEditor(props: Parameters<typeof TextEditorCore>[0]) {
  const { controller, state } = useWorkspace();
  return (
    <TextEditorCore
      {...props}
      disabled={!!state.pending || state.replacing}
      resetKey={state.textHistoryEpoch}
      onBoundary={() => controller.endEditGroup()}
    />
  );
}
