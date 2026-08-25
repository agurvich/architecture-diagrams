import type { Diagram } from '../../types/diagram';
import { DEFAULT_COLOR_PALETTE } from '../../lib/colorPalette';
import { anchorIdFor } from '../../engine/actorAnchor';

// A second, unrelated domain for the actor/action/trigger model (the main
// demo is all AWS/S3) — one step, "Place Order", triggers two separate
// actions under two separate roles: charging the customer and reserving
// stock. Neither role is a source/target of "Place Order" itself; each is
// attributed to the specific bucket-to-bucket-shaped action it performs.
export const orderProcessingDiagram: Diagram = {
  colorPalette: DEFAULT_COLOR_PALETTE,
  edgeSets: [{ id: 'actions', name: 'Actions', color: '#f7924f' }],
  nodes: [
    { id: 'customer', label: 'Customer', position: { x: 0, y: 140 }, metadata: { type: 'external' }, color: '#98a2b3' },
    { id: 'place-order', label: 'Place Order', position: { x: 260, y: 140 }, metadata: { type: 'compute' }, color: '#4f8ff7' },
    { id: 'orders-table', label: 'Orders Table', position: { x: 540, y: 0 }, metadata: { type: 'database' }, color: '#38b06a' },
    { id: 'payments-table', label: 'Payments Table', position: { x: 820, y: 0 }, metadata: { type: 'database' }, color: '#38b06a' },
    { id: 'inventory-table', label: 'Inventory Table', position: { x: 820, y: 280 }, metadata: { type: 'database' }, color: '#38b06a' },
    {
      id: 'billing-role',
      label: 'Billing Role',
      position: { x: 540, y: 420 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },
    {
      id: 'fulfillment-role',
      label: 'Fulfillment Role',
      position: { x: 820, y: 420 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },
  ],
  edges: [
    { id: 'e-customer-order', sourceId: 'customer', targetId: 'place-order', sets: ['actions'], metadata: { label: 'submits' } },
    { id: 'e-order-orderstable', sourceId: 'place-order', targetId: 'orders-table', sets: ['actions'], metadata: { label: 'PutItem' } },
    {
      id: 'a-orders-payments',
      sourceId: 'orders-table',
      targetId: 'payments-table',
      sets: ['actions'],
      metadata: { label: 'Charge' },
      actorId: 'billing-role',
    },
    {
      id: 'a-orders-inventory',
      sourceId: 'orders-table',
      targetId: 'inventory-table',
      sets: ['actions'],
      metadata: { label: 'Reserve' },
      actorId: 'fulfillment-role',
    },
    { id: 't-order-payments', sourceId: 'place-order', targetId: anchorIdFor('a-orders-payments'), sets: ['actions'], metadata: {} },
    { id: 't-order-inventory', sourceId: 'place-order', targetId: anchorIdFor('a-orders-inventory'), sets: ['actions'], metadata: {} },
  ],
  frames: [],
};
