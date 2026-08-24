import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDiagramStore } from '../../store/diagramStore';
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

export function HierarchyPanel() {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const toggleExpand = useDiagramStore((s) => s.toggleExpand);
  const select = useDiagramStore((s) => s.select);

  const tree = buildTree(nodes);
  const roots = tree.get(undefined) ?? [];

  const renderNode = (node: DiagramNode, depth: number) => {
    const children = tree.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    return (
      <div key={node.id} style={{ paddingLeft: depth * 14 }}>
        <div className="flex items-center gap-1 py-0.5">
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
