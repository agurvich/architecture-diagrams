import { useCallback, useRef } from 'react';
import { ViewportPortal, useReactFlow } from '@xyflow/react';
import { useDiagramStore } from '../../store/diagramStore';
import type { StickyNote } from '../../types/diagram';

/**
 * A frame's sticky-note annotations, drawn directly on the canvas in the
 * same absolute flow coordinate space as a top-level node — real Post-its
 * you drag into place next to whatever they're commenting on, not a fixed
 * side panel. Only the currently-viewed frame's own notes render at all;
 * switching frames (or exiting frame view) swaps or clears them entirely.
 */
export function StickyNotes() {
  const diagram = useDiagramStore((s) => s.diagram);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const updateStickyNote = useDiagramStore((s) => s.updateStickyNote);
  const deleteStickyNote = useDiagramStore((s) => s.deleteStickyNote);
  const viewMode = useDiagramStore((s) => s.viewMode);

  const frame = diagram.frames.find((f) => f.id === currentFrameId);
  if (!frame) return null;
  const notes = frame.stickyNotes ?? [];
  if (notes.length === 0) return null;

  return (
    <ViewportPortal>
      {notes.map((note) => (
        <StickyNoteCard
          key={note.id}
          note={note}
          readOnly={viewMode}
          onChangeText={(text) => updateStickyNote(frame.id, note.id, { text })}
          onMove={(position) => updateStickyNote(frame.id, note.id, { position })}
          onDelete={() => deleteStickyNote(frame.id, note.id)}
        />
      ))}
    </ViewportPortal>
  );
}

function StickyNoteCard({
  note,
  readOnly,
  onChangeText,
  onMove,
  onDelete,
}: {
  note: StickyNote;
  readOnly: boolean;
  onChangeText: (text: string) => void;
  onMove: (position: { x: number; y: number }) => void;
  onDelete: () => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  // Recomputed from the raw screen point on every move (via
  // screenToFlowPosition, which already accounts for pan/zoom) rather than
  // accumulating deltas tick-to-tick — same drift-proof approach the
  // pane-context-menu "add node at this position" already uses.
  const dragStart = useRef<{ screen: { x: number; y: number }; notePos: { x: number; y: number } } | null>(null);

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return;
      e.stopPropagation(); // don't let the drag also pan the canvas underneath
      dragStart.current = { screen: { x: e.clientX, y: e.clientY }, notePos: note.position };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragStart.current) return;
        const startFlow = screenToFlowPosition(dragStart.current.screen);
        const currentFlow = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        onMove({
          x: dragStart.current.notePos.x + (currentFlow.x - startFlow.x),
          y: dragStart.current.notePos.y + (currentFlow.y - startFlow.y),
        });
      };
      const onMouseUp = () => {
        dragStart.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [readOnly, note.position, screenToFlowPosition, onMove],
  );

  return (
    <div
      className="sticky-note pointer-events-auto absolute flex w-40 flex-col rounded-sm shadow-md"
      data-id={note.id}
      style={{ transform: `translate(${note.position.x}px, ${note.position.y}px)`, background: note.color }}
    >
      <div
        className={`sticky-note__header flex h-5 shrink-0 items-center justify-end px-1 ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={onHeaderMouseDown}
        title={readOnly ? undefined : 'Drag to move'}
      >
        {!readOnly && (
          <button
            className="cursor-pointer rounded-sm border-none bg-transparent p-0 text-xs leading-none text-black/50 hover:text-black/80"
            title="Delete sticky note"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onDelete}
          >
            ✕
          </button>
        )}
      </div>
      <textarea
        className="sticky-note__text min-h-16 w-full resize-none border-none bg-transparent p-2 pt-0 text-xs text-black/80 outline-none"
        value={note.text}
        placeholder="Note…"
        readOnly={readOnly}
        onChange={(e) => onChangeText(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
