import type { Diagram } from '../../types/diagram';
import { DEFAULT_COLOR_PALETTE } from '../../lib/colorPalette';

// The smallest useful example: a classic three-tier web app, chosen
// specifically to demonstrate merge-on-collapse — two app servers both
// talking to the same load balancer and the same database collapse into
// one deduplicated line each way, rather than two redundant parallel ones.
export const threeTierWebAppDiagram: Diagram = {
  colorPalette: DEFAULT_COLOR_PALETTE,
  edgeSets: [{ id: 'traffic', name: 'Traffic', color: '#4f8ff7' }],
  nodes: [
    { id: 'client', label: 'Client', position: { x: 0, y: 140 }, metadata: { type: 'external' }, color: '#98a2b3' },
    { id: 'load-balancer', label: 'Load Balancer', position: { x: 260, y: 140 }, metadata: { type: 'network' }, color: '#f7b500' },
    {
      id: 'app-servers',
      label: 'App Servers',
      position: { x: 540, y: 40 },
      metadata: { type: 'compute' },
      color: '#4f8ff7',
    },
    { id: 'app-server-1', label: 'App Server 1', parentId: 'app-servers', position: { x: 20, y: 40 }, metadata: {} },
    { id: 'app-server-2', label: 'App Server 2', parentId: 'app-servers', position: { x: 20, y: 114 }, metadata: {} },
    { id: 'database', label: 'Database', position: { x: 900, y: 140 }, metadata: { type: 's3' }, color: '#38b06a' },
  ],
  edges: [
    { id: 'e-client-lb', sourceId: 'client', targetId: 'load-balancer', sets: ['traffic'], metadata: {} },
    { id: 'e-lb-app1', sourceId: 'load-balancer', targetId: 'app-server-1', sets: ['traffic'], metadata: {} },
    { id: 'e-lb-app2', sourceId: 'load-balancer', targetId: 'app-server-2', sets: ['traffic'], metadata: {} },
    { id: 'e-app1-db', sourceId: 'app-server-1', targetId: 'database', sets: ['traffic'], metadata: {} },
    { id: 'e-app2-db', sourceId: 'app-server-2', targetId: 'database', sets: ['traffic'], metadata: {} },
  ],
  frames: [
    {
      id: 'frame-1',
      name: '1. Overview',
      activeSets: ['traffic'],
      expandedNodes: [],
      notes: 'App Servers collapsed to one box — the load balancer and database each show a single line into it, already deduplicated even though two servers sit behind it.',
    },
    {
      id: 'frame-2',
      name: '2. Expanded',
      activeSets: ['traffic'],
      expandedNodes: ['app-servers'],
      notes: 'Expanding reveals both app servers and their own individual connections — the two lines that were merged split back out, with nothing lost.',
    },
  ],
};
