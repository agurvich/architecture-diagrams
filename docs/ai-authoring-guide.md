# Authoring a diagram for this tool (AI reference)

This document is written to be handed directly to an AI (in a prompt, a tool call, or a system message) that needs to *generate* a `Diagram` JSON document for this app — no need to read the source. It covers the schema, the invariants nothing enforces for you, and the authoring patterns that make a diagram actually good in this tool rather than merely valid.

If you just want working examples to crib from, the three shipped example diagrams (referenced throughout this guide) are:

- `src/data/examples/threeTierWebApp.ts` — the smallest complete diagram, inlined in full below.
- `src/data/examples/orderProcessing.ts` — the actor/action/trigger pattern outside AWS, also inlined in full below.
- `src/data/seedDiagram.ts` — the full-featured shipped default (nested account boundaries, both lenses, the complete actor/action/trigger story, a 4-frame walkthrough, and the `permissionScope` metadata tagging used for node-lens grouping). Too long to inline; read it directly when you need a fourth, richer reference point.

## The core idea, in one paragraph

A `Diagram` is **one graph with stable node positions**, viewed through independent, orthogonal axes: which named edge-sets ("lenses") are active, which container nodes are expanded, and — optionally — which metadata key nodes are currently grouped by. Nothing about the graph itself changes when any of these toggle; only what's drawn does. Your job authoring a diagram is to build a graph honest enough that all of these axes produce something legible on their own, not to hand-design one particular view.

## Top-level shape

```ts
interface Diagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  edgeSets: EdgeSet[];
  frames: Frame[];
  colorPalette?: string[]; // optional; omit and the app fills in a default
}
```

That's the entire persisted document — no separate "layout" object, no view state. Import validation is intentionally loose (it only checks that `nodes`/`edges`/`edgeSets`/`frames` are arrays), which means **you** are responsible for every referential invariant below — a bad reference doesn't error, it just silently fails to render or renders wrong.

## Nodes

```ts
interface DiagramNode {
  id: string;                 // unique, stable, referenced by edges/frames/etc.
  label: string;
  parentId?: string;          // another node's id — see Hierarchy below
  position: { x: number; y: number }; // relative to parentId, or absolute if top-level
  metadata: Record<string, string>;   // always present, {} if unused
  color?: string;              // CSS color string
  icon?: string | null;        // see Icons below — omit unless you have a reason to override
  isActor?: boolean;           // see Actors/actions/triggers below
  autoLayout?: { direction: 'vertical' | 'horizontal'; gap: number };
}
```

**Positioning.** There is no automatic layout on load — `position` is what actually renders. Two ways to get it right without a rendering engine of your own:

