import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import { useDiagramStore } from '../../../store/diagramStore';
import type { DiagramNode } from '../../../types/diagram';

const SIMPLE_NODES: DiagramNode[] = [
  { id: 'parent', label: 'Parent', position: { x: 0, y: 0 }, metadata: {} },
  { id: 'target', label: 'Target', position: { x: 0, y: 0 }, metadata: { env: 'prod' } },
  { id: 'child', label: 'Child', parentId: 'target', position: { x: 0, y: 0 }, metadata: {} },
  { id: 'other', label: 'Other', position: { x: 0, y: 0 }, metadata: { env: 'staging' } },
];

function setSimpleDiagram() {
  useDiagramStore.getState().loadSeed();
  useDiagramStore.setState((state) => ({
    diagram: {
      ...state.diagram,
      nodes: SIMPLE_NODES,
      edges: [],
      colorPalette: ['#ff0000', '#00ff00'],
    },
    selected: { kind: 'node', id: 'target' },
  }));
}

describe('NodePropertiesPanel', () => {
  beforeEach(() => {
    setSimpleDiagram();
  });

  it('returns null (renders nothing) for a node id that no longer exists', () => {
    const { container } = render(<NodePropertiesPanel nodeId="does-not-exist" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('editing the label field updates the node', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    const label = screen.getByLabelText('Label');
    await user.clear(label);
    await user.type(label, 'Renamed');
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.label).toBe('Renamed');
  });

  it('toggling the Actor switch flips isActor', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    await user.click(screen.getByRole('switch', { name: 'Actor' }));
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.isActor).toBe(true);
  });

  it('the parent dropdown excludes the node itself and any node that would create a cycle', () => {
    render(<NodePropertiesPanel nodeId="target" />);
    const select = screen.getByLabelText('Parent (hierarchy)') as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    // 'target' itself and 'child' (target's own descendant — picking it as
    // parent would create a cycle) must both be excluded; 'parent' and
    // 'other' are fine.
    expect(optionLabels).not.toContain('Target');
    expect(optionLabels).not.toContain('Child');
    expect(optionLabels).toContain('Parent');
    expect(optionLabels).toContain('Other');
  });

  it('changing the parent dropdown reparents the node', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    await user.selectOptions(screen.getByLabelText('Parent (hierarchy)'), 'Parent');
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.parentId).toBe('parent');
  });

  it('hides the Auto layout section for a node with no children', () => {
    render(<NodePropertiesPanel nodeId="parent" />);
    expect(screen.queryByText('Auto layout')).toBeNull();
  });

  it('shows Auto layout mode buttons for a node with children, and clicking one applies it with the default gap', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    expect(screen.getByText('Auto layout')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'vertical' }));

    const node = useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!;
    expect(node.autoLayout).toEqual({ direction: 'vertical', gap: 40 });
  });

  it('shows a Gap field once auto layout is active, and editing it updates the stored gap', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().updateNode('target', { autoLayout: { direction: 'vertical', gap: 40 } });
    render(<NodePropertiesPanel nodeId="target" />);

    const gapInput = screen.getByLabelText('Gap');
    await user.clear(gapInput);
    await user.type(gapInput, '15');

    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.autoLayout?.gap).toBe(15);
  });

  it('switching back to Manual clears autoLayout entirely', async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().updateNode('target', { autoLayout: { direction: 'vertical', gap: 40 } });
    render(<NodePropertiesPanel nodeId="target" />);

    await user.click(screen.getByRole('button', { name: 'Manual' }));

    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.autoLayout).toBeUndefined();
  });

  it('clicking a palette swatch sets the node color', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    await user.click(screen.getByTitle('#ff0000'));
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.color).toBe('#ff0000');
  });

  it('picking a custom color both sets it on the node and appends it to the shared palette', () => {
    useDiagramStore.getState().updateNode('target', { color: undefined });
    render(<NodePropertiesPanel nodeId="target" />);
    const colorInput = screen.getByTitle('Custom color — adds to the palette above');

    // jsdom's <input type="color"> doesn't support userEvent.type — fire
    // the change event the way a real color-picker selection would
    // (fireEvent.change goes through React's native-value-setter tracking
    // correctly, unlike setting .value and dispatching a plain Event).
    fireEvent.change(colorInput, { target: { value: '#123456' } });

    const state = useDiagramStore.getState();
    expect(state.diagram.nodes.find((n) => n.id === 'target')!.color).toBe('#123456');
    expect(state.diagram.colorPalette).toContain('#123456');
  });

  it('Clear removes the node\'s color, and only appears once a color is set', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    useDiagramStore.getState().updateNode('target', { color: '#ff0000' });
    render(<NodePropertiesPanel nodeId="target" />);
    await user.click(screen.getAllByRole('button', { name: 'Clear' })[0]);
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.color).toBeUndefined();
  });

  it('clicking "None" pins the icon to null, and "Auto" clears a pin back to guessing', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);

    await user.click(screen.getByRole('button', { name: /None/ }));
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.icon).toBeNull();

    await user.click(screen.getByRole('button', { name: /Auto/ }));
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.icon).toBeUndefined();
  });

  it('typing in the icon search filters the icon grid', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    const before = screen.getAllByRole('button').length;
    await user.type(screen.getByPlaceholderText(/Search \d+ icons/), 'zzzznomatch');
    expect(screen.getByText(/No icons match/)).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeLessThan(before);
  });

  it('editing an existing metadata value updates it in place, keyed by the same key', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    const valueInputs = screen.getAllByDisplayValue('prod');
    await user.clear(valueInputs[0]);
    await user.type(valueInputs[0], 'dev');
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.metadata).toEqual({ env: 'dev' });
  });

  it('deleting an existing metadata entry removes just that key', async () => {
    useDiagramStore.getState().updateNode('target', { metadata: { env: 'prod', tier: 'web' } });
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    const envRow = screen.getByDisplayValue('env').closest('div')!;
    await user.click(envRow.querySelector('button')!);
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.metadata).toEqual({ tier: 'web' });
  });

  it('adding a new metadata entry requires a non-blank key, and clears the inputs on success', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    const addButton = screen.getByRole('button', { name: '+' });

    // Blank key: no-op, nothing added.
    await user.click(addButton);
    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.metadata).toEqual({ env: 'prod' });

    await user.type(screen.getByPlaceholderText('key'), 'tier');
    await user.type(screen.getByPlaceholderText('value'), 'web');
    await user.click(addButton);

    expect(useDiagramStore.getState().diagram.nodes.find((n) => n.id === 'target')!.metadata).toEqual({
      env: 'prod',
      tier: 'web',
    });
    expect(screen.getByPlaceholderText('key')).toHaveValue('');
    expect(screen.getByPlaceholderText('value')).toHaveValue('');
  });

  it('Delete node removes it from the diagram and clears selection', async () => {
    const user = userEvent.setup();
    render(<NodePropertiesPanel nodeId="target" />);
    await user.click(screen.getByRole('button', { name: 'Delete node' }));
    expect(useDiagramStore.getState().diagram.nodes.some((n) => n.id === 'target')).toBe(false);
    expect(useDiagramStore.getState().selected).toBeNull();
  });
});
