import { ReactFlowProvider } from '@xyflow/react';
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

  return (
    <TooltipProvider delayDuration={300}>
      <ReactFlowProvider>
        <div className="flex h-screen w-screen flex-col">
          <Toolbar />
          <div className="flex min-h-0 flex-1">
            <aside className="flex w-[260px] shrink-0 flex-col gap-2.5 overflow-y-auto border-r bg-card p-2.5">
              <EdgeSetTogglePanel />
              <HierarchyPanel />
            </aside>
            <main className="relative min-w-0 flex-1">
              <DiagramCanvas />
              <FramePlayerControls />
            </main>
            <aside className="flex w-[260px] shrink-0 flex-col gap-2.5 overflow-y-auto border-l bg-card p-2.5">
              {selected && <PropertiesPanel />}
              <FrameSequencerPanel />
            </aside>
          </div>
        </div>
      </ReactFlowProvider>
    </TooltipProvider>
  );
}

export default App;
