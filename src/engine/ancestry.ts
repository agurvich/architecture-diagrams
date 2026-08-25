import type { Diagram, NodeId } from '../types/diagram';

export interface AncestryIndex {
  parentOf: Map<NodeId, NodeId>;
  childrenOf: Map<NodeId, NodeId[]>;
}

export function buildAncestryIndex(diagram: Diagram): AncestryIndex {
  const parentOf = new Map<NodeId, NodeId>();
  const childrenOf = new Map<NodeId, NodeId[]>();

  for (const node of diagram.nodes) {
    if (node.parentId) {
      parentOf.set(node.id, node.parentId);
      const siblings = childrenOf.get(node.parentId) ?? [];
      siblings.push(node.id);
      childrenOf.set(node.parentId, siblings);
    }
  }

  return { parentOf, childrenOf };
}

export function hasChildren(index: AncestryIndex, nodeId: NodeId): boolean {
  return (index.childrenOf.get(nodeId)?.length ?? 0) > 0;
}

function getAncestorChain(index: AncestryIndex, nodeId: NodeId): NodeId[] {
  const chain: NodeId[] = [nodeId];
  let current = nodeId;
  const seen = new Set<NodeId>([nodeId]);
  while (index.parentOf.has(current)) {
    const parent = index.parentOf.get(current)!;
    if (seen.has(parent)) break; // guard against malformed cyclic data
    chain.unshift(parent);
    seen.add(parent);
    current = parent;
  }
  return chain; // [root, ..., nodeId]
}

/**
 * Walks root-to-node along the parent chain. The FIRST ancestor (excluding
 * nodeId itself) that has children AND is not in expandedNodes is the
 * topmost collapsed ancestor that subsumes nodeId. If none, nodeId is
 * visible as itself.
 *
 * This same function resolves an edge drawn directly against a container
 * (rather than one of its children) correctly with no special-casing: the
 * edge's endpoint IS the parent node's own id, so resolving it only walks
 * that parent's strict ancestors — the parent's own collapse state
 * doesn't affect whether it itself is visible.
 */
export function resolveVisibleAncestor(
  index: AncestryIndex,
  nodeId: NodeId,
  expandedNodes: Set<NodeId>,
): NodeId {
  const chain = getAncestorChain(index, nodeId);
  for (let i = 0; i < chain.length - 1; i++) {
    const ancestor = chain[i];
    if (hasChildren(index, ancestor) && !expandedNodes.has(ancestor)) {
      return ancestor;
    }
  }
  return nodeId;
}

/**
 * True if ancestorId is a strict ancestor of nodeId in the raw hierarchy
 * (regardless of collapse state). Used to catch edges that would otherwise
 * render between a container and something already nested inside it — the
 * floating-edge geometry has no sensible answer for that case, since the
 * "target" point lies inside the "source" rectangle rather than outside it.
 */
export function isAncestor(index: AncestryIndex, ancestorId: NodeId, nodeId: NodeId): boolean {
  let current = index.parentOf.get(nodeId);
  const seen = new Set<NodeId>();
  while (current && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    current = index.parentOf.get(current);
  }
  return false;
}

/** All descendant node ids of nodeId (not including nodeId itself). */
export function getDescendants(index: AncestryIndex, nodeId: NodeId): NodeId[] {
  const result: NodeId[] = [];
  const stack = [...(index.childrenOf.get(nodeId) ?? [])];
  while (stack.length) {
    const current = stack.pop()!;
    result.push(current);
    stack.push(...(index.childrenOf.get(current) ?? []));
  }
  return result;
}
