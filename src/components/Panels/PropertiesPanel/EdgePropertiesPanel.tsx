import { useMemo } from 'react';
import { useDiagramStore } from '../../../store/diagramStore';
import { computeEffectiveGraph } from '../../../engine/computeEffectiveGraph';
import type { EdgeId } from '../../../types/diagram';

export function EdgePropertiesPanel({ effectiveEdgeId }: { effectiveEdgeId: string }) {
  const diagram = useDiagramStore((s) => s.diagram);
  const activeSets = useDiagramStore((s) => s.activeSets);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const deleteEdge = useDiagramStore((s) => s.deleteEdge);
  const select = useDiagramStore((s) => s.select);

  const effectiveGraph = useMemo(
    () => computeEffectiveGraph(diagram, { activeSets, expandedNodes }),
    [diagram, activeSets, expandedNodes],
  );
  const effEdge = effectiveGraph.visibleEdges.find((e) => e.id === effectiveEdgeId);

  if (!effEdge) return null;

  const nodeLabel = (id: string) => diagram.nodes.find((n) => n.id === id)?.label ?? id;

  if (effEdge.count > 1) {
    return (
      <div className="panel properties-panel">
        <div className="panel__header-row">
          <h3 className="panel__title">Merged edge ({effEdge.count})</h3>
          <button className="panel__close" onClick={() => select(null)}>
            ✕
          </button>
        </div>
        <p className="properties-panel__hint">
          {nodeLabel(effEdge.visibleSourceId)} → {nodeLabel(effEdge.visibleTargetId)} represents {effEdge.count} underlying
          relationships. Expand nodes until this resolves to a single edge to edit it directly.
        </p>
        <ul className="properties-panel__original-list">
          {effEdge.originalEdgeIds.map((id) => {
            const raw = diagram.edges.find((e) => e.id === id);
            if (!raw) return null;
            return (
              <li key={id}>
                {nodeLabel(raw.sourceId)} → {nodeLabel(raw.targetId)}{' '}
                <span className="properties-panel__mini-badge">{raw.level}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const rawEdgeId: EdgeId = effEdge.originalEdgeIds[0];
  const rawEdge = diagram.edges.find((e) => e.id === rawEdgeId);
  if (!rawEdge) return null;

  const toggleSet = (setId: string) => {
    const has = rawEdge.sets.includes(setId);
    updateEdge(rawEdgeId, { sets: has ? rawEdge.sets.filter((s) => s !== setId) : [...rawEdge.sets, setId] });
  };

  return (
    <div className="panel properties-panel">
      <div className="panel__header-row">
        <h3 className="panel__title">Edge</h3>
        <button className="panel__close" onClick={() => select(null)}>
          ✕
        </button>
      </div>
      <p className="properties-panel__hint">
        {nodeLabel(rawEdge.sourceId)} → {nodeLabel(rawEdge.targetId)}
      </p>

      <div className="properties-panel__metadata">
        <span className="properties-panel__label">Sets</span>
        {diagram.edgeSets.map((s) => (
          <label key={s.id} className="properties-panel__checkbox-row">
            <input type="checkbox" checked={rawEdge.sets.includes(s.id)} onChange={() => toggleSet(s.id)} />
            <span className="edge-set-list__swatch" style={{ background: s.color }} />
            {s.name}
          </label>
        ))}
      </div>

      <label className="properties-panel__field">
        Level
        <select value={rawEdge.level} onChange={(e) => updateEdge(rawEdgeId, { level: e.target.value as 'node' | 'group' })}>
          <option value="node">Node-level</option>
          <option value="group">Group-level</option>
        </select>
      </label>

      <label className="properties-panel__field">
        Label
        <input
          type="text"
          value={rawEdge.metadata.label ?? ''}
          onChange={(e) => updateEdge(rawEdgeId, { metadata: { ...rawEdge.metadata, label: e.target.value } })}
        />
      </label>

      <button
        className="properties-panel__delete"
        onClick={() => {
          deleteEdge(rawEdgeId);
          select(null);
        }}
      >
        Delete edge
      </button>
    </div>
  );
}
