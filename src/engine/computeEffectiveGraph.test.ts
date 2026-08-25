import { describe, expect, it } from 'vitest';
import type { Diagram } from '../types/diagram';
import { computeEffectiveGraph } from './computeEffectiveGraph';

// A small fixture: a "cluster" group with two children (a, b) that both
// connect to an external "db" node, plus a group-level edge from the
// cluster itself to "cache". Mirrors the shape that matters for the
// collapse-merge algorithm without depending on the shipped demo diagram.
function makeFixture(): Diagram {
  return {
    edgeSets: [
      { id: 'infra', name: 'Infrastructure', color: '#4f8ff7' },
      { id: 'data', name: 'Data', color: '#38b06a' },
    ],
    nodes: [
      { id: 'cluster', label: 'Cluster', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'a', label: 'A', parentId: 'cluster', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'b', label: 'B', parentId: 'cluster', position: { x: 0, y: 80 }, metadata: {} },
      { id: 'db', label: 'DB', position: { x: 300, y: 0 }, metadata: {} },
      { id: 'cache', label: 'Cache', position: { x: 300, y: 150 }, metadata: {} },
    ],
    edges: [
      { id: 'e-a-db-infra', sourceId: 'a', targetId: 'db', sets: ['infra'], level: 'node', metadata: {} },
      { id: 'e-b-db-infra', sourceId: 'b', targetId: 'db', sets: ['infra'], level: 'node', metadata: {} },
      { id: 'e-a-db-data', sourceId: 'a', targetId: 'db', sets: ['data'], level: 'node', metadata: {} },
      { id: 'e-a-b-internal', sourceId: 'a', targetId: 'b', sets: ['infra'], level: 'node', metadata: {} },
      { id: 'e-cluster-cache', sourceId: 'cluster', targetId: 'cache', sets: ['data'], level: 'group', metadata: {} },
    ],
    frames: [],
  };
}

const allSets = new Set(['infra', 'data']);

