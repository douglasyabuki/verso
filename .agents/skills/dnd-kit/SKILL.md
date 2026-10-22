---
name: dnd-kit
description: Implement, debug, or review dnd-kit sorting in Verso's content library and variant editor, including handles, keyboard alternatives, filtered ordering, drag feedback, cancellation, and undoable drops. Does not cover resume text editing or compiler behavior.
---

# dnd-kit for Verso

Retain its modern API checks and interaction-specific configuration, not its calendar, recurrence, task nesting, or cross-feature drop rules.

## Check the installed API first

Reviewed against installed `@dnd-kit/react` and `@dnd-kit/dom` **0.5.1**, React **19.3.0**, and Next.js **16.4.2**. Recheck the manifest, lockfile, and installed declarations before changing drag code. Do not upgrade dependencies incidentally.

- Start at the [React quickstart](https://dndkit.com/react/quickstart/), [useSortable](https://dndkit.com/react/hooks/use-sortable/), and [sortable state management](https://dndkit.com/react/guides/sortable-state-management/). Installed `react/index.d.ts`, `react/sortable.d.ts`, `dom/index.d.ts`, and `dom/sortable.d.ts` take precedence over examples marked Latest.
- Use `DragDropProvider` and React hooks from `@dnd-kit/react`; `useSortable` and `isSortable` from `@dnd-kit/react/sortable`. Modern sensors/plugins from `@dnd-kit/dom` are compatible. Do not mix legacy `DndContext`, `SortableContext`, `useSensors`, or `active/over` events into this implementation.
- Events expose `event.operation.source/target` and `event.canceled`. `useSortable` exposes `ref` and `handleRef`; attach them to the measured row and dedicated accessible button respectively.
- Default sortable plugins include optimistic DOM sorting and keyboard sorting. With those defaults, source and target can be the same entity: use `isSortable(source)` and `source.initialIndex/index`, checking the group too. Do not assume different source/target IDs.
- Provider sensor/plugin arrays replace defaults; callbacks extend them. Preserve accessibility, keyboard input, and auto-scroll. Pointer activation constraints are alternatives, not cumulative requirements. Do not replace default interactive-element protection casually.

## Verso interaction contracts

- Content shows entries and achievements in library order. Variants shows selected entries and achievements in variant output order, followed by unselected items in library order. Selection indicators remain visible in Content.
- Library entry moves touch only `section.entries`; library achievement moves touch only `entry.bullets`. Variant moves touch only the active variant's section/entry references or `bulletIds`. Never rewrite another variant or library order as a consequence of a variant move.
- Sort only within the same list. Excluded variant entries and achievements are selection controls, not sortable destinations. Keep registration IDs and rendered indexes consistent with each sortable group; use separate group identities for sections, entries, and achievements.
- Render excluded items without a sortable hook rather than registering them with `disabled: true`: in 0.5.1 the optimistic sorting plugin enumerates every registered sortable droppable, including disabled ones, when constructing its group order.
- When search/archive filters hide entries, reorder visible IDs among their original slots. Hidden IDs retain their positions. Dragging and move buttons must call the same pure operation.
- Preserve the active source through feedback. Keep preview state transient; commit once on a valid completed drop through `WorkspaceEdit`. No persistence on hover. If using default optimistic sorting, do not layer React-owned speculative reordering on top of it.
- Cancel/no-op drops and invalid destinations must not edit. Cancel when navigating, changing visible membership, undoing/redoing, or replacing the workspace. Reject deferred commits against stale document identity; avoid nested-source teardown updates during insertion effects.
- Keep handles separate from inputs, rich text, checkboxes, links, and other buttons. Keep touch scrolling available outside handles. Retain labeled move-up/down alternatives, focus restoration, instructions, and position announcements.

## Validation

Follow the repository exclusion of automated tests: do not add or run them. Run format checking, lint, route type generation/type checking, and a production build. Manually check pointer and keyboard sorting, touch when available, nested lists, filtering with hidden IDs, cancellation/outside drops, no-op drops, undo/redo, focus and announcements, local save/reload, and two variants' independent output order. Watch for duplicate registration, React insertion-effect warnings, stale feedback, or accidental edits from ordinary controls. Report unverified browser/device behavior explicitly.
