import { useMemo, useState } from 'react';
import type { EdgeSetId } from '../../types/diagram';
import { useDiagramStore } from '../../store/diagramStore';

const POPOVER_WIDTH = 220;
const POPOVER_HEIGHT = 220;
const VIEWPORT_MARGIN = 10;

export interface PendingConnection {
  sourceId: string;
  targetId: string;
  screenX: number;
  screenY: number;
  defaultLevel: 'node' | 'group';
}

interface Props {
  pending: PendingConnection;
  onDone: () => void;
}

export function ConnectionPopover({ pending, onDone }: Props) {
  const edgeSets = useDiagramStore((s) => s.diagram.edgeSets);
  const addEdge = useDiagramStore((s) => s.addEdge);
  const [selectedSets, setSelectedSets] = useState<Set<EdgeSetId>>(new Set());
  const [level, setLevel] = useState<'node' | 'group'>(pending.defaultLevel);

  const clampedPosition = useMemo(() => {
    const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - POPOVER_HEIGHT - VIEWPORT_MARGIN;
    return {
      left: Math.min(pending.screenX, Math.max(maxLeft, VIEWPORT_MARGIN)),
      top: Math.min(pending.screenY, Math.max(maxTop, VIEWPORT_MARGIN)),
    };
  }, [pending.screenX, pending.screenY]);

  const toggleSet = (id: EdgeSetId) => {
    setSelectedSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    if (selectedSets.size === 0) return;
    addEdge(pending.sourceId, pending.targetId, [...selectedSets], level);
    onDone();
  };

  return (
    <div
      className="connection-popover"
      style={{ left: clampedPosition.left, top: clampedPosition.top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="connection-popover__title">New edge — tag sets</div>
      <div className="connection-popover__sets">
        {edgeSets.map((s) => (
          <label key={s.id} className="connection-popover__set">
            <input type="checkbox" checked={selectedSets.has(s.id)} onChange={() => toggleSet(s.id)} />
            <span className="connection-popover__swatch" style={{ background: s.color }} />
            {s.name}
          </label>
        ))}
      </div>
      <div className="connection-popover__level">
        <label>
          <input type="radio" name="level" checked={level === 'node'} onChange={() => setLevel('node')} />
          Node-level
        </label>
        <label>
          <input type="radio" name="level" checked={level === 'group'} onChange={() => setLevel('group')} />
          Group-level
        </label>
      </div>
      <div className="connection-popover__actions">
        <button onClick={onDone}>Cancel</button>
        <button className="primary" disabled={selectedSets.size === 0} onClick={confirm}>
          Add edge
        </button>
      </div>
    </div>
  );
}