describe('computeEffectiveGraph', () => {
  it('shows every node and edge when nothing is collapsed and all sets are active', () => {
    const diagram = makeFixture();
    const { visibleNodes, visibleEdges } = computeEffectiveGraph(diagram, {
      activeSets: allSets,
      expandedNodes: new Set(['cluster']),
    });

    expect(visibleNodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'cache', 'cluster', 'db']);
    // a<->b internal edge, a->db (2 sets merge to 1), b->db, cluster->cache
    expect(visibleEdges).toHaveLength(4);
  });

  it('filters edges whose sets are not active', () => {
    const diagram = makeFixture();
    const { visibleEdges } = computeEffectiveGraph(diagram, {
      activeSets: new Set(['data']),
      expandedNodes: new Set(['cluster']),
    });

    // only e-a-db-data and e-cluster-cache carry the 'data' set
    expect(visibleEdges).toHaveLength(2);
    expect(visibleEdges.every((e) => e.sets.every((s) => s === 'data'))).toBe(true);
  });

  it('collapses a group into a single node carrying its descendants', () => {
    const diagram = makeFixture();
    const { visibleNodes } = computeEffectiveGraph(diagram, {
      activeSets: allSets,
      expandedNodes: new Set(), // cluster collapsed
    });

    const nodeIds = visibleNodes.map((n) => n.id).sort();
    expect(nodeIds).toEqual(['cache', 'cluster', 'db']);

    const cluster = visibleNodes.find((n) => n.id === 'cluster')!;
    expect(cluster.renderMode).toBe('collapsed-group');
    expect(cluster.collapsedChildIds?.sort()).toEqual(['a', 'b']);
  });

  it('merges multiple children edges to the same external node into one deduplicated edge on collapse', () => {
    const diagram = makeFixture();
    const { visibleEdges } = computeEffectiveGraph(diagram, {
      activeSets: allSets,
      expandedNodes: new Set(),
    });

    const clusterToDb = visibleEdges.find((e) => e.visibleSourceId === 'cluster' && e.visibleTargetId === 'db');
    expect(clusterToDb).toBeDefined();
    // e-a-db-infra + e-b-db-infra + e-a-db-data all collapse into one edge
    expect(clusterToDb!.count).toBe(3);
    expect(clusterToDb!.originalEdgeIds.sort()).toEqual(['e-a-db-data', 'e-a-db-infra', 'e-b-db-infra']);
    expect([...clusterToDb!.sets].sort()).toEqual(['data', 'infra']);
  });

  it('drops edges fully internal to a collapsed group', () => {
    const diagram = makeFixture();
    const { visibleEdges } = computeEffectiveGraph(diagram, {
      activeSets: allSets,
      expandedNodes: new Set(),
    });

    // e-a-b-internal must not appear as a self-loop or otherwise
    expect(visibleEdges.some((e) => e.originalEdgeIds.includes('e-a-b-internal'))).toBe(false);
  });

  it('drops an edge whose target has been reparented inside the source (or vice versa)', () => {
    const diagram = makeFixture();
    // Reparent "cache" under "cluster" — the existing cluster->cache
    // group-level edge now points from a container to something rendered
    // inside it. Floating-edge geometry has no sensible anchor for that,
    // so it should be dropped once the container is expanded (while
    // collapsed, it is already covered by the plain vs===vt check).
    diagram.nodes.find((n) => n.id === 'cache')!.parentId = 'cluster';

    const expanded = computeEffectiveGraph(diagram, { activeSets: allSets, expandedNodes: new Set(['cluster']) });
    expect(expanded.visibleEdges.some((e) => e.originalEdgeIds.includes('e-cluster-cache'))).toBe(false);
    // cache itself should still render, just with no edge to its own parent
    expect(expanded.visibleNodes.some((n) => n.id === 'cache')).toBe(true);
  });

  it('inherits color from the nearest ancestor with one set, and lets an explicit color override it', () => {
    const diagram = makeFixture();
    diagram.nodes.find((n) => n.id === 'cluster')!.color = '#ff0000';

    const expanded = computeEffectiveGraph(diagram, { activeSets: allSets, expandedNodes: new Set(['cluster']) });
    const a = expanded.visibleNodes.find((n) => n.id === 'a')!;
    const b = expanded.visibleNodes.find((n) => n.id === 'b')!;
    expect(a.color).toBe('#ff0000');
    expect(b.color).toBe('#ff0000');

    diagram.nodes.find((n) => n.id === 'a')!.color = '#00ff00';
    const expanded2 = computeEffectiveGraph(diagram, { activeSets: allSets, expandedNodes: new Set(['cluster']) });
    expect(expanded2.visibleNodes.find((n) => n.id === 'a')!.color).toBe('#00ff00');
    expect(expanded2.visibleNodes.find((n) => n.id === 'b')!.color).toBe('#ff0000');
  });

  it('leaves color undefined when neither the node nor any ancestor has one', () => {
    const diagram = makeFixture();
    const { visibleNodes } = computeEffectiveGraph(diagram, { activeSets: allSets, expandedNodes: new Set(['cluster']) });
    expect(visibleNodes.find((n) => n.id === 'a')!.color).toBeUndefined();
  });

  it('resolves a group-level edge to the parent regardless of expand state', () => {
    const diagram = makeFixture();

    const collapsed = computeEffectiveGraph(diagram, { activeSets: allSets, expandedNodes: new Set() });
    const expanded = computeEffectiveGraph(diagram, { activeSets: allSets, expandedNodes: new Set(['cluster']) });

    for (const graph of [collapsed, expanded]) {
      const groupEdge = graph.visibleEdges.find((e) => e.originalEdgeIds.includes('e-cluster-cache'));
      expect(groupEdge).toBeDefined();
      expect(groupEdge!.visibleSourceId).toBe('cluster');
      expect(groupEdge!.visibleTargetId).toBe('cache');
      expect(groupEdge!.level).toBe('group');
    }
  });

  it('splits merged children back out into individual edges once expanded', () => {
    const diagram = makeFixture();
    const { visibleEdges } = computeEffectiveGraph(diagram, {
      activeSets: allSets,
      expandedNodes: new Set(['cluster']),
    });

    const aToDb = visibleEdges.find((e) => e.visibleSourceId === 'a' && e.visibleTargetId === 'db');
    const bToDb = visibleEdges.find((e) => e.visibleSourceId === 'b' && e.visibleTargetId === 'db');
    expect(aToDb?.count).toBe(2); // infra + data
    expect(bToDb?.count).toBe(1); // infra only
  });

  it('highlights a hovered node, its connected edges, and their other endpoints, and dims everything else', () => {
    const diagram = makeFixture();
    const { visibleNodes, visibleEdges } = computeEffectiveGraph(diagram, {
      activeSets: allSets,
      expandedNodes: new Set(),
      hoverTarget: { kind: 'node', id: 'db' },
    });

    const db = visibleNodes.find((n) => n.id === 'db')!;
    const cluster = visibleNodes.find((n) => n.id === 'cluster')!;
    const cache = visibleNodes.find((n) => n.id === 'cache')!;
    expect(db.highlighted).toBe(true);
    expect(cluster.highlighted).toBe(true); // connected via the merged edge
    expect(cache.dimmed).toBe(true); // not connected to db

    const clusterToDb = visibleEdges.find((e) => e.visibleSourceId === 'cluster' && e.visibleTargetId === 'db')!;
    const clusterToCache = visibleEdges.find((e) => e.visibleSourceId === 'cluster' && e.visibleTargetId === 'cache')!;
    expect(clusterToDb.highlighted).toBe(true);
    expect(clusterToCache.dimmed).toBe(true);
  });

  it('resolves frame-highlighted raw ids through to their effective node/edge', () => {
    const diagram = makeFixture();
    const { visibleNodes, visibleEdges } = computeEffectiveGraph(diagram, {
      activeSets: allSets,
      expandedNodes: new Set(), // cluster collapsed, so 'a' resolves to 'cluster'
      frameHighlighted: ['a', 'e-cluster-cache'],
    });

    const cluster = visibleNodes.find((n) => n.id === 'cluster')!;
    expect(cluster.highlighted).toBe(true);

    const clusterToCache = visibleEdges.find((e) => e.originalEdgeIds.includes('e-cluster-cache'))!;
    expect(clusterToCache.highlighted).toBe(true);
  });
});
