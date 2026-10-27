"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { useWorkspace } from "@/hooks/workspace/use-workspace";
import {
  numericLayoutControls,
  type TemplateSettings,
} from "@/types-and-constants/output";
import type { ResumeDocument } from "@/types-and-constants/resume";

type NumericKey = (typeof numericLayoutControls)[number]["key"];
type LayoutDraftsOptions = {
  document: ResumeDocument;
  values: TemplateSettings;
  change: (changes: Partial<TemplateSettings>) => void;
  linkedMargins?: boolean;
  reveal?: (key: NumericKey) => void;
};

/** Keep numeric text local to a mounted document/variant/locale/scope editor.
 * @param options Committed document baseline, resolved settings, and batch writer.
 * @returns Draft text, errors, cancel/edit handlers and a guarded commit boundary.
 * External document changes invalidate all drafts, including equal-valued history restores.
 * @example const drafts = useLayoutDrafts({ document, values, change });
 */
export function useLayoutDrafts({
  document,
  values,
  change,
  linkedMargins = false,
  reveal,
}: LayoutDraftsOptions) {
  const { controller } = useWorkspace();
  const [local, setLocal] = useState<{
    baseline: ResumeDocument;
    drafts: Partial<Record<NumericKey, string>>;
    errors: Partial<Record<NumericKey, string>>;
  }>({ baseline: document, drafts: {}, errors: {} });
  const latest = useRef(local);
  const active = useRef(false);
  const inputs = useRef<Partial<Record<NumericKey, HTMLInputElement | null>>>(
    {},
  );
  if (local.baseline !== document) {
    setLocal({ baseline: document, drafts: {}, errors: {} });
  }
  const current =
    local.baseline === document
      ? local
      : { baseline: document, drafts: {}, errors: {} };
  const commitDrafts = (
    extra: Partial<TemplateSettings>,
    captured: typeof local,
  ) => {
    const snapshot = controller.getSnapshot();
    // Read the controller before considering any event's captured draft text.
    if (
      !active.current ||
      snapshot.document !== document ||
      latest.current !== captured
    )
      return true;
    if (snapshot.replacing || snapshot.pending) return false;
    const errors: Partial<Record<NumericKey, string>> = {};
    const changes: Partial<TemplateSettings> = {};
    for (const control of numericLayoutControls) {
      const text = captured.drafts[control.key];
      if (text === undefined) continue;
      const value = Number(text);
      if (
        !text.trim() ||
        !Number.isFinite(value) ||
        value < control.min ||
        value > control.max ||
        (control.key === "targetPages" && !Number.isInteger(value))
      ) {
        errors[control.key] =
          `Enter ${control.key === "targetPages" ? "a whole number" : "a number"} from ${control.min} to ${control.max}.`;
      } else {
        if (value !== values[control.key]) changes[control.key] = value;
        if (
          linkedMargins &&
          (control.key === "marginLeft" || control.key === "marginRight")
        ) {
          changes.marginLeft = value;
          changes.marginRight = value;
        }
      }
    }
    const invalid = numericLayoutControls.find(({ key }) => errors[key]);
    if (invalid) {
      const invalidDrafts = { ...captured, errors };
      latest.current = invalidDrafts;
      setLocal(invalidDrafts);
      reveal?.(invalid.key);
      requestAnimationFrame(() => {
        if (
          active.current &&
          latest.current === invalidDrafts &&
          controller.getSnapshot().document === document
        )
          inputs.current[invalid.key]?.focus();
      });
      return false;
    }
    Object.assign(changes, extra);
    const clean = { baseline: document, drafts: {}, errors: {} };
    latest.current = clean;
    setLocal(clean);
    if (Object.keys(changes).length) change(changes);
    return true;
  };
  const commit = (extra: Partial<TemplateSettings> = {}) =>
    commitDrafts(extra, current);
  useLayoutEffect(() => {
    latest.current = current;
    active.current = true;
    const unregister = controller.registerEditorDraftGuard(() =>
      commitDrafts({}, latest.current),
    );
    return () => {
      active.current = false;
      unregister();
    };
  });
  return {
    text: (key: NumericKey) =>
      current.drafts[key] ??
      (values[key] === "template-default" ? "" : String(values[key])),
    errors: current.errors,
    bindInput: (key: NumericKey, node: HTMLInputElement | null) => {
      inputs.current[key] = node;
    },
    focus: (key: NumericKey) => inputs.current[key]?.focus(),
    history: (redo: boolean) => {
      if (redo) controller.redo();
      else controller.undo();
    },
    commit,
    flush: (extra: Partial<TemplateSettings> = {}) =>
      commitDrafts(extra, latest.current),
    edit: (key: NumericKey, text: string) => {
      if (
        !active.current ||
        controller.getSnapshot().document !== document ||
        latest.current !== current
      )
        return;
      const next = {
        ...current,
        drafts: { ...current.drafts, [key]: text },
        errors: { ...current.errors, [key]: undefined },
      };
      latest.current = next;
      setLocal(next);
    },
    cancel: (key: NumericKey) => {
      if (
        !active.current ||
        controller.getSnapshot().document !== document ||
        latest.current !== current
      )
        return;
      const drafts = { ...current.drafts };
      const errors = { ...current.errors };
      delete drafts[key];
      delete errors[key];
      const next = { ...current, drafts, errors };
      latest.current = next;
      setLocal(next);
    },
  };
}
