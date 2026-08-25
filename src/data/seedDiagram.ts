import type { Diagram } from '../types/diagram';
import { DEFAULT_COLOR_PALETTE } from '../lib/colorPalette';

// This app's own architecture and runtime data flow, shown through the app
// itself — three lenses:
// - Structure: static composition (what renders/calls what)
// - Data Flow: the runtime path a user action takes, numbered step by step
// - Persistence: how the working diagram survives (localStorage + JSON)
//
// "Canvas" and "Panels" are containers with two children each that both
// talk to the Store — collapsing either should merge those into one edge,
// same merge-on-collapse case as the original infra demo. "Engine" also
// carries a group-level edge into "Canvas" itself (not into one specific
// child renderer), mirroring the original's cluster-to-cache edge.
export const seedDiagram: Diagram = {
  colorPalette: DEFAULT_COLOR_PALETTE,
  edgeSets: [
    { id: 'structure', name: 'Structure', color: '#4f8ff7' },
    { id: 'dataflow', name: 'Data Flow', color: '#f7924f' },
    { id: 'persistence', name: 'Persistence', color: '#38b06a' },
  ],
  nodes: [
    { id: 'user', label: 'User', position: { x: 0, y: 200 }, metadata: { type: 'actor' } },
    { id: 'toolbar', label: 'Toolbar', position: { x: 300, y: 20 }, metadata: { type: 'ui' } },
    {
      id: 'canvas',
      label: 'Canvas',
      position: { x: 300, y: 160 },
      metadata: { type: 'subsystem', file: 'DiagramCanvas.tsx' },
      color: '#c05fd6',
    },
    {
      id: 'node-renderer',
      label: 'Node Renderer',
      parentId: 'canvas',
      position: { x: 40, y: 40 },
      metadata: { type: 'component', file: 'GraphNode.tsx' },
    },
    {
      id: 'edge-renderer',
      label: 'Edge Renderer',
      parentId: 'canvas',
      position: { x: 40, y: 160 },
      metadata: { type: 'component', file: 'GraphEdge.tsx' },
    },
    {
      id: 'panels',
      label: 'Panels',
      position: { x: 300, y: 400 },
      metadata: { type: 'subsystem' },
      color: '#2fb6c4',
    },
    {
      id: 'hierarchy-panel',
      label: 'Hierarchy Panel',
      parentId: 'panels',
      position: { x: 40, y: 40 },
      metadata: { type: 'component', file: 'HierarchyPanel.tsx' },
    },
    {
      id: 'properties-panel',
      label: 'Properties Panel',
      parentId: 'panels',
      position: { x: 40, y: 160 },
      metadata: { type: 'component', file: 'NodePropertiesPanel.tsx' },
    },
    {
      id: 'store',
      label: 'Diagram Store',
      position: { x: 660, y: 220 },
      metadata: { type: 'state', file: 'diagramStore.ts' },
      color: '#f7b500',
      icon: 'database',
    },
    {
      id: 'engine',
      label: 'Effective Graph Engine',
      position: { x: 980, y: 220 },
      metadata: { type: 'derivation', file: 'computeEffectiveGraph.ts' },
      color: '#e0475a',
      icon: 'gear',
    },
    {
      id: 'local-storage',
      label: 'Local Storage',
      position: { x: 660, y: 440 },
      metadata: { type: 'storage' },
      color: '#98a2b3',
    },
    {
      id: 'json-file',
      label: 'JSON File',
      position: { x: 980, y: 440 },
      metadata: { type: 'file' },
      color: '#98a2b3',
    },
  ],
  edges: [
    // --- Structure: static composition, always true regardless of what the user does ---
    { id: 's-user-toolbar', sourceId: 'user', targetId: 'toolbar', sets: ['structure'], metadata: {} },
    { id: 's-user-canvas', sourceId: 'user', targetId: 'canvas', sets: ['structure'], metadata: {} },
    { id: 's-user-panels', sourceId: 'user', targetId: 'panels', sets: ['structure'], metadata: {} },
    { id: 's-toolbar-store', sourceId: 'toolbar', targetId: 'store', sets: ['structure'], metadata: {} },
    { id: 's-noderenderer-store', sourceId: 'node-renderer', targetId: 'store', sets: ['structure'], metadata: {} },
    { id: 's-edgerenderer-store', sourceId: 'edge-renderer', targetId: 'store', sets: ['structure'], metadata: {} },
    { id: 's-hierarchypanel-store', sourceId: 'hierarchy-panel', targetId: 'store', sets: ['structure'], metadata: {} },
    { id: 's-propertiespanel-store', sourceId: 'properties-panel', targetId: 'store', sets: ['structure'], metadata: {} },
    { id: 's-store-engine', sourceId: 'store', targetId: 'engine', sets: ['structure'], metadata: {} },
    // drawn directly against "canvas" itself: the engine's output feeds the canvas as a whole, not any one renderer
    { id: 's-engine-canvas', sourceId: 'engine', targetId: 'canvas', sets: ['structure'], metadata: {} },
    { id: 's-store-localstorage', sourceId: 'store', targetId: 'local-storage', sets: ['structure'], metadata: {} },
    { id: 's-store-jsonfile', sourceId: 'store', targetId: 'json-file', sets: ['structure'], metadata: {} },

    // --- Data Flow: the same edges, walked as three numbered request paths ---
    { id: 'd-user-toolbar', sourceId: 'user', targetId: 'toolbar', sets: ['dataflow'], metadata: { label: '1. click "+ Add node"' } },
    { id: 'd-toolbar-store', sourceId: 'toolbar', targetId: 'store', sets: ['dataflow'], metadata: { label: '2. addNode()' } },
    { id: 'd-user-canvas', sourceId: 'user', targetId: 'canvas', sets: ['dataflow'], metadata: { label: '1. drag / right-click' } },
    { id: 'd-noderenderer-store', sourceId: 'node-renderer', targetId: 'store', sets: ['dataflow'], metadata: { label: '2. updateNode() / select()' } },
    { id: 'd-edgerenderer-store', sourceId: 'edge-renderer', targetId: 'store', sets: ['dataflow'], metadata: { label: '2. addEdge() / reverseEdge()' } },
    { id: 'd-user-panels', sourceId: 'user', targetId: 'panels', sets: ['dataflow'], metadata: { label: '1. toggle lens / edit field' } },
    { id: 'd-hierarchypanel-store', sourceId: 'hierarchy-panel', targetId: 'store', sets: ['dataflow'], metadata: { label: '2. toggleExpand()' } },
    { id: 'd-propertiespanel-store', sourceId: 'properties-panel', targetId: 'store', sets: ['dataflow'], metadata: { label: '2. updateNode()' } },
    { id: 'd-store-engine', sourceId: 'store', targetId: 'engine', sets: ['dataflow'], metadata: { label: '3. computeEffectiveGraph()' } },
    { id: 'd-engine-canvas', sourceId: 'engine', targetId: 'canvas', sets: ['dataflow'], metadata: { label: '4. re-render' } },

    // --- Persistence: how the working diagram survives a reload ---
    { id: 'p-store-localstorage', sourceId: 'store', targetId: 'local-storage', sets: ['persistence'], metadata: { label: 'debounced auto-save, loaded on startup' } },
    { id: 'p-store-jsonfile', sourceId: 'store', targetId: 'json-file', sets: ['persistence'], metadata: { label: 'Export JSON / Import JSON' } },
  ],
  frames: [
    {
      id: 'frame-1',
      name: '1. Component architecture',
      activeSets: ['structure'],
      expandedNodes: [],
      notes: 'The static shape of the app: Canvas and Panels are collapsed subsystems here — what matters at this level is that the User drives three UI areas, all of which read and write one shared Store.',
    },
    {
      id: 'frame-2',
      name: '2. Inside the UI layer',
      activeSets: ['structure'],
      expandedNodes: ['canvas', 'panels'],
      notes: 'Expanding Canvas and Panels reveals the individual renderer/panel components underneath — each one calls the Store independently, which is exactly the merge-on-collapse case: collapse either group back up and its children\'s edges to the Store fold into one line.',
    },
    {
      id: 'frame-3',
      name: '3. A user action, step by step',
      activeSets: ['dataflow'],
      expandedNodes: [],
      notes: 'Switching lenses (without touching expand state) reframes the same nodes as three parallel request paths — toolbar, canvas, and panels — that all converge on the Store, get derived by the Effective Graph Engine, and flow back out as a re-render. One-way data flow, no matter which UI area triggered it.',
    },
    {
      id: 'frame-4',
      name: '4. Keeping it saved',
      activeSets: ['persistence'],
      expandedNodes: [],
      notes: 'The persistence lens shows what survives a reload: every Store mutation debounce-saves to Local Storage automatically, while Export/Import JSON is the explicit, user-triggered escape hatch to a file.',
    },
  ],
};
