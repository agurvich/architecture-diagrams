/**
 * Groups items by their own parentId, preserving each item's original
 * relative order within its bucket. A top-level item (parentId undefined)
 * lands in the `undefined` bucket — callers that only ever look up real
 * node ids can ignore it.
 */
export function groupByParent<T extends { id: string; parentId?: string }>(
  items: T[],
): Map<string | undefined, T[]> {
  const map = new Map<string | undefined, T[]>();
  for (const item of items) {
    const list = map.get(item.parentId) ?? [];
    list.push(item);
    map.set(item.parentId, list);
  }
  return map;
}
