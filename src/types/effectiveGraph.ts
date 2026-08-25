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
   * A remembered compass anchor, carried through only when this merged
   * edge resolves to exactly one raw edge whose own endpoints weren't
   * substituted by a collapsed ancestor (i.e. it's unambiguous which
   * node the handle actually belongs to). Undefined otherwise, meaning
   * "use floating (dynamic) edge geometry".
   */
  sourceHandle?: 'top' | 'right' | 'bottom' | 'left';
  targetHandle?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * The actor attributed to this action, carried through only when
   * unambiguous (same condition as sourceHandle/targetHandle: exactly one
   * raw edge merged in here, endpoints unsubstituted). Undefined for a
   * merged edge or a plain edge with no attribution.
   */
  actorId?: NodeId;
  dimmed: boolean;
  highlighted: boolean;
}

export interface EffectiveGraph {
  visibleNodes: EffectiveNode[];
  visibleEdges: EffectiveEdge[];
}
