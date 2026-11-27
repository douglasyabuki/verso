"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { CareerController } from "@/stores/career/controller";
import { LivePreview } from "@/stores/output/live-preview";

const area = "[data-live-preview-editor]";
const textControl =
  'textarea, input:not([type]), input:is([type="text"], [type="search"], [type="email"], [type="url"], [type="tel"], [type="number"]), [contenteditable="true"]';
const sliderControl = 'input[type="range"], [role="slider"]';
const sliderKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** Connect the PDF lanes to the active form while keeping status updates in the pane.
 * @param controller Active workspace owner.
 * @param resumeId Resume chosen by the current destination, or empty for the pane selector.
 * @param editor Whether the destination supports draft preview.
 * @param automaticSaved Whether a committed change can refresh outside the editors.
 * @param automaticResumeIds Resumes with opted-in automatic publication.
 * @returns Stable coordinator and preview selector and completion commands.
 * @example useLivePreview(controller, resume.id, true, false, [])
 */
export function useLivePreview(
  controller: CareerController,
  resumeId: string,
  editor: boolean,
  automaticSaved: boolean,
  automaticResumeIds: readonly string[],
) {
  const [coordinator] = useState(() => new LivePreview());
  const [choice, selectResume] = useState("");
  const selected = resumeId || choice;
  const callbacks = useRef({ update: coordinator.update, mobile: () => {} });
  const [commands] = useState(() => ({
    update: () => callbacks.current.update(),
    mobile: () => callbacks.current.mobile(),
  }));
  useLayoutEffect(() => {
    const id =
      selected || controller.getSnapshot().head?.document.resumes[0]?.id;
    coordinator.configure(
      selected,
      editor,
      automaticSaved || Boolean(id && automaticResumeIds.includes(id)),
      controller,
    );
  }, [
    controller,
    coordinator,
    selected,
    editor,
    automaticSaved,
    automaticResumeIds,
  ]);
  useLayoutEffect(() => {
    const disconnect = coordinator.connect(controller);
    return () => {
      disconnect();
      coordinator.dispose();
    };
  }, [controller, coordinator]);
  useEffect(() => {
    let text = false;
    let composition: Element | null = null;
    let gesture: Element | null = null;
    let frame = 0;
    let requested = false;
    let completing = false;
    const keys = new Set<string>();
    const sync = () =>
      coordinator.interaction(
        text || Boolean(composition) || completing,
        Boolean(gesture) || keys.size > 0,
      );
    const inText = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest("[data-preview-text-popover]") ||
        (target.closest(area) &&
          target.closest(`${textControl}, [data-slot="text-editor"]`)),
      );
    const inSlider = (target: EventTarget | null) =>
      target instanceof Element && target.closest(area)
        ? target.closest(sliderControl)
        : null;
    const afterFocus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        text = inText(document.activeElement);
        completing = false;
        if (!inSlider(document.activeElement)) keys.clear();
        sync();
        if (requested && !composition) {
          requested = false;
          coordinator.update();
        }
      });
    };
    const focus = (event: FocusEvent) => {
      text = inText(event.target);
      sync();
    };
    const blur = (event: FocusEvent) => {
      if (inText(event.target) && inText(event.relatedTarget)) return;
      afterFocus();
    };
    const pointer = (event: PointerEvent) => {
      gesture = inSlider(event.target);
      if (!inText(event.target)) text = false;
      sync();
    };
    const pointerEnd = () => {
      gesture = null;
      sync();
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.type === "keydown" &&
        sliderKeys.has(event.key) &&
        inSlider(event.target)
      )
        keys.add(event.key);
      if (event.type === "keyup") keys.delete(event.key);
      sync();
    };
    const start = (event: CompositionEvent) => {
      if (inText(event.target)) {
        composition = event.target as Element;
        sync();
      }
    };
    const end = () => {
      if (!composition) return;
      composition = null;
      completing = true;
      sync();
      afterFocus();
    };
    const update = () => {
      if (composition || completing) requested = true;
      else coordinator.update();
    };
    const mobile = () => {
      if (
        document.activeElement instanceof HTMLElement &&
        inText(document.activeElement)
      )
        document.activeElement.blur();
      text = false;
      gesture = null;
      keys.clear();
      sync();
      if (editor) update();
    };
    callbacks.current = { update, mobile };
    text = inText(document.activeElement);
    sync();
    const listeners = new AbortController();
    const options = { capture: true, signal: listeners.signal };
    document.addEventListener("focusin", focus, options);
    document.addEventListener("focusout", blur, options);
    document.addEventListener("pointerdown", pointer, options);
    document.addEventListener("pointerup", pointerEnd, options);
    document.addEventListener("pointercancel", pointerEnd, options);
    document.addEventListener("keydown", key, options);
    document.addEventListener("keyup", key, options);
    document.addEventListener("compositionstart", start, options);
    document.addEventListener("compositionend", end, options);
    window.addEventListener(
      "blur",
      () => {
        gesture = null;
        keys.clear();
        sync();
      },
      options,
    );
    return () => {
      listeners.abort();
      cancelAnimationFrame(frame);
      coordinator.interaction(false, false);
    };
  }, [coordinator, selected, editor]);
  return { coordinator, selected, selectResume, commands };
}
