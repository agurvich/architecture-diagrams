import { useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useDiagramStore } from '../../store/diagramStore';
import { EXAMPLES } from '../../data/examples';

export function Toolbar() {
  const diagram = useDiagramStore((s) => s.diagram);
  const exportJSON = useDiagramStore((s) => s.exportJSON);
  const importJSON = useDiagramStore((s) => s.importJSON);
  const resetToImported = useDiagramStore((s) => s.resetToImported);
  const hasImported = useDiagramStore((s) => s.lastImportedDiagram !== null);
  const loadSeed = useDiagramStore((s) => s.loadSeed);
  const loadExample = useDiagramStore((s) => s.loadExample);
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
    <div className="relative flex items-center gap-4 border-b bg-card px-3.5 py-2">
      <span className="font-semibold">Multi-Lens Diagram</span>
      <span className="toolbar__stats text-xs text-muted-foreground">
        {diagram.nodes.length} nodes · {diagram.edges.length} edges · {diagram.edgeSets.length} lenses
      </span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" onClick={handleAddNode}>
          + Add node
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport}>
          Export JSON
        </Button>
        <Button size="sm" variant="outline" onClick={handleImportClick}>
          Import JSON
        </Button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
        {hasImported && (
          <Button size="sm" variant="outline" onClick={resetToImported} title="Reload the last JSON file you imported, discarding edits made since">
            Reset to imported
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={loadSeed}>
          Reset to demo
        </Button>
        <select
          className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs"
          value=""
          title="Load one of the built-in example diagrams"
          onChange={(e) => {
            const example = EXAMPLES.find((ex) => ex.id === e.target.value);
            if (example) loadExample(example.diagram);
          }}
        >
          <option value="" disabled>
            Load example…
          </option>
          {EXAMPLES.map((ex) => (
            <option key={ex.id} value={ex.id} title={ex.description}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>
      {importError && (
        <div
          className="absolute right-3.5 top-full z-20 cursor-pointer rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
          onClick={clearImportError}
        >
          {importError} (click to dismiss)
        </div>
      )}
    </div>
  );
}
