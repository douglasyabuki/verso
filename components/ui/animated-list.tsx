"use client";

import { cn } from "cn";
import {
  type ComponentPropsWithRef,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useListEntrance } from "@/hooks/use-list-entrance";

export type AnimatedListSelectionProps<T extends { id: string }> = {
  mode?: "selectable";
  items: T[];
  selectedId: string | null;
  onSelect: (item: T) => void;
  contextKey: string;
  activation: {
    sequence: number;
    contextKey: string;
    itemId: string;
  } | null;
  label: string;
  disabled: boolean;
  renderItem: (item: T) => ReactNode;
  children?: ReactNode;
  className?: string;
  motion?: "animated" | "subtle" | "none";
  initialScrollTop: number;
  onRestoreScroll?: (viewport: HTMLDivElement) => void;
  onScroll: (offset: number) => void;
};

type AnimatedListContextValue = {
  mode: "selectable" | "sortable";
  register?: (id: string, element: HTMLElement | null) => void;
};

const selectableContext: AnimatedListContextValue = { mode: "selectable" };

const AnimatedListContext = createContext(selectableContext);

type AnimatedSortableListProps = {
  mode: "sortable";
  children: ReactNode;
  selectedId?: string | null;
  contextKey?: string;
  itemIds?: string[];
  dragging?: boolean;
};

/**
 * Shared list foundation adapted from the supplied AnimatedList reference.
 * Selectable mode owns controlled focus, reveal, entrance history, and the ring.
 * Sortable mode portals one decorative surface into the selected row without
 * changing list markup or row transforms; dnd-kit owns all drag movement.
 * Mount with a new key to establish fresh entrance history.
 */
export function AnimatedList<T extends { id: string }>(
  props: AnimatedListSelectionProps<T> | AnimatedSortableListProps,
) {
  if (props.mode === "sortable") {
    return <SortableAnimatedList {...props} />;
  }
  return (
    <AnimatedListContext value={selectableContext}>
      <SelectableAnimatedList {...props} />
    </AnimatedListContext>
  );
}

