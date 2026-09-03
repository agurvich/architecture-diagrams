# Canvas rebuild — handoff notes

## Why

The current app (React Flow + custom Zustand store) was a discovery project: it proved which interaction mechanics matter, but ended up single-player with sharing hacked on after the fact (a gzip'd URL param, not real collaboration). The actual goal is a tool for sketching architecture on an iPad and sharing it live (self-hosted) with a colleague, built on a mature canvas SDK instead of hand-rolled primitives — while keeping the one feature that's actually worth keeping: hierarchical nesting with a frame-based state-toggle/narration system.

## Feature audit (current app)

- **Stable nodes, lens-scoped edges** — edges belong to named "edge sets," toggled independently.
- **Hierarchical nesting** — arbitrary depth, collapse/expand, collapse merges children's edges into deduplicated lines against the outside world (including edges drawn directly against a container).
- **Node-lens grouping** — regroups nodes into on-screen regions by a shared metadata key, independent of the structural tree; barycenter crossing-reduction; incomplete-bundle indicators.
- **Actor/action/trigger model** — an edge can be attributed to an actor independent of its own endpoints; triggers point at a specific action's anchor.
- **Editing mechanics** — drag-to-reassign edge endpoints, two layout modes (Figma-style auto-layout + one-shot elkjs), marquee bulk actions, hierarchy tree panel, metadata autocomplete.
- **Frames** — named snapshots of active lenses/expanded nodes/highlights/grouping, steppable prev/next (presentation mode over one persistent graph); per-frame draggable sticky notes; `?frame=` deep link; exit-frame-view.
- **Hover highlighting** — connected elements highlight, rest dims.
- **Sharing** — read-only shareable URL (whole diagram gzip+base64url'd into `?d=`), hard read-only `viewMode` gated at the store's single mutation choke point.
- **JSON export/import**, localStorage autosave, an AI-authoring guide for the schema.

**The core feature worth preserving: hierarchical nesting + frame-based state-toggle.** Node-lens grouping and the actor model are valuable but secondary — lenses are really a special case of "swap to a different frame snapshot," done as sugar for a common authoring pattern.

## What's missing that motivated this rebuild

1. **Freehand/iPad-native drawing feel** — not something worth building from scratch.
2. **Real self-hosted multiplayer** — share a live drawing session via a link, not async JSON hand-off.
3. **Sketch → clean-shape recognition** (draw a rough circle, it snaps to a circle).

## SDK comparison: tldraw vs. Excalidraw

| | tldraw | Excalidraw |
|---|---|---|
| Freehand/iPad drawing | Excellent — pressure-sensitive `perfect-freehand`, their flagship feature | Fine, not a specialty |
| Self-hosted multiplayer | Real, documented (Cloudflare Workers or Node+SQLite); official multiplayer starter kit exists | DIY — `excalidraw-room` relay + community docker-compose stacks; thin official docs |
| Extensibility for our core feature (hierarchy + frame-toggle) | Strong — `ShapeUtil`/`StateNode`/bindings are a first-class SDK for building whole custom canvas apps; their own "frame" shape is just a clipping container, so we'd build ours from scratch either way, but the SDK is designed for exactly this pattern | Weak — no first-class custom-element-type API, toolbar/properties panel not overridable; realistic pattern is a companion overlay synced via `updateScene`/`customData`, not a native extension |
| Shape recognition | Doesn't exist | Real, shipped ("Autoshape," merged July 2026) — freedraw → clean rectangle/ellipse/diamond/arrow |
| License | Source-available (2025 relicense): free for dev; production requires a paid commercial license **or** a free hobby tier that forces a "made with tldraw" watermark — hobby tier is explicitly non-commercial only | MIT — no restrictions, no watermark |

**Recommendation: tldraw.** Shape recognition is a bounded, addable feature (worst case, hand-roll a simplify-and-classify pass on freedraw strokes later). The hierarchy/frame system is the actual core value, and that's exactly where tldraw's SDK is purpose-built (see: the tldraw "workflow" starter kit, which does custom nodes/ports/execution on these same primitives) versus Excalidraw's bolt-on extension story.

**Open risk: licensing.** This is likely commercial use (built for work, shared with colleagues). Get a real quote before committing — "value-based" pricing means nothing is public — or explicitly decide the watermark is acceptable for an internal tool.

## Architecture note — read before starting (multiplayer-driven correction)

Build custom shapes/tools/domain state **directly on tldraw's own store/`Editor` APIs from the first spike**, not as a parallel state manager (e.g. a Zustand store) that merely renders into tldraw as a view. tldraw sync works by syncing the underlying reactive store itself — anything kept outside it is invisible to sync no matter when multiplayer gets added, and retrofitting that later means rearchitecting the mutation layer, not just adding a server. Built store-native from the start, the official multiplayer starter kit's sync wiring should be a cheap, late addition — not a phase-4 rewrite.

## Migration plan

1. **De-risk the license question** — get a real quote or confirm watermark-acceptability before writing code on this foundation.
2. **Spike: hierarchy + frame-toggle on tldraw's primitives, built store-native.** One custom container `ShapeUtil` that nests, collapses/expands, and merges child connections into the parent on collapse — the single riskiest mechanic — implemented via tldraw's own store, not shadow app state. If this doesn't feel natural within a few days, that's the signal to stop and reconsider.
3. **Port the data model.** `Diagram`/`DiagramNode`/`DiagramEdge`/`EdgeSet`/`Frame`/`StickyNote` (`src/types/diagram.ts`) are mostly rendering-agnostic and survive as-is. The real IP to carry over is the derivation logic — `computeEffectiveGraph`, ancestry resolution, node-lens grouping, actor/action/trigger (`src/engine/`) — reimplemented to operate over tldraw records.
4. **Rebuild the interaction layer**, roughly foundational → additive: hierarchical nesting/collapse → edge-set lens toggling → frames/narration → node-lens grouping → actor/action/trigger → sticky notes → share-link/view-mode (may be simpler on tldraw if it already has a read-only primitive).
5. **Multiplayer**, via the official starter kit — should now be a low-cost addition given step 2's constraint, not a separate architecture phase.

**Kept as-is regardless of foundation:** JSON schema, export/import, the AI-authoring doc (schema-level, not renderer-specific).

## Next decisions for whoever picks this up

- Get the tldraw commercial license quote (or decide the watermark is fine).
- Run the Phase-1 store-native hierarchy spike before committing further.
