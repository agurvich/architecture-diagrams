import { Handle, Position, useConnection, type NodeProps, type Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { EffectiveNode } from '../../types/effectiveGraph';
import { useDiagramStore } from '../../store/diagramStore';
import { getIconComponent } from '../../icons/registry';

export type GraphNodeType = Node<EffectiveNode, 'graphNode'>;

const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

const NODE_BASE =
  'graph-node relative flex h-full w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-l-4 border-gray-400 bg-white px-2.5 py-1.5 text-center text-xs font-medium text-foreground transition-[opacity,box-shadow] duration-150';

export function GraphNode({ id, data, selected }: NodeProps<GraphNodeType>) {
  const setHover = useDiagramStore((s) => s.setHover);
  const select = useDiagramStore((s) => s.select);
  const toggleExpand = useDiagramStore((s) => s.toggleExpand);
  // Hover changes recompute the effective graph, replacing every node/edge
  // object. Doing that mid-drag corrupts React Flow's own pointer
  // hit-testing for the handle under the cursor (breaking drag-to-connect)
  // and, for a node drag, causes the dragged node to snap back to its
  // pre-drag position on every intermediate re-render since we only commit
  // the new position on drag stop. Freezing hover during either kind of
  // drag avoids the churn entirely.
  const connectionInProgress = useConnection((c) => c.inProgress);
  const isNodeDragging = useDiagramStore((s) => s.isNodeDragging);
  const hoverFrozen = connectionInProgress || isNodeDragging;
  const onHoverEnter = () => {
    if (!hoverFrozen) setHover({ kind: 'node', id });
  };
  const onHoverLeave = () => {
    if (!hoverFrozen) setHover(null);
  };

  const className = cn(
    NODE_BASE,
    `graph-node--${data.renderMode}`,
    data.renderMode === 'collapsed-group' && 'border-2 bg-muted/60',
    data.renderMode === 'expanded-container' &&
      'items-start justify-start rounded-lg border-2 border-dashed bg-muted/30 p-0',
    data.dimmed && 'graph-node--dimmed opacity-25',
    data.highlighted && 'graph-node--highlighted shadow-[0_0_0_2px_theme(colors.amber.500)]',
    selected && 'graph-node--selected shadow-[0_0_0_2px_var(--primary)]',
  );

  const handles = HANDLE_POSITIONS.map((pos) => (
    <Handle
      key={pos}
      id={pos}
      type="source"
      position={pos}
      className="graph-node__handle !size-2.5 opacity-0 group-hover:opacity-60"
    />
  ));

  const accentStyle: React.CSSProperties | undefined = data.color ? { borderLeftColor: data.color } : undefined;
  const NodeIcon = getIconComponent(data.icon);
  const icon = NodeIcon && (
    <NodeIcon className="graph-node__icon shrink-0 text-sm" style={data.color ? { color: data.color } : undefined} />
  );

  if (data.renderMode === 'expanded-container') {
    return (
      <div className={cn(className, 'group')} style={accentStyle} onMouseEnter={onHoverEnter} onMouseLeave={onHoverLeave}>
        <div
          className="flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-1.5 font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: 'node', id });
          }}
        >
          <button
            className="graph-node__chevron cursor-pointer border-none bg-transparent p-0 px-0.5 text-[11px] leading-none"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(id);
            }}
            title="Collapse"
          >
            ▾
          </button>
          {icon}
          <span className="graph-node__label overflow-hidden text-ellipsis">{data.label}</span>
        </div>
        {handles}
      </div>
    );
  }

  return (
    <div
      className={cn(className, 'group cursor-pointer')}
      style={accentStyle}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'node', id });
      }}
    >
      {data.renderMode === 'collapsed-group' && (
        <button
          className="graph-node__chevron cursor-pointer border-none bg-transparent p-0 px-0.5 text-[11px] leading-none"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(id);
          }}
          title="Expand"
        >
          ▸
        </button>
      )}
      {icon}
      <span className="graph-node__label overflow-hidden text-ellipsis">{data.label}</span>
      {data.renderMode === 'collapsed-group' && data.collapsedChildIds && (
        <span className="graph-node__badge whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] text-muted-foreground">
          {data.collapsedChildIds.length} nodes
        </span>
      )}
      {handles}
    </div>
  );
}
