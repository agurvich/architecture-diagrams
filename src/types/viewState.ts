import type { NodeId, EdgeId } from './diagram';

export interface HoverTarget {
  kind: 'node' | 'edge';
  id: string;
}

export interface SelectedElement {
  kind: 'node' | 'edge';
  id: NodeId | EdgeId;
}
