import type { DiagramNode } from '../types/diagram';

/** Every metadata value in use for each key, across all given nodes, first-seen order. */
export function getMetadataValuesByKey(nodes: DiagramNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const n of nodes) {
    for (const [k, v] of Object.entries(n.metadata)) {
      if (!v) continue;
      const list = map.get(k) ?? [];
      if (!list.includes(v)) list.push(v);
      map.set(k, list);
    }
  }
  return map;
}

/** Every distinct metadata key in use across all given nodes, sorted. */
export function getMetadataKeys(nodes: DiagramNode[]): string[] {
  return [...getMetadataValuesByKey(nodes).keys()].sort();
}
