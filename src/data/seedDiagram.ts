import type { Diagram } from '../types/diagram';
import { DEFAULT_COLOR_PALETTE } from '../lib/colorPalette';

// A small "web app" system demoed through three lenses:
// - Infrastructure: physical/network connectivity
// - Process: request/response sequence
// - Data: what reads/writes what
//
// The "API Cluster" group has two children (api-1, api-2) that both talk to
// the same database — collapsing the group should merge those into one edge
// rather than drawing two parallel lines. The group also carries a
// group-level "Data" edge to the cache, representing a subsystem-level
// relationship that isn't owned by either child specifically.
export const seedDiagram: Diagram = {
  colorPalette: DEFAULT_COLOR_PALETTE,
  edgeSets: [
    { id: 'infra', name: 'Infrastructure', color: '#4f8ff7' },
    { id: 'process', name: 'Process', color: '#f7924f' },
    { id: 'data', name: 'Data', color: '#38b06a' },
  ],
  nodes: [
    { id: 'client', label: 'Client Browser', position: { x: 0, y: 200 }, metadata: { type: 'actor' } },
    { id: 'lb', label: 'Load Balancer', position: { x: 260, y: 200 }, metadata: { type: 'infra' } },
    { id: 'api-cluster', label: 'API Cluster', position: { x: 540, y: 140 }, metadata: { type: 'subsystem' } },
    { id: 'api-1', label: 'API Server 1', parentId: 'api-cluster', position: { x: 40, y: 40 }, metadata: { type: 'service' } },
    { id: 'api-2', label: 'API Server 2', parentId: 'api-cluster', position: { x: 40, y: 160 }, metadata: { type: 'service' } },
    { id: 'db', label: 'Primary Database', position: { x: 900, y: 100 }, metadata: { type: 'datastore' } },
    { id: 'cache', label: 'Cache', position: { x: 900, y: 280 }, metadata: { type: 'datastore' } },
  ],
  edges: [
    { id: 'e-client-lb-infra', sourceId: 'client', targetId: 'lb', sets: ['infra'], level: 'node', metadata: {} },
    { id: 'e-client-lb-process', sourceId: 'client', targetId: 'lb', sets: ['process'], level: 'node', metadata: { label: '1. request' } },

    { id: 'e-lb-api1-infra', sourceId: 'lb', targetId: 'api-1', sets: ['infra'], level: 'node', metadata: {} },
    { id: 'e-lb-api2-infra', sourceId: 'lb', targetId: 'api-2', sets: ['infra'], level: 'node', metadata: {} },
    { id: 'e-lb-api1-process', sourceId: 'lb', targetId: 'api-1', sets: ['process'], level: 'node', metadata: { label: '2. route' } },

    // both API servers talk to the DB on the infra + data lenses — this is
    // the merge-on-collapse case: collapsing api-cluster should yield ONE
    // edge to db per active lens, not two.
    { id: 'e-api1-db-infra', sourceId: 'api-1', targetId: 'db', sets: ['infra'], level: 'node', metadata: {} },
    { id: 'e-api2-db-infra', sourceId: 'api-2', targetId: 'db', sets: ['infra'], level: 'node', metadata: {} },
    { id: 'e-api1-db-data', sourceId: 'api-1', targetId: 'db', sets: ['data'], level: 'node', metadata: { label: 'reads/writes' } },
    { id: 'e-api2-db-data', sourceId: 'api-2', targetId: 'db', sets: ['data'], level: 'node', metadata: { label: 'reads/writes' } },
    { id: 'e-api1-db-process', sourceId: 'api-1', targetId: 'db', sets: ['process'], level: 'node', metadata: { label: '3. query' } },

    // group-level edge: the cluster as a whole talks to the cache, not
    // attributable to one specific api server.
    { id: 'e-cluster-cache-data', sourceId: 'api-cluster', targetId: 'cache', sets: ['data'], level: 'group', metadata: { label: 'cache reads' } },
    { id: 'e-cluster-cache-infra', sourceId: 'api-cluster', targetId: 'cache', sets: ['infra'], level: 'group', metadata: {} },
  ],
  frames: [
    {
      id: 'frame-1',
      name: '1. Physical topology',
      activeSets: ['infra'],
      expandedNodes: [],
      notes: 'Every hop is a network connection. The API Cluster is collapsed — its two servers both reach the database and cache, but that detail is not important at this level.',
    },
    {
      id: 'frame-2',
      name: '2. Inside the cluster',
      activeSets: ['infra'],
      expandedNodes: ['api-cluster'],
      highlighted: ['api-1', 'api-2'],
      notes: 'Expanding the cluster reveals two API servers behind the load balancer, each independently connected to the database.',
    },
    {
      id: 'frame-3',
      name: '3. Request sequence',
      activeSets: ['process'],
      expandedNodes: [],
      notes: 'Switching lenses (without touching expand state) shows the same nodes as a request/response sequence: client to load balancer to one API server to the database.',
    },
    {
      id: 'frame-4',
      name: '4. Data movement',
      activeSets: ['data'],
      expandedNodes: [],
      highlighted: ['db', 'cache'],
      notes: 'The data lens shows what reads and writes what. The cluster-to-cache edge is a group-level relationship — it belongs to the cluster as a whole, not to either individual server.',
    },
  ],
};
