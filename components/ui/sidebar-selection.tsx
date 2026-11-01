"use client";

import { cn } from "cn";
import { type ComponentProps, useLayoutEffect, useRef } from "react";

/**
 * Decorates the active sidebar rows without changing their navigation or focus.
 * Children contain normal sidebar buttons; className controls the scope layout.
 * Each scope clips and scrolls with its collection. Nested pages have a separate
 * surface and snap when their resume changes. For example:
 * `<SidebarSelection><SidebarMenu>…</SidebarMenu></SidebarSelection>`.
 */
export function SidebarSelection({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  const root = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLSpanElement>(null);
  const nested = useRef<HTMLSpanElement>(null);
  const history = useRef(
    new Map<
      HTMLSpanElement,
      {
        target: HTMLElement;
        context: string | null;
        top: number;
        left: number;
        width: number;
        height: number;
      }
    >(),
  );

  const measureCurrent = useRef<(animate: boolean) => void>(() => {});
  const resize = useRef<ResizeObserver | null>(null);
  const observed = useRef(new Set<Element>());
  const reduced = useRef(false);

  useLayoutEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => {
      reduced.current = query.matches;
      if (query.matches)
        [main.current, nested.current].forEach((surface) =>
          surface?.getAnimations().forEach((animation) => animation.cancel()),
        );
    };
    reduce();
    query.addEventListener("change", reduce);
    const observer = new ResizeObserver(() => measureCurrent.current(false));
    resize.current = observer;
    return () => {
      observer.disconnect();
      resize.current = null;
      observed.current.clear();
      query.removeEventListener("change", reduce);
    };
  }, []);

  // Commit measurements see navigation and expansion together. Resize callbacks
  // use the latest measurement without rebuilding their subscriptions.
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const surfaces = [main.current!, nested.current!];
    const measure = (animate: boolean) => {
      const targets = [
        container.querySelector<HTMLElement>(
          '[data-sidebar="menu-button"][data-active], [data-sidebar="group-label"][data-active]',
        ),
        container.querySelector<HTMLElement>(
          '[data-sidebar="menu-sub-button"][data-active]',
        ),
      ];
      const origin = targets.some(Boolean)
        ? container.getBoundingClientRect()
        : null;
      const updates = surfaces.map((surface, index) => {
        const target = targets[index];
        if (!target || !origin) return { surface, next: null };
        // Entrance animations scale the button without changing its layout.
        // ResizeObserver does not fire when that scale finishes, so measuring
        // painted bounds here can leave the surface permanently undersized.
        let top = 0;
        let left = 0;
        for (
          let element: HTMLElement | null = target;
          element && element !== container;
          element = element.offsetParent as HTMLElement | null
        ) {
          top += element.offsetTop;
          left += element.offsetLeft;
          const parent: Element | null = element.offsetParent;
          if (parent instanceof HTMLElement && parent !== container) {
            top += parent.clientTop - parent.scrollTop;
            left += parent.clientLeft - parent.scrollLeft;
          }
        }
        const next = {
          target,
          context: target.closest('[data-sidebar="menu-sub"]')?.id ?? null,
          top,
          left,
          width: target.offsetWidth,
          height: target.offsetHeight,
        };
        const previous = history.current.get(surface);
        if (
          previous &&
          Object.entries(next).every(
            ([key, value]) => previous[key as keyof typeof previous] === value,
          )
        )
          return;
        const painted =
          animate &&
          previous &&
          previous.target !== target &&
          previous.context === next.context &&
          !reduced.current &&
          !surface.hidden
            ? surface.getBoundingClientRect()
            : null;
        const from = painted
          ? {
              top:
                painted.top -
                origin.top +
                container.scrollTop -
                container.clientTop,
              left:
                painted.left -
                origin.left +
                container.scrollLeft -
                container.clientLeft,
              width: painted.width,
              height: painted.height,
            }
          : null;
        return { surface, next, previous, from };
      });
      // Both indicators finish reading before either surface changes layout.
      updates.forEach((update) => {
        if (!update) return;
        const { surface, next } = update;
        if (!next) {
          surface.getAnimations().forEach((animation) => animation.cancel());
          surface.hidden = true;
          history.current.delete(surface);
          return;
        }
        const { previous, from } = update;
        surface.getAnimations().forEach((animation) => animation.cancel());
        surface.hidden = false;
        Object.assign(surface.style, {
          top: `${next.top}px`,
          left: `${next.left}px`,
          width: `${next.width}px`,
          height: `${next.height}px`,
        });
        if (
          animate &&
          previous &&
          from &&
          previous.target !== next.target &&
          previous.context === next.context &&
          !reduced.current
        ) {
          surface.animate(
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
        history.current.set(surface, next);
      });
    };
    measureCurrent.current = measure;
    measure(true);
    const targets = new Set<Element>([
      container,
      ...container.querySelectorAll<HTMLElement>(
        '[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"], [data-sidebar="group-label"]',
      ),
    ]);
    for (const target of observed.current) {
      if (!targets.has(target)) resize.current?.unobserve(target);
    }
    for (const target of targets) {
      if (!observed.current.has(target)) resize.current?.observe(target);
    }
    observed.current = targets;
  });

  useLayoutEffect(
    () => () => {
      [main.current, nested.current].forEach((surface) =>
        surface?.getAnimations().forEach((animation) => animation.cancel()),
      );
    },
    [],
  );

  return (
    <div
      {...props}
      ref={root}
      data-sidebar-selection=""
      className={cn("relative isolate", className)}
    >
      <span
        ref={main}
        hidden
        aria-hidden="true"
        data-slot="sidebar-selection-surface"
      />
      <span
        ref={nested}
        hidden
        aria-hidden="true"
        data-slot="sidebar-selection-surface"
      />
      {children}
    </div>
  );
}
