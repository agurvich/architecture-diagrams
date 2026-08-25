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
  /**
   * Icon override. Three states: `undefined` (field absent) — Auto, guess
   * live from label/metadata via src/icons/iconMatcher.ts; `null` — pinned
   * to no icon at all; a string — pinned to that key in
   * src/icons/registry.ts.
   */
  icon?: string | null;
}

export interface DiagramEdge {
  id: EdgeId;
  sourceId: NodeId;
  targetId: NodeId;
  sets: EdgeSetId[];
  metadata: Record<string, string>;
  /**
   * The compass side of each node's border this edge was dragged from/to,
   * if it was drawn by hand. When both are set, the edge renders as a
   * curve anchored to those exact points instead of the default floating
   * (dynamic center-to-center intersection) straight line — undefined
   * for edges with no remembered anchor (e.g. imported JSON), which fall
   * back to floating geometry.
   */
  sourceHandle?: 'top' | 'right' | 'bottom' | 'left';
  targetHandle?: 'top' | 'right' | 'bottom' | 'left';
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
  /**
   * Accumulating library of custom node colors: every color ever chosen
   * via the full color picker gets appended here (deduped), independent
   * of which nodes currently use it, so authors build up a reusable
   * palette instead of re-picking the same shade repeatedly. Optional so
   * diagrams saved before this field existed still parse.
   */
  colorPalette?: string[];
}
