import { create } from 'zustand';
import type { Diagram, DiagramEdge, DiagramNode, EdgeId, EdgeSet, EdgeSetId, Frame, FrameId, NodeId } from '../types/diagram';
import type { HoverTarget, SelectedElement } from '../types/viewState';
import { seedDiagram } from '../data/seedDiagram';
import { DEFAULT_COLOR_PALETTE } from '../lib/colorPalette';
import { makeId } from '../utils/id';
import {
  InvalidDiagramError,
  exportDiagramJSON,
  loadFromLocalStorage,
  loadLastImportedDiagram,
  parseImportedDiagramJSON,
  saveLastImportedDiagram,
  saveToLocalStorageDebounced,
} from './persistence';
import { anchorIdFor, isAnchorId } from '../engine/actorAnchor';

function cloneSeed(): Diagram {
  return JSON.parse(JSON.stringify(seedDiagram));
}

function cloneDiagram(diagram: Diagram): Diagram {
  return JSON.parse(JSON.stringify(diagram));
}

/** Fills in colorPalette for diagrams saved/imported before that field existed. */
function normalizeDiagram(diagram: Diagram): Diagram {
  if (diagram.colorPalette && diagram.colorPalette.length > 0) return diagram;
  return { ...diagram, colorPalette: [...DEFAULT_COLOR_PALETTE] };
}

function defaultActiveSets(diagram: Diagram): Set<EdgeSetId> {
  return new Set(diagram.edgeSets.map((s) => s.id));
}

interface DiagramStore {
  diagram: Diagram;
  activeSets: Set<EdgeSetId>;
  expandedNodes: Set<NodeId>;
  hoverTarget: HoverTarget | null;
  selected: SelectedElement | null;
  /** Nodes selected via React Flow's own marquee (shift-drag) box-select. */
  multiSelectedNodeIds: Set<NodeId>;
  /** Effective edge ids selected the same way — a separate set since a marquee box can cover both at once. */
  multiSelectedEdgeIds: Set<string>;
  currentFrameId: FrameId | null;
  /** Snapshot of the last successfully imported JSON, so resetToImported can return to it even after further edits — null until an import has happened (this session or a previous one, since it's also persisted). */
  lastImportedDiagram: Diagram | null;
  /**
   * When set, clicking a node/edge on the canvas toggles its membership in
   * this frame's `highlighted` list instead of selecting it — the
   * authoring counterpart to a frame's playback-time highlight/dim.
   */
  editingHighlightsForFrameId: FrameId | null;
  importError: string | null;
  /**
   * True while a node is actively being dragged. Hover updates must be
   * suppressed during this window: hovering another node mid-drag would
   * otherwise force a full effective-graph recompute, replacing every
   * rendered node/edge object and snapping the dragged node back to its
   * pre-drag position on every intermediate re-render.
   */
  isNodeDragging: boolean;

  loadSeed: () => void;
  /** Loads any example diagram (see data/examples/) the same way loadSeed loads the shipped default — a fresh clone, all view state reset. */
  loadExample: (diagram: Diagram) => void;
  importJSON: (json: string) => void;
  /** Reloads whatever was last imported (see lastImportedDiagram) — a no-op if nothing has been imported yet. */
  resetToImported: () => void;
  exportJSON: () => string;
  clearImportError: () => void;
  setNodeDragging: (dragging: boolean) => void;

  toggleEdgeSet: (id: EdgeSetId) => void;
  toggleExpand: (nodeId: NodeId) => void;
  /** Adds nodeIds to expandedNodes without touching any already-expanded node's state (unlike toggleExpand). */
  expandNodes: (nodeIds: NodeId[]) => void;
  setHover: (t: HoverTarget | null) => void;
  select: (sel: SelectedElement | null) => void;
  setMultiSelectedNodeIds: (ids: Set<NodeId>) => void;
  setMultiSelectedEdgeIds: (ids: Set<string>) => void;

