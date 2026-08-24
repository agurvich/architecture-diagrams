import { useState } from 'react';
import { useDiagramStore } from '../../store/diagramStore';

export function FrameSequencerPanel() {
  const frames = useDiagramStore((s) => s.diagram.frames);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const saveFrame = useDiagramStore((s) => s.saveFrame);
  const updateFrame = useDiagramStore((s) => s.updateFrame);
  const deleteFrame = useDiagramStore((s) => s.deleteFrame);
  const reorderFrames = useDiagramStore((s) => s.reorderFrames);
  const gotoFrame = useDiagramStore((s) => s.gotoFrame);
  const [newFrameName, setNewFrameName] = useState('');

  const handleCapture = () => {
    const name = newFrameName.trim() || `Frame ${frames.length + 1}`;
    saveFrame(name, '');
    setNewFrameName('');
  };

  return (
    <div className="panel">
      <h3 className="panel__title">Frame sequencer</h3>
      <div className="panel__add-row">
        <input
          type="text"
          placeholder="New frame name"
          value={newFrameName}
          onChange={(e) => setNewFrameName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
        />
        <button onClick={handleCapture}>Capture current state</button>
      </div>
      <ul className="frame-list">
        {frames.map((f, idx) => (
          <li key={f.id} className={`frame-list__item ${f.id === currentFrameId ? 'frame-list__item--active' : ''}`}>
            <div className="frame-list__row">
              <button className="frame-list__reorder" disabled={idx === 0} onClick={() => reorderFrames(idx, idx - 1)}>
                ▲
              </button>
              <button
                className="frame-list__reorder"
                disabled={idx === frames.length - 1}
                onClick={() => reorderFrames(idx, idx + 1)}
              >
                ▼
              </button>
              <input
                type="text"
                className="frame-list__name"
                value={f.name}
                onChange={(e) => updateFrame(f.id, { name: e.target.value })}
              />
              <button className="frame-list__goto" onClick={() => gotoFrame(f.id)} title="Go to this frame">
                ▶
              </button>
              <button className="frame-list__delete" onClick={() => deleteFrame(f.id)} title="Delete frame">
                ✕
              </button>
            </div>
            <textarea
              className="frame-list__notes"
              placeholder="Narration notes…"
              value={f.notes}
              onChange={(e) => updateFrame(f.id, { notes: e.target.value })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
