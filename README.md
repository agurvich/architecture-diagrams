# Architecture Diagrams

An interactive multi-lens diagram tool: one graph, viewed through several togglable perspectives instead of several separate static diagrams.

- **Nodes are stable** — the same components exist across every lens, preserving spatial memory.
- **Edges are lens-scoped** — each edge belongs to one or more named "edge sets" (e.g. Control Flow / Data Flow) that can be toggled on or off independently, alone or combined.
- **Hierarchy is orthogonal to lens** — nodes can be grouped into collapsible subsystems, nested arbitrarily deep (a Step Function inside an AWS account, an AV Lambda inside the same account, and so on). Collapsing a group merges its children's edges into the external world into single deduplicated lines (no redundant parallel edges), and correctly resolves an edge drawn directly against a container itself (not one of its children) at any collapse depth.
- **Actors, actions, and triggers** — a node can be flagged as an actor (an IAM role, a person, anything that *does* things); an edge can be attributed to one via `actorId`, independent of its own source/target, since the actor performing an action isn't necessarily either endpoint (an IAM role copying between two S3 buckets it isn't itself drawn connected to). Every such action renders a small anchor at its own midpoint carrying the actor's icon. A **trigger** is just a plain edge whose target is that anchor instead of a real node — a process step pointing at the *specific* action it causes, not just the actor in general. See `src/engine/actorAnchor.ts`.
- **Edges can be reassigned by dragging** — select a single (unmerged) edge and drag either endpoint onto a different node or actor-anchor to reattach it in place, instead of deleting and recreating it.
- **Frames capture narrated walkthroughs** — a frame is a saved snapshot of which lenses are active, which nodes are expanded, and what's highlighted, so an author can build a guided sequence a viewer can step through. "Edit highlights" puts the canvas into a click-to-toggle mode for building that highlighted set node/edge by node/edge, live. The current frame is mirrored into the URL as `?frame=<id>`, so a link resumes at that exact frame.
- **Hovering** a node or edge highlights everything connected to it and dims the rest — including an actor's own actions when you hover the actor itself, even though it's neither endpoint of any of them.

## Running it

```bash
npm install
npm run dev
```

Opens with a small seeded demo diagram — a real-world AWS ingest pipeline (Step Function → S3 buckets → AV-scanning Lambda → cross-account copy, two AWS account boundaries, three IAM roles attributed to the actions they perform) that exercises collapse-merge at multiple nesting depths, the actor/action/trigger model, and a 4-frame walkthrough. The toolbar's "Load example…" dropdown also has two smaller, more focused examples: a three-tier web app (built to show merge-on-collapse as simply as possible) and an order-processing flow (the actor model in a non-AWS domain) — see `src/data/examples/`.

```bash
npm run build   # type-check + production build
```

## Testing

```bash
npm run test       # Vitest + React Testing Library (engine + component tests)
npm run test:watch # same, in watch mode
npm run test:e2e   # Playwright, driving a real browser against the dev server
```

Unit/component tests live next to the code they cover (`*.test.ts(x)`); end-to-end tests live in `e2e/`. The Playwright suite exercises the full interaction model against a real browser — lens toggling, collapse/expand with edge merging, hover highlighting, frame playback, and drag-to-connect edge creation — and is what actually caught a real bug: hovering a node mid-drag was corrupting React Flow's hit-testing for the handle under the cursor (fixed in `GraphNode.tsx`/`GraphEdge.tsx` by freezing hover while a connection is in progress).

`src/data/examples/index.test.ts` validates every shipped example diagram's structural integrity (every id reference resolves to something real, every trigger's anchor points at an action edge that actually has an actor, `computeEffectiveGraph` doesn't throw for any frame) — a safety net for editing the demo data itself, not just the engine.

Note: Node 22+ defines its own experimental global `localStorage`, which otherwise wins over jsdom's actually-functional one at the same bare-global slot in every test that touches persistence. `vitest.config.ts` disables it (`--no-experimental-webstorage`) and `persistence.ts` uses `window.localStorage` explicitly rather than the bare identifier, so this is unambiguous in both a real browser and the test runner.

## Deploying to GitHub Pages

```bash
npm run deploy:pages
```

Builds the app and pushes `dist/` to the `gh-pages` branch (via a throwaway git worktree, so it never touches your working tree on `main`). One-time setup in the repo: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**. Vite's `base` is set to `./` (relative) so the build works from any subpath without hardcoding the repo name.

## How it works

- **`src/types/diagram.ts`** — the persisted schema: `Node`, `Edge`, `EdgeSet`, `Frame`, `Diagram`. A diagram is a single JSON-serializable document. A node's `isActor` flag and an edge's `actorId`/`sourceHandle`/`targetHandle` are all optional, so older exported JSON still imports fine.
- **`src/engine/`** — the core derivation logic. `computeEffectiveGraph` takes the raw `Diagram` plus the current view state (active edge sets, expanded nodes, hover/frame highlights) and produces the graph that actually gets rendered: it resolves each node/edge endpoint to its nearest visible (collapsed) ancestor, then dedupes and merges edges that resolve to the same pair, unioning their sets and combined metadata. A remembered edge anchor and an action's `actorId` both carry through as long as the merge resolves to exactly one raw edge — a collapsed ancestor standing in for the real endpoint is still a real node with its own border and handles, not a reason to fall back to floating geometry. `ancestry.ts` holds the ancestor-resolution walk that ordinary collapse and an edge drawn directly against a container share with no special-casing, at any nesting depth. `actorAnchor.ts` defines the `anchor:<edgeId>` id scheme a trigger edge's `targetId` uses to point at a specific action instead of a real node.
- **`src/store/diagramStore.ts`** — a Zustand store holding the diagram document plus the view axes (active edge sets, expanded nodes, current frame, and the frame-highlight-editing mode) and all CRUD/authoring actions, including the cascade rules for actors/actions/triggers (deleting an action edge or its actor cleans up any trigger left pointing at nothing). The diagram auto-saves to `localStorage` (debounced); a successful JSON import is separately snapshotted so "Reset to imported" can return to it even after further edits; view state resets on reload.
- **`src/components/Canvas/`** — the React Flow canvas: custom node rendering for leaf/collapsed-group/expanded-container/actor-anchor states, custom floating edges (so edges reattach correctly as nodes toggle collapse state), drag-to-reassign edge endpoints, and the inline popover for tagging a newly-dragged edge's sets (and, for a real node-to-node connection, its actor).
- **`src/components/Panels/`** — lens toggles, hierarchy tree, node/edge property editors (including the Actor toggle and the actor-attribution dropdown), and the frame sequencer (author, highlight-edit, and playback).
- **`src/data/seedDiagram.ts`** — the demo diagram shipped with the app; **`src/data/examples/`** — the full gallery, including the seed.

## Non-goals (for now)

No backend, no auto-layout (node position is a deliberate authoring choice, preserved across lenses), no natural-language authoring assist, no schema-level validation rules beyond the shape check on import. Diagrams are shared as JSON files via the Export/Import buttons in the toolbar, or as a link to a specific frame via the `?frame=` URL param.
