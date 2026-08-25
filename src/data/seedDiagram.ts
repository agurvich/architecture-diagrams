import type { Diagram } from '../types/diagram';
import { DEFAULT_COLOR_PALETTE } from '../lib/colorPalette';
import { anchorIdFor } from '../engine/actorAnchor';

// A real-world example: a Step Function pulling files off a public file
// server, copying them into a landing bucket, virus-scanning them via a
// Lambda, and copying clean files cross-account into an ingest bucket —
// two lenses:
// - Control Flow: the Step Function's own state sequence (black arrows in
//   the original hand-drawn diagram this is modeled on), including the
//   Scan step's Pass/Fail branch into the AV Lambda's Copy/Quarantine
//   states.
// - Data Flow: the actual S3 operations each step causes, attributed to
//   the IAM role that performs them. "List Files" acts directly (it's one
//   endpoint of its own action — the list_files call). "Download File"
//   both acts directly (the batch_download call) AND triggers a second
//   action it isn't itself an endpoint of: the actual copy from the file
//   server's archive into the landing bucket, still performed under the
//   Internet Ingest role since it's crossing out of AWS entirely. "Copy to
//   Unscanned", "Copy", and "X-Account Copy" work the same way — each
//   triggers a specific bucket-to-bucket action it doesn't itself touch,
//   this time under the Step Function's own in-account role. This is
//   exactly what the
//   actor/action/trigger model (isActor, DiagramEdge.actorId, and trigger
//   edges pointing at an action's anchor) exists to make legible — see
//   engine/actorAnchor.ts.
//
// "Archive Files" isn't a step at all — it's the files themselves, sitting
// on the file server (USASpending.gov), which is why it lives inside that
// group rather than inside the Step Function: list_files describes it,
// batch_download serves it.
//
// Everything but the external source sits inside one of two AWS account
// boundaries (containers, same mechanism as the Step Function/AV Lambda
// groups, just one level further out) — "X-Account Copy" is literally the
// edge that crosses from one boundary into the other.
export const seedDiagram: Diagram = {
  colorPalette: DEFAULT_COLOR_PALETTE,
  edgeSets: [
    { id: 'control', name: 'Control Flow', color: '#4f8ff7' },
    { id: 'dataflow', name: 'Data Flow', color: '#f7924f' },
  ],
  nodes: [
    { id: 'source', label: 'USASpending.gov', position: { x: -250, y: 380 }, metadata: { type: 'external' }, color: '#98a2b3' },
    { id: 'list-files-endpoint', label: 'list_files', parentId: 'source', position: { x: 20, y: 40 }, metadata: { type: 'endpoint' } },
    { id: 'batch-download-endpoint', label: 'batch_download', parentId: 'source', position: { x: 20, y: 114 }, metadata: { type: 'endpoint' } },
    // Not an endpoint — the actual files sitting on the file server.
    // list_files describes what's here; batch_download serves it.
    { id: 'archive-files', label: 'Archive Files', parentId: 'source', position: { x: 240, y: 77 }, metadata: { type: 'files' } },

    {
      id: 'account-processing',
      label: 'Acquisition Account',
      position: { x: 50, y: 40 },
      metadata: { type: 'aws-account' },
      color: '#64748b',
    },
    {
      id: 'step-fn',
      label: 'Ingest Step Function',
      parentId: 'account-processing',
      position: { x: 20, y: 40 },
      metadata: { type: 'orchestration' },
      color: '#4f8ff7',
    },
    { id: 'read-watermark', label: 'Read Watermark', parentId: 'step-fn', position: { x: 20, y: 40 }, metadata: {} },
    { id: 'list-files', label: 'List Files', parentId: 'step-fn', position: { x: 20, y: 114 }, metadata: {} },
    { id: 'diff-files', label: 'Diff Files', parentId: 'step-fn', position: { x: 20, y: 188 }, metadata: {} },
    { id: 'download-file', label: 'Download File', parentId: 'step-fn', position: { x: 20, y: 262 }, metadata: {} },
    { id: 'copy-to-unscanned', label: 'Copy to Unscanned', parentId: 'step-fn', position: { x: 20, y: 336 }, metadata: {} },
    { id: 'trigger-av-scan', label: 'Trigger AV Scan', parentId: 'step-fn', position: { x: 20, y: 410 }, metadata: {} },
    { id: 'x-account-copy', label: 'X-Account Copy', parentId: 'step-fn', position: { x: 20, y: 484 }, metadata: {} },

    { id: 'landing-bucket', label: 'Landing Bucket', parentId: 'account-processing', position: { x: 380, y: 380 }, metadata: { type: 's3' }, color: '#38b06a' },
    { id: 'unscanned-bucket', label: 'Unscanned Bucket', parentId: 'account-processing', position: { x: 620, y: 380 }, metadata: { type: 's3' }, color: '#38b06a' },
    { id: 'watermark-bucket', label: 'Watermark Bucket', parentId: 'account-processing', position: { x: 380, y: 620 }, metadata: { type: 's3' }, color: '#38b06a' },

    {
      id: 'av-lambda',
      label: 'AV Lambda',
      parentId: 'account-processing',
      position: { x: 620, y: 580 },
      metadata: { type: 'compute' },
      color: '#c05fd6',
    },
    { id: 'scan', label: 'Scan', parentId: 'av-lambda', position: { x: 20, y: 40 }, metadata: {} },
    { id: 'copy-clean', label: 'Copy', parentId: 'av-lambda', position: { x: 20, y: 114 }, metadata: {} },
    { id: 'quarantine-step', label: 'Quarantine', parentId: 'av-lambda', position: { x: 20, y: 188 }, metadata: {} },

    { id: 'clean-bucket', label: 'Clean Bucket', parentId: 'account-processing', position: { x: 900, y: 380 }, metadata: { type: 's3' }, color: '#38b06a' },
    { id: 'quarantine-bucket', label: 'Quarantine Bucket', parentId: 'account-processing', position: { x: 900, y: 620 }, metadata: { type: 's3' }, color: '#e0475a' },

    {
      id: 'internet-role',
      label: 'Internet Ingest Role',
      parentId: 'account-processing',
      position: { x: 20, y: 650 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },
    {
      id: 'stepfn-role',
      label: 'Step Function Role',
      parentId: 'account-processing',
      position: { x: 300, y: 650 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },
    {
      id: 'avscan-role',
      label: 'AV Scan Role',
      parentId: 'account-processing',
      position: { x: 900, y: 850 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },

    {
      id: 'account-ingest',
      label: 'Viz Tools Account',
      position: { x: 1400, y: 400 },
      metadata: { type: 'aws-account' },
      color: '#64748b',
    },
    { id: 'ingest-bucket', label: 'Ingest Bucket', parentId: 'account-ingest', position: { x: 20, y: 40 }, metadata: { type: 's3' }, color: '#38b06a' },
    { id: 'write-watermark', label: 'Write Watermark', parentId: 'account-ingest', position: { x: 220, y: 40 }, metadata: {} },
    {
      id: 'viztools-role',
      label: 'Viz Tools Role',
      parentId: 'account-ingest',
      position: { x: 20, y: 140 },
      metadata: { type: 'iam-role' },
      color: '#f7b500',
      isActor: true,
    },
  ],
  edges: [
    // --- Control Flow: the Step Function's own state sequence ---
    { id: 'cf-watermark-list', sourceId: 'read-watermark', targetId: 'list-files', sets: ['control'], metadata: {} },
    { id: 'cf-list-diff', sourceId: 'list-files', targetId: 'diff-files', sets: ['control'], metadata: {} },
    { id: 'cf-diff-download', sourceId: 'diff-files', targetId: 'download-file', sets: ['control'], metadata: {} },
    { id: 'cf-download-copytounscanned', sourceId: 'download-file', targetId: 'copy-to-unscanned', sets: ['control'], metadata: {} },
    { id: 'cf-copytounscanned-trigger', sourceId: 'copy-to-unscanned', targetId: 'trigger-av-scan', sets: ['control'], metadata: {} },
    { id: 'cf-trigger-scan', sourceId: 'trigger-av-scan', targetId: 'scan', sets: ['control'], metadata: {} },
    { id: 'cf-scan-copy', sourceId: 'scan', targetId: 'copy-clean', sets: ['control'], metadata: { label: 'Pass' } },
    { id: 'cf-scan-quarantine', sourceId: 'scan', targetId: 'quarantine-step', sets: ['control'], metadata: { label: 'Fail' } },
    { id: 'cf-copy-xaccount', sourceId: 'copy-clean', targetId: 'x-account-copy', sets: ['control'], metadata: {} },

    // --- Data Flow: actions (bucket-to-bucket operations, attributed to
    // the IAM role performing them) and triggers (the step that causes
    // one, when the step isn't itself an endpoint of the action) ---
    { id: 'a-watermark-bucket', sourceId: 'read-watermark', targetId: 'watermark-bucket', sets: ['dataflow'], metadata: { label: 'GetObject' }, actorId: 'stepfn-role' },
    { id: 'a-list-source', sourceId: 'list-files', targetId: 'list-files-endpoint', sets: ['dataflow'], metadata: { label: 'GET /list_files' }, actorId: 'internet-role' },
    { id: 'a-download-source', sourceId: 'download-file', targetId: 'batch-download-endpoint', sets: ['dataflow'], metadata: { label: 'GET /batch_download' }, actorId: 'internet-role' },
    { id: 'd-listendpoint-archive', sourceId: 'list-files-endpoint', targetId: 'archive-files', sets: ['dataflow'], metadata: { label: 'file list' } },
    { id: 'a-archive-landing', sourceId: 'archive-files', targetId: 'landing-bucket', sets: ['dataflow'], metadata: { label: 'PutObject' }, actorId: 'internet-role' },
    { id: 'a-landing-unscanned', sourceId: 'landing-bucket', targetId: 'unscanned-bucket', sets: ['dataflow'], metadata: { label: 'CopyObject' }, actorId: 'stepfn-role' },
    { id: 'a-unscanned-clean', sourceId: 'unscanned-bucket', targetId: 'clean-bucket', sets: ['dataflow'], metadata: { label: 'CopyObject (clean)' }, actorId: 'avscan-role' },
    { id: 'a-unscanned-quarantine', sourceId: 'unscanned-bucket', targetId: 'quarantine-bucket', sets: ['dataflow'], metadata: { label: 'CopyObject (infected)' }, actorId: 'avscan-role' },
    { id: 'a-clean-ingest', sourceId: 'clean-bucket', targetId: 'ingest-bucket', sets: ['dataflow'], metadata: { label: 'Cross-account CopyObject' }, actorId: 'stepfn-role' },
    { id: 'a-writewatermark-bucket', sourceId: 'write-watermark', targetId: 'watermark-bucket', sets: ['dataflow'], metadata: { label: 'Cross-account PutObject' }, actorId: 'viztools-role' },

    { id: 't-download', sourceId: 'download-file', targetId: anchorIdFor('a-archive-landing'), sets: ['dataflow'], metadata: {} },
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
      expandedNodes: ['account-processing', 'account-ingest'],
      notes: 'Both account boundaries expanded, but the Step Function and the AV Lambda still collapsed to single boxes — just the high-level shape: check the watermark, list and diff against it, download, copy for scanning, scan, then copy cross-account into the ingest bucket in the other account.',
    },
    {
      id: 'frame-2',
      name: '2. Inside the AV scan',
      activeSets: ['control'],
      expandedNodes: ['account-processing', 'account-ingest', 'av-lambda'],
      notes: 'Expanding the AV Lambda reveals its own three states: Scan, then a Pass/Fail branch straight out of the Step Function\'s own control-flow language — Copy on Pass, Quarantine on Fail.',
    },
    {
      id: 'frame-3',
      name: '3. Who does what',
      activeSets: ['dataflow'],
      expandedNodes: ['account-processing', 'account-ingest', 'source'],
      notes: 'Switching to the Data Flow lens (without touching expand state) reframes the same nodes around the actual S3 operations and which IAM role performs each one — the small badge on each action line is that role. Hovering a role highlights every action it performs. "List Files" acts directly; "Download File", "Copy to Unscanned", "Copy", and "X-Account Copy" each trigger an action they\'re not themselves touching a bucket in.',
    },
    {
      id: 'frame-4',
      name: '4. Full detail',
      activeSets: ['dataflow'],
      expandedNodes: ['account-processing', 'account-ingest', 'step-fn', 'av-lambda', 'source'],
      notes: 'Everything expanded: every state next to the specific bucket-to-bucket action it causes and the role that performs it, both account boundaries visible end to end.',
    },
  ],
};
