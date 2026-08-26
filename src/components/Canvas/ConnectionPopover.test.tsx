import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionPopover, type PendingConnection } from './ConnectionPopover';
import { useDiagramStore } from '../../store/diagramStore';
import { anchorIdFor } from '../../engine/actorAnchor';

function setSimpleDiagram() {
  useDiagramStore.getState().loadSeed();
  useDiagramStore.setState((state) => ({
    diagram: {
      ...state.diagram,
      nodes: [
        { id: 'a', label: 'A', position: { x: 0, y: 0 }, metadata: {} },
        { id: 'b', label: 'B', position: { x: 0, y: 0 }, metadata: {} },
        { id: 'role', label: 'Role', position: { x: 0, y: 0 }, metadata: {}, isActor: true },
      ],
      edges: [],
    },
  }));
}

describe('ConnectionPopover — plain edge', () => {
  beforeEach(() => {
    setSimpleDiagram();
  });

  const pending: PendingConnection = { sourceId: 'a', targetId: 'b', screenX: 50, screenY: 50 };

  it('renders the plain-edge heading, an actor dropdown (actors exist), and disables Add edge with no sets picked', () => {
    render(<ConnectionPopover pending={pending} onDone={() => {}} />);
    expect(screen.getByText('New edge — tag sets')).toBeInTheDocument();
    expect(screen.getByLabelText('Actor (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add edge' })).toBeDisabled();
  });

  it('picking a set enables Add edge, and confirming calls addEdge with the picked set/actor/handles then onDone', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const withHandles: PendingConnection = { ...pending, sourceHandle: 'right', targetHandle: 'left' };
    render(<ConnectionPopover pending={withHandles} onDone={onDone} />);

    const setId = useDiagramStore.getState().diagram.edgeSets[0].id;
    await user.click(screen.getByLabelText(useDiagramStore.getState().diagram.edgeSets[0].name));
    await user.selectOptions(screen.getByLabelText('Actor (optional)'), 'Role');
    const addButton = screen.getByRole('button', { name: 'Add edge' });
    expect(addButton).not.toBeDisabled();
    await user.click(addButton);

    const edges = useDiagramStore.getState().diagram.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      sourceId: 'a',
      targetId: 'b',
      sets: [setId],
      sourceHandle: 'right',
      targetHandle: 'left',
      actorId: 'role',
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Cancel calls onDone without creating an edge', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<ConnectionPopover pending={pending} onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useDiagramStore.getState().diagram.edges).toHaveLength(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('hides the actor dropdown entirely when the diagram has no actor nodes', () => {
    useDiagramStore.setState((state) => ({
      diagram: { ...state.diagram, nodes: state.diagram.nodes.filter((n) => !n.isActor) },
    }));
    render(<ConnectionPopover pending={pending} onDone={() => {}} />);
    expect(screen.queryByLabelText('Actor (optional)')).toBeNull();
  });
});

describe('ConnectionPopover — trigger (dropped on an actor-anchor)', () => {
  beforeEach(() => {
    setSimpleDiagram();
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        edges: [{ id: 'action1', sourceId: 'a', targetId: 'b', sets: [], metadata: {}, actorId: 'role' }],
      },
    }));
  });

  it('renders the trigger heading and a description naming the actor and the action\'s endpoints, with no actor dropdown', () => {
    const pending: PendingConnection = { sourceId: 'a', targetId: anchorIdFor('action1'), screenX: 50, screenY: 50 };
    render(<ConnectionPopover pending={pending} onDone={() => {}} />);

    expect(screen.getByText('New trigger — tag sets')).toBeInTheDocument();
    expect(screen.getByText(/Triggers Role's action between/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Actor (optional)')).toBeNull();
  });

  it('confirming a trigger passes actorId undefined — the trigger points at the action, not at a separately chosen actor', async () => {
    const user = userEvent.setup();
    const pending: PendingConnection = { sourceId: 'a', targetId: anchorIdFor('action1'), screenX: 50, screenY: 50 };
    render(<ConnectionPopover pending={pending} onDone={() => {}} />);

    await user.click(screen.getByLabelText(useDiagramStore.getState().diagram.edgeSets[0].name));
    await user.click(screen.getByRole('button', { name: 'Add edge' }));

    const trigger = useDiagramStore.getState().diagram.edges.find((e) => e.id !== 'action1')!;
    expect(trigger.targetId).toBe(anchorIdFor('action1'));
    expect(trigger.actorId).toBeUndefined();
  });
});
