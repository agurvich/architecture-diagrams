import type { Diagram, DiagramNode, NodeId } from '../types/diagram';
import type { EffectiveEdge, EffectiveNode } from '../types/effectiveGraph';
import { buildAncestryIndex, getDescendants } from './ancestry';
import { LEAF_SIZE, computeContainerSizes, type Size } from './containerLayout';

/** Region key for a bundle root with no value for the active lens key anywhere in its own ancestor chain. */
export const UNCLASSIFIED_REGION = '__unclassified__';

export interface NodeLensRegion {
  /** The tag value this region groups, or UNCLASSIFIED_REGION. */
  value: string;
  /** Bundle root node ids in this region, sorted by label. */
  rootIds: NodeId[];
}

/** Horizontal spacing between adjacent region columns — exported so the canvas can position each region's header label at the same x its nodes stack under. */
export const REGION_GAP_X = 420;
const ROOT_GAP_Y = 60;

/**
 * Every node's bundle root under lensKey: itself, if it carries an explicit
 * (non-empty) value for that metadata key; otherwise the nearest ancestor
 * that does; otherwise itself again, as the trivial root of its own
 * "unclassified" bundle (a top-level node with no tagged ancestor at all).
 * Operates on the raw hierarchy — independent of collapse state, since
 * bundle membership is a property of the diagram, not of what's currently
 * on screen.
 */
export function computeBundleRootOf(diagram: Diagram, lensKey: string): Map<NodeId, NodeId> {
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  const cache = new Map<NodeId, NodeId>();

  function resolve(id: NodeId): NodeId {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    // Guard against malformed cyclic data the same way ancestry.ts does —
    // a self-reference short-circuits the walk instead of recursing forever.
    cache.set(id, id);
    const node = nodeById.get(id);
    const ownTag = node?.metadata[lensKey];
    const root = ownTag ? id : node?.parentId ? resolve(node.parentId) : id;
    cache.set(id, root);
    return root;
  }

  for (const n of diagram.nodes) resolve(n.id);
  return cache;
}

/**
 * Orders each region's roots to reduce edge crossings against its
 * immediate neighbor, via one left-to-right sweep of the standard
 * barycenter heuristic: the first region stays in its seed (alphabetical)
 * order as a fixed reference, and each subsequent region reorders its
 * roots by the average (normalized) rank of whatever they connect to in
 * the PREVIOUS region's already-finalized order — so an edge's two ends
 * pull toward the same row instead of crossing diagonally. A one-directional
 * sweep (rather than alternating passes to convergence) is enough to
 * resolve the common case correctly, and avoids the failure mode of
 * scoring every region simultaneously against a frozen snapshot: two
 * regions that are each other's only neighbor would score identically in
 * both directions and end up mirror-reversed together, leaving the actual
 * crossing count unchanged. A root with no neighbors in the previous
 * region keeps its seed rank as its own fallback barycenter; ties break by
 * label, so the result stays fully deterministic.
 */
function orderRegionsByBarycenter(
  regionValues: string[],
  rootsByRegion: Map<string, NodeId[]>,
  visibleEdges: EffectiveEdge[],
  bundleRootOf: Map<NodeId, NodeId>,
  nodeById: Map<NodeId, DiagramNode>,
): Map<string, NodeId[]> {
  const neighborsOf = new Map<NodeId, NodeId[]>();
  for (const e of visibleEdges) {
    const a = bundleRootOf.get(e.visibleSourceId);
    const b = bundleRootOf.get(e.visibleTargetId);
    if (!a || !b || a === b) continue;
    (neighborsOf.get(a) ?? neighborsOf.set(a, []).get(a)!).push(b);
    (neighborsOf.get(b) ?? neighborsOf.set(b, []).get(b)!).push(a);
  }

  const rankOf = (list: NodeId[]) => {
    const rank = new Map<NodeId, number>();
    list.forEach((id, i) => rank.set(id, list.length > 1 ? i / (list.length - 1) : 0.5));
    return rank;
  };

  const ordered = new Map<string, NodeId[]>();
  let previousRank: Map<NodeId, number> | null = null;
  for (const value of regionValues) {
    const seed = rootsByRegion.get(value)!; // already alphabetical
    if (!previousRank) {
      ordered.set(value, seed);
      previousRank = rankOf(seed);
      continue;
    }
    const seedRank = rankOf(seed);
    const scored = seed.map((id) => {
      const ranks = (neighborsOf.get(id) ?? []).map((n) => previousRank!.get(n)).filter((r): r is number => r !== undefined);
      const barycenter = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : seedRank.get(id)!;
      return { id, barycenter };
    });
    scored.sort((a, b) => a.barycenter - b.barycenter || (nodeById.get(a.id)?.label ?? '').localeCompare(nodeById.get(b.id)?.label ?? ''));
    const result = scored.map((s) => s.id);
    ordered.set(value, result);
    previousRank = rankOf(result);
  }
  return ordered;
}

