import type { Diagram } from '../types/diagram';
import { DEFAULT_COLOR_PALETTE } from '../lib/colorPalette';
import { anchorIdFor } from '../engine/actorAnchor';

// A real-world example: a Step Function ingesting files from a public
// source, archiving them to a landing bucket, virus-scanning them via a
// Lambda, and copying clean files cross-account into an ingest bucket —
// two lenses:
// - Control Flow: the Step Function's own state sequence (black arrows in
//   the original hand-drawn diagram this is modeled on), including the
//   Scan step's Pass/Fail branch into the AV Lambda's Copy/Quarantine
//   states.
// - Data Flow: the actual S3 operations each step causes, attributed to
//   the IAM role that performs them. "Copy to Unscanned", "Copy", and
//   "X-Account Copy" don't touch a bucket directly themselves — each
//   triggers a specific bucket-to-bucket action performed under a
//   role's identity, which is exactly what the actor/action/trigger model
//   (isActor, DiagramEdge.actorId, and trigger edges pointing at an
//   action's anchor) exists to make legible. "List Files" and "Archive
//   Files", by contrast, are themselves one endpoint of their own action
//   (no trigger needed — see engine/actorAnchor.ts for why).
export const seedDiagram: Diagram = {
  colorPalette: DEFAULT_COLOR_PALETTE,
  edgeSets: [
    { id: 'control', name: 'Control Flow', color: '#4f8ff7' },
    { id: 'dataflow', name: 'Data Flow', color: '#f7924f' },
  ],
  nodes: [
    { id: 'source', label: 'USASpending.gov', position: { x: -250, y: 380 }, metadata: { type: 'external' }, color: '#98a2b3' },

    {
      id: 'step-fn',
      label: 'Ingest Step Function',
      position: { x: 50, y: 40 },
      metadata: { type: 'orchestration' },
      color: '#4f8ff7',
    },
    { id: 'list-files', label: 'List Files', parentId: 'step-fn', position: { x: 20, y: 40 }, metadata: {} },
    { id: 'download-file', label: 'Download File', parentId: 'step-fn', position: { x: 20, y: 114 }, metadata: {} },
    { id: 'archive-files', label: 'Archive Files', parentId: 'step-fn', position: { x: 20, y: 188 }, metadata: {} },
    { id: 'copy-to-unscanned', label: 'Copy to Unscanned', parentId: 'step-fn', position: { x: 20, y: 262 }, metadata: {} },
    { id: 'trigger-av-scan', label: 'Trigger AV Scan', parentId: 'step-fn', position: { x: 20, y: 336 }, metadata: {} },
    { id: 'x-account-copy', label: 'X-Account Copy', parentId: 'step-fn', position: { x: 20, y: 410 }, metadata: {} },

    { id: 'landing-bucket', label: 'Landing Bucket', position: { x: 380, y: 380 }, metadata: { type: 's3' }, color: '#38b06a' },
    { id: 'unscanned-bucket', label: 'Unscanned Bucket', position: { x: 620, y: 380 }, metadata: { type: 's3' }, color: '#38b06a' },

    {
      id: 'av-lambda',
      label: 'AV Lambda',
      position: { x: 620, y: 580 },
      metadata: { type: 'compute' },
      color: '#c05fd6',
    },
    { id: 'scan', label: 'Scan', parentId: 'av-lambda', position: { x: 20, y: 40 }, metadata: {} },
    { id: 'copy-clean', label: 'Copy', parentId: 'av-lambda', position: { x: 20, y: 114 }, metadata: {} },
    { id: 'quarantine-step', label: 'Quarantine', parentId: 'av-lambda', position: { x: 20, y: 188 }, metadata: {} },

    { id: 'clean-bucket', label: 'Clean Bucket', position: { x: 900, y: 380 }, metadata: { type: 's3' }, color: '#38b06a' },
    { id: 'quarantine-bucket', label: 'Quarantine Bucket', position: { x: 900, y: 620 }, metadata: { type: 's3' }, color: '#e0475a' },
    { id: 'ingest-bucket', label: 'Ingest Bucket', position: { x: 1180, y: 380 }, metadata: { type: 's3' }, color: '#38b06a' },

    {
      id: 'internet-role',
      label: 'Internet Ingest Role',
      position: { x: -250, y: 650 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },
    {
      id: 'stepfn-role',
      label: 'Step Function Role',
      position: { x: 300, y: 650 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },
    {
      id: 'avscan-role',
      label: 'AV Scan Role',
      position: { x: 900, y: 850 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },
  ],
  edges: [
    // --- Control Flow: the Step Function's own state sequence ---
    { id: 'cf-list-download', sourceId: 'list-files', targetId: 'download-file', sets: ['control'], metadata: {} },
    { id: 'cf-download-archive', sourceId: 'download-file', targetId: 'archive-files', sets: ['control'], metadata: {} },
    { id: 'cf-archive-copytounscanned', sourceId: 'archive-files', targetId: 'copy-to-unscanned', sets: ['control'], metadata: {} },
    { id: 'cf-copytounscanned-trigger', sourceId: 'copy-to-unscanned', targetId: 'trigger-av-scan', sets: ['control'], metadata: {} },
    { id: 'cf-trigger-scan', sourceId: 'trigger-av-scan', targetId: 'scan', sets: ['control'], metadata: {} },
    { id: 'cf-scan-copy', sourceId: 'scan', targetId: 'copy-clean', sets: ['control'], metadata: { label: 'Pass' } },
    { id: 'cf-scan-quarantine', sourceId: 'scan', targetId: 'quarantine-step', sets: ['control'], metadata: { label: 'Fail' } },
    { id: 'cf-copy-xaccount', sourceId: 'copy-clean', targetId: 'x-account-copy', sets: ['control'], metadata: {} },

    // --- Data Flow: actions (bucket-to-bucket operations, attributed to
    // the IAM role performing them) and triggers (the step that causes
    // one, when the step isn't itself an endpoint of the action) ---
    { id: 'a-list-source', sourceId: 'list-files', targetId: 'source', sets: ['dataflow'], metadata: { label: 'ListObjects' }, actorId: 'internet-role' },
    { id: 'a-archive-landing', sourceId: 'archive-files', targetId: 'landing-bucket', sets: ['dataflow'], metadata: { label: 'PutObject' }, actorId: 'internet-role' },
    { id: 'a-landing-unscanned', sourceId: 'landing-bucket', targetId: 'unscanned-bucket', sets: ['dataflow'], metadata: { label: 'CopyObject' }, actorId: 'stepfn-role' },
    { id: 'a-unscanned-clean', sourceId: 'unscanned-bucket', targetId: 'clean-bucket', sets: ['dataflow'], metadata: { label: 'CopyObject (clean)' }, actorId: 'avscan-role' },
    { id: 'a-unscanned-quarantine', sourceId: 'unscanned-bucket', targetId: 'quarantine-bucket', sets: ['dataflow'], metadata: { label: 'CopyObject (infected)' }, actorId: 'avscan-role' },
    { id: 'a-clean-ingest', sourceId: 'clean-bucket', targetId: 'ingest-bucket', sets: ['dataflow'], metadata: { label: 'Cross-account CopyObject' }, actorId: 'stepfn-role' },

    { id: 't-copytounscanned', sourceId: 'copy-to-unscanned', targetId: anchorIdFor('a-landing-unscanned'), sets: ['dataflow'], metadata: {} },
    { id: 't-copy', sourceId: 'copy-clean', targetId: anchorIdFor('a-unscanned-clean'), sets: ['dataflow'], metadata: {} },
    { id: 't-quarantine', sourceId: 'quarantine-step', targetId: anchorIdFor('a-unscanned-quarantine'), sets: ['dataflow'], metadata: {} },
    { id: 't-xaccountcopy', sourceId: 'x-account-copy', targetId: anchorIdFor('a-clean-ingest'), sets: ['dataflow'], metadata: {} },
  ],
  frames: [
    {
      id: 'frame-1',
      name: '1. Pipeline overview',
      activeSets: ['control'],
      expandedNodes: [],
      notes: 'The Step Function and the AV Lambda collapsed to single boxes, showing just the high-level shape: list, download, archive, copy for scanning, scan, then copy cross-account into the ingest bucket.',
    },
    {
      id: 'frame-2',
      name: '2. Inside the AV scan',
      activeSets: ['control'],
      expandedNodes: ['av-lambda'],
      notes: 'Expanding the AV Lambda reveals its own three states: Scan, then a Pass/Fail branch straight out of the Step Function\'s own control-flow language — Copy on Pass, Quarantine on Fail.',
    },
    {
      id: 'frame-3',
      name: '3. Who does what',
      activeSets: ['dataflow'],
      expandedNodes: [],
      notes: 'Switching to the Data Flow lens (without touching expand state) reframes the same nodes around the actual S3 operations and which IAM role performs each one — the small badge on each action line is that role. "Copy to Unscanned", "Copy", and "X-Account Copy" trigger an action they\'re not themselves touching a bucket in; "List Files" and "Archive Files" act directly.',
    },
    {
      id: 'frame-4',
      name: '4. Full detail',
      activeSets: ['dataflow'],
      expandedNodes: ['step-fn', 'av-lambda'],
      notes: 'Everything expanded: every state next to the specific bucket-to-bucket action it causes and the role that performs it.',
    },
  ],
};
