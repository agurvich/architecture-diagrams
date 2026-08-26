import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';
import { useDiagramStore } from '../../store/diagramStore';
import { EXAMPLES } from '../../data/examples';

function renderToolbar() {
  return render(
    <ReactFlowProvider>
      <Toolbar />
    </ReactFlowProvider>,
  );
}

describe('Toolbar', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
  });

  it('shows current node/edge/lens counts', () => {
    useDiagramStore.setState((state) => ({
      diagram: {
        ...state.diagram,
        nodes: [{ id: 'a', label: 'A', position: { x: 0, y: 0 }, metadata: {} }],
        edges: [],
      },
    }));
    renderToolbar();
    expect(screen.getByText(/1 nodes/)).toBeInTheDocument();
    expect(screen.getByText(/0 edges/)).toBeInTheDocument();
  });

  it('+ Add node adds a node at some position and selects it', async () => {
    const user = userEvent.setup();
    const before = useDiagramStore.getState().diagram.nodes.length;
    renderToolbar();

    await user.click(screen.getByRole('button', { name: '+ Add node' }));

    const state = useDiagramStore.getState();
    expect(state.diagram.nodes.length).toBe(before + 1);
    const added = state.diagram.nodes.at(-1)!;
    expect(added.label).toBe('New node');
    expect(state.selected).toEqual({ kind: 'node', id: added.id });
  });

  it('Run graph layout runs the root-level (containerId null) layout', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(useDiagramStore.getState(), 'runGraphLayout').mockResolvedValue();
    renderToolbar();

    await user.click(screen.getByRole('button', { name: 'Run graph layout' }));

    expect(spy).toHaveBeenCalledWith(null);
    spy.mockRestore();
  });

  it('Reset to demo reloads the seed diagram', async () => {
    const user = userEvent.setup();
    useDiagramStore.setState((state) => ({
      diagram: { ...state.diagram, nodes: [] },
    }));
    renderToolbar();

    await user.click(screen.getByRole('button', { name: 'Reset to demo' }));

    expect(useDiagramStore.getState().diagram.nodes.length).toBeGreaterThan(0);
  });

  it('picking an example from the dropdown loads that example\'s diagram', async () => {
    const user = userEvent.setup();
    renderToolbar();
    const example = EXAMPLES[0];

    await user.selectOptions(screen.getByTitle('Load one of the built-in example diagrams'), example.id);

    expect(useDiagramStore.getState().diagram.nodes.map((n) => n.id).sort()).toEqual(
      example.diagram.nodes.map((n) => n.id).sort(),
    );
  });

  it('hides "Reset to imported" until something has actually been imported, then shows it reactively', async () => {
    renderToolbar();
    expect(screen.queryByRole('button', { name: 'Reset to imported' })).toBeNull();

    useDiagramStore.getState().importJSON(
      JSON.stringify({
        nodes: [{ id: 'x', label: 'X', position: { x: 0, y: 0 }, metadata: {} }],
        edges: [],
        edgeSets: [],
        frames: [],
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset to imported' })).toBeInTheDocument();
    });
  });

  it('shows the import error banner, and clicking it dismisses the error', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().importJSON('not valid json{');
    renderToolbar();

    expect(useDiagramStore.getState().importError).not.toBeNull();
    const banner = screen.getByText(/click to dismiss/);
    expect(banner).toBeInTheDocument();

    await user.click(banner);
    expect(useDiagramStore.getState().importError).toBeNull();
  });

  it('selecting a file via the hidden file input imports it', async () => {
    const user = userEvent.setup();
    renderToolbar();
    const file = new File(
      [JSON.stringify({ nodes: [{ id: 'y', label: 'Y', position: { x: 0, y: 0 }, metadata: {} }], edges: [], edgeSets: [], frames: [] })],
      'diagram.json',
      { type: 'application/json' },
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(useDiagramStore.getState().diagram.nodes.map((n) => n.id)).toEqual(['y']);
  });
});

describe('Toolbar — Export JSON', () => {
  beforeEach(() => {
    useDiagramStore.getState().loadSeed();
    // jsdom doesn't implement the Blob URL APIs at all.
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a Blob from the current diagram\'s exported JSON and revokes the object URL afterward', async () => {
    const user = userEvent.setup();
    renderToolbar();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await user.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    clickSpy.mockRestore();
  });
});