/**
 * Repositions every visible node-lens bundle root into a region column by
 * its value for lensKey (or "Unclassified" if none), leaving every other
 * node's parentId/position untouched — an untagged descendant keeps
 * rendering nested exactly as it normally would, riding along with
 * whichever ancestor's bundle it belongs to, since only the root's own
 * detachment (parentId cleared, absolute position overridden) is needed for
 * React Flow's own nesting to carry the rest of the bundle along for free.
 *
 * A no-op passthrough (same node array, no regions) when lensKey is null.
 */
export function applyNodeLens(
  visibleNodes: EffectiveNode[],
  visibleEdges: EffectiveEdge[],
  diagram: Diagram,
  lensKey: string | null,
): { nodes: EffectiveNode[]; regions: NodeLensRegion[] } {
  if (!lensKey) return { nodes: visibleNodes, regions: [] };

  const index = buildAncestryIndex(diagram);
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  const bundleRootOf = computeBundleRootOf(diagram, lensKey);
  const isRoot = (id: NodeId) => bundleRootOf.get(id) === id;

  // Detach bundle roots (clear parentId) before sizing containers, so a
  // container's computed size already reflects whatever's actually still
  // nested under it post-extraction, not its pre-lens shape.
  const detached: EffectiveNode[] = visibleNodes.map((n) => (isRoot(n.id) ? { ...n, parentId: undefined } : n));
  const sizes: Map<NodeId, Size> = computeContainerSizes(detached);

  // Bundle-completeness for every visible container (root or not): how many
  // of its full raw descendant set are still part of its own bundle,
  // vs. how many broke away into some other bundle entirely.
  const bundleInfoById = new Map<NodeId, { visible: number; total: number }>();
  for (const n of visibleNodes) {
    const descendants = getDescendants(index, n.id);
    if (descendants.length === 0) continue;
    const myRoot = bundleRootOf.get(n.id)!;
    const nested = descendants.filter((d) => bundleRootOf.get(d) === myRoot).length;
    if (nested < descendants.length) bundleInfoById.set(n.id, { visible: nested, total: descendants.length });
  }

  // Group visible bundle roots into regions by tag value.
  const rootsByRegion = new Map<string, NodeId[]>();
  for (const n of visibleNodes) {
    if (!isRoot(n.id)) continue;
    const region = nodeById.get(n.id)?.metadata[lensKey] || UNCLASSIFIED_REGION;
    const list = rootsByRegion.get(region) ?? [];
    list.push(n.id);
    rootsByRegion.set(region, list);
  }
  for (const list of rootsByRegion.values()) {
    list.sort((a, b) => (nodeById.get(a)?.label ?? '').localeCompare(nodeById.get(b)?.label ?? ''));
  }
  // Unclassified always sorts last; every real value alphabetically before it.
  const regionValues = [...rootsByRegion.keys()].sort((a, b) => {
    if (a === UNCLASSIFIED_REGION) return 1;
    if (b === UNCLASSIFIED_REGION) return -1;
    return a.localeCompare(b);
  });
  const orderedRootsByRegion = orderRegionsByBarycenter(regionValues, rootsByRegion, visibleEdges, bundleRootOf, nodeById);
  const regions: NodeLensRegion[] = regionValues.map((value) => ({ value, rootIds: orderedRootsByRegion.get(value)! }));

  // Absolute position per bundle root: one column per region, left to
  // right in the same order as `regions`, stacked top to bottom within.
  const rootPosition = new Map<NodeId, { x: number; y: number }>();
  regions.forEach((region, colIdx) => {
    let y = 0;
    for (const rootId of region.rootIds) {
      rootPosition.set(rootId, { x: colIdx * REGION_GAP_X, y });
      y += (sizes.get(rootId) ?? LEAF_SIZE).height + ROOT_GAP_Y;
    }
  });

  // Every descendant still riding with an unclassified root gets dimmed
  // too, not just the root's own box — otherwise only the root itself
  // would read as "set aside" while its normal nested children stayed at
  // full opacity.
  const unclassifiedRoot = rootsByRegion.get(UNCLASSIFIED_REGION);
  const dimmedIds = new Set<NodeId>();
  if (unclassifiedRoot) {
    for (const rootId of unclassifiedRoot) {
      dimmedIds.add(rootId);
      for (const d of getDescendants(index, rootId)) {
        if (bundleRootOf.get(d) === rootId) dimmedIds.add(d);
      }
    }
  }

  const nodes: EffectiveNode[] = detached.map((n) => {
    const bundle = bundleInfoById.get(n.id);
    const patch: Partial<EffectiveNode> = bundle ? { lensBundle: bundle } : {};
    if (dimmedIds.has(n.id)) patch.dimmed = true;
    if (isRoot(n.id)) {
      patch.position = rootPosition.get(n.id)!;
      patch.lensUnclassified = !(nodeById.get(n.id)?.metadata[lensKey]);
      patch.lensDetached = true;
    }
    return Object.keys(patch).length > 0 ? { ...n, ...patch } : n;
  });

  return { nodes, regions };
}
