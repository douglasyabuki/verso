"use client";

import { Plus } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";

import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { SidebarSelection } from "@/components/ui/sidebar-selection";

type CollectionMeasurement = () => () => void;

const pendingCollectionMeasurements = new Set<CollectionMeasurement>();
let collectionFrame = 0;

/** Queue collection reads together before applying any flex allocation writes. */
function scheduleCollectionMeasurement(measure: CollectionMeasurement) {
  pendingCollectionMeasurements.add(measure);
  if (collectionFrame) return;
  collectionFrame = requestAnimationFrame(() => {
    collectionFrame = 0;
    const writes = [...pendingCollectionMeasurements].map((read) => read());
    pendingCollectionMeasurements.clear();
    writes.forEach((write) => write());
  });
}

export function SidebarCollection({
  label,
  active,
  onOpen,
  onCreate,
  createLabel,
  createDisabled,
  children,
}: {
  label: string;
  active: boolean;
  onOpen: () => void;
  onCreate?: () => void;
  createLabel?: string;
  createDisabled?: boolean;
  children: ReactNode;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const group = groupRef.current!;
    const content = contentRef.current!;
    const collections = group.parentElement!;
    const measure = () => {
      const heading = group
        .querySelector('[data-sidebar="group-label"]')!
        .getBoundingClientRect().height;
      const height = content.getBoundingClientRect().height;
      const styles = getComputedStyle(collections);
      const available =
        collections.clientHeight -
        parseFloat(styles.paddingTop) -
        parseFloat(styles.paddingBottom) -
        parseFloat(styles.rowGap);
      const rowHeight =
        content
          .querySelector('[data-sidebar="menu-button"]')
          ?.getBoundingClientRect().height ?? 32;
      const menuGap =
        parseFloat(getComputedStyle(content.querySelector("ul")!).rowGap) || 0;
      const minimum = Math.max(
        0,
        Math.min(rowHeight * 4 + menuGap * 3, available / 2 - heading),
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
    const observer = new ResizeObserver(() =>
      scheduleCollectionMeasurement(measure),
    );
    observer.observe(content);
    observer.observe(collections);
    return () => {
      observer.disconnect();
      pendingCollectionMeasurements.delete(measure);
      if (!pendingCollectionMeasurements.size) {
        cancelAnimationFrame(collectionFrame);
        collectionFrame = 0;
      }
    };
  }, []);
  return (
    <SidebarGroup ref={groupRef} className="min-h-0 shrink px-3 py-0">
      <SidebarSelection className="shrink-0">
        <SidebarGroupLabel
          render={<button type="button" />}
          aria-current={active ? "page" : undefined}
          data-active={active || undefined}
          className="h-9 w-full pr-9 hover:bg-sidebar-accent data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground"
          onClick={onOpen}
        >
          {label}
        </SidebarGroupLabel>
      </SidebarSelection>
      {onCreate && (
        <SidebarGroupAction
          className="top-2 right-5 disabled:opacity-50"
          aria-label={createLabel}
          title={createLabel}
          disabled={createDisabled}
          onClick={onCreate}
        >
          <Plus />
        </SidebarGroupAction>
      )}
      <div
        data-collection-viewport
        role="region"
        aria-label={`${label} list`}
        tabIndex={0}
        className="app-scrollbar min-h-0 overflow-x-hidden overflow-y-auto"
      >
        <div ref={contentRef}>
          <SidebarSelection>{children}</SidebarSelection>
        </div>
      </div>
    </SidebarGroup>
  );
}
