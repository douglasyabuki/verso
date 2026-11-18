"use client";

import { type RefObject, useLayoutEffect } from "react";

type CollectionAllocationOptions = {
  group: RefObject<HTMLElement | null>;
  content: RefObject<HTMLElement | null>;
};

type CollectionMeasurement = () => () => void;

const collectionTargets = new Map<Element, Set<CollectionMeasurement>>();
let collectionObserver: ResizeObserver | null = null;

/**
 * One observer delivers every collection's resizes together. Reads precede all
 * flex allocation writes, and both run before paint: deferring to the next frame
 * painted an expanded list inside its stale height, flashing a scrollbar.
 */
function observeCollection(target: Element, measure: CollectionMeasurement) {
  collectionObserver ??= new ResizeObserver((entries) => {
    const measures = new Set(
      entries.flatMap((entry) => [
        ...(collectionTargets.get(entry.target) ?? []),
      ]),
    );
    const writes = [...measures].map((read) => read());
    writes.forEach((write) => write());
  });
  const measures = collectionTargets.get(target);
  if (measures) measures.add(measure);
  else {
    collectionTargets.set(target, new Set([measure]));
    collectionObserver.observe(target);
  }
}

/** Release one collection's targets, disconnecting the observer after the last. */
function unobserveCollection(measure: CollectionMeasurement) {
  for (const [target, measures] of collectionTargets) {
    if (!measures.delete(measure) || measures.size) continue;
    collectionTargets.delete(target);
    collectionObserver?.unobserve(target);
  }
  if (!collectionTargets.size) {
    collectionObserver?.disconnect();
    collectionObserver = null;
  }
}

/**
 * Allocates sidebar height between sibling collections: each group's flex basis
 * fits its heading and rows, and its minimum keeps up to four rows visible
 * without exceeding an equal share of the space left by fixed groups
 * (`data-sidebar-fixed-group`). Reallocates whenever the rows, the shared
 * container, or a fixed group resizes, before the browser paints.
 * @param options.group Collection root; its parent is the shared container and
 * it must contain a `[data-sidebar="group-label"]` heading.
 * @param options.content Wrapper around the collection's menu list.
 * @returns Nothing; it writes `flex-basis` and `min-height` on the group.
 * @example useCollectionAllocation({ group: groupRef, content: contentRef });
 */
export function useCollectionAllocation({
  group: groupRef,
  content: contentRef,
}: CollectionAllocationOptions) {
  useLayoutEffect(() => {
    const group = groupRef.current!;
    const content = contentRef.current!;
    const collections = group.parentElement!;
    const measure = () => {
      // Entrance animations transform headings and rows. Allocate their layout
      // dimensions, not the temporarily scaled visual bounds.
      const heading = group.querySelector<HTMLElement>(
        '[data-sidebar="group-label"]',
      )!.offsetHeight;
      const height = content.offsetHeight;
      const styles = getComputedStyle(collections);
      const siblings = [...collections.children] as HTMLElement[];
      const collectionCount = Math.max(
        1,
        siblings.filter(
          (item) => !item.hasAttribute("data-sidebar-fixed-group"),
        ).length,
      );
      const reservedHeight = siblings
        .filter((item) => item.hasAttribute("data-sidebar-fixed-group"))
        .reduce((sum, item) => sum + item.offsetHeight, 0);
      const available =
        collections.clientHeight -
        parseFloat(styles.paddingTop) -
        parseFloat(styles.paddingBottom) -
        parseFloat(styles.rowGap) * Math.max(0, siblings.length - 1) -
        reservedHeight;
      const rowHeight =
        content.querySelector<HTMLElement>('[data-sidebar="menu-button"]')
          ?.offsetHeight ?? 32;
      const menuGap =
        parseFloat(getComputedStyle(content.querySelector("ul")!).rowGap) || 0;
      const minimum = Math.max(
        0,
        Math.min(
          rowHeight * 4 + menuGap * 3,
          available / collectionCount - heading,
        ),
      );
      const basis = `${heading + height}px`;
      const minHeight = `${heading + Math.min(height, minimum)}px`;
      return () => {
        if (group.style.flexBasis !== basis) group.style.flexBasis = basis;
        if (group.style.minHeight !== minHeight)
          group.style.minHeight = minHeight;
      };
    };
    measure()();
    observeCollection(content, measure);
    observeCollection(collections, measure);
    for (const sibling of collections.children) {
      if (sibling.hasAttribute("data-sidebar-fixed-group"))
        observeCollection(sibling, measure);
    }
    return () => unobserveCollection(measure);
  }, [groupRef, contentRef]);
}
