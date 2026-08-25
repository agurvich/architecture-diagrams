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
              className={`relative flex min-h-0 shrink-0 flex-col border-r bg-card transition-[width] duration-150 ${
                leftCollapsed ? 'w-8' : 'w-[260px]'
              }`}
            >
              <button
                className="absolute top-2 right-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setLeftCollapsed((v) => !v)}
                title={leftCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                {leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
              {!leftCollapsed && (
                <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 pt-9">
                  {/* Card (see ui/card.tsx) is `overflow-hidden` with the
                      flexbox default `flex-shrink: 1` — without `shrink-0`
                      here, a flex-col parent that's out of room silently
                      *shrinks* each Card below its own content height and
                      Card's own overflow-hidden clips the excess, instead
                      of it ever reaching this div's overflow-y-auto. */}
                  <div className="shrink-0">
                    <EdgeSetTogglePanel />
                  </div>
                  <div className="shrink-0">
                    <HierarchyPanel />
                  </div>
                </div>
              )}
            </aside>
            <main className="relative min-w-0 flex-1">
              <DiagramCanvas />
              <FramePlayerControls />
            </main>
            <aside
              className={`relative flex min-h-0 shrink-0 flex-col border-l bg-card transition-[width] duration-150 ${
                rightCollapsed ? 'w-8' : 'w-[260px]'
              }`}
            >
              <button
                className="absolute top-2 left-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setRightCollapsed((v) => !v)}
                title={rightCollapsed ? 'Expand panel' : 'Collapse panel'}
              >
                {rightCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
              {!rightCollapsed && (
                <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 pt-9">
                  {selected && (
                    <div className="shrink-0">
                      <PropertiesPanel />
                    </div>
                  )}
                  <div className="shrink-0">
                    <FrameSequencerPanel />
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </ReactFlowProvider>
    </TooltipProvider>
  );
}

export default App;
