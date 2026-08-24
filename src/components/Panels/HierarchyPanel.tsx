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
      <div key={node.id} className="hierarchy-panel__node" style={{ paddingLeft: depth * 14 }}>
        <div className="hierarchy-panel__row">
          {hasChildren ? (
            <button className="hierarchy-panel__chevron" onClick={() => toggleExpand(node.id)}>
              {expandedNodes.has(node.id) ? '▾' : '▸'}
            </button>
          ) : (
            <span className="hierarchy-panel__chevron-spacer" />
          )}
          <span className="hierarchy-panel__label" onClick={() => select({ kind: 'node', id: node.id })}>
            {node.label}
          </span>
        </div>
        {hasChildren && expandedNodes.has(node.id) && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="panel">
      <h3 className="panel__title">Hierarchy</h3>
      <div className="hierarchy-panel__tree">{roots.map((n) => renderNode(n, 0))}</div>
    </div>
  );
}
