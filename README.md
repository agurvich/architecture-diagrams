# Architecture Diagrams

An interactive multi-lens diagram tool: one graph, viewed through several togglable perspectives instead of several separate static diagrams.

- **Nodes are stable** — the same components exist across every lens, preserving spatial memory.
- **Edges are lens-scoped** — each edge belongs to one or more named "edge sets" (e.g. Infrastructure / Process / Data) that can be toggled on or off independently, alone or combined.
- **Hierarchy is orthogonal to lens** — nodes can be grouped into collapsible subsystems. Collapsing a group merges its children's edges into the external world into single deduplicated lines (no redundant parallel edges), and supports group-level edges that belong to the subsystem as a whole rather than any one child.
- **Frames capture narrated walkthroughs** — a frame is a saved snapshot of which lenses are active, which nodes are expanded, and what's highlighted, so an author can build a guided sequence a viewer can step through.
- **Hovering** a node or edge highlights everything connected to it and dims the rest.

## Running it

```bash
npm install
npm run dev
```

Opens with a small seeded demo diagram (a load-balanced API cluster with Infrastructure/Process/Data lenses) that exercises collapse-merge, group-level edges, and a 4-frame walkthrough.

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

## Deploying to GitHub Pages

```bash
npm run deploy:pages
```

Builds the app and pushes `dist/` to the `gh-pages` branch (via a throwaway git worktree, so it never touches your working tree on `main`). One-time setup in the repo: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**. Vite's `base` is set to `./` (relative) so the build works from any subpath without hardcoding the repo name.

## How it works

- **`src/types/diagram.ts`** — the persisted schema: `Node`, `Edge`, `EdgeSet`, `Frame`, `Diagram`. A diagram is a single JSON-serializable document.
- **`src/engine/`** — the core derivation logic. `computeEffectiveGraph` takes the raw `Diagram` plus the current view state (active edge sets, expanded nodes, hover/frame highlights) and produces the graph that actually gets rendered: it resolves each node/edge endpoint to its nearest visible (collapsed) ancestor, then dedupes and merges edges that resolve to the same pair, unioning their sets and combined metadata. `ancestry.ts` holds the ancestor-resolution walk that both ordinary collapse and group-level edges share with no special-casing.
- **`src/store/diagramStore.ts`** — a Zustand store holding the diagram document plus the three view axes (active edge sets, expanded nodes, current frame) and all CRUD/authoring actions. The diagram auto-saves to `localStorage` (debounced); view state resets on reload.
- **`src/components/Canvas/`** — the React Flow canvas: custom node rendering for leaf/collapsed-group/expanded-container states, custom floating edges (so edges reattach correctly as nodes toggle collapse state), and the inline popover for tagging a newly-dragged edge's sets.
- **`src/components/Panels/`** — lens toggles, hierarchy tree, node/edge property editors, and the frame sequencer (author + playback).
- **`src/data/seedDiagram.ts`** — the demo diagram shipped with the app.

## Non-goals (for now)

No backend, no auto-layout (node position is a deliberate authoring choice, preserved across lenses), no natural-language authoring assist, no schema-level validation rules. Diagrams are shared as JSON files via the Export/Import buttons in the toolbar.
