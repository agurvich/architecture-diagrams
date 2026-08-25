import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDiagramStore } from '../../store/diagramStore';

export function FrameSequencerPanel() {
  const frames = useDiagramStore((s) => s.diagram.frames);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const editingHighlightsForFrameId = useDiagramStore((s) => s.editingHighlightsForFrameId);
  const setEditingHighlightsForFrame = useDiagramStore((s) => s.setEditingHighlightsForFrame);
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
    <Card className="gap-2 py-2.5">
      <CardHeader className="px-2.5">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Frame sequencer
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 px-2.5">
        <div className="flex gap-1.5">
          <Input
            className="min-w-0 flex-1"
            placeholder="New frame name"
            value={newFrameName}
            onChange={(e) => setNewFrameName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
          />
          <Button size="sm" variant="outline" onClick={handleCapture}>
            Capture current state
          </Button>
        </div>
        <ul className="flex flex-col gap-2">
          {frames.map((f, idx) => (
            <li
              key={f.id}
              className={`rounded-md border p-1.5 ${f.id === currentFrameId ? 'border-primary bg-accent/50' : ''}`}
            >
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-[10px]"
                  disabled={idx === 0}
                  onClick={() => reorderFrames(idx, idx - 1)}
                >
                  ▲
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-[10px]"
                  disabled={idx === frames.length - 1}
                  onClick={() => reorderFrames(idx, idx + 1)}
                >
                  ▼
                </Button>
                <Input
                  className="min-w-0 flex-1"
                  type="text"
                  value={f.name}
                  onChange={(e) => updateFrame(f.id, { name: e.target.value })}
                />
                <Button size="icon" variant="ghost" onClick={() => gotoFrame(f.id)} title="Go to this frame">
                  ▶
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteFrame(f.id)} title="Delete frame">
                  ✕
                </Button>
              </div>
              <Textarea
                className="mt-1.5 min-h-10"
                placeholder="Narration notes…"
                value={f.notes}
                onChange={(e) => updateFrame(f.id, { notes: e.target.value })}
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                {editingHighlightsForFrameId === f.id ? (
                  <Button size="sm" className="flex-1" onClick={() => setEditingHighlightsForFrame(null)}>
                    Done editing highlights
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditingHighlightsForFrame(f.id)}
                  >
                    Edit highlights ({f.highlighted?.length ?? 0})
                  </Button>
                )}
                {f.highlighted && f.highlighted.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Clear highlights"
                    onClick={() => updateFrame(f.id, { highlighted: undefined })}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
