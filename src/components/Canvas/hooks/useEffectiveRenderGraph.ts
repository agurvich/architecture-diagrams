import { useCallback, useEffect, useMemo } from 'react';
import { useDiagramStore } from '../../../store/diagramStore';
import { computeEffectiveGraph } from '../../../engine/computeEffectiveGraph';
import { computeAutoLayoutPositions, computeContainerSizes, topoSort } from '../../../engine/containerLayout';
import { applyNodeLens } from '../../../engine/nodeLens';
import type { EffectiveNode } from '../../../types/effectiveGraph';

/**
 * Derives everything about "what should currently be rendered" from the
 * store: the effective (lens/collapse/hover-resolved) graph, each visible
 * node's rendered size, topo order, its position (auto-layout-aware), and
 * its absolute canvas-space position (needed by anything that can't work in
 * a single node's local, parent-relative coordinate space — actor anchors,
 * wrap-in-container, drag-to-reparent).
 *
 * Also owns the effect that persists computed auto-layout slots back into
 * the diagram's own stored positions — so a node's stored position is
 * never stale relative to where it's actually drawn (see the effect's own
 * comment for the drag-position-randomizing bug this fixed).
 */
export function useEffectiveRenderGraph() {
  const diagram = useDiagramStore((s) => s.diagram);
  const activeSets = useDiagramStore((s) => s.activeSets);
  const expandedNodes = useDiagramStore((s) => s.expandedNodes);
  const nodeLensKey = useDiagramStore((s) => s.nodeLensKey);
  const hoverTarget = useDiagramStore((s) => s.hoverTarget);
  const currentFrameId = useDiagramStore((s) => s.currentFrameId);
  const editingHighlightsForFrameId = useDiagramStore((s) => s.editingHighlightsForFrameId);
  const draggedNodeId = useDiagramStore((s) => s.draggedNodeId);
  const updateNode = useDiagramStore((s) => s.updateNode);

  const currentFrame = diagram.frames.find((f) => f.id === currentFrameId) ?? null;
  const editingFrame = diagram.frames.find((f) => f.id === editingHighlightsForFrameId) ?? null;

  const effectiveGraph = useMemo(
    () =>
      computeEffectiveGraph(diagram, {
        activeSets,
        expandedNodes,
        hoverTarget,
        // While authoring a frame's highlights, show THAT frame's current
        // (live-updating as you click) membership instead of whatever
        // frame is actually playing — same field, different source.
        frameHighlighted: editingFrame ? (editingFrame.highlighted ?? []) : (currentFrame?.highlighted ?? null),
      }),
    [diagram, activeSets, expandedNodes, hoverTarget, currentFrame, editingFrame],
  );

  // Repositions node-lens bundle roots into their region columns (see
  // engine/nodeLens.ts), leaving every other node's parentId/position
  // exactly as computeEffectiveGraph produced it — a no-op passthrough
  // when no lens is active. Applied here, before sizes/order/positions are
  // derived, so everything downstream (container auto-sizing, auto-layout
  // stacking, absolute positions, React Flow's own nesting) picks up the
  // lens-adjusted tree for free instead of needing its own special case.
  const nodeLens = useMemo(
    () => applyNodeLens(effectiveGraph.visibleNodes, effectiveGraph.visibleEdges, diagram, nodeLensKey),
    [effectiveGraph.visibleNodes, effectiveGraph.visibleEdges, diagram, nodeLensKey],
  );
  const lensAdjustedGraph = useMemo(
    () => ({ visibleNodes: nodeLens.nodes, visibleEdges: effectiveGraph.visibleEdges }),
    [nodeLens.nodes, effectiveGraph.visibleEdges],
  );

  const sizes = useMemo(() => computeContainerSizes(lensAdjustedGraph.visibleNodes), [lensAdjustedGraph.visibleNodes]);
  const orderedNodes = useMemo(() => topoSort(lensAdjustedGraph.visibleNodes), [lensAdjustedGraph.visibleNodes]);

  // Position overrides for children of an auto-layout container (Figma-
  // style stacked row/column instead of freeform placement). Only the
  // node actually being dragged is excluded from getting an override — it
  // renders at its own raw, live-updating (cursor-following) position for
  // the duration of the drag — while every OTHER node, auto-layout or not,
  // keeps rendering at its normal computed position throughout.
  // Suppressing the override for *every* node whenever *any* drag was
  // active (the previous approach) meant every auto-layout child in the
  // whole diagram would snap to its stale stored `position` — never kept
  // in sync while auto-layout is what's actually been positioning it —
  // the instant any drag started anywhere, which is exactly what looked
  // like every position on screen "randomizing". Still-visible siblings
  // in the dragged node's own container reflow live as its sort rank
  // changes during the drag, since it's still included as an input to
  // their computed slots, just not given one of its own.
  const autoLayoutPositions = useMemo(
    () => computeAutoLayoutPositions(lensAdjustedGraph.visibleNodes, sizes, draggedNodeId ?? undefined),
    [lensAdjustedGraph.visibleNodes, sizes, draggedNodeId],
  );
  const positionOf = useCallback((n: EffectiveNode) => autoLayoutPositions.get(n.id) ?? n.position, [autoLayoutPositions]);

  // Persists every computed auto-layout slot back into the diagram's own
  // stored node positions, instead of leaving them as a purely visual,
  // render-time-only override — so a node's stored position is never
  // stale relative to where it's actually drawn. Two things fall out of
  // that for free: toggling auto-layout off leaves every child exactly
  // where it last visually sat (free one-shot alignment, then back to
  // manual placement) rather than snapping to some older stored value,
  // and dragging a node no longer has a stale position to snap back to
  // once released. Runs whenever the computed slots actually change —
  // the container's own layout mode is toggled, a child is added,
  // removed, resized, or reordered — and skips whichever node is
  // *currently* being dragged, since onNodeDrag is already keeping that
  // one's stored position live via the cursor; its own slot gets synced
  // the instant the drag stops and this effect sees it excluded no more.
  useEffect(() => {
    for (const [id, pos] of autoLayoutPositions) {
      if (id === draggedNodeId) continue;
      const node = diagram.nodes.find((n) => n.id === id);
      if (node && (node.position.x !== pos.x || node.position.y !== pos.y)) {
        updateNode(id, { position: pos });
      }
    }
  }, [autoLayoutPositions, draggedNodeId, diagram.nodes, updateNode]);

  // Absolute (canvas-space) position of every visible node, resolved by
  // walking down from each root — nested nodes' own `position` is only
  // relative to whatever container currently holds them.
  const absolutePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const n of orderedNodes) {
      const parentAbs = n.parentId ? map.get(n.parentId) : undefined;
      const pos = positionOf(n);
      map.set(n.id, { x: (parentAbs?.x ?? 0) + pos.x, y: (parentAbs?.y ?? 0) + pos.y });
    }
    return map;
  }, [orderedNodes, positionOf]);

  return {
    diagram,
    // The lens-adjusted graph, not the raw one computeEffectiveGraph
    // produced — every other consumer of "effectiveGraph" (canvas
    // node/edge construction, drag/reparent, bulk actions) wants whatever
    // is actually on screen right now, lens included.
    effectiveGraph: lensAdjustedGraph,
    sizes,
    orderedNodes,
    positionOf,
    absolutePositions,
    editingFrame,
    nodeLensKey,
    nodeLensRegions: nodeLens.regions,
  };
}
