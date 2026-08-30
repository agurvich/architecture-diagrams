import { useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useDiagramStore } from '../../store/diagramStore';
import { EXAMPLES } from '../../data/examples';
import { encodeDiagramForURL } from '../../utils/urlDiagramCodec';

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
  const runGraphLayout = useDiagramStore((s) => s.runGraphLayout);
  const viewMode = useDiagramStore((s) => s.viewMode);
  const setViewMode = useDiagramStore((s) => s.setViewMode);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

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

  // Packs the current diagram into a ?d=<compressed> URL (see
  // utils/urlDiagramCodec.ts) and copies it to the clipboard — carries the
  // current frame along too (if any), so sharing mid-walkthrough resumes
  // right there instead of at frame 1. The recipient opens it read-only;
  // see App.tsx's init effect and Toolbar's viewMode banner below.
  const handleShare = async () => {
    try {
      const encoded = await encodeDiagramForURL(diagram);
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('d', encoded);
      if (currentFrameId) url.searchParams.set('frame', currentFrameId);
      await navigator.clipboard.writeText(url.toString());
      setShareState('copied');
    } catch {
      setShareState('error');
    } finally {
      setTimeout(() => setShareState('idle'), 2000);
    }
  };

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
      {viewMode && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700">
          <span>Viewing a shared diagram — read-only</span>
          <Button size="sm" onClick={() => setViewMode(false)}>
            Edit
          </Button>
        </div>
      )}
      <div className="ml-auto flex gap-2">
        {!viewMode && (
          <>
            <Button size="sm" onClick={handleAddNode}>
              + Add node
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runGraphLayout(null)}
              title="Auto-arrange every top-level node to minimize edge crossings (a container with its own auto layout is left alone — right-click it to run this inside it instead)"
            >
              Run graph layout
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={handleExport}>
          Export JSON
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleShare}
          title="Copy a link that opens this diagram, read-only, for someone else"
        >
          {shareState === 'copied' ? 'Link copied!' : shareState === 'error' ? 'Could not copy link' : 'Copy share link'}
        </Button>
        {!viewMode && (
          <>
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
          </>
        )}
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
