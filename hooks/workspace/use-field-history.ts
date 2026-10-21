"use client";

import { type ChangeEvent, type CompositionEvent, useRef } from "react";

import { useWorkspace } from "@/hooks/workspace/use-workspace";
import type { EditGroup } from "@/types-and-constants/workspace";

type FieldHistoryOptions = {
  fieldKey: string;
  onChange: (value: string, group: EditGroup) => void;
};

/** Attach explicit typing, clipboard, and composition boundaries to a workspace field.
 * @param options Stable field identity and synchronous document-edit callback.
 * @returns Input/textarea handlers; clipboard defaults and native undo remain untouched.
 * @example const input = useFieldHistory({ fieldKey: "profile.name", onChange });
 */
export function useFieldHistory({ fieldKey, onChange }: FieldHistoryOptions) {
  const { controller } = useWorkspace();
  const composition = useRef<{
    key: string;
    ended: boolean;
    value: string;
  } | null>(null);
  const clipboard = useRef(false);

  const boundary = () => {
    controller.endEditGroup();
    composition.current = null;
    clipboard.current = false;
  };

  const clipboardBoundary = () => {
    boundary();
    clipboard.current = true;
  };

  const change = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.currentTarget.value;
    const native = event.nativeEvent as InputEvent;
    const inputType = native.inputType ?? "";
    const active = composition.current;
    // Some browsers deliver the final input after compositionend; others before it.
    if (
      active?.ended &&
      !native.isComposing &&
      !inputType.toLowerCase().includes("composition") &&
      value !== active.value
    ) {
      composition.current = null;
    }
    const composing = composition.current;
    const isolated =
      clipboard.current ||
      [
        "insertFromPaste",
        "insertFromDrop",
        "deleteByCut",
        "historyUndo",
        "historyRedo",
      ].includes(inputType);
    onChange(
      value,
      composing
        ? { key: composing.key, kind: "composition" }
        : { key: fieldKey, kind: isolated ? "isolated" : "typing" },
    );
    clipboard.current = false;
    if (isolated) controller.endEditGroup();
  };

  const startComposition = () => {
    boundary();
    composition.current = {
      key: `${fieldKey}:${crypto.randomUUID()}`,
      ended: false,
      value: "",
    };
  };

  const endComposition = (
    event: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const active = composition.current;
    if (!active) return;
    active.ended = true;
    active.value = event.currentTarget.value;
    onChange(active.value, { key: active.key, kind: "composition" });
  };

  return {
    onChange: change,
    onFocus: boundary,
    onBlur: boundary,
    onPaste: clipboardBoundary,
    onCut: clipboardBoundary,
    onCompositionStart: startComposition,
    onCompositionEnd: endComposition,
  };
}
