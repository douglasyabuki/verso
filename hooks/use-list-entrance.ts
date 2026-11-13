"use client";

import { useLayoutEffect, useRef } from "react";

type ListEntranceOptions = {
  getElements: () => HTMLElement[];
  contextKey: string;
  disabled?: boolean;
  mode?: "scroll" | "all";
  stagger?: "full" | "responsive";
};

type EntranceState = {
  context: string;
  seen: Set<string | HTMLElement>;
  animations: Map<HTMLElement, Animation>;
  elements: HTMLElement[];
  disabled: boolean;
  mode: "scroll" | "all";
  stagger: "full" | "responsive";
  scrolled: boolean;
  observer: IntersectionObserver | null;
};

type Clip = { top: number; left: number; right: number; bottom: number };

const subscribers = new Set<EntranceState>();
const pending = new Set<EntranceState>();
let frame = 0;
let motionQuery: MediaQueryList | null = null;

/** Identify a row across remounts when its consumer supplies a stable ID. */
function rowKey(element: HTMLElement) {
  return element.dataset.listId ?? element.dataset.sortId ?? element;
}

/** Cancel a state's row animation, if any, and release its handle. */
function cancelRow(state: EntranceState, element: HTMLElement) {
  state.animations.get(element)?.cancel();
  state.animations.delete(element);
}

/** Cancel every active entrance belonging to a list. */
function cancelAll(state: EntranceState) {
  state.animations.forEach((animation) => animation.cancel());
  state.animations.clear();
}

/** Read visibility with pass-local ancestor clipping caches; never retain layout across frames. */
function visible(element: HTMLElement, clips: Map<HTMLElement, Clip>) {
  if (!element.getClientRects().length) return false;
  const rect = element.getBoundingClientRect();
  let clip: Clip = {
    top: 0,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
  const ancestors: HTMLElement[] = [];
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const cached = clips.get(parent);
    if (cached) {
      clip = cached;
      break;
    }
    ancestors.push(parent);
  }
  // Build cumulative clips from the outermost unknown ancestor inward.
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const parent = ancestors[index];
    const style = getComputedStyle(parent);
    const y = /(auto|scroll|hidden|clip)/.test(style.overflowY);
    const x = /(auto|scroll|hidden|clip)/.test(style.overflowX);
    if (x || y) {
      const bounds = parent.getBoundingClientRect();
      clip = {
        top: y ? Math.max(clip.top, bounds.top + parent.clientTop) : clip.top,
        bottom: y
          ? Math.min(
              clip.bottom,
              bounds.top + parent.clientTop + parent.clientHeight,
            )
          : clip.bottom,
        left: x
          ? Math.max(clip.left, bounds.left + parent.clientLeft)
          : clip.left,
        right: x
          ? Math.min(
              clip.right,
              bounds.left + parent.clientLeft + parent.clientWidth,
            )
          : clip.right,
      };
    }
    clips.set(parent, clip);
  }
  return (
    rect.bottom > clip.top &&
    rect.top < clip.bottom &&
    rect.right > clip.left &&
    rect.left < clip.right
  );
}

/** Read a list's candidates, returning a write-only reveal phase for the batch. */
function prepareReveal(state: EntranceState, clips: Map<HTMLElement, Clip>) {
  const scroll = state.scrolled;
  const rows = state.elements.flatMap((element) => {
    const id = rowKey(element);
    if (!scroll && state.seen.has(id)) return [];
    const showing = state.mode === "all" || visible(element, clips);
    return [
      {
        element,
        id,
        showing,
        animate:
          showing &&
          !state.seen.has(id) &&
          !state.disabled &&
          !motionQuery?.matches &&
          !!element.animate &&
          !element.matches(":focus-within, :disabled, [data-current]") &&
          !element.closest("fieldset:disabled, [inert]"),
      },
    ];
  });
  return () => {
    state.scrolled = false;
    let stagger = 0;
    for (const { element, id, showing, animate } of rows) {
      if (!showing) {
        if (scroll) {
          state.seen.delete(id);
          cancelRow(state, element);
        }
        continue;
      }
      state.seen.add(id);
      if (!animate) continue;
      const delay =
        state.stagger === "responsive"
          ? scroll
            ? 0
            : Math.min(stagger * 50, 150)
          : stagger * 50;
      stagger++;
      // Individual scale composes with dnd-kit transforms. Capture-phase
      // interaction cancellation removes it before drag measurement.
      const animation = element.animate(
        [
          { opacity: 0, scale: "0.85", offset: 0 },
          { opacity: 1, scale: "0.9", offset: 0.25 },
          { opacity: 1, scale: "1.02", offset: 0.75 },
          { opacity: 1, scale: "1", offset: 1 },
        ],
        {
          duration: 350,
          delay,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "backwards",
        },
      );
      state.animations.set(element, animation);
      animation.onfinish = () => {
        if (state.animations.get(element) === animation)
          state.animations.delete(element);
      };
    }
  };
}

/** Queue one list; a shared frame reads all pending lists before any animation writes. */
function schedule(state: EntranceState) {
  if (!subscribers.has(state) || state.mode !== "scroll") return;
  pending.add(state);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const clips = new Map<HTMLElement, Clip>();
    const writes = [...pending].map((list) => prepareReveal(list, clips));
    pending.clear();
    writes.forEach((write) => write());
  });
}

