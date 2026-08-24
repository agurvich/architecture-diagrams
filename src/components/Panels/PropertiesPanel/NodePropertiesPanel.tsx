import { useState } from 'react';
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

  if (!node) return null;

  const metadataEntries = Object.entries(node.metadata);
  const eligibleParents = nodes.filter((n) => n.id !== node.id && !wouldCreateCycle(nodes, node.id, n.id));

  return (
    <div className="panel properties-panel">
      <div className="panel__header-row">
        <h3 className="panel__title">Node</h3>
        <button className="panel__close" onClick={() => select(null)}>
          ✕
        </button>
      </div>

      <label className="properties-panel__field">
        Label
        <input type="text" value={node.label} onChange={(e) => updateNode(node.id, { label: e.target.value })} />
      </label>

      <label className="properties-panel__field">
        Parent (hierarchy)
        <select
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
      </label>

      <label className="properties-panel__field">
        Color
        <div className="properties-panel__color-row">
          <input
            type="color"
            value={node.color ?? DEFAULT_COLOR}
            onChange={(e) => updateNode(node.id, { color: e.target.value })}
          />
          {node.color && <button onClick={() => updateNode(node.id, { color: undefined })}>Clear</button>}
        </div>
      </label>

      <div className="properties-panel__field">
        Icon
        <div className="properties-panel__icon-grid">
          <button
            className={`properties-panel__icon-option ${!node.icon ? 'properties-panel__icon-option--selected' : ''}`}
            title="No icon"
            onClick={() => updateNode(node.id, { icon: undefined })}
          >
            —
          </button>
          {ICON_OPTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`properties-panel__icon-option ${node.icon === key ? 'properties-panel__icon-option--selected' : ''}`}
              title={label}
              onClick={() => updateNode(node.id, { icon: key })}
            >
              <Icon />
            </button>
          ))}
        </div>
      </div>

      <div className="properties-panel__metadata">
        <span className="properties-panel__label">Metadata</span>
        {metadataEntries.map(([key, value]) => (
          <div key={key} className="properties-panel__metadata-row">
            <input type="text" value={key} readOnly />
            <input
              type="text"
              value={value}
              onChange={(e) => updateNode(node.id, { metadata: { ...node.metadata, [key]: e.target.value } })}
            />
            <button
              onClick={() => {
                const next = { ...node.metadata };
                delete next[key];
                updateNode(node.id, { metadata: next });
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="properties-panel__metadata-row">
          <input type="text" placeholder="key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input type="text" placeholder="value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <button
            onClick={() => {
              if (!newKey.trim()) return;
              updateNode(node.id, { metadata: { ...node.metadata, [newKey.trim()]: newValue } });
              setNewKey('');
              setNewValue('');
            }}
          >
            +
          </button>
        </div>
      </div>

      <button
        className="properties-panel__delete"
        onClick={() => {
          deleteNode(node.id);
          select(null);
        }}
      >
        Delete node
      </button>
    </div>
  );
}
