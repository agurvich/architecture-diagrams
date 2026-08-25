import { useEffect, useRef, useState } from 'react';
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

const FRAME_PARAM = 'frame';

function App() {
  const selected = useDiagramStore((s) => s.selected);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Deep-link a frame via ?frame=<id> — on first mount, a valid param wins
  // over whatever currentFrameId starts as (gotoFrame no-ops harmlessly on
  // an unknown id). After that, the URL just mirrors currentFrameId, so
  // stepping through the sequencer (or Next/Prev) keeps the address bar
  // pointing at the frame actually on screen — reload or share the link
  // and it resumes there. The ref makes the very first run skip writing
  // (letting gotoFrame's own resulting state change trigger the write on
  // the next run) so the initial deep link isn't clobbered before it's
  // even applied.
  const didInitFromUrl = useRef(false);
  useEffect(() => {
    if (!didInitFromUrl.current) {
      didInitFromUrl.current = true;
      const requested = new URLSearchParams(window.location.search).get(FRAME_PARAM);
      if (requested) {
        useDiagramStore.getState().gotoFrame(requested);
        return;
      }
    }
    const params = new URLSearchParams(window.location.search);
    if (currentFrameId) params.set(FRAME_PARAM, currentFrameId);
    else params.delete(FRAME_PARAM);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [currentFrameId]);

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
