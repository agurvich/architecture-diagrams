import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { EdgeSetTogglePanel } from './components/Panels/EdgeSetTogglePanel';
import { HierarchyPanel } from './components/Panels/HierarchyPanel';
import { FrameSequencerPanel } from './components/Panels/FrameSequencerPanel';
import { FramePlayerControls } from './components/Panels/FramePlayerControls';
import { PropertiesPanel } from './components/Panels/PropertiesPanel/PropertiesPanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { TooltipProvider } from './components/ui/tooltip';
import { useDiagramStore } from './store/diagramStore';

function App() {
  const selected = useDiagramStore((s) => s.selected);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <ReactFlowProvider>
        <div className="flex h-screen w-screen flex-col">
          <Toolbar />
          <div className="flex min-h-0 flex-1">
            <aside
              className={`relative flex shrink-0 flex-col overflow-y-auto border-r bg-card transition-[width] duration-150 ${
                leftCollapsed ? 'w-8 gap-0 p-0' : 'w-[260px] gap-2.5 p-2.5'
              }`}
            >
              <button
                className="absolute top-2 right-1.5 z-10 cursor-pointer rounded border-none bg-transparent p-0.5 text-muted-foreground hover:bg-accent"
                onClick={() => setLeftCollapsed((v) => !v)}
                title={leftCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                {leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
              {!leftCollapsed && (
                <>
                  <EdgeSetTogglePanel />
                  <HierarchyPanel />
                </>
              )}
            </aside>
            <main className="relative min-w-0 flex-1">
              <DiagramCanvas />
              <FramePlayerControls />
            </main>
            <aside
              className={`relative flex shrink-0 flex-col overflow-y-auto border-l bg-card transition-[width] duration-150 ${
                rightCollapsed ? 'w-8 gap-0 p-0' : 'w-[260px] gap-2.5 p-2.5'
              }`}
            >
              <button
                className="absolute top-2 left-1.5 z-10 cursor-pointer rounded border-none bg-transparent p-0.5 text-muted-foreground hover:bg-accent"
                onClick={() => setRightCollapsed((v) => !v)}
                title={rightCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                {rightCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
              {!rightCollapsed && (
                <>
                  {selected && <PropertiesPanel />}
                  <FrameSequencerPanel />
                </>
              )}
            </aside>
          </div>
        </div>
      </ReactFlowProvider>
    </TooltipProvider>
  );
}

export default App;
