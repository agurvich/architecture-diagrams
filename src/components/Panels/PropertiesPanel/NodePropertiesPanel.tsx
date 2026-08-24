import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDiagramStore } from '../../../store/diagramStore';
import type { NodeId } from '../../../types/diagram';
import { ICON_OPTIONS } from '../../../icons/registry';

const DEFAULT_COLOR = '#98a2b3';

function wouldCreateCycle(nodes: { id: NodeId; parentId?: NodeId }[], nodeId: NodeId, candidateParentId: NodeId): boolean {
  let current: NodeId | undefined = candidateParentId;
  while (current) {
    if (current === nodeId) return true;
    current = nodes.find((n) => n.id === current)?.parentId;
  }
  return false;
}

export function NodePropertiesPanel({ nodeId }: { nodeId: NodeId }) {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const updateNode = useDiagramStore((s) => s.updateNode);
  const deleteNode = useDiagramStore((s) => s.deleteNode);
  const setNodeParent = useDiagramStore((s) => s.setNodeParent);
  const select = useDiagramStore((s) => s.select);

  const node = nodes.find((n) => n.id === nodeId);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const idPrefix = useId();

  if (!node) return null;

  const metadataEntries = Object.entries(node.metadata);
  const eligibleParents = nodes.filter((n) => n.id !== node.id && !wouldCreateCycle(nodes, node.id, n.id));

  return (
    <div className="properties-panel flex flex-col gap-2.5 rounded-lg border bg-card p-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Node</h3>
        <button className="cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 hover:bg-accent" onClick={() => select(null)}>
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-label`}>Label</Label>
        <Input
          id={`${idPrefix}-label`}
          type="text"
          value={node.label}
          onChange={(e) => updateNode(node.id, { label: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-parent`}>Parent (hierarchy)</Label>
        <select
          id={`${idPrefix}-parent`}
          className="h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
          value={node.parentId ?? ''}
          onChange={(e) => setNodeParent(node.id, e.target.value || undefined)}
        >
          <option value="">(none — top level)</option>
          {eligibleParents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-color`}>Color</Label>
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-color`}
            type="color"
            className="h-6 w-9 cursor-pointer rounded border p-0.5"
            value={node.color ?? DEFAULT_COLOR}
            onChange={(e) => updateNode(node.id, { color: e.target.value })}
          />
          {node.color && (
            <Button size="sm" variant="outline" onClick={() => updateNode(node.id, { color: undefined })}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Icon</Label>
        <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto p-0.5">
          <button
            className={`flex cursor-pointer items-center justify-center rounded-md border py-1.5 text-sm hover:bg-accent ${!node.icon ? 'border-primary bg-accent text-accent-foreground' : ''}`}
            title="No icon"
            onClick={() => updateNode(node.id, { icon: undefined })}
          >
            —
          </button>
          {ICON_OPTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`flex cursor-pointer items-center justify-center rounded-md border py-1.5 text-sm hover:bg-accent ${node.icon === key ? 'border-primary bg-accent text-accent-foreground' : ''}`}
              title={label}
              onClick={() => updateNode(node.id, { icon: key })}
            >
              <Icon />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Metadata</span>
        {metadataEntries.map(([key, value]) => (
          <div key={key} className="flex gap-1">
            <Input className="min-w-0 flex-1" type="text" value={key} readOnly />
            <Input
              className="min-w-0 flex-1"
              type="text"
              value={value}
              onChange={(e) => updateNode(node.id, { metadata: { ...node.metadata, [key]: e.target.value } })}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                const next = { ...node.metadata };
                delete next[key];
                updateNode(node.id, { metadata: next });
              }}
            >
              ✕
            </Button>
          </div>
        ))}
        <div className="flex gap-1">
          <Input
            className="min-w-0 flex-1"
            type="text"
            placeholder="key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <Input
            className="min-w-0 flex-1"
            type="text"
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              if (!newKey.trim()) return;
              updateNode(node.id, { metadata: { ...node.metadata, [newKey.trim()]: newValue } });
              setNewKey('');
              setNewValue('');
            }}
          >
            +
          </Button>
        </div>
      </div>

      <Button
        variant="destructive"
        onClick={() => {
          deleteNode(node.id);
          select(null);
        }}
      >
        Delete node
      </Button>
    </div>
  );
}
