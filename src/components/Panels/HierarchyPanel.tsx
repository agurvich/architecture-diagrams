import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { useDiagramStore } from '../../store/diagramStore';
import { wouldCreateCycle } from '../../utils/nodeTree';
import type { DiagramNode, NodeId } from '../../types/diagram';

function buildTree(nodes: DiagramNode[]): Map<NodeId | undefined, DiagramNode[]> {
  const map = new Map<NodeId | undefined, DiagramNode[]>();
  for (const n of nodes) {
    const list = map.get(n.parentId) ?? [];
    list.push(n);
    map.set(n.parentId, list);
  }
  return map;
}

// rootId's own id plus every descendant's — the set a recursive
// expand/collapse-all needs to hand to expandNodes/collapseNodes.
function collectSubtreeIds(tree: Map<NodeId | undefined, DiagramNode[]>, rootId: NodeId): NodeId[] {
  const ids: NodeId[] = [rootId];
  for (const child of tree.get(rootId) ?? []) ids.push(...collectSubtreeIds(tree, child.id));
  return ids;
}

type DropZone = 'before' | 'after' | 'inside';

export function HierarchyPanel() {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const toggleExpand = useDiagramStore((s) => s.toggleExpand);
  const expandNodes = useDiagramStore((s) => s.expandNodes);
  const collapseNodes = useDiagramStore((s) => s.collapseNodes);
  const select = useDiagramStore((s) => s.select);
  const moveNode = useDiagramStore((s) => s.moveNode);
  const duplicateNode = useDiagramStore((s) => s.duplicateNode);

  const [dragId, setDragId] = useState<NodeId | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: NodeId; zone: DropZone } | null>(null);

  const tree = buildTree(nodes);
  const roots = tree.get(undefined) ?? [];

  // Top quarter of a row = reorder before it, bottom quarter = after it,
  // the middle half = nest inside it as a new child — same three-way split
  // Figma's own layers panel uses. Only sets a drop target when the
  // resulting parent (the row's own parent for before/after, the row
  // itself for inside) wouldn't create a cycle, so an invalid drop is
  // simply not offered rather than accepted and rejected later.
  const handleDragOver = (e: React.DragEvent, node: DiagramNode) => {
    if (!dragId || dragId === node.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - rect.top;
    const zone: DropZone = offset < rect.height * 0.25 ? 'before' : offset > rect.height * 0.75 ? 'after' : 'inside';
    const resultingParentId = zone === 'inside' ? node.id : node.parentId;
    if (resultingParentId && wouldCreateCycle(nodes, dragId, resultingParentId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ id: node.id, zone });
  };

  const handleDrop = (e: React.DragEvent, node: DiagramNode) => {
    e.preventDefault();
    if (dragId && dropTarget?.id === node.id) {
      if (dropTarget.zone === 'inside') {
        moveNode(dragId, node.id, undefined);
        if (!expandedNodes.has(node.id)) expandNodes([node.id]);
      } else {
        // Excluding the dragged node itself from this lookup means
        // targetIdx/beforeId are always computed against where things
        // will actually sit once it's removed, so "after" never
        // accidentally resolves back to the dragged node's own id.
        const siblings = (tree.get(node.parentId) ?? []).filter((n) => n.id !== dragId);
        const targetIdx = siblings.findIndex((n) => n.id === node.id);
        const beforeId = dropTarget.zone === 'before' ? node.id : siblings[targetIdx + 1]?.id;
        moveNode(dragId, node.parentId, beforeId);
      }
    }
    setDragId(null);
    setDropTarget(null);
  };

  const renderNode = (node: DiagramNode, depth: number) => {
    const children = tree.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    const isDropTarget = dropTarget?.id === node.id;
    return (
      <div key={node.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              style={{ paddingLeft: depth * 14 }}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', node.id);
                setDragId(node.id);
              }}
              onDragOver={(e) => {
                e.stopPropagation();
                handleDragOver(e, node);
              }}
              onDrop={(e) => {
                e.stopPropagation();
                handleDrop(e, node);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropTarget(null);
              }}
              className={cn(
                'flex items-center gap-1 border-t-2 border-b-2 border-transparent py-0.5',
                dragId === node.id && 'opacity-40',
                isDropTarget && dropTarget.zone === 'before' && 'border-t-primary',
                isDropTarget && dropTarget.zone === 'after' && 'border-b-primary',
                isDropTarget && dropTarget.zone === 'inside' && 'rounded bg-accent',
              )}
            >
              {hasChildren ? (
                <button
                  className="w-[18px] cursor-pointer border-none bg-transparent p-0 text-center"
                  onClick={() => toggleExpand(node.id)}
                >
                  {expandedNodes.has(node.id) ? '▾' : '▸'}
                </button>
              ) : (
                <span className="inline-block w-[18px]" />
              )}
              <span className="cursor-pointer hover:underline" onClick={() => select({ kind: 'node', id: node.id })}>
                {node.label}
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => {
                const newId = duplicateNode(node.id);
                if (newId) select({ kind: 'node', id: newId });
              }}
            >
              Duplicate
            </ContextMenuItem>
            {hasChildren && (
              <>
                <ContextMenuItem onClick={() => expandNodes(collectSubtreeIds(tree, node.id))}>
                  Expand all
                </ContextMenuItem>
                <ContextMenuItem onClick={() => collapseNodes(collectSubtreeIds(tree, node.id))}>
                  Collapse all
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
        {hasChildren && expandedNodes.has(node.id) && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <Card className="gap-2 py-2.5">
      <CardHeader className="px-2.5">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col px-2.5 text-sm">{roots.map((n) => renderNode(n, 0))}</CardContent>
    </Card>
  );
}
