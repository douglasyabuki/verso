"use client";

import { Accessibility, Feedback } from "@dnd-kit/dom";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useDragDropManager,
} from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { OrderButtons } from "@/components/editor/order-buttons";
import { AnimatedList, AnimatedListItem } from "@/components/ui/animated-list";
import { Button } from "@/components/ui/button";

type SortItem = { id: string; label: string };

type SortContextValue = {
  scope: string;
  items: SortItem[];
  onReorder: (sourceId: string, targetId: string) => boolean | void;
  announce: (message: string) => void;
};

const SortContext = createContext<SortContextValue | null>(null);

const accessibility = Accessibility.configure({
  screenReaderInstructions: {
    draggable:
      "Press Space or Enter to pick up. Use Up and Down to reorder. Press Space or Enter to drop, or Escape to cancel. Move up and Move down buttons are also available.",
  },
  announcements: {
    dragstart: ({ operation: { source } }: DragStartEvent) =>
      source ? `Picked up ${source.data.label}.` : undefined,
    dragover: ({ operation: { source } }: DragOverEvent) =>
      isSortable(source)
        ? `${source.data.label}, position ${source.index + 1}.`
        : undefined,
    dragend: ({ canceled, operation: { source } }: DragEndEvent) =>
      canceled
        ? "Reordering canceled."
        : isSortable(source)
          ? `${source.data.label}, position ${source.index + 1}.`
          : undefined,
  },
});

function CancelStaleDrag({
  revision,
  contextKey,
}: {
  revision: object;
  contextKey: string;
}) {
  const manager = useDragDropManager();
  useEffect(
    () => () => {
      const source = manager?.dragOperation.source;
      // Nested registrations can disappear during React insertion-effect cleanup.
      queueMicrotask(() => {
        if (
          source &&
          manager?.dragOperation.source === source &&
          !manager.dragOperation.status.idle
        ) {
          manager.actions.stop({ canceled: true });
        }
      });
    },
    [manager, revision, contextKey],
  );
  return null;
}

export function SortableList({
  scope,
  items,
  revision,
  contextKey = "",
  selectedId,
  onReorder,
  onBeforeReorder,
  children,
}: {
  scope: string;
  items: SortItem[];
  revision: object;
  contextKey?: string;
  selectedId?: string | null;
  onReorder: (sourceId: string, targetId: string) => void;
  onBeforeReorder?: () => boolean;
  children: ReactNode;
}) {
  const latest = useRef(revision);
  useEffect(() => {
    latest.current = revision;
  }, [revision]);
  const [announcement, announce] = useState("");
  const [dragging, setDragging] = useState(false);
  const mounted = useRef(false);
  const started = useRef<{ revision: object; key: string } | null>(null);
  const key = JSON.stringify([scope, contextKey, items.map((item) => item.id)]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const reorder = (source: string, target: string) => {
    if (onBeforeReorder?.() === false) return false;
    onReorder(source, target);
    return true;
  };
  return (
    <SortContext.Provider
      value={{ scope, items, onReorder: reorder, announce }}
    >
      <DragDropProvider
        plugins={(defaults) =>
          defaults.map((plugin) =>
            plugin === Accessibility
              ? accessibility
              : plugin === Feedback
                ? Feedback.configure({ dropAnimation: null })
                : plugin,
          )
        }
        onBeforeDragStart={(event) => {
          const element = event.operation.source?.handle;
          if (
            element?.closest("fieldset:disabled, [inert]") ||
            onBeforeReorder?.() === false
          )
            event.preventDefault();
        }}
        onDragStart={() => {
          setDragging(true);
          started.current = { revision, key };
        }}
        onDragEnd={(event) => {
          setDragging(false);
          const snapshot = started.current;
          started.current = null;
          const { source, target } = event.operation;
          if (
            event.canceled ||
            !target ||
            !isSortable(source) ||
            !isSortable(target) ||
            source.group !== scope ||
            source.initialGroup !== scope ||
            target.group !== scope ||
            snapshot?.revision !== revision ||
            snapshot.key !== key
          )
            return;
          const from = items[source.initialIndex];
          const to = items[source.index];
          if (!from || !to || from.id === to.id) return;
          // Let dnd-kit finish its operation before a document edit can remove nested sources.
          queueMicrotask(() => {
            if (mounted.current && latest.current === revision)
              reorder(from.id, to.id);
          });
        }}
      >
        <CancelStaleDrag revision={revision} contextKey={key} />
        <AnimatedList
          mode="sortable"
          selectedId={selectedId}
          contextKey={scope}
          itemIds={items.map((item) => item.id)}
          dragging={dragging}
        >
          {children}
        </AnimatedList>
        <span
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </span>
      </DragDropProvider>
    </SortContext.Provider>
  );
}

type SortableRowProps = {
  id: string;
  label: string;
  children: (controls: {
    dragHandle: ReactNode;
    orderButtons: ReactNode;
  }) => ReactNode;
  className?: string;
  as?: "div" | "li";
  surface?: "standard" | "nested" | "plain";
  current?: boolean;
};

export function SortableRow(props: SortableRowProps) {
  const context = useContext(SortContext);
  if (!context) throw new Error("SortableList is required");
  const index = context.items.findIndex((item) => item.id === props.id);
  if (index < 0) {
    const Tag = props.as ?? "div";
    return (
      <AnimatedListItem
        as={Tag}
        itemId={props.id}
        className={props.className}
        surface={props.surface ?? "plain"}
        current={props.current}
      >
        {props.children({
          dragHandle: <span aria-hidden="true" className="size-7 shrink-0" />,
          orderButtons: (
            <span aria-hidden="true" className="h-6 w-12 shrink-0" />
          ),
        })}
      </AnimatedListItem>
    );
  }
  return <RegisteredRow {...props} context={context} index={index} />;
}

function RegisteredRow({
  id,
  label,
  children,
  className,
  as: Tag = "div",
  surface = "plain",
  current = false,
  context,
  index,
}: SortableRowProps & {
  context: SortContextValue;
  index: number;
}) {
  const { ref, handleRef, isDragSource, isDropTarget, isDropping } =
    useSortable({
      id,
      index: Math.max(0, index),
      group: context.scope,
      type: context.scope,
      accept: context.scope,
      disabled: index < 0 || context.items.length < 2,
      data: { label },
    });
  const handle = useRef<HTMLButtonElement | null>(null);
  const dragHandle = (
    <Button
      data-sort-handle
      ref={(element) => {
        handle.current = element;
        handleRef(element);
      }}
      variant="ghost"
      size="icon-sm"
      className="cursor-grab touch-none active:cursor-grabbing disabled:invisible"
      disabled={context.items.length < 2}
      aria-label={`Reorder ${label}`}
    >
      <GripVertical />
    </Button>
  );
  const orderButtons = (
    <OrderButtons
      label={label}
      first={index === 0}
      last={index === context.items.length - 1}
      onMove={(offset) => {
        const neighbor = context.items[index + offset];
        if (!neighbor) return;
        if (context.onReorder(id, neighbor.id) === false) return;
        context.announce(
          `${label}, position ${index + offset + 1} of ${context.items.length}.`,
        );
        requestAnimationFrame(() =>
          handle.current?.focus({ preventScroll: true }),
        );
      }}
    />
  );
  return (
    <AnimatedListItem
      as={Tag}
      itemId={id}
      surface={surface}
      current={current}
      ref={ref}
      className={className}
      data-sort-id={id}
      dragging={isDragSource}
      dropTarget={isDropTarget}
      dropping={isDropping}
    >
      {children({ dragHandle, orderButtons })}
    </AnimatedListItem>
  );
}
