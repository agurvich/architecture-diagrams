import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  const idPrefix = useId();

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
      className="connection-popover fixed z-30 flex w-[220px] flex-col gap-2 rounded-lg border bg-popover p-2.5 text-popover-foreground shadow-lg"
      style={{ left: clampedPosition.left, top: clampedPosition.top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-semibold">New edge — tag sets</div>
      <div className="flex flex-col gap-1">
        {edgeSets.map((s) => {
          const inputId = `${idPrefix}-${s.id}`;
          return (
            <div key={s.id} className="flex items-center gap-1.5 text-xs">
              <Checkbox id={inputId} checked={selectedSets.has(s.id)} onCheckedChange={() => toggleSet(s.id)} />
              <span className="inline-block h-[9px] w-[9px] rounded-sm" style={{ background: s.color }} />
              <Label htmlFor={inputId} className="cursor-pointer font-normal">
                {s.name}
              </Label>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="level" checked={level === 'node'} onChange={() => setLevel('node')} />
          Node-level
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="level" checked={level === 'group'} onChange={() => setLevel('group')} />
          Group-level
        </label>
      </div>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" disabled={selectedSets.size === 0} onClick={confirm}>
          Add edge
        </Button>
      </div>
    </div>
  );
}