/** Reparent one surface on selection; its host carries it through native drag transforms. */
function SortableAnimatedList({
  children,
  selectedId,
  contextKey = "",
  itemIds = [],
  dragging = false,
}: AnimatedSortableListProps) {
  const elements = useRef(new Map<string, HTMLElement>());
  const surface = useRef<HTMLSpanElement>(null);
  const history = useRef<{ context: string; membership: string } | null>(null);
  const [selection, setSelection] = useState<{
    target: HTMLElement | null;
    from: DOMRect | null;
  }>({ target: null, from: null });
  const animatedSelection = useRef<typeof selection | null>(null);
  const lastSurface = useRef<HTMLSpanElement | null>(null);
  const reduced = useRef(false);
  const resize = useRef<ResizeObserver | null>(null);
  const measuredTarget = useRef<{
    element: HTMLElement;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const cancel = () =>
      lastSurface.current
        ?.getAnimations()
        .forEach((animation) => animation.cancel());
    const change = () => {
      reduced.current = query.matches;
      if (query.matches) cancel();
    };
    change();
    query.addEventListener("change", change);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const target = measuredTarget.current;
            if (
              target &&
              (target.element.offsetWidth !== target.width ||
                target.element.offsetHeight !== target.height)
            )
              cancel();
          });
    resize.current = observer;
    return () => {
      cancel();
      observer?.disconnect();
      resize.current = null;
      measuredTarget.current = null;
      query.removeEventListener("change", change);
    };
  }, []);

  const register = useCallback((id: string, element: HTMLElement | null) => {
    if (element) elements.current.set(id, element);
    else elements.current.delete(id);
  }, []);
  useListEntrance({
    getElements: () => [...elements.current.values()],
    contextKey,
    disabled: dragging,
  });
  const value = useMemo<AnimatedListContextValue>(
    () => ({ mode: "sortable", register }),
    [register],
  );

  useLayoutEffect(() => {
    const target = selectedId
      ? (elements.current.get(selectedId) ?? null)
      : null;
    const membership = JSON.stringify(itemIds);
    const stable =
      history.current?.context === contextKey &&
      history.current.membership === membership;
    history.current = { context: contextKey, membership };
    if (!stable)
      surface.current
        ?.getAnimations()
        .forEach((animation) => animation.cancel());
    if (target === selection.target) return;
    // Capture the visible surface before the portal moves. This also keeps rapid
    // selection changes continuous when a previous transition is still running.
    const from =
      stable && !dragging && selection.target?.isConnected
        ? (surface.current?.getBoundingClientRect() ?? null)
        : null;
    surface.current?.getAnimations().forEach((animation) => animation.cancel());
    setSelection({ target, from });
  }, [selectedId, itemIds, contextKey, selection.target, dragging]);

  useLayoutEffect(() => {
    const element = surface.current;
    lastSurface.current = element;
    const target = selection.target;
    const previous = measuredTarget.current;
    if (previous?.element !== target) {
      if (previous) resize.current?.unobserve(previous.element);
      measuredTarget.current = target
        ? {
            element: target,
            width: target.offsetWidth,
            height: target.offsetHeight,
          }
        : null;
      if (target) resize.current?.observe(target);
    }
    if (!element) return;
    const from = selection.from;
    const fresh = animatedSelection.current !== selection;
    animatedSelection.current = selection;
    if (dragging)
      element.getAnimations().forEach((animation) => animation.cancel());
    if (fresh && from && !dragging && !reduced.current && element.animate) {
      const next = element.getBoundingClientRect();
      element.animate(
        [
          {
            transform: `translate(${from.left - next.left}px, ${from.top - next.top}px)`,
            width: `${from.width}px`,
            height: `${from.height}px`,
          },
          {
            transform: "translate(0, 0)",
            width: `${next.width}px`,
            height: `${next.height}px`,
          },
        ],
        { duration: 250, easing: "ease-out" },
      );
    }
  }, [selection, dragging]);

  return (
    <AnimatedListContext value={value}>
      {children}
      {selection.target &&
        createPortal(
          <span
            ref={surface}
            aria-hidden="true"
            data-slot="animated-list-sortable-surface"
            className="pointer-events-none absolute inset-0 z-1 rounded-[inherit] bg-accent/70 ring-1 ring-primary"
          />,
          selection.target,
        )}
    </AnimatedListContext>
  );
}

type AnimatedListItemProps<Tag extends "button" | "div" | "li"> = {
  as?: Tag;
  itemId?: string;
  surface?: "standard" | "nested" | "plain";
  current?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  dropping?: boolean;
} & ComponentPropsWithRef<Tag>;

