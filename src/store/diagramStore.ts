import { create } from 'zustand';
import type { Diagram, DiagramEdge, DiagramNode, EdgeId, EdgeSet, EdgeSetId, Frame, FrameId, NodeId } from '../types/diagram';
import type { HoverTarget, SelectedElement } from '../types/viewState';
import { seedDiagram } from '../data/seedDiagram';
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

function defaultActiveSets(diagram: Diagram): Set<EdgeSetId> {
  return new Set(diagram.edgeSets.map((s) => s.id));
}

interface DiagramStore {
  diagram: Diagram;
  activeSets: Set<EdgeSetId>;
  expandedNodes: Set<NodeId>;
  hoverTarget: HoverTarget | null;
  selected: SelectedElement | null;
  currentFrameId: FrameId | null;
  importError: string | null;

  loadSeed: () => void;
  importJSON: (json: string) => void;
  exportJSON: () => string;
  clearImportError: () => void;

  toggleEdgeSet: (id: EdgeSetId) => void;
  toggleExpand: (nodeId: NodeId) => void;
  setHover: (t: HoverTarget | null) => void;
  select: (sel: SelectedElement | null) => void;

  addNode: (partial: Omit<DiagramNode, 'id'>) => NodeId;
  updateNode: (id: NodeId, patch: Partial<DiagramNode>) => void;
  deleteNode: (id: NodeId) => void;
  setNodeParent: (nodeId: NodeId, parentId: NodeId | undefined) => void;

  addEdge: (sourceId: NodeId, targetId: NodeId, sets: EdgeSetId[], level: 'node' | 'group') => EdgeId;
  updateEdge: (id: EdgeId, patch: Partial<DiagramEdge>) => void;
  deleteEdge: (id: EdgeId) => void;

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
  const initialDiagram = loadFromLocalStorage() ?? cloneSeed();

  return {
    diagram: initialDiagram,
    activeSets: defaultActiveSets(initialDiagram),
    expandedNodes: new Set(),
    hoverTarget: null,
    selected: null,
    currentFrameId: null,
    importError: null,

    loadSeed: () => {
      const diagram = cloneSeed();
      saveToLocalStorageDebounced(diagram);
      set({
        diagram,
        activeSets: defaultActiveSets(diagram),
        expandedNodes: new Set(),
        hoverTarget: null,
        selected: null,
        currentFrameId: null,
        importError: null,
      });
    },

    importJSON: (json) => {
      try {
        const diagram = parseImportedDiagramJSON(json);
        saveToLocalStorageDebounced(diagram);
        set({
          diagram,
          activeSets: defaultActiveSets(diagram),
          expandedNodes: new Set(),
          hoverTarget: null,
          selected: null,
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
    select: (sel) => set({ selected: sel }),

    addNode: (partial) => {
      const id = makeId('node');
      persistAndSet(set, (diagram) => ({ ...diagram, nodes: [...diagram.nodes, { ...partial, id }] }));
      return id;
    },

    updateNode: (id, patch) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      })),

    deleteNode: (id) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.filter((n) => n.id !== id).map((n) => (n.parentId === id ? { ...n, parentId: undefined } : n)),
        edges: diagram.edges.filter((e) => e.sourceId !== id && e.targetId !== id),
      })),

    setNodeParent: (nodeId, parentId) =>
      persistAndSet(set, (diagram) => ({
        ...diagram,
        nodes: diagram.nodes.map((n) => (n.id === nodeId ? { ...n, parentId } : n)),
      })),

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
