import { useCallback, useRef, useState } from 'react';
import type { OnConnectEnd, OnConnectStart, OnReconnect } from '@xyflow/react';
import { useDiagramStore } from '../../../store/diagramStore';
import type { CompassSide } from '../../../types/diagram';
import type { GraphEdgeType } from '../GraphEdge';
import { type PendingConnection } from '../ConnectionPopover';

/**
 * Drawing a brand-new edge (drag from a handle to a node/anchor) and
 * reconnecting an existing edge's own endpoint both go through React
 * Flow's same underlying connection-drag gesture — see isReconnectingRef
 * below for why that matters — plus the hover-dimming reset every
 * connection-type drag needs (same staleness as a node drag, see
 * useNodeDragAndReparent's onNodeDragStart).
 */
export function useEdgeConnections() {
  const setHover = useDiagramStore((s) => s.setHover);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const [pending, setPending] = useState<PendingConnection | null>(null);

  // React Flow fires onConnectEnd for EVERY connect-type pointer-up,
  // including dragging an existing reconnectable edge's own endpoint —
  // reconnect isn't a separate gesture from React Flow's point of view,
  // it's the same connection drag with fromNode/toNode pinned to whichever
  // end wasn't grabbed. Without this flag, onConnectEnd's "you just drew a
  // brand new edge" flow below would fire a second time for every
  // reconnect, on top of (and independent from) whatever onReconnect did
  // or didn't do, producing a spurious extra edge — bracketed by
  // onReconnectStart/onReconnectEnd below, which span the exact time
  // onConnectEnd's body runs in during a reconnect.
  const isReconnectingRef = useRef(false);

  const onConnectStart: OnConnectStart = useCallback(() => {
    setHover(null);
  }, [setHover]);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      // Mirrors onConnectStart: hoverFrozen only lifts once this handler
      // returns, so whatever the pointer is sitting over right now hasn't
      // had a chance to set hover for itself yet — without this, dimming
      // stays stuck at whatever was hovered before the drag began until
      // the next real mouseenter/leave.
      setHover(null);
      if (isReconnectingRef.current) return;
      if (!connectionState.isValid || !connectionState.fromNode || !connectionState.toNode) return;
      const sourceId = connectionState.fromNode.id;
      const targetId = connectionState.toNode.id;
      if (sourceId === targetId) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : (event as MouseEvent);
      setPending({
        sourceId,
        targetId,
        screenX: point.clientX,
        screenY: point.clientY,
        // Position's string values ('top'/'right'/'bottom'/'left') already
        // match our handle-id convention, so the exact side dragged
        // from/to carries straight through to the new edge.
        sourceHandle: connectionState.fromPosition as CompassSide | undefined,
        targetHandle: connectionState.toPosition as CompassSide | undefined,
      });
    },
    [setHover],
  );

  // Dragging an existing (reconnectable) edge's own endpoint onto a
  // different node/anchor/handle reassigns it in place instead of forcing
  // a delete-and-recreate — how a misattributed trigger gets pointed at
  // the right action's anchor, an edge gets re-aimed at a different node,
  // or just moved to a different side of the same node. The no-op guard
  // matters specifically for a substituted endpoint (edge rendered against
  // a collapsed ancestor): dropping back without actually moving it would
  // otherwise fire with the SAME source/target/handles the edge already
  // rendered with (the collapsed ancestor's id) and silently overwrite the
  // raw edge's real child endpoint with that ancestor's id — only write
  // when something actually changed. Handles are part of that comparison
  // (not just source/target node ids) so a same-node, different-handle
  // drag — e.g. moving the anchor from north to east on the node it's
  // already attached to — still counts as a real change and gets written,
  // instead of being silently swallowed.
  const onReconnect: OnReconnect<GraphEdgeType> = useCallback(
    (oldEdge, newConnection) => {
      if (!oldEdge.data || oldEdge.data.count !== 1) return;
      if (!newConnection.source || !newConnection.target) return;
      if (
        newConnection.source === oldEdge.source &&
        newConnection.target === oldEdge.target &&
        newConnection.sourceHandle === oldEdge.sourceHandle &&
        newConnection.targetHandle === oldEdge.targetHandle
      ) {
        return;
      }
      const rawEdgeId = oldEdge.data.originalEdgeIds[0];
      updateEdge(rawEdgeId, {
        sourceId: newConnection.source,
        targetId: newConnection.target,
        sourceHandle: (newConnection.sourceHandle ?? undefined) as CompassSide | undefined,
        targetHandle: (newConnection.targetHandle ?? undefined) as CompassSide | undefined,
      });
    },
    [updateEdge],
  );

  const onReconnectStart = useCallback(() => {
    isReconnectingRef.current = true;
  }, []);

  const onReconnectEnd = useCallback(() => {
    isReconnectingRef.current = false;
  }, []);

  return { pending, setPending, onConnectStart, onConnectEnd, onReconnect, onReconnectStart, onReconnectEnd };
}