/** Shared item surface; forwards native props and refs to the measured element. */
export function AnimatedListItem<Tag extends "button" | "div" | "li" = "div">({
  as,
  itemId,
  surface = "standard",
  current = false,
  dragging = false,
  dropTarget = false,
  dropping = false,
  className,
  ref,
  ...props
}: AnimatedListItemProps<Tag>) {
  const { mode, register } = useContext(AnimatedListContext);
  const forwardedRef = ref as Ref<HTMLElement> | undefined;
  const itemRef = useCallback(
    (element: HTMLElement | null) => {
      if (itemId) register?.(itemId, element);
      const cleanup =
        typeof forwardedRef === "function" ? forwardedRef(element) : undefined;
      if (forwardedRef && typeof forwardedRef !== "function")
        forwardedRef.current = element;
      return () => {
        if (itemId) register?.(itemId, null);
        if (typeof cleanup === "function") cleanup();
        else if (typeof forwardedRef === "function") forwardedRef(null);
        else if (forwardedRef) forwardedRef.current = null;
      };
    },
    [itemId, register, forwardedRef],
  );
  const Element: "button" | "div" | "li" = as ?? "div";
  const nativeProps = props as HTMLAttributes<HTMLElement>;
  return (
    <Element
      {...nativeProps}
      ref={itemRef}
      data-slot="animated-list-item"
      data-list-mode={mode}
      data-surface={surface}
      data-current={current || undefined}
      data-dragging={dragging || undefined}
      data-drop-target={dropTarget || undefined}
      data-dropping={dropping || undefined}
      className={cn(
        "min-w-0 data-[surface=nested]:bg-(--list-item-surface-nested) data-[surface=nested]:outline data-[surface=nested]:-outline-offset-1 data-[surface=nested]:outline-border data-[surface=standard]:border-border data-[surface=standard]:bg-(--list-item-surface)",
        "not-data-[surface=plain]:transition-[border-color,box-shadow] not-data-[surface=plain]:duration-150 not-data-[surface=plain]:hover:border-ring not-data-[surface=plain]:hover:inset-shadow-[0_0_0_1px_color-mix(in_oklab,var(--ring)_30%,transparent)] motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[surface=nested]:focus-visible:outline-2 data-[surface=nested]:focus-visible:outline-offset-2 data-[surface=nested]:focus-visible:outline-ring",
        "data-[list-mode=sortable]:has-[:focus-visible]:not-has-[[data-slot=animated-list-item]_:focus-visible]:outline-2 data-[list-mode=sortable]:has-[:focus-visible]:not-has-[[data-slot=animated-list-item]_:focus-visible]:outline-offset-2 data-[list-mode=sortable]:has-[:focus-visible]:not-has-[[data-slot=animated-list-item]_:focus-visible]:outline-ring",
        "data-[list-mode=sortable]:relative data-[list-mode=sortable]:data-current:isolate data-[list-mode=sortable]:data-current:z-1 data-[list-mode=sortable]:data-current:[&>:not([data-slot=animated-list-sortable-surface])]:relative data-[list-mode=sortable]:data-current:[&>:not([data-slot=animated-list-sortable-surface])]:z-10",
        "data-[list-mode=sortable]:data-dragging:shadow-[0_4px_12px_color-mix(in_oklab,var(--foreground)_18%,transparent)] data-[list-mode=sortable]:data-dragging:outline-2 data-[list-mode=sortable]:data-dragging:-outline-offset-2 data-[list-mode=sortable]:data-dragging:outline-ring",
        "data-[list-mode=sortable]:data-dropping:shadow-[0_4px_12px_color-mix(in_oklab,var(--foreground)_18%,transparent)] data-[list-mode=sortable]:data-dropping:outline-2 data-[list-mode=sortable]:data-dropping:-outline-offset-2 data-[list-mode=sortable]:data-dropping:outline-ring",
        "data-[list-mode=sortable]:data-drop-target:not-data-dragging:outline data-[list-mode=sortable]:data-drop-target:not-data-dragging:-outline-offset-1 data-[list-mode=sortable]:data-drop-target:not-data-dragging:outline-ring data-[list-mode=sortable]:data-drop-target:not-data-dragging:outline-dashed",
        className,
      )}
    />
  );
}

