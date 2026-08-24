import { useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../../store/diagramStore';

export function Toolbar() {
  const diagram = useDiagramStore((s) => s.diagram);
  const exportJSON = useDiagramStore((s) => s.exportJSON);
  const importJSON = useDiagramStore((s) => s.importJSON);
  const loadSeed = useDiagramStore((s) => s.loadSeed);
  const importError = useDiagramStore((s) => s.importError);
  const clearImportError = useDiagramStore((s) => s.clearImportError);
  const addNode = useDiagramStore((s) => s.addNode);
  const select = useDiagramStore((s) => s.select);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = () => {
    const canvasEl = document.querySelector('.diagram-canvas');
    const rect = canvasEl?.getBoundingClientRect();
    const center = rect
      ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const position = screenToFlowPosition(center);
    const id = addNode({ label: 'New node', position, metadata: {} });
    select({ kind: 'node', id });
  };

  const handleExport = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') importJSON(reader.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="toolbar">
      <span className="toolbar__title">Multi-Lens Diagram</span>
      <span className="toolbar__stats">
        {diagram.nodes.length} nodes · {diagram.edges.length} edges · {diagram.edgeSets.length} lenses
      </span>
      <div className="toolbar__actions">
        <button className="primary" onClick={handleAddNode}>
          + Add node
        </button>
        <button onClick={handleExport}>Export JSON</button>
        <button onClick={handleImportClick}>Import JSON</button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
        <button onClick={loadSeed}>Reset to demo</button>
      </div>
      {importError && (
        <div className="toolbar__error" onClick={clearImportError}>
          {importError} (click to dismiss)
        </div>
      )}
    </div>
  );
}