  addNode: (partial: Omit<DiagramNode, 'id'>) => NodeId;
  /** Copies a node and its full descendant subtree (not edges) to new ids, offsetting the top-level copy so it doesn't sit exactly on top of the original. */
  duplicateNode: (id: NodeId) => NodeId | null;
  updateNode: (id: NodeId, patch: Partial<DiagramNode>) => void;
  deleteNode: (id: NodeId) => void;
  setNodeParent: (nodeId: NodeId, parentId: NodeId | undefined) => void;
  /**
   * Repositions nodeId in the raw diagram.nodes array — the source of
   * truth for sibling order everywhere order is ever shown (currently
   * just HierarchyPanel's tree, same idea as reorderFrames below for
   * frames) — under parentId, immediately before beforeId, or at the end
   * of that parent's children if beforeId is undefined. Also reparents:
   * this is the single operation behind both a plain drag-to-reorder
   * (beforeId set, parentId unchanged) and a drag-to-nest (parentId
   * changed) in the hierarchy panel, since dropping a layer at a new spot
   * in the tree naturally means both at once.
   */
  moveNode: (nodeId: NodeId, parentId: NodeId | undefined, beforeId: NodeId | undefined) => void;
  /** Appends a color to the accumulating palette (deduped, no-op if already present). */
  addPaletteColor: (color: string) => void;

  addEdge: (
    sourceId: NodeId,
    targetId: NodeId,
    sets: EdgeSetId[],
    sourceHandle?: 'top' | 'right' | 'bottom' | 'left',
    targetHandle?: 'top' | 'right' | 'bottom' | 'left',
    actorId?: NodeId,
  ) => EdgeId;
  updateEdge: (id: EdgeId, patch: Partial<DiagramEdge>) => void;
  deleteEdge: (id: EdgeId) => void;
  /** Swaps an edge's source and target. */
  reverseEdge: (id: EdgeId) => void;

  addEdgeSet: (name: string, color: string) => EdgeSetId;
  updateEdgeSet: (id: EdgeSetId, patch: Partial<EdgeSet>) => void;

  saveFrame: (name: string, notes: string) => FrameId;
  updateFrame: (id: FrameId, patch: Partial<Frame>) => void;
  deleteFrame: (id: FrameId) => void;
  reorderFrames: (fromIdx: number, toIdx: number) => void;
  gotoFrame: (id: FrameId) => void;
  nextFrame: () => void;
  prevFrame: () => void;
  setEditingHighlightsForFrame: (id: FrameId | null) => void;
  /**
   * Toggles a group of raw node/edge ids in a frame's highlighted list
   * together, as one unit — a merged edge's several constituent raw edges
   * all get added or all get removed in the same click, rather than
   * letting them drift out of sync with each other.
   */
  toggleFrameHighlightIds: (frameId: FrameId, ids: (NodeId | EdgeId)[]) => void;
}

function persistAndSet(
  set: (partial: Partial<DiagramStore> | ((s: DiagramStore) => Partial<DiagramStore>)) => void,
  updater: (diagram: Diagram) => Diagram,
) {
  set((state) => {
    const nextDiagram = updater(state.diagram);
    saveToLocalStorageDebounced(nextDiagram);
    return { diagram: nextDiagram };
  });
}