function SelectableAnimatedList<T extends { id: string }>({
  items,
  selectedId,
  onSelect,
  contextKey,
  activation,
  label,
  disabled,
  renderItem,
  children,
  className,
  motion = "animated",
  initialScrollTop,
  onRestoreScroll,
  onScroll,
}: AnimatedListSelectionProps<T>) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const history = useRef<{
    context: string;
    consumed: number;
    selection: string | null;
    ids: string[];
  } | null>(null);
  const focused = useRef<string | null>(null);
  const focusInside = useRef(false);
  const reduced = useRef(false);
  const bounds = useRef<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      reduced.current = query.matches;
      if (query.matches) {
        ring.current
          ?.getAnimations()
          .forEach((animation) => animation.cancel());
        const node = viewport.current;
        if (node) node.scrollTo({ top: node.scrollTop, behavior: "instant" });
      }
    };
    change();
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);

  const measureCurrent = useRef<() => void>(() => {});
  const resize = useRef<ResizeObserver | null>(null);
  const observed = useRef(new Set<Element>());

  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureCurrent.current());
    resize.current = observer;
    return () => {
      observer.disconnect();
      resize.current = null;
      observed.current.clear();
    };
  }, []);

  // Restoration is synchronous and precedes all measurement and intersections.
  useLayoutEffect(() => {
    const node = viewport.current;
    const body = content.current;
    const outline = ring.current;
    if (!node || !body || !outline) return;
    const old = history.current;
    const reset = !old || old.context !== contextKey;
    if (reset) {
      focused.current = null;
      focusInside.current = false;
      bounds.current = null;
      onRestoreScroll?.(node);
      node.scrollTop = initialScrollTop;
      history.current = {
        context: contextKey,
        consumed: activation?.sequence ?? 0,
        selection: selectedId,
        ids: [],
      };
    }
    const state = history.current!;
    const ids = items.map((item) => item.id);
    const membershipChanged = JSON.stringify(state.ids) !== JSON.stringify(ids);
    if (
      !reset &&
      focused.current &&
      !ids.includes(focused.current) &&
      focusInside.current
    ) {
      const index = state.ids.indexOf(focused.current);
      const target =
        state.ids.slice(index + 1).find((id) => ids.includes(id)) ??
        state.ids
          .slice(0, index)
          .reverse()
          .find((id) => ids.includes(id));
      if (target && !disabled) {
        buttons.current.get(target)?.focus({ preventScroll: true });
      }
    }

    const selected = selectedId ? buttons.current.get(selectedId) : undefined;
    const selectionChanged = state.selection !== selectedId;
    let travel = false;
    if (disabled) {
      focusInside.current = false;
    }
    if (activation && activation.sequence > state.consumed) {
      if (
        disabled ||
        activation.contextKey !== contextKey ||
        activation.itemId !== selectedId
      ) {
        state.consumed = activation.sequence;
      } else if (selected) {
        state.consumed = activation.sequence;
        travel = !reset && !membershipChanged && state.selection !== selectedId;
        selected.focus({ preventScroll: true });
        reveal(selected);
      }
      // A matching signal remains pending until its selected button mounts.
    }
    state.selection = selectedId;
    state.ids = ids;

    const measure = (animate = false, force = false) => {
      const target = selectedId ? buttons.current.get(selectedId) : undefined;
      if (!target) {
        outline.getAnimations().forEach((animation) => animation.cancel());
        outline.hidden = true;
        bounds.current = null;
        return;
      }
      const next = {
        top: target.offsetTop,
        left: target.offsetLeft,
        width: target.offsetWidth,
        height: target.offsetHeight,
      };
      const previous = bounds.current;
      // Scroll position updates rerender the owner. Keep an in-flight trip alive
      // unless selection, membership, or measured geometry actually changed.
      if (
        !animate &&
        !force &&
        previous &&
        previous.top === next.top &&
        previous.left === next.left &&
        previous.width === next.width &&
        previous.height === next.height
      )
        return;
      outline.getAnimations().forEach((animation) => animation.cancel());
      outline.hidden = false;
      Object.assign(outline.style, {
        top: `${next.top}px`,
        left: `${next.left}px`,
        width: `${next.width}px`,
        height: `${next.height}px`,
      });
      if (
        animate &&
        previous &&
        motion === "animated" &&
        !reduced.current &&
        outline.animate
      ) {
        outline.animate(
          [
            {
              transform: `translate(${previous.left - next.left}px, ${previous.top - next.top}px)`,
              width: `${previous.width}px`,
              height: `${previous.height}px`,
            },
            {
              transform: "translate(0, 0)",
              width: `${next.width}px`,
              height: `${next.height}px`,
            },
          ],
          { duration: 250, easing: "ease-out" },
        );
      }
      bounds.current = next;
    };
    measureCurrent.current = () => measure();
    measure(travel, selectionChanged || membershipChanged || disabled);
    const targets = new Set<Element>([node, body, ...buttons.current.values()]);
    for (const target of observed.current) {
      if (!targets.has(target)) resize.current?.unobserve(target);
    }
    for (const target of targets) {
      if (!observed.current.has(target)) resize.current?.observe(target);
    }
    observed.current = targets;
  });

  useListEntrance({
    getElements: () => [...buttons.current.values()],
    contextKey,
    disabled: disabled || motion !== "animated",
    stagger: "responsive",
  });

  /** Reveal only within this viewport, preserving the workspace position. */
  function reveal(button: HTMLButtonElement) {
    const node = viewport.current;
    if (!node) return;
    const box = button.getBoundingClientRect();
    const view = node.getBoundingClientRect();
    const top = view.top + node.clientTop + 4;
    const bottom = top + node.clientHeight - 8;
    const delta =
      box.top < top
        ? box.top - top
        : box.bottom > bottom
          ? Math.min(box.bottom - bottom, box.top - top)
          : 0;
    if (delta)
      node.scrollTo({
        top: node.scrollTop + delta,
        behavior:
          motion === "animated" && !reduced.current ? "smooth" : "instant",
      });
  }

  return (
    <div
      ref={viewport}
      data-slot="animated-list-viewport"
      role="region"
      aria-label={label}
      data-disabled={disabled || undefined}
      data-motion={motion}
      className={cn(
        "min-w-0 scroll-fade-y [scrollbar-gutter:stable] overflow-y-auto [--scroll-fade-size:12px] [overflow-anchor:none] focus-within:[--scroll-fade-mask:none] data-[motion=none]:[&_[data-slot=animated-list-item]]:transition-none",
        className,
      )}
      onScroll={(event) => {
        const node = event.currentTarget;
        onScroll(node.scrollTop);
      }}
      onFocusCapture={() => {
        focusInside.current = true;
      }}
      onBlurCapture={(event) => {
        if (
          (event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget)) ||
          (!event.relatedTarget && (event.target as HTMLElement).isConnected)
        )
          focusInside.current = false;
      }}
    >
      <div
        ref={content}
        data-slot="animated-list-track"
        className="relative isolate flex min-w-0 flex-col gap-3 p-1"
      >
        {children}
        {items.map((item) => (
          <AnimatedListItem
            as="button"
            current={item.id === selectedId}
            key={item.id}
            ref={(button) => {
              if (button) buttons.current.set(item.id, button);
              else buttons.current.delete(item.id);
            }}
            type="button"
            data-list-id={item.id}
            disabled={disabled}
            aria-current={item.id === selectedId ? "true" : undefined}
            className="relative flex w-full min-w-0 shrink-0 cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left text-card-foreground shadow-sm disabled:pointer-events-none disabled:opacity-50 [&>*]:relative [&>*]:z-10"
            onClick={() => {
              if (!disabled) onSelect(item);
            }}
            onFocus={() => {
              focused.current = item.id;
            }}
            onKeyDown={(event) => {
              if (
                disabled ||
                event.target !== event.currentTarget ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
              )
                return;
              const index = items.findIndex(
                (candidate) => candidate.id === item.id,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : event.key === "ArrowUp"
                      ? Math.max(0, index - 1)
                      : event.key === "ArrowDown"
                        ? Math.min(items.length - 1, index + 1)
                        : null;
              if (next === null) return;
              event.preventDefault();
              if (next === index) return;
              const target = buttons.current.get(items[next].id);
              target?.focus({ preventScroll: true });
              if (target) reveal(target);
            }}
          >
            {renderItem(item)}
          </AnimatedListItem>
        ))}
        <div
          ref={ring}
          hidden
          aria-hidden="true"
          data-slot="animated-list-ring"
          className="pointer-events-none absolute z-1 rounded-xl bg-accent/70 ring-1 ring-primary"
        />
      </div>
    </div>
  );
}
