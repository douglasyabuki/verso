---
name: dnd-kit
description: Implement, debug, or review dnd-kit sorting in Verso's career and independent-resume editors, including handles, keyboard alternatives, filtered ordering, drag feedback, cancellation, and undoable Saves. Does not cover resume text editing or compiler behavior.
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

The active schema-2 application separates shared Career details from independent
one-language resumes. Forms and ordering use explicit Save/Cancel; drops change
only the owning draft. Retired schema-1 variant modules are reference assets,
not constraints on active commit timing or data structures.

- Career ordering changes shared list order. Resume Content & order changes only that resume's selection/order; it never reorders shared content or another resume. Hiding a parent retains nested choices. Existing archived selections stay usable; archived content cannot be newly selected.
- Section entry-order drafts are independent of entry forms. Sorting preserves the entry draft, selection, filter, and scroll. Save/Cancel affects only its scope, and each successful Save creates one history step. Order scopes contain IDs only; wording edits do not change their baselines.
- Sort only within the same list. Excluded resume entries and achievements are selection controls, not sortable destinations. Keep registration IDs and rendered indexes consistent with each sortable group; use separate group identities for sections, entries, and achievements.
- Render excluded items without a sortable hook rather than registering them with `disabled: true`: in 0.5.1 the optimistic sorting plugin enumerates every registered sortable droppable, including disabled ones, when constructing its group order.
- When search/archive filters hide entries, reorder visible IDs among their original slots. Hidden IDs retain their positions. Dragging and move buttons must call the same pure operation.
- Preserve the active source through feedback. Keep preview state transient; apply a valid completed drop once to the owning form draft. Persist and add a workspace undo step only on explicit form Save; Cancel restores selection/order together. No persistence on hover or drop. If using default optimistic sorting, do not layer React-owned speculative reordering on top of it.
- Cancel/no-op drops and invalid destinations must not edit. Cancel when navigating, changing visible membership, undoing/redoing, or replacing the workspace. Reject deferred commits against stale document identity; avoid nested-source teardown updates during insertion effects.
- Keep handles separate from inputs, rich text, checkboxes, links, and other buttons. Keep touch scrolling available outside handles. Retain labeled move-up/down alternatives, focus restoration, instructions, and position announcements.

## Validation

Read vitest-testing; use the configured Node, Chromium component, and production E2E suites to cover reorder/filter/cancel behavior, keyboard alternatives, and independent entry/order Save/Cancel boundaries. Run format checking, lint, route type generation/type checking, and a production build for implementation changes. Manually check pointer and keyboard sorting, touch when available, nested lists, filtering with hidden IDs, cancellation/outside drops, no-op drops, undo/redo, focus and announcements, local save/reload, and two resumes' independent output order. Watch for duplicate registration, React insertion-effect warnings, stale feedback, or accidental edits from ordinary controls. Report unverified browser/device behavior explicitly.
