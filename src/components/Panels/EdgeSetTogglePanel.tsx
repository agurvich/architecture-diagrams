import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDiagramStore } from '../../store/diagramStore';

const PALETTE = ['#4f8ff7', '#f7924f', '#38b06a', '#c05fd6', '#e0475a', '#2fb6c4'];

export function EdgeSetTogglePanel() {
  const edgeSets = useDiagramStore((s) => s.diagram.edgeSets);
  const activeSets = useDiagramStore((s) => s.activeSets);
  const toggleEdgeSet = useDiagramStore((s) => s.toggleEdgeSet);
  const addEdgeSet = useDiagramStore((s) => s.addEdgeSet);
  const [newName, setNewName] = useState('');
  const idPrefix = useId();

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const color = PALETTE[edgeSets.length % PALETTE.length];
    addEdgeSet(name, color);
    setNewName('');
  };

  return (
    <Card className="gap-2 py-2.5">
      <CardHeader className="px-2.5">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lenses (edge sets)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 px-2.5">
        <ul className="flex flex-col gap-1.5">
          {edgeSets.map((s) => {
            const inputId = `${idPrefix}-${s.id}`;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <Checkbox id={inputId} checked={activeSets.has(s.id)} onCheckedChange={() => toggleEdgeSet(s.id)} />
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                <Label htmlFor={inputId} className="cursor-pointer font-normal">
                  {s.name}
                </Label>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-1.5">
          <Input
            className="min-w-0 flex-1"
            placeholder="New edge set name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button size="sm" variant="outline" onClick={handleAdd}>
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
