import { useDiagramStore } from '../../../store/diagramStore';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import { EdgePropertiesPanel } from './EdgePropertiesPanel';

export function PropertiesPanel() {
  const selected = useDiagramStore((s) => s.selected);
  const viewMode = useDiagramStore((s) => s.viewMode);
  // Every field in here is an editable control with no read-only
  // rendering of its own — while viewing a shared diagram, clicking a
  // node/edge still highlights it on the canvas (harmless), but no editor
  // opens for it.
  if (!selected || viewMode) return null;
  if (selected.kind === 'node') return <NodePropertiesPanel nodeId={selected.id} />;
  return <EdgePropertiesPanel effectiveEdgeId={selected.id} />;
}
