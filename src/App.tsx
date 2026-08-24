import { ReactFlowProvider } from '@xyflow/react';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { EdgeSetTogglePanel } from './components/Panels/EdgeSetTogglePanel';
import { HierarchyPanel } from './components/Panels/HierarchyPanel';
import { FrameSequencerPanel } from './components/Panels/FrameSequencerPanel';
import { FramePlayerControls } from './components/Panels/FramePlayerControls';
import { PropertiesPanel } from './components/Panels/PropertiesPanel/PropertiesPanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { useDiagramStore } from './store/diagramStore';

function App() {
  const selected = useDiagramStore((s) => s.selected);

  return (
    <ReactFlowProvider>
      <div className="app-shell">
        <Toolbar />
        <div className="app-body">
          <aside className="app-sidebar app-sidebar--left">
            <EdgeSetTogglePanel />
            <HierarchyPanel />
          </aside>
          <main className="app-canvas-wrap">
            <DiagramCanvas />
            <FramePlayerControls />
          </main>
          <aside className="app-sidebar app-sidebar--right">
            {selected && <PropertiesPanel />}
            <FrameSequencerPanel />
          </aside>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default App;
