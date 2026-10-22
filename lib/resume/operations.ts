/** Move an item without changing IDs. @param items Mutable draft array. @param index Current position. @param offset -1 or 1. @returns Nothing; boundary moves are ignored. @example move(items, 2, -1) */
export function move<T>(items: T[], index: number, offset: number): void {
  const target = index + offset;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
}

/** Move a visible item to another visible slot, preserving hidden items' positions.
 * @param items Mutable complete draft list. @param visibleIds Ordered visible sortable IDs.
 * @param sourceId Item being moved. @param targetId Item whose visible position is the destination.
 * @param getId Stable identity accessor.
 * @returns Nothing; invalid, stale, duplicate, and unchanged moves are ignored.
 * @example reorderVisible(entries, visibleIds, draggedId, targetId, entry => entry.id);
 */
export function reorderVisible<T>(
  items: T[],
  visibleIds: string[],
  sourceId: string,
  targetId: string,
  getId: (item: T) => string,
): void {
  const source = visibleIds.indexOf(sourceId);
  const target = visibleIds.indexOf(targetId);
  if (
    source < 0 ||
    target < 0 ||
    source === target ||
    new Set(visibleIds).size !== visibleIds.length
  )
    return;
  const visible = new Set(visibleIds);
  const slots = items.flatMap((item, index) =>
    visible.has(getId(item)) ? [index] : [],
  );
  if (
    slots.length !== visibleIds.length ||
    slots.some((slot, index) => getId(items[slot]) !== visibleIds[index])
  )
    return;
  const reordered = slots.map((slot) => items[slot]);
  reordered.splice(target, 0, reordered.splice(source, 1)[0]);
  slots.forEach((slot, index) => {
    items[slot] = reordered[index];
  });
}
