import type { Diagram } from '../../types/diagram';
import { seedDiagram } from '../seedDiagram';
import { threeTierWebAppDiagram } from './threeTierWebApp';
import { orderProcessingDiagram } from './orderProcessing';

export interface Example {
  id: string;
  name: string;
  description: string;
  diagram: Diagram;
}

// Ordered smallest/simplest first — the pipeline (the shipped default,
// still what "Reset to demo" loads) is the fullest tour of every feature
// at once; the other two exist to show the model applies outside AWS and
// outside a single all-in-one example.
export const EXAMPLES: Example[] = [
  {
    id: 'three-tier-web-app',
    name: 'Three-Tier Web App',
    description: 'Client → load balancer → app servers → database — the smallest example, built to show merge-on-collapse.',
    diagram: threeTierWebAppDiagram,
  },
  {
    id: 'order-processing',
    name: 'Order Processing (Actors)',
    description: 'One step triggering two separately-attributed actions under two different roles — the actor model outside AWS.',
    diagram: orderProcessingDiagram,
  },
  {
    id: 'usaspending-pipeline',
    name: 'USASpending Ingest Pipeline',
    description: 'The full demo: nested account boundaries, control vs. data flow lenses, and the complete actor/action/trigger story.',
    diagram: seedDiagram,
  },
];