export const useDiagramStore = create<DiagramStore>((set, get) => {
  const initialDiagram = normalizeDiagram(loadFromLocalStorage() ?? cloneSeed());

  return {
    diagram: initialDiagram,
    activeSets: defaultActiveSets(initialDiagram),
    expandedNodes: new Set(),
    hoverTarget: null,
    selected: null,
    multiSelectedNodeIds: new Set(),
    multiSelectedEdgeIds: new Set(),
    currentFrameId: null,
    editingHighlightsForFrameId: null,
    lastImportedDiagram: loadLastImportedDiagram(),
    importError: null,
    isNodeDragging: false,

    setNodeDragging: (dragging) => set({ isNodeDragging: dragging }),

    loadSeed: () => get().loadExample(seedDiagram),

    loadExample: (example) => {
      const diagram = cloneDiagram(example);
      saveToLocalStorageDebounced(diagram);
      set({
        diagram,
        activeSets: defaultActiveSets(diagram),
        expandedNodes: new Set(),
        hoverTarget: null,
        selected: null,
        multiSelectedNodeIds: new Set(),
        multiSelectedEdgeIds: new Set(),
        currentFrameId: null,
        editingHighlightsForFrameId: null,
        importError: null,
      });
    },

    importJSON: (json) => {
      try {
        const diagram = normalizeDiagram(parseImportedDiagramJSON(json));
        saveToLocalStorageDebounced(diagram);
        saveLastImportedDiagram(diagram);
        set({
          diagram,
          activeSets: defaultActiveSets(diagram),
          expandedNodes: new Set(),
          hoverTarget: null,
          selected: null,
          multiSelectedNodeIds: new Set(),
          multiSelectedEdgeIds: new Set(),
          currentFrameId: null,
          editingHighlightsForFrameId: null,
          lastImportedDiagram: diagram,
          importError: null,
        });
      } catch (err) {
        set({ importError: err instanceof InvalidDiagramError ? err.message : 'Failed to import diagram.' });
      }
    },

    resetToImported: () => {
      const imported = get().lastImportedDiagram;
      if (!imported) return;
      const diagram = cloneDiagram(imported);
      saveToLocalStorageDebounced(diagram);
      set({
        diagram,
        activeSets: defaultActiveSets(diagram),
        expandedNodes: new Set(),
        hoverTarget: null,
        selected: null,
        multiSelectedNodeIds: new Set(),
        multiSelectedEdgeIds: new Set(),
        currentFrameId: null,
        editingHighlightsForFrameId: null,
        importError: null,
      });
    },

    exportJSON: () => exportDiagramJSON(get().diagram),
    clearImportError: () => set({ importError: null }),

    toggleEdgeSet: (id) =>
      set((state) => {
        const next = new Set(state.activeSets);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { activeSets: next };
      }),

    toggleExpand: (nodeId) =>
      set((state) => {
        const next = new Set(state.expandedNodes);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return { expandedNodes: next };
      }),

    expandNodes: (nodeIds) =>
      set((state) => {
        const next = new Set(state.expandedNodes);
        for (const id of nodeIds) next.add(id);
        return { expandedNodes: next };
      }),

    setHover: (t) => set({ hoverTarget: t }),
    // A specific single selection (click, context menu, duplicate, etc.)
    // always supersedes any prior marquee multi-selection — otherwise a
    // leftover multiSelectedNodeIds entry (e.g. from a right-click, which
    // React Flow treats as a selection event too) silently rides along and
    // gets swept up by Delete/Backspace alongside the node you meant to
    // act on.
    select: (sel) =>
      set({
        selected: sel,
        multiSelectedNodeIds: sel ? new Set() : get().multiSelectedNodeIds,
        multiSelectedEdgeIds: sel ? new Set() : get().multiSelectedEdgeIds,
      }),
    setMultiSelectedNodeIds: (ids) => set({ multiSelectedNodeIds: ids }),
    setMultiSelectedEdgeIds: (ids) => set({ multiSelectedEdgeIds: ids }),

    addNode: (partial) => {
      const id = makeId('node');
      persistAndSet(set, (diagram) => ({ ...diagram, nodes: [...diagram.nodes, { ...partial, id }] }));
      return id;
    },

    duplicateNode: (sourceId) => {
      const nodes = get().diagram.nodes;
      const source = nodes.find((n) => n.id === sourceId);
      if (!source) return null;

      // Copy the whole subtree, not just this node: collect source + every
      // descendant, mint each a new id, and remap parentId references
      // within the copy so the nested structure is preserved. Only the
      // top-level copy gets the "copy" label suffix and position offset —
      // descendants keep their labels and their existing relative
      // position under their (also-copied) parent.
      const childrenOf = new Map<NodeId, DiagramNode[]>();
      for (const n of nodes) {
        if (n.parentId) {
          const list = childrenOf.get(n.parentId) ?? [];
          list.push(n);
          childrenOf.set(n.parentId, list);
        }
      }
      const subtree: DiagramNode[] = [];
      const stack = [source];
      while (stack.length) {
        const n = stack.pop()!;
        subtree.push(n);
        stack.push(...(childrenOf.get(n.id) ?? []));
      }

      const idMap = new Map<NodeId, NodeId>(subtree.map((n) => [n.id, makeId('node')]));
      const copies: DiagramNode[] = subtree.map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        label: n.id === sourceId ? `${n.label} copy` : n.label,
        parentId: n.id === sourceId ? n.parentId : idMap.get(n.parentId!),
        // Offset large enough to clearly separate the copy from the
        // original (a leaf node is ~170x64), so it doesn't land nearly on
        // top of it and look like nothing happened.
        position: n.id === sourceId ? { x: n.position.x + 60, y: n.position.y + 60 } : { ...n.position },
        metadata: { ...n.metadata },
      }));

      persistAndSet(set, (diagram) => ({ ...diagram, nodes: [...diagram.nodes, ...copies] }));
      return idMap.get(sourceId)!;
    },

    updateNode: (id, patch) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      })),

    deleteNode: (id) => {
      persistAndSet(set, (diagram) => {
        // Any action edge attributed to this node loses its actor (the
        // resource-to-resource relationship survives; only the "who did
        // it" attribution goes dangling), and any trigger edge pointing at
        // that now-actorless action's anchor cascades away with it — same
        // idea as an edge cascading when the node it's attached to goes.
        const orphanedAnchors = new Set(
          diagram.edges.filter((e) => e.actorId === id).map((e) => anchorIdFor(e.id)),
        );
        return {
          ...diagram,
          nodes: diagram.nodes.filter((n) => n.id !== id).map((n) => (n.parentId === id ? { ...n, parentId: undefined } : n)),
          edges: diagram.edges
            .filter((e) => e.sourceId !== id && e.targetId !== id && !orphanedAnchors.has(e.targetId))
            .map((e) => (e.actorId === id ? { ...e, actorId: undefined } : e)),
        };
      });
      set((state) => {
        const next = new Set(state.multiSelectedNodeIds);
        next.delete(id);
        return {
          multiSelectedNodeIds: next,
          selected: state.selected?.kind === 'node' && state.selected.id === id ? null : state.selected,
        };
      });
    },

    setNodeParent: (nodeId, parentId) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.map((n) => (n.id === nodeId ? { ...n, parentId } : n)),
      })),

    moveNode: (nodeId, parentId, beforeId) =>
      persistAndSet(set, (diagram) => {
        const node = diagram.nodes.find((n) => n.id === nodeId);
        if (!node) return diagram;
        const moved = { ...node, parentId };
        const rest = diagram.nodes.filter((n) => n.id !== nodeId);
        const insertAt = beforeId ? rest.findIndex((n) => n.id === beforeId) : -1;
        const nodes = insertAt === -1 ? [...rest, moved] : [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
        return { ...diagram, nodes };
      }),

    addPaletteColor: (color) =>
      persistAndSet(set, (diagram) => {
        const palette = diagram.colorPalette ?? [];
        if (palette.includes(color)) return diagram;
        return { ...diagram, colorPalette: [...palette, color] };
      }),

    addEdge: (sourceId, targetId, sets, sourceHandle, targetHandle, actorId) => {
      const id = makeId('edge');
      persistAndSet(set, (diagram) => ({
        ...diagram,
        edges: [...diagram.edges, { id, sourceId, targetId, sets, metadata: {}, sourceHandle, targetHandle, actorId }],
      }));
      return id;
    },

    updateEdge: (id, patch) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        edges: diagram.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),

    // Deleting an action edge cascades to any trigger edge pointing at its
    // anchor — same reasoning as deleteNode cascading to edges touching
    // the deleted node: a trigger with nothing left to point at is dead
    // weight, not a broken reference to leave dangling.
    deleteEdge: (id) =>
      persistAndSet(set, (diagram) => {
        const anchorId = anchorIdFor(id);
        return { ...diagram, edges: diagram.edges.filter((e) => e.id !== id && e.targetId !== anchorId) };
      }),

    // A trigger edge's targetId is a synthetic anchor, not a real node —
    // swapping it into sourceId would be meaningless, so leave trigger
    // edges untouched (the UI also hides "Reverse direction" for them).
    reverseEdge: (id) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        edges: diagram.edges.map((e) =>
          e.id === id && !isAnchorId(e.targetId)
            ? { ...e, sourceId: e.targetId, targetId: e.sourceId, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle }
            : e,
        ),
      })),

    addEdgeSet: (name, color) => {
      const id = makeId('set');
      persistAndSet(set, (diagram) => ({ ...diagram, edgeSets: [...diagram.edgeSets, { id, name, color }] }));
      set((state) => ({ activeSets: new Set(state.activeSets).add(id) }));
      return id;
    },

    updateEdgeSet: (id, patch) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        edgeSets: diagram.edgeSets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })),

    saveFrame: (name, notes) => {
      const id = makeId('frame');
      const state = get();
      const frame: Frame = {
        id,
        name,
        notes,
        activeSets: [...state.activeSets],
        expandedNodes: [...state.expandedNodes],
        // Starts with nothing spotlighted — `selected.id` here would be an
        // *effective* id (e.g. `merged:a=>b` for an edge), not one of the
        // raw node/edge ids `highlighted` and its resolution in
        // computeEffectiveGraph.ts actually expect, so guessing from
        // current selection never really worked for edges. Use "Edit
        // highlights" below to build the list correctly instead.
        highlighted: undefined,
      };
      persistAndSet(set, (diagram) => ({ ...diagram, frames: [...diagram.frames, frame] }));
      set({ currentFrameId: id });
      return id;
    },

    updateFrame: (id, patch) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        frames: diagram.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      })),

    deleteFrame: (id) =>
      persistAndSet(set, (diagram) => ({ ...diagram, frames: diagram.frames.filter((f) => f.id !== id) })),

    reorderFrames: (fromIdx, toIdx) =>
      persistAndSet(set, (diagram) => {
        const frames = [...diagram.frames];
        const [moved] = frames.splice(fromIdx, 1);
        frames.splice(toIdx, 0, moved);
        return { ...diagram, frames };
      }),

    gotoFrame: (id) => {
      const frame = get().diagram.frames.find((f) => f.id === id);
      if (!frame) return;
      set({
        currentFrameId: id,
        activeSets: new Set(frame.activeSets),
        expandedNodes: new Set(frame.expandedNodes),
      });
    },

    nextFrame: () => {
      const { diagram, currentFrameId } = get();
      if (diagram.frames.length === 0) return;
      const idx = diagram.frames.findIndex((f) => f.id === currentFrameId);
      const nextIdx = idx === -1 ? 0 : Math.min(idx + 1, diagram.frames.length - 1);
      get().gotoFrame(diagram.frames[nextIdx].id);
    },

    prevFrame: () => {
      const { diagram, currentFrameId } = get();
      if (diagram.frames.length === 0) return;
      const idx = diagram.frames.findIndex((f) => f.id === currentFrameId);
      const prevIdx = idx === -1 ? 0 : Math.max(idx - 1, 0);
      get().gotoFrame(diagram.frames[prevIdx].id);
    },

    // Also jumps to the frame's own lens/expand state (like gotoFrame) so
    // clicks land on the same nodes/edges this frame will actually show
    // during playback, rather than whatever was on screen before editing
    // started.
    setEditingHighlightsForFrame: (id) => {
      if (id) get().gotoFrame(id);
      set({ editingHighlightsForFrameId: id });
    },

    toggleFrameHighlightIds: (frameId, ids) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        frames: diagram.frames.map((f) => {
          if (f.id !== frameId) return f;
          const current = new Set(f.highlighted ?? []);
          // All-or-nothing: if every id in this click's group (e.g. every
          // raw edge behind one merged line) is already highlighted,
          // remove them all; otherwise add whichever are missing — keeps
          // a merged edge's raw edges toggling together as one unit
          // instead of drifting out of sync with each other.
          const allPresent = ids.every((rawId) => current.has(rawId));
          for (const rawId of ids) {
            if (allPresent) current.delete(rawId);
            else current.add(rawId);
          }
          const next = [...current];
          return { ...f, highlighted: next.length > 0 ? next : undefined };
        }),
      })),
  };
});
