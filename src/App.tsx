import { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { EdgeSetTogglePanel } from './components/Panels/EdgeSetTogglePanel';
import { NodeLensPanel } from './components/Panels/NodeLensPanel';
import { HierarchyPanel } from './components/Panels/HierarchyPanel';
import { FrameSequencerPanel } from './components/Panels/FrameSequencerPanel';
import { FramePlayerControls } from './components/Panels/FramePlayerControls';
import { PropertiesPanel } from './components/Panels/PropertiesPanel/PropertiesPanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { TooltipProvider } from './components/ui/tooltip';
import { useDiagramStore } from './store/diagramStore';
import { decodeDiagramFromURL } from './utils/urlDiagramCodec';

const FRAME_PARAM = 'frame';
const DIAGRAM_PARAM = 'd';

function App() {
  const selected = useDiagramStore((s) => s.selected);
  const viewMode = useDiagramStore((s) => s.viewMode);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Deep-link a frame via ?frame=<id>, and/or a whole diagram via ?d=<...>
  // (see utils/urlDiagramCodec.ts and Toolbar's "Copy share link") — on
  // first mount, valid params win over whatever state starts as (gotoFrame
  // no-ops harmlessly on an unknown id). A ?d= diagram loads via the same
  // path as "Import JSON" and then flips on viewMode — opening someone
  // else's shared link is read-only until you explicitly hit "Edit",
  // never mistakable for editing your own working diagram. After the
  // initial load, the URL just mirrors currentFrameId, so stepping through
  // the sequencer (or Next/Prev) keeps the address bar pointing at the
  // frame actually on screen. The ref makes the very first run skip
  // writing (letting the resulting state change trigger the write on the
  // next run instead) so the initial deep link isn't clobbered before
  // it's even applied.
  const didInitFromUrl = useRef(false);
  useEffect(() => {
    if (!didInitFromUrl.current) {
      didInitFromUrl.current = true;
      const params = new URLSearchParams(window.location.search);
      const encodedDiagram = params.get(DIAGRAM_PARAM);
      const requestedFrame = params.get(FRAME_PARAM);

      if (encodedDiagram) {
        void (async () => {
          try {
            const diagram = await decodeDiagramFromURL(encodedDiagram);
            useDiagramStore.getState().importJSON(JSON.stringify(diagram));
            useDiagramStore.getState().setViewMode(true);
          } catch {
            useDiagramStore.setState({
              importError: 'This shared diagram link could not be read — it may be corrupted or from an incompatible version of the app.',
            });
          } finally {
            // The payload's only job was getting the diagram into the
            // store — strip it either way so the address bar doesn't
            // carry it around forever, and so a plain reload doesn't
            // re-decode (and re-flip to view mode) after the viewer has
            // already started editing.
            params.delete(DIAGRAM_PARAM);
            const query = params.toString();
            window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
            if (requestedFrame) useDiagramStore.getState().gotoFrame(requestedFrame);
          }
        })();
        return;
      }

      if (requestedFrame) {
        useDiagramStore.getState().gotoFrame(requestedFrame);
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
                    <NodeLensPanel />
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
                  {selected && !viewMode && (
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
