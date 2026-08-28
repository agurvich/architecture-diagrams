import { Button } from '@/components/ui/button';
import { useDiagramStore } from '../../store/diagramStore';

export function FramePlayerControls() {
  const frames = useDiagramStore((s) => s.diagram.frames);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const nextFrame = useDiagramStore((s) => s.nextFrame);
  const prevFrame = useDiagramStore((s) => s.prevFrame);
  const exitFrameView = useDiagramStore((s) => s.exitFrameView);
  const addStickyNote = useDiagramStore((s) => s.addStickyNote);

  if (frames.length === 0) return null;

  const idx = frames.findIndex((f) => f.id === currentFrameId);
  const current = idx === -1 ? null : frames[idx];

  return (
    <div className="absolute bottom-3.5 left-1/2 z-10 flex max-w-[560px] -translate-x-1/2 items-center gap-3 rounded-xl border bg-card px-3.5 py-2 shadow-lg">
      <Button size="sm" variant="outline" onClick={prevFrame} disabled={idx <= 0}>
        ◀ Prev
      </Button>
      <div className="min-w-[200px] max-w-[340px]">
        <div className="frame-player__title flex items-center justify-between gap-2 font-semibold">
          {current ? current.name : 'Not viewing a frame'}
          {current && (
            <span className="font-normal text-muted-foreground">
              {idx + 1} / {frames.length}
            </span>
          )}
        </div>
        {current?.notes && <div className="mt-0.5 text-xs text-muted-foreground">{current.notes}</div>}
      </div>
      <Button size="sm" variant="outline" onClick={nextFrame} disabled={idx === frames.length - 1}>
        Next ▶
      </Button>
      {current && (
        <>
          <Button size="sm" variant="outline" title="Add a sticky note to this frame" onClick={() => addStickyNote(current.id)}>
            🗒️+
          </Button>
          <Button size="icon" variant="ghost" title="Exit frame view" onClick={exitFrameView}>
            ✕
          </Button>
        </>
      )}
    </div>
  );
}
