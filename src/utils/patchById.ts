/** Returns a copy of items with the entry matching id shallow-merged with patch; other entries untouched. */
export function patchById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
