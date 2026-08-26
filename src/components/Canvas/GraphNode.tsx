import { Handle, Position, useConnection, type NodeProps, type Node } from '@xyflow/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import type { EffectiveNode } from '../../types/effectiveGraph';
import { useDiagramStore } from '../../store/diagramStore';
import { actionEdgeIdFromAnchor } from '../../engine/actorAnchor';
import { DEFAULT_AUTO_LAYOUT_GAP } from '../../engine/containerLayout';
import { getIconComponent } from '../../icons/registry';
import { guessIconKey } from '../../icons/iconMatcher';

export type GraphNodeType = Node<EffectiveNode, 'graphNode'>;

const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

// Matches the old default border-gray-400, used so every node gets an icon
// badge (not just colored ones) — a plain monochrome icon was too easy to
// miss next to a colored one at a glance.
const DEFAULT_ACCENT = '#9ca3af';

const NODE_BASE =
  'graph-node relative flex h-full w-full items-stretch overflow-hidden rounded-lg border-[1.5px] border-border bg-white text-center text-xs font-medium text-foreground transition-[opacity,box-shadow] duration-150';

export function GraphNode({ id, data, selected }: NodeProps<GraphNodeType>) {
  const setHover = useDiagramStore((s) => s.setHover);
  const select = useDiagramStore((s) => s.select);
  const editingHighlightsForFrameId = useDiagramStore((s) => s.editingHighlightsForFrameId);
  const toggleFrameHighlightIds = useDiagramStore((s) => s.toggleFrameHighlightIds);
  const toggleExpand = useDiagramStore((s) => s.toggleExpand);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const updateNode = useDiagramStore((s) => s.updateNode);
  const addNode = useDiagramStore((s) => s.addNode);
  const deleteNode = useDiagramStore((s) => s.deleteNode);
  const duplicateNode = useDiagramStore((s) => s.duplicateNode);
  const diagramNodes = useDiagramStore((s) => s.diagram.nodes);
  const colorPalette = useDiagramStore((s) => s.diagram.colorPalette ?? []);
  // Hover changes recompute the effective graph, replacing every node/edge
  // object. Doing that mid-drag corrupts React Flow's own pointer
  // hit-testing for the handle under the cursor (breaking drag-to-connect)
  // and, for a node drag, causes the dragged node to snap back to its
  // pre-drag position on every intermediate re-render since we only commit
  // the new position on drag stop. Freezing hover during either kind of
  // drag avoids the churn entirely.
  const connectionInProgress = useConnection((c) => c.inProgress);
  const draggedNodeId = useDiagramStore((s) => s.draggedNodeId);
  const hoverFrozen = connectionInProgress || draggedNodeId !== null;
  const onHoverEnter = () => {
    if (!hoverFrozen) setHover({ kind: 'node', id });
  };
  const onHoverLeave = () => {
    if (!hoverFrozen) setHover(null);
  };
  // While authoring a frame's highlights, a click toggles this node's own
  // (real, raw) id in that frame's list instead of selecting it — see
  // toggleFrameHighlightIds. A collapsed group's own id is exactly what
  // frame playback resolves against too, so no special-casing needed here
  // for collapsed vs. expanded.
  const onNodeBodyClick = () => {
    if (editingHighlightsForFrameId) {
      toggleFrameHighlightIds(editingHighlightsForFrameId, [id]);
      return;
    }
    select({ kind: 'node', id });
  };

  const className = cn(
    NODE_BASE,
    `graph-node--${data.renderMode}`,
    data.renderMode === 'collapsed-group' && 'border-2 bg-muted/60',
    data.renderMode === 'expanded-container' && 'flex-col items-stretch rounded-lg border-2 border-dashed bg-muted/30 p-0',
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

  const accentColor = data.color ?? DEFAULT_ACCENT;
  const accentStyle: React.CSSProperties = {
    // A colored node washes the rest of its card (behind the label), not
    // just the color bar — left unset (falling back to the class-based
    // bg-white/bg-muted) when the node has no explicit color, so "no
    // color" still reads as visually distinct from "has a color".
    background: data.color ? `color-mix(in oklch, ${data.color}, white 88%)` : undefined,
  };
  // Three states: a pinned icon key always wins; a pinned `null` means no
  // icon at all; `undefined` (the default) guesses live from the label and
  // metadata values, the way LoopIconMatcher.swift's `resolvedIcon` does —
  // computed at render time rather than stored, so renaming a node updates
  // its icon automatically unless the user has pinned one explicitly.
  const resolvedIconKey =
    data.icon === null ? null : (data.icon ?? guessIconKey(data.label, Object.values(data.metadata)));
  const NodeIcon = resolvedIconKey ? getIconComponent(resolvedIconKey) : undefined;
  // The color bar itself always renders (this is what used to be a thin
  // border-left accent — widened and given the icon a home, rather than
  // the icon sitting as a small badge separate from it) so pinning "no
  // icon" doesn't also lose the node's color indicator; the icon, when
  // there is one, sits inside it at full height for maximum legibility.
  const iconSize = data.renderMode === 'expanded-container' ? 16 : 24;

  if (data.renderMode === 'actor-anchor') {
    return (
      <div
        className="graph-node__anchor flex cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-md transition-opacity duration-150"
        style={{ width: '100%', height: '100%', background: accentColor, opacity: data.dimmed ? 0.25 : 1 }}
        title={`Action by ${data.label}`}
        onMouseEnter={() => !hoverFrozen && data.linkedEdgeId && setHover({ kind: 'edge', id: data.linkedEdgeId })}
        onMouseLeave={() => !hoverFrozen && setHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (editingHighlightsForFrameId) {
            // The anchor's own id is `anchor:<rawEdgeId>` (see
            // engine/actorAnchor.ts) — an anchor only ever exists for a
            // single unambiguous raw action edge, so that's the one raw
            // id to toggle, not data.linkedEdgeId (which is the
            // *effective* edge id, used only for the normal select() case
            // below).
            toggleFrameHighlightIds(editingHighlightsForFrameId, [actionEdgeIdFromAnchor(id)]);
            return;
          }
          if (data.linkedEdgeId) select({ kind: 'edge', id: data.linkedEdgeId });
        }}
      >
        {NodeIcon && <NodeIcon className="text-white" style={{ fontSize: 14 }} />}
        {/* All four compass handles, same as every other node — not just
            "top": a trigger edge's fixed anchor needs an actual handle to
            resolve against for whichever side geometry picks, and with
            only one declared, React Flow had no choice but to force every
            fixed-anchor trigger onto that single side regardless of the
            source step's real position. */}
        {handles}
      </div>
    );
  }
  const colorBar = (
    <span
      className="graph-node__icon-bar flex w-11 shrink-0 items-center justify-center self-stretch"
      style={{ background: accentColor }}
    >
      {NodeIcon && <NodeIcon className="graph-node__icon text-white" style={{ fontSize: iconSize }} />}
    </span>
  );

  const handleAddChild = () => {
    const existingChildren = diagramNodes.filter((n) => n.parentId === id).length;
    const newId = addNode({
      label: 'New node',
      parentId: id,
      position: { x: 20, y: 40 + existingChildren * 74 },
      metadata: {},
    });
    if (!expandedNodes.has(id)) toggleExpand(id);
    select({ kind: 'node', id: newId });
  };

  const menu = (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={() => select({ kind: 'node', id })}>Edit properties…</ContextMenuItem>
      {data.renderMode !== 'leaf' && (
        <ContextMenuItem onClick={() => toggleExpand(id)}>
          {data.renderMode === 'expanded-container' ? 'Collapse' : 'Expand'}
        </ContextMenuItem>
      )}
      <ContextMenuItem onClick={handleAddChild}>Add child node</ContextMenuItem>
      {data.renderMode !== 'leaf' && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Auto layout</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40">
            <ContextMenuItem
              onClick={() => updateNode(id, { autoLayout: undefined })}
              className={!data.autoLayout ? 'font-semibold' : undefined}
            >
              None (manual)
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => updateNode(id, { autoLayout: { direction: 'vertical', gap: data.autoLayout?.gap ?? DEFAULT_AUTO_LAYOUT_GAP } })}
              className={data.autoLayout?.direction === 'vertical' ? 'font-semibold' : undefined}
            >
              Vertical
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => updateNode(id, { autoLayout: { direction: 'horizontal', gap: data.autoLayout?.gap ?? DEFAULT_AUTO_LAYOUT_GAP } })}
              className={data.autoLayout?.direction === 'horizontal' ? 'font-semibold' : undefined}
            >
              Horizontal
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      <ContextMenuSub>
        <ContextMenuSubTrigger>Set color</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-auto">
          <div className="grid grid-cols-4 gap-1 p-1">
            {colorPalette.map((c) => (
              <button
                key={c}
                className={`h-6 w-6 cursor-pointer rounded-full border-2 ${data.color === c ? 'border-primary' : 'border-transparent'}`}
                style={{ background: c }}
                title={c}
                onClick={() => updateNode(id, { color: c })}
              />
            ))}
          </div>
          {data.color && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => updateNode(id, { color: undefined })}>Clear color</ContextMenuItem>
            </>
          )}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem
        onClick={() => {
          const newId = duplicateNode(id);
          if (newId) select({ kind: 'node', id: newId });
        }}
      >
        Duplicate
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onClick={() => deleteNode(id)}>
        Delete node
      </ContextMenuItem>
    </ContextMenuContent>
  );

  if (data.renderMode === 'expanded-container') {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className={cn(className, 'group')} onMouseEnter={onHoverEnter} onMouseLeave={onHoverLeave}>
            <div
              className="flex w-full cursor-pointer items-stretch overflow-hidden rounded-t-[7px] font-semibold"
              style={accentStyle}
              onClick={(e) => {
                e.stopPropagation();
                onNodeBodyClick();
              }}
            >
              {colorBar}
              <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5">
                <button
                  className="graph-node__chevron -m-1 cursor-pointer rounded border-none bg-transparent p-1 text-sm leading-none hover:bg-black/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(id);
                  }}
                  title="Collapse"
                >
                  ▾
                </button>
                <span className="graph-node__label overflow-hidden text-ellipsis">{data.label}</span>
              </div>
            </div>
            {handles}
          </div>
        </ContextMenuTrigger>
        {menu}
      </ContextMenu>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(className, 'group cursor-pointer')}
          onMouseEnter={onHoverEnter}
          onMouseLeave={onHoverLeave}
          onClick={(e) => {
            e.stopPropagation();
            onNodeBodyClick();
          }}
        >
          {colorBar}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5" style={accentStyle}>
            {data.renderMode === 'collapsed-group' && (
              <button
                className="graph-node__chevron -m-1 cursor-pointer rounded border-none bg-transparent p-1 text-sm leading-none hover:bg-black/10"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(id);
                }}
                title="Expand"
              >
                ▸
              </button>
            )}
            <span className="graph-node__label overflow-hidden text-ellipsis">{data.label}</span>
            {data.renderMode === 'collapsed-group' && data.collapsedChildIds && (
              <span className="graph-node__badge whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] text-muted-foreground">
                {data.collapsedChildIds.length} nodes
              </span>
            )}
          </div>
          {handles}
        </div>
      </ContextMenuTrigger>
      {menu}
    </ContextMenu>
  );
}
