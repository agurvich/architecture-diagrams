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
  level: 'node' | 'group' | 'mixed';
  dimmed: boolean;
  highlighted: boolean;
}

export interface EffectiveGraph {
  visibleNodes: EffectiveNode[];
  visibleEdges: EffectiveEdge[];
}
