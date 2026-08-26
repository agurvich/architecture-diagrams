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
  /** Marks this node as eligible to be attributed as the actor performing an action edge (see DiagramEdge.actorId) or triggering one. */
  isActor?: boolean;
  /**
   * When set, this container's own children are auto-arranged in a single
   * row (horizontal) or column (vertical) with `gap` px between them,
   * Figma-style, instead of each one's stored `position` being read
   * literally. A child's stored position still matters while this is
   * set — it's the sort key (top-to-bottom for vertical, left-to-right
   * for horizontal) that decides where in the row/column it lands, so
   * dragging it near a different sibling reorders rather than repositions
   * arbitrarily. See engine/containerLayout.ts.
   */
  autoLayout?: { direction: 'vertical' | 'horizontal'; gap: number };
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
  /**
   * The actor (a node with isActor: true) responsible for this action —
   * independent of sourceId/targetId, since the actor performing an
   * action isn't necessarily either endpoint (e.g. an IAM role copying
   * between two buckets it's not itself drawn connected to). Rendered as
   * a small anchor node at this edge's midpoint (see engine/actorAnchor.ts)
   * that a "trigger" edge — a plain DiagramEdge whose own targetId is that
   * anchor's id — can point at to show a specific process step causing
   * this specific action, rather than just the actor in general.
   */
  actorId?: NodeId;
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
