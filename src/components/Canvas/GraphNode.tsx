import { Handle, Position, useConnection, type NodeProps, type Node } from '@xyflow/react';
import type { EffectiveNode } from '../../types/effectiveGraph';
import { useDiagramStore } from '../../store/diagramStore';

export type GraphNodeType = Node<EffectiveNode, 'graphNode'>;

const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function GraphNode({ id, data, selected }: NodeProps<GraphNodeType>) {
  const setHover = useDiagramStore((s) => s.setHover);
  const select = useDiagramStore((s) => s.select);
  const toggleExpand = useDiagramStore((s) => s.toggleExpand);
  // Hover changes recompute the effective graph, replacing every node/edge
  // object. Doing that mid-drag corrupts React Flow's own pointer
  // hit-testing for the handle under the cursor, silently breaking
  // drag-to-connect on any node the cursor passes near en route. Freezing
  // hover while a connection is in progress avoids the churn entirely.
  const connectionInProgress = useConnection((c) => c.inProgress);
  const onHoverEnter = () => {
    if (!connectionInProgress) setHover({ kind: 'node', id });
  };
  const onHoverLeave = () => {
    if (!connectionInProgress) setHover(null);
  };

  const classNames = [
    'graph-node',
    `graph-node--${data.renderMode}`,
    data.dimmed ? 'graph-node--dimmed' : '',
    data.highlighted ? 'graph-node--highlighted' : '',
    selected ? 'graph-node--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handles = HANDLE_POSITIONS.map((pos) => (
    <Handle key={pos} id={pos} type="source" position={pos} className="graph-node__handle" />
  ));

  if (data.renderMode === 'expanded-container') {
    return (
      <div className={classNames} onMouseEnter={onHoverEnter} onMouseLeave={onHoverLeave}>
        <div
          className="graph-node__header"
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: 'node', id });
          }}
        >
          <button
            className="graph-node__chevron"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(id);
            }}
            title="Collapse"
          >
            ▾
          </button>
          <span className="graph-node__label">{data.label}</span>
        </div>
        {handles}
      </div>
    );
  }

  return (
    <div
      className={classNames}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'node', id });
      }}
    >
      {data.renderMode === 'collapsed-group' && (
        <button
          className="graph-node__chevron"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(id);
          }}
          title="Expand"
        >
          ▸
        </button>
      )}
      <span className="graph-node__label">{data.label}</span>
      {data.renderMode === 'collapsed-group' && data.collapsedChildIds && (
        <span className="graph-node__badge">{data.collapsedChildIds.length} nodes</span>
      )}
      {handles}
    </div>
  );
}
