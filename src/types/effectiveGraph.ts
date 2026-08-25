import type { EdgeId, EdgeSetId, NodeId } from './diagram';

export type RenderMode = 'leaf' | 'collapsed-group' | 'expanded-container';

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
  dimmed: boolean;
  highlighted: boolean;
}

export interface EffectiveGraph {
  visibleNodes: EffectiveNode[];
  visibleEdges: EffectiveEdge[];
}
