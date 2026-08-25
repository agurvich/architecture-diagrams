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
  parseImportedDiagramJSON,
  saveToLocalStorageDebounced,
} from './persistence';

function cloneSeed(): Diagram {
  return JSON.parse(JSON.stringify(seedDiagram));
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
  currentFrameId: FrameId | null;
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
  importJSON: (json: string) => void;
  exportJSON: () => string;
  clearImportError: () => void;
  setNodeDragging: (dragging: boolean) => void;

  toggleEdgeSet: (id: EdgeSetId) => void;
  toggleExpand: (nodeId: NodeId) => void;
  setHover: (t: HoverTarget | null) => void;
  select: (sel: SelectedElement | null) => void;
  setMultiSelectedNodeIds: (ids: Set<NodeId>) => void;

  addNode: (partial: Omit<DiagramNode, 'id'>) => NodeId;
  /** Copies a node and its full descendant subtree (not edges) to new ids, offsetting the top-level copy so it doesn't sit exactly on top of the original. */
  duplicateNode: (id: NodeId) => NodeId | null;
  updateNode: (id: NodeId, patch: Partial<DiagramNode>) => void;
  deleteNode: (id: NodeId) => void;
  setNodeParent: (nodeId: NodeId, parentId: NodeId | undefined) => void;
  /** Appends a color to the accumulating palette (deduped, no-op if already present). */
  addPaletteColor: (color: string) => void;

  addEdge: (sourceId: NodeId, targetId: NodeId, sets: EdgeSetId[], level: 'node' | 'group') => EdgeId;
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
    currentFrameId: null,
    importError: null,
    isNodeDragging: false,

    setNodeDragging: (dragging) => set({ isNodeDragging: dragging }),

    loadSeed: () => {
      const diagram = cloneSeed();
      saveToLocalStorageDebounced(diagram);
      set({
        diagram,
        activeSets: defaultActiveSets(diagram),
        expandedNodes: new Set(),
        hoverTarget: null,
        selected: null,
        multiSelectedNodeIds: new Set(),
        currentFrameId: null,
        importError: null,
      });
    },

    importJSON: (json) => {
      try {
        const diagram = normalizeDiagram(parseImportedDiagramJSON(json));
        saveToLocalStorageDebounced(diagram);
        set({
          diagram,
          activeSets: defaultActiveSets(diagram),
          expandedNodes: new Set(),
          hoverTarget: null,
          selected: null,
          multiSelectedNodeIds: new Set(),
          currentFrameId: null,
          importError: null,
        });
      } catch (err) {
        set({ importError: err instanceof InvalidDiagramError ? err.message : 'Failed to import diagram.' });
      }
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

    setHover: (t) => set({ hoverTarget: t }),
    // A specific single selection (click, context menu, duplicate, etc.)
    // always supersedes any prior marquee multi-selection — otherwise a
    // leftover multiSelectedNodeIds entry (e.g. from a right-click, which
    // React Flow treats as a selection event too) silently rides along and
    // gets swept up by Delete/Backspace alongside the node you meant to
    // act on.
    select: (sel) => set({ selected: sel, multiSelectedNodeIds: sel ? new Set() : get().multiSelectedNodeIds }),
    setMultiSelectedNodeIds: (ids) => set({ multiSelectedNodeIds: ids }),

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
      persistAndSet(set, (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.filter((n) => n.id !== id).map((n) => (n.parentId === id ? { ...n, parentId: undefined } : n)),
        edges: diagram.edges.filter((e) => e.sourceId !== id && e.targetId !== id),
      }));
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

    addPaletteColor: (color) =>
      persistAndSet(set, (diagram) => {
        const palette = diagram.colorPalette ?? [];
        if (palette.includes(color)) return diagram;
        return { ...diagram, colorPalette: [...palette, color] };
      }),

    addEdge: (sourceId, targetId, sets, level) => {
      const id = makeId('edge');
      persistAndSet(set, (diagram) => ({
        ...diagram,
        edges: [...diagram.edges, { id, sourceId, targetId, sets, level, metadata: {} }],
      }));
      return id;
    },

    updateEdge: (id, patch) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        edges: diagram.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),

    deleteEdge: (id) =>
      persistAndSet(set, (diagram) => ({ ...diagram, edges: diagram.edges.filter((e) => e.id !== id) })),

    reverseEdge: (id) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        edges: diagram.edges.map((e) => (e.id === id ? { ...e, sourceId: e.targetId, targetId: e.sourceId } : e)),
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
        highlighted: state.selected ? [state.selected.id] : undefined,
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
  };
});
