import { useDiagramStore } from '../../store/diagramStore';

export function FramePlayerControls() {
  const frames = useDiagramStore((s) => s.diagram.frames);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const nextFrame = useDiagramStore((s) => s.nextFrame);
  const prevFrame = useDiagramStore((s) => s.prevFrame);

  if (frames.length === 0) return null;

  const idx = frames.findIndex((f) => f.id === currentFrameId);
  const current = idx === -1 ? null : frames[idx];

  return (
    <div className="frame-player">
      <button onClick={prevFrame} disabled={idx <= 0}>
        ◀ Prev
      </button>
      <div className="frame-player__body">
        <div className="frame-player__title">
          {current ? current.name : 'Not viewing a frame'}
          {current && (
            <span className="frame-player__counter">
              {idx + 1} / {frames.length}
            </span>
          )}
        </div>
        {current?.notes && <div className="frame-player__notes">{current.notes}</div>}
      </div>
      <button onClick={nextFrame} disabled={idx === frames.length - 1}>
        Next ▶
      </button>
    </div>
  );
}
