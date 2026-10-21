/** Move an item without changing IDs. @param items Mutable draft array. @param index Current position. @param offset -1 or 1. @returns Nothing; boundary moves are ignored. @example move(items, 2, -1) */
export function move<T>(items: T[], index: number, offset: number): void {
  const target = index + offset;
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
}
