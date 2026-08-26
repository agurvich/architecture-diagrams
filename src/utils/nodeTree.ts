import type { NodeId } from '../types/diagram';

/** True if making candidateParentId the parent of nodeId would create a cycle (candidateParentId is nodeId itself, or already one of its own descendants). */
export function wouldCreateCycle(nodes: { id: NodeId; parentId?: NodeId }[], nodeId: NodeId, candidateParentId: NodeId): boolean {
  let current: NodeId | undefined = candidateParentId;
  while (current) {
    if (current === nodeId) return true;
    current = nodes.find((n) => n.id === current)?.parentId;
  }
  return false;
}
