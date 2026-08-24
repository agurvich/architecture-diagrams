export type NodeId = string;
export type EdgeId = string;
export type EdgeSetId = string;
export type FrameId = string;

export interface DiagramNode {
  id: NodeId;
  label: string;
  parentId?: NodeId;
  position: { x: number; y: number };
  metadata: Record<string, string>;
  /** Accent color for the node (CSS color string), author-chosen. */
  color?: string;
  /** Key into the icon registry (src/icons/registry.ts), e.g. "server". */
  icon?: string;
}

export interface DiagramEdge {
  id: EdgeId;
  sourceId: NodeId;
  targetId: NodeId;
  sets: EdgeSetId[];
  level: 'node' | 'group';
  metadata: Record<string, string>;
}

export interface EdgeSet {
  id: EdgeSetId;
  name: string;
  color: string;
}

export interface Frame {
  id: FrameId;
  name: string;
  activeSets: EdgeSetId[];
  expandedNodes: NodeId[];
  highlighted?: (NodeId | EdgeId)[];
  notes: string;
}

export interface Diagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  edgeSets: EdgeSet[];
  frames: Frame[];
}
