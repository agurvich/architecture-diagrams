import type { EdgeId, EdgeSetId, NodeId } from './diagram';

export type RenderMode = 'leaf' | 'collapsed-group' | 'expanded-container' | 'actor-anchor';

export interface EffectiveNode {
  [key: string]: unknown;
  id: NodeId;
  label: string;
  renderMode: RenderMode;
  collapsedChildIds?: NodeId[];
  position: { x: number; y: number };
  /** Set only when nested inside an expanded-container in the render tree. */
  parentId?: NodeId;
  metadata: Record<string, string>;
  color?: string;
  icon?: string | null;
  /** Eligible to be attributed as an action's actor, or as a trigger's source. */
  isActor?: boolean;
  /**
   * actor-anchor nodes only: the effective edge id (the action) this
   * anchor sits on and represents — clicking the anchor selects this
   * edge rather than the (non-existent, synthetic) anchor "node" itself.
   */
  linkedEdgeId?: string;
  dimmed: boolean;
  highlighted: boolean;
}

export interface EffectiveEdge {
  [key: string]: unknown;
  /** `merged:${visibleSourceId}=>${visibleTargetId}` */
  id: string;
  visibleSourceId: NodeId;
  visibleTargetId: NodeId;
  sets: EdgeSetId[];
  originalEdgeIds: EdgeId[];
  count: number;
  /** Distinct, non-empty `metadata.label` values from the merged raw edges, in first-seen order. */
  labels: string[];
  /**
   * A remembered compass anchor, carried through when this merged edge
   * resolves to exactly one raw edge — a collapsed ancestor standing in
   * for the real endpoint is still a real node with its own border, so
   * substitution doesn't make the remembered side ambiguous. Undefined
   * for a merged edge (count > 1), meaning "use floating (dynamic) edge
   * geometry".
   */
  sourceHandle?: 'top' | 'right' | 'bottom' | 'left';
  targetHandle?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * The actor attributed to this action, carried through under the same
   * condition as sourceHandle/targetHandle: exactly one raw edge merged
   * in here. Undefined for a merged edge or a plain edge with no
   * attribution.
   */
  actorId?: NodeId;
  dimmed: boolean;
  highlighted: boolean;
}

export interface EffectiveGraph {
  visibleNodes: EffectiveNode[];
  visibleEdges: EffectiveEdge[];
}