/** Route captured scrolls only to lists inside the scrolled element. */
function onScroll(event: Event) {
  const target = event.target;
  for (const state of subscribers) {
    if (state.mode !== "scroll") continue;
    if (
      target === document ||
      (target instanceof Element &&
        state.elements.some((element) => target.contains(element)))
    ) {
      state.scrolled = true;
      schedule(state);
    }
  }
}

/** Preserve synchronous focus/pointer cancellation across nested sortable lists. */
function onInteract(event: Event) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  const sortableInteraction =
    target instanceof Element &&
    target.closest('[data-slot="animated-list-item"]');
  // Canceling scale on pointerdown moves an action away before pointerup,
  // causing the browser to dispatch click to its parent. Pause ordinary actions
  // through click instead; drag handles still cancel before drag measurement.
  const action =
    target instanceof Element &&
    target.closest("button, input, a, [contenteditable]");
  if (
    sortableInteraction &&
    action &&
    !action.hasAttribute("data-sort-handle")
  ) {
    if (event.type === "pointerdown") {
      for (const state of subscribers)
        state.animations.forEach((animation) => animation.pause());
      return;
    }
    if (event.type === "focusin" && !action.matches(":focus-visible")) return;
  }
  for (const state of subscribers) {
    if (sortableInteraction) cancelAll(state);
    for (const element of state.elements) {
      if (element.contains(target)) {
        state.seen.add(rowKey(element));
        cancelRow(state, element);
      }
    }
  }
}

/** Resume entrances after the native click has used the stable pressed geometry. */
function onPointerEnd() {
  for (const state of subscribers)
    state.animations.forEach((animation) => {
      if (animation.playState === "paused") animation.play();
    });
}

/** Immediately stop active entrances when the shared media query requests less motion. */
function onReduce() {
  if (motionQuery?.matches) subscribers.forEach(cancelAll);
}

/** Subscribe for one mounted hook, returning cleanup of its observers and shared resources. */
function subscribe(state: EntranceState) {
  if (!subscribers.size) {
    motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", onInteract, true);
    document.addEventListener("focusin", onInteract, true);
    document.addEventListener("pointerup", onPointerEnd, true);
    document.addEventListener("pointercancel", onPointerEnd, true);
    motionQuery.addEventListener("change", onReduce);
  }
  subscribers.add(state);
  return () => {
    state.observer?.disconnect();
    state.observer = null;
    cancelAll(state);
    // Effect replay cancels the first entrance but retains this ref. A new
    // subscription must reveal rows again rather than treating them as finished.
    state.seen.clear();
    state.scrolled = false;
    pending.delete(state);
    subscribers.delete(state);
    if (!subscribers.size) {
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onInteract, true);
      document.removeEventListener("focusin", onInteract, true);
      document.removeEventListener("pointerup", onPointerEnd, true);
      document.removeEventListener("pointercancel", onPointerEnd, true);
      motionQuery?.removeEventListener("change", onReduce);
      motionQuery = null;
    }
  };
}

/**
 * Pops rows in DOM order, staggering each visible batch by 50 ms.
 * getElements supplies current rows; contextKey resets entrance history.
 * disabled suppresses motion; mode="all" reveals even offscreen rows without
 * scroll replay. Scroll mode replays returning rows. Returns nothing; focus
 * and pointer interaction cancel pending motion before drag measurements.
 * stagger="responsive" caps opening delays at 150 ms and removes scroll stagger;
 * the default "full" keeps the uncapped 50 ms stagger for every batch.
 * @example useListEntrance({ getElements: () => [...rows.current.values()], contextKey: sectionId });
 */
export function useListEntrance({
  getElements,
  contextKey,
  disabled = false,
  mode = "scroll",
  stagger = "full",
}: ListEntranceOptions) {
  const history = useRef<EntranceState>({
    context: contextKey,
    seen: new Set(),
    animations: new Map(),
    elements: [],
    disabled,
    mode,
    stagger,
    scrolled: false,
    observer: null,
  });

  useLayoutEffect(() => subscribe(history.current), []);

  // Reconcile committed rows/options without replacing subscriptions. Initial
  // reads remain synchronous and follow the consumer's scroll restoration.
  useLayoutEffect(() => {
    const state = history.current;
    if (state.context !== contextKey) {
      cancelAll(state);
      state.seen.clear();
      state.context = contextKey;
      state.scrolled = false;
    }
    const elements = getElements().sort((a, b) =>
      a === b
        ? 0
        : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING
          ? 1
          : -1,
    );
    const membership = new Set(elements);
    for (const element of state.animations.keys()) {
      if (
        !membership.has(element) ||
        element.matches("[data-current], :focus-within")
      )
        cancelRow(state, element);
    }
    const previous = new Set(state.elements);
    if (mode !== "scroll") {
      state.observer?.disconnect();
      state.observer = null;
    } else {
      if (!state.observer) {
        state.observer = new IntersectionObserver(() => schedule(state));
        previous.clear();
      }
      for (const element of previous) {
        if (!membership.has(element)) state.observer.unobserve(element);
      }
      for (const element of elements) {
        if (!previous.has(element)) state.observer.observe(element);
      }
    }
    state.elements = elements;
    state.disabled = disabled;
    state.mode = mode;
    state.stagger = stagger;
    if (disabled || motionQuery?.matches) cancelAll(state);
    pending.delete(state);
    prepareReveal(state, new Map())();
  });
}
