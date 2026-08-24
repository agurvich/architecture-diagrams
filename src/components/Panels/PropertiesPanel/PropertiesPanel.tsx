import { useDiagramStore } from '../../../store/diagramStore';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import { EdgePropertiesPanel } from './EdgePropertiesPanel';

export function PropertiesPanel() {
  const selected = useDiagramStore((s) => s.selected);
  if (!selected) return null;
  if (selected.kind === 'node') return <NodePropertiesPanel nodeId={selected.id} />;
  return <EdgePropertiesPanel effectiveEdgeId={selected.id} />;
}