1. **Hand-place it**, using these real pixel constants so boxes don't overlap: a leaf/collapsed node is `170×64`; a container's own padding is `20`px with a `34`px header strip on top of that; a floating actor-anchor is a `26×26` circle. Give siblings at least ~`74`px of vertical (or ~`190`px horizontal) spacing so an edge between them has room for its own arrowhead. A child's `position` is relative to its `parentId`'s own interior (i.e. `{x: 20, y: 40}` means 20px right / 40px down from the inside of the parent's header, not from the canvas origin).
2. **Set `autoLayout` on a container** (`{ direction: 'vertical', gap: 40 }` is the app's own default gap) and just get each child's *sort order* right via `position.y` (vertical) or `position.x` (horizontal) — the app stacks them itself and even persists the computed slots back, so you don't have to compute exact pixels for that container's children at all. This is usually the better choice unless you specifically want a hand-composed spatial layout (e.g. mirroring a real network topology).

Top-level nodes (no `parentId`) always use absolute canvas coordinates; give them generous gaps (`250`–`400`px) since they're usually containers themselves.

**Icons.** Leave `icon` unset (`undefined`) unless you need to override it — the app guesses a reasonable icon automatically from the node's `label`, falling back to its `metadata` values if the label doesn't match anything (e.g. a node metadata'd `{ type: 's3' }` gets a bucket icon even if its label is a custom name that doesn't itself mention "bucket"). Set `icon: null` only if you deliberately want no icon at all. Don't hand-pick an icon key unless the auto-guess is actually wrong for your case — the registry has ~90 keys and guessing a valid one from scratch is more likely to be wrong than trusting the matcher.

**Color.** Optional; a node with no `color` inherits its nearest ancestor's (walking up `parentId`, CSS-inheritance-style), so coloring just the top-level container of a subsystem is usually enough to tint everything inside it consistently. Reuse the same hex values across nodes that belong to the same conceptual category (e.g. every S3-bucket-like node the same green) rather than picking a new color per node — that repetition is what makes color legible as a category signal instead of noise. The shipped default palette (also a reasonable one to reuse) is:

```
#4f8ff7 (blue)  #f7924f (orange)  #38b06a (green)  #c05fd6 (purple)
#e0475a (red)   #2fb6c4 (teal)    #f7b500 (yellow) #98a2b3 (gray)
```

## Hierarchy — nesting nodes into containers

Any node that other nodes point at via `parentId` automatically becomes a collapsible container — there's no separate "is this a container" flag. **Collapsing it merges every edge crossing its boundary**: if three children each have their own edge to some external node, the collapsed parent shows one deduplicated line to that same external node, not three overlapping ones. This is the single most valuable structural device in this tool — use it deliberately:

- Nest nodes into a container when they're truly a subsystem a viewer would want to reason about as one unit some of the time and in full detail other times (an AWS account, a microservice's internal steps, a Lambda's internal states).
- Don't nest for the sake of nesting — a container with one child, or one that's never meaningfully collapsed in any frame, is just indirection.
- Depth of 2–3 levels (e.g. account → service → step) is typically as deep as is useful; much deeper and the merge behavior stops being legible to a viewer clicking through chevrons.
- An edge can point directly at a container node itself (not one of its children) at any depth — this resolves correctly with no special handling, so it's fine to model a genuinely container-level relationship (e.g. "this whole account talks to that whole account") as its own edge rather than picking an arbitrary child to stand in for it.

## Edges

```ts
interface DiagramEdge {
  id: string;
  sourceId: string;    // a node id
  targetId: string;    // a node id, OR `anchor:<edgeId>` — see Triggers below
  sets: string[];      // EdgeSet ids this edge belongs to — see Lenses below
  metadata: Record<string, string>; // metadata.label, if set, renders as the edge's caption
  sourceHandle?: 'top' | 'right' | 'bottom' | 'left'; // omit — let it float
  targetHandle?: 'top' | 'right' | 'bottom' | 'left'; // omit — let it float
  actorId?: string;    // a node id with isActor: true — see Actors below
}
```

Leave `sourceHandle`/`targetHandle` unset unless you have a specific reason to pin an edge to an exact side of a node — the default "floating" geometry (a straight line between whichever borders actually face each other) already looks right and re-resolves correctly as nodes expand/collapse; a fixed handle is meant for edges a human dragged by hand and remembered, not something worth guessing at when authoring from scratch.

An edge only renders while **at least one** of its `sets` is currently active, and only if its two endpoints (after resolving each to whichever visible ancestor currently represents it) are different — an edge fully internal to a currently-collapsed group correctly disappears rather than drawing a self-loop.

## Lenses (`EdgeSet`)

```ts
interface EdgeSet {
  id: string;
  name: string;   // shown in the toggle panel
  color: string;  // this lens's edges render in this color when they're the only set an edge belongs to
}
```

Pick 2–4 lenses that represent genuinely different *kinds* of relationship over the same nodes — the two shipped examples are "Control Flow vs. Data Flow" (a process's own sequence vs. the actual data operations it causes) and a single "Traffic" lens for the simplest case. Don't create a lens for something that's really just a category of node (that's what `metadata` + node-lens grouping is for, below) — a lens is specifically about which *edges* are relevant to a given question.

An edge can belong to more than one lens (`sets: ['a', 'b']`) if the same relationship is genuinely meaningful under both; it renders in a neutral dashed style instead of one lens's color when more than one of its sets happens to be simultaneously active, since there's no single color that would be honest.

## Actors, actions, and triggers

The pattern for "who/what performed this operation," when the answer isn't obviously one of the edge's own two endpoints (e.g. an IAM role copying between two S3 buckets it isn't itself drawn connected to):

1. Mark the responsible node `isActor: true`.
2. Attribute the actual operation's edge with `actorId: '<that actor's node id>'` — independent of `sourceId`/`targetId`. This edge is called an **action**; it renders a small circular anchor at its own midpoint carrying the actor's icon.
3. If some other node *causes* that action without being either of its endpoints (a process step that kicks it off), add a separate plain edge — a **trigger** — whose `targetId` is `` `anchor:${actionEdgeId}` `` (the action edge's own id, prefixed) instead of a real node id. It has no `actorId` of its own; the actor is already implied by the action it points at.

Worked example (from `orderProcessing.ts`):

```ts
// "Place Order" doesn't touch either table itself — it triggers two
// separate actions, each performed by a different role.
{ id: 'a-orders-payments', sourceId: 'orders-table', targetId: 'payments-table',
  sets: ['actions'], metadata: { label: 'Charge' }, actorId: 'billing-role' },
{ id: 'a-orders-inventory', sourceId: 'orders-table', targetId: 'inventory-table',
  sets: ['actions'], metadata: { label: 'Reserve' }, actorId: 'fulfillment-role' },

{ id: 't-order-payments', sourceId: 'place-order',
  targetId: anchorIdFor('a-orders-payments'), sets: ['actions'], metadata: {} },
{ id: 't-order-inventory', sourceId: 'place-order',
  targetId: anchorIdFor('a-orders-inventory'), sets: ['actions'], metadata: {} },
```

(`anchorIdFor(id)` is just `` `anchor:${id}` `` — write the string directly if you're not importing the helper.)

Don't use this pattern for a plain two-party relationship — only reach for it when the actor genuinely isn't one of the edge's own endpoints. A trigger's target must be an action edge that actually has `actorId` set; pointing one at a plain edge (or a nonexistent id) has no defined rendering.

## Node-lens grouping (metadata-driven regrouping)

Independent of both lenses and hierarchy, a viewer can group the *nodes themselves* into on-screen regions by any metadata key that's actually in use — e.g. `permissionScope`, `team`, `environment`. This is for questions the structural tree can't answer (which resources fall under one security boundary, when that boundary cuts across the account/service structure the tree already encodes).

To make this useful when you author a diagram:

- Only tag nodes with a metadata key if the value is genuinely meaningful for *some* grouping question a viewer might ask — don't invent a key just to have one.
- A node with no value for the active key rides along with its nearest tagged ancestor automatically; you don't need to tag every node, just the ones whose grouping actually differs from their structural parent's.
- The interesting case is exactly when a node's tag *disagrees* with its structural container — e.g. every node in the seed diagram's `permissionScope` tagging inherits its AWS account's scope by just not being tagged individually, **except** the four IAM-role nodes, which are explicitly tagged `iam-security` even though they're structurally split across two different, unrelated AWS-account containers. Grouping by `permissionScope` then pulls all four into one region regardless of which account each structurally belongs to — that's the whole point of the feature, and it only works because most nodes were left untagged rather than all being redundantly tagged with their container's own value.
- A node with genuinely no meaningful value for the key (nothing in the diagram is "outside" every scope, say) should simply not be tagged at all, and neither should any of its ancestors — it'll land in the automatic "Unclassified" region rather than being forced into a category it doesn't belong to.

## Frames — narrated walkthroughs

```ts
interface Frame {
  id: string;
  name: string;
  activeSets: string[];       // EdgeSet ids
  expandedNodes: string[];    // container node ids
  highlighted?: (string)[];   // raw node/edge ids to spotlight (dims everything else)
  notes: string;              // one caption shown under the frame's title during playback
  nodeLensKey?: string;       // metadata key node-lens grouping should show, if any
  stickyNotes?: StickyNote[]; // see below
}
```

A frame is a full snapshot of the view axes — build a sequence of frames the way you'd write slides: each one should earn its place by changing what's expanded, which lens is active, what's highlighted, or which node-lens grouping is showing, in a way that tells part of a story. `notes` is one short caption per frame explaining what changed and why; it's shown automatically during playback, so write it as if narrating to someone watching, not as an internal comment.

`highlighted` takes **raw** ids (a real node id, or a real edge's own `id` — not an effective/merged id), and dims everything not listed; leave it `undefined` (not `[]`) when a frame has nothing specific to spotlight.

### Sticky notes

```ts
interface StickyNote {
  id: string;
  text: string;
  color: string;               // any CSS color — pastel tones read best
  position: { x: number; y: number }; // same absolute canvas space as a top-level node
}
```

Distinct from `notes` (one caption per frame): a frame can carry several sticky notes, each an independently positioned card drawn directly on the canvas next to whatever it's commenting on, visible only while that specific frame is the one being viewed. Use `notes` for the one-sentence "what changed in this frame" narration, and sticky notes for supplementary call-outs pinned near a specific node or region (e.g. a caveat about one particular bucket) that would clutter the main caption. Position them near, but not directly on top of, whatever they're annotating — a small offset (e.g. 40–80px up and to the side) reads better than perfect overlap.

## Before you hand it off: a referential-integrity checklist

Nothing validates these at import time beyond the top-level array shapes, so check them yourself:

- Every `parentId`, `sourceId`, `targetId` (when it's a real node id, not an anchor), and `actorId` refers to a node that actually exists in `nodes`.
- No node's `parentId` chain cycles back to itself.
- Every id in an edge's `sets` refers to an `EdgeSet` that actually exists in `edgeSets`.
- Every `anchor:<id>` used as a `targetId` refers to an edge that exists, has `sets` overlapping the trigger's own, and has `actorId` set.
- Every id in `frames[].expandedNodes` refers to a node that actually has children (expanding a leaf does nothing).
- Every id in `frames[].activeSets` refers to a real `EdgeSet`.
- Every id in `frames[].highlighted` refers to a real node or edge id (raw, not a merged/effective id).
- Every `frames[].nodeLensKey`, if set, is a metadata key that's actually present on at least one node's `metadata`.
- All node/edge/frame/sticky-note `id`s are unique within their own collection.

## Full worked example (smallest complete diagram)

This is the entire `threeTierWebApp.ts` diagram — copy this shape for a minimal, valid, good diagram; it demonstrates merge-on-collapse (two app servers behind one load balancer collapse to one deduplicated edge each way) in the smallest possible form:

```json
{
  "colorPalette": ["#4f8ff7", "#f7924f", "#38b06a", "#c05fd6", "#e0475a", "#2fb6c4", "#f7b500", "#98a2b3"],
  "edgeSets": [{ "id": "traffic", "name": "Traffic", "color": "#4f8ff7" }],
  "nodes": [
    { "id": "client", "label": "Client", "position": { "x": 0, "y": 140 }, "metadata": { "type": "external" }, "color": "#98a2b3" },
    { "id": "load-balancer", "label": "Load Balancer", "position": { "x": 260, "y": 140 }, "metadata": { "type": "network" }, "color": "#f7b500" },
    { "id": "app-servers", "label": "App Servers", "position": { "x": 540, "y": 40 }, "metadata": { "type": "compute" }, "color": "#4f8ff7" },
    { "id": "app-server-1", "label": "App Server 1", "parentId": "app-servers", "position": { "x": 20, "y": 40 }, "metadata": {} },
    { "id": "app-server-2", "label": "App Server 2", "parentId": "app-servers", "position": { "x": 20, "y": 114 }, "metadata": {} },
    { "id": "database", "label": "Database", "position": { "x": 900, "y": 140 }, "metadata": { "type": "s3" }, "color": "#38b06a" }
  ],
  "edges": [
    { "id": "e-client-lb", "sourceId": "client", "targetId": "load-balancer", "sets": ["traffic"], "metadata": {} },
    { "id": "e-lb-app1", "sourceId": "load-balancer", "targetId": "app-server-1", "sets": ["traffic"], "metadata": {} },
    { "id": "e-lb-app2", "sourceId": "load-balancer", "targetId": "app-server-2", "sets": ["traffic"], "metadata": {} },
    { "id": "e-app1-db", "sourceId": "app-server-1", "targetId": "database", "sets": ["traffic"], "metadata": {} },
    { "id": "e-app2-db", "sourceId": "app-server-2", "targetId": "database", "sets": ["traffic"], "metadata": {} }
  ],
  "frames": [
    {
      "id": "frame-1", "name": "1. Overview", "activeSets": ["traffic"], "expandedNodes": [],
      "notes": "App Servers collapsed to one box — the load balancer and database each show a single line into it, already deduplicated even though two servers sit behind it."
    },
    {
      "id": "frame-2", "name": "2. Expanded", "activeSets": ["traffic"], "expandedNodes": ["app-servers"],
      "notes": "Expanding reveals both app servers and their own individual connections — the two lines that were merged split back out, with nothing lost."
    }
  ]
}
```

For the actor/action/trigger pattern in a complete, still-small diagram, read `src/data/examples/orderProcessing.ts` in full (inlined under "Worked example" above is just its two action/trigger pairs — the file also has the rest of the graph they connect into). For every feature combined at once — deep nesting, both lenses, node-lens metadata tagging, and a full frame sequence — read `src/data/seedDiagram.ts`.
