import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './index';
import { computeEffectiveGraph } from '../../engine/computeEffectiveGraph';
import { isAnchorId, actionEdgeIdFromAnchor } from '../../engine/actorAnchor';

describe('example diagrams — structural validity', () => {
  for (const example of EXAMPLES) {
    describe(example.name, () => {
      const { diagram } = example;
      const nodeIds = new Set(diagram.nodes.map((n) => n.id));
      const edgeIds = new Set(diagram.edges.map((e) => e.id));

      it('every node id is unique', () => {
        expect(diagram.nodes.length).toBe(nodeIds.size);
      });

      it('every edge id is unique', () => {
        expect(diagram.edges.length).toBe(edgeIds.size);
      });

      it('every node parentId (if set) refers to another real node', () => {
        for (const n of diagram.nodes) {
          if (n.parentId) expect(nodeIds.has(n.parentId)).toBe(true);
        }
      });

      it('every edge sourceId refers to a real node', () => {
        for (const e of diagram.edges) {
          expect(nodeIds.has(e.sourceId)).toBe(true);
        }
      });

      it('every edge targetId refers to a real node, or a trigger anchor pointing at a real action edge with an actor', () => {
        for (const e of diagram.edges) {
          if (isAnchorId(e.targetId)) {
            const actionEdgeId = actionEdgeIdFromAnchor(e.targetId);
            const actionEdge = diagram.edges.find((x) => x.id === actionEdgeId);
            expect(actionEdge, `trigger "${e.id}" points at a nonexistent action edge "${actionEdgeId}"`).toBeDefined();
            expect(actionEdge!.actorId, `trigger "${e.id}"'s action edge "${actionEdgeId}" has no actorId to anchor on`).toBeDefined();
          } else {
            expect(nodeIds.has(e.targetId)).toBe(true);
          }
        }
      });

      it('every edge actorId (if set) refers to a node flagged isActor', () => {
        for (const e of diagram.edges) {
          if (!e.actorId) continue;
          const actor = diagram.nodes.find((n) => n.id === e.actorId);
          expect(actor, `edge "${e.id}"'s actorId "${e.actorId}" does not exist`).toBeDefined();
          expect(actor!.isActor, `edge "${e.id}"'s actorId "${e.actorId}" is not flagged isActor`).toBe(true);
        }
      });

      it('every edge sets entry refers to a real edge set', () => {
        const setIds = new Set(diagram.edgeSets.map((s) => s.id));
        for (const e of diagram.edges) {
          for (const s of e.sets) expect(setIds.has(s)).toBe(true);
        }
      });

      it('every frame\'s activeSets/expandedNodes refer to real edge sets/nodes', () => {
        const setIds = new Set(diagram.edgeSets.map((s) => s.id));
        for (const f of diagram.frames) {
          for (const s of f.activeSets) expect(setIds.has(s)).toBe(true);
          for (const n of f.expandedNodes) expect(nodeIds.has(n)).toBe(true);
        }
      });

      it('computeEffectiveGraph does not throw for any (activeSets, expandedNodes) combination the frames use, or the fully-collapsed/expanded default', () => {
        const allSets = new Set(diagram.edgeSets.map((s) => s.id));
        expect(() => computeEffectiveGraph(diagram, { activeSets: allSets, expandedNodes: new Set() })).not.toThrow();
        for (const f of diagram.frames) {
          expect(() =>
            computeEffectiveGraph(diagram, {
              activeSets: new Set(f.activeSets),
              expandedNodes: new Set(f.expandedNodes),
              frameHighlighted: f.highlighted ?? null,
            }),
          ).not.toThrow();
        }
      });
    });
  }
});
