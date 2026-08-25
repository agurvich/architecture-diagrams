import type { EdgeId } from '../types/diagram';

const ANCHOR_PREFIX = 'anchor:';

/**
 * The synthetic node id representing the midpoint of an action edge (a raw
 * edge with actorId set). A trigger edge's own targetId points at this
 * instead of a real node, so it visually attaches to the specific action
 * rather than just the actor in general. Keyed off the action edge's own
 * (permanent) id rather than its current merged/effective id, so the
 * reference stays stable across expand/collapse.
 */
export function anchorIdFor(actionEdgeId: EdgeId): string {
  return `${ANCHOR_PREFIX}${actionEdgeId}`;
}

export function isAnchorId(id: string): boolean {
  return id.startsWith(ANCHOR_PREFIX);
}

export function actionEdgeIdFromAnchor(anchorId: string): EdgeId {
  return anchorId.slice(ANCHOR_PREFIX.length);
}
