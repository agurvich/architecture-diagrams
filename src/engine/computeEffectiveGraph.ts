import type { Diagram, EdgeId, EdgeSetId, NodeId } from '../types/diagram';
import type { EffectiveEdge, EffectiveGraph, EffectiveNode } from '../types/effectiveGraph';
import type { HoverTarget } from '../types/viewState';
import { buildAncestryIndex, getDescendants, hasChildren, isAncestor, resolveVisibleAncestor } from './ancestry';

export interface ComputeEffectiveGraphOptions {
  activeSets: Set<EdgeSetId>;
  expandedNodes: Set<NodeId>;
  hoverTarget?: HoverTarget | null;
  frameHighlighted?: (NodeId | EdgeId)[] | null;
}

export function computeEffectiveGraph(
  diagram: Diagram,
  opts: ComputeEffectiveGraphOptions,
): EffectiveGraph {
  const index = buildAncestryIndex(diagram);
  const resolveCache = new Map<NodeId, NodeId>();
  const resolve = (nodeId: NodeId): NodeId => {
    let cached = resolveCache.get(nodeId);
    if (cached === undefined) {
      cached = resolveVisibleAncestor(index, nodeId, opts.expandedNodes);
      resolveCache.set(nodeId, cached);
    }
    return cached;
  };

  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  const colorCache = new Map<NodeId, string | undefined>();
  // A node with no color of its own inherits the nearest ancestor's,
  // the way it would in CSS — an explicit color set anywhere in the
  // chain "wins" for everything below it until overridden again.
  const resolveColor = (nodeId: NodeId): string | undefined => {
    if (colorCache.has(nodeId)) return colorCache.get(nodeId);
    const node = nodeById.get(nodeId);
    const color = node?.color ?? (node?.parentId ? resolveColor(node.parentId) : undefined);
    colorCache.set(nodeId, color);
    return color;
  };

  // --- Visible nodes ---
  const visibleNodes: EffectiveNode[] = [];
  for (const node of diagram.nodes) {
    if (resolve(node.id) !== node.id) continue; // subsumed by a collapsed ancestor

    const nodeHasChildren = hasChildren(index, node.id);
    const renderMode = !nodeHasChildren
      ? 'leaf'
      : opts.expandedNodes.has(node.id)
        ? 'expanded-container'
        : 'collapsed-group';

    visibleNodes.push({
      id: node.id,
      label: node.label,
      renderMode,
      collapsedChildIds: renderMode === 'collapsed-group' ? getDescendants(index, node.id) : undefined,
      position: node.position,
      // Any strict ancestor of a self-visible node is guaranteed expanded
      // (otherwise this node would have been subsumed), so the raw parentId
      // is always safe to use directly here.
      parentId: node.parentId,
      metadata: node.metadata,
      color: resolveColor(node.id),
      icon: node.icon,
      dimmed: false,
      highlighted: false,
    });
  }

  // --- Merged/deduped visible edges ---
  interface Accumulator {
    sets: Set<EdgeSetId>;
    originalEdgeIds: EdgeId[];
    levels: Set<'node' | 'group'>;
  }
  const accByKey = new Map<string, Accumulator>();
  const keyOrder: string[] = [];
  const keyToEndpoints = new Map<string, { vs: NodeId; vt: NodeId }>();

  for (const edge of diagram.edges) {
    const setsInPlay = edge.sets.filter((s) => opts.activeSets.has(s));
    if (setsInPlay.length === 0) continue;

    const vs = resolve(edge.sourceId);
    const vt = resolve(edge.targetId);
    if (vs === vt) continue; // fully internal to a collapsed group
    // One endpoint renders as a container that visually contains the
    // other (e.g. a node was reparented under a node it already has an
    // edge to, or vice versa). Floating-edge geometry has no sensible
    // anchor for "target sits inside source's own rectangle", so skip it
    // rather than draw a line that appears to come from nowhere.
    if (isAncestor(index, vs, vt) || isAncestor(index, vt, vs)) continue;

    const key = `${vs}=>${vt}`;
    let acc = accByKey.get(key);
    if (!acc) {
      acc = { sets: new Set(), originalEdgeIds: [], levels: new Set() };
      accByKey.set(key, acc);
      keyOrder.push(key);
      keyToEndpoints.set(key, { vs, vt });
    }
    for (const s of setsInPlay) acc.sets.add(s);
    acc.originalEdgeIds.push(edge.id);
    acc.levels.add(edge.level);
  }

  const visibleEdges: EffectiveEdge[] = keyOrder.map((key) => {
    const acc = accByKey.get(key)!;
    const { vs, vt } = keyToEndpoints.get(key)!;
    const levels = [...acc.levels];
    return {
      id: `merged:${key}`,
      visibleSourceId: vs,
      visibleTargetId: vt,
      sets: [...acc.sets],
      originalEdgeIds: acc.originalEdgeIds,
      count: acc.originalEdgeIds.length,
      level: levels.length === 1 ? levels[0] : 'mixed',
      dimmed: false,
      highlighted: false,
    };
  });

  applyHighlight(visibleNodes, visibleEdges, opts, resolve, diagram);

  return { visibleNodes, visibleEdges };
}

function applyHighlight(
  nodes: EffectiveNode[],
  edges: EffectiveEdge[],
  opts: ComputeEffectiveGraphOptions,
  resolve: (id: NodeId) => NodeId,
  diagram: Diagram,
): void {
  const hover = opts.hoverTarget;
  const frameHighlighted = opts.frameHighlighted;
  const hasFrameHighlight = !hover && frameHighlighted && frameHighlighted.length > 0;
  if (!hover && !hasFrameHighlight) return; // nothing to dim

  const hlNodes = new Set<string>();
  const hlEdges = new Set<string>();

  if (hover?.kind === 'node') {
    hlNodes.add(hover.id);
    for (const e of edges) {
      if (e.visibleSourceId === hover.id || e.visibleTargetId === hover.id) {
        hlEdges.add(e.id);
        hlNodes.add(e.visibleSourceId);
        hlNodes.add(e.visibleTargetId);
      }
    }
  } else if (hover?.kind === 'edge') {
    const e = edges.find((x) => x.id === hover.id);
    if (e) {
      hlEdges.add(e.id);
      hlNodes.add(e.visibleSourceId);
      hlNodes.add(e.visibleTargetId);
    }
  } else if (hasFrameHighlight) {
    const nodeIds = new Set(diagram.nodes.map((n) => n.id));
    for (const rawId of frameHighlighted!) {
      if (nodeIds.has(rawId)) {
        hlNodes.add(resolve(rawId));
      } else {
        // treat as a raw edge id: highlight whichever merged edge subsumes it
        const e = edges.find((x) => x.originalEdgeIds.includes(rawId));
        if (e) {
          hlEdges.add(e.id);
          hlNodes.add(e.visibleSourceId);
          hlNodes.add(e.visibleTargetId);
        }
      }
    }
  }

  for (const n of nodes) {
    n.highlighted = hlNodes.has(n.id);
    n.dimmed = !n.highlighted;
  }
  for (const e of edges) {
    e.highlighted = hlEdges.has(e.id);
    e.dimmed = !e.highlighted;
  }
}
