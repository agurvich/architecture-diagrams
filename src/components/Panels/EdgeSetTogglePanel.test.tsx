import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagramStore } from '../../store/diagramStore';
import { EdgeSetTogglePanel } from './EdgeSetTogglePanel';

beforeEach(() => {
  useDiagramStore.getState().loadSeed();
});

describe('EdgeSetTogglePanel', () => {
  it('renders a checkbox per edge set, all checked by default', () => {
    render(<EdgeSetTogglePanel />);
    const { diagram } = useDiagramStore.getState();
    for (const set of diagram.edgeSets) {
      expect(screen.getByRole('checkbox', { name: new RegExp(set.name) })).toBeChecked();
    }
  });

  it('unchecking a lens removes it from activeSets, and rechecking restores it', async () => {
    const user = userEvent.setup();
    render(<EdgeSetTogglePanel />);

    const structureCheckbox = screen.getByRole('checkbox', { name: /Structure/i });
    expect(useDiagramStore.getState().activeSets.has('structure')).toBe(true);

    await user.click(structureCheckbox);
    expect(useDiagramStore.getState().activeSets.has('structure')).toBe(false);
    expect(structureCheckbox).not.toBeChecked();

    await user.click(structureCheckbox);
    expect(useDiagramStore.getState().activeSets.has('structure')).toBe(true);
  });

  it('adding a new edge set appends it and activates it', async () => {
    const user = userEvent.setup();
    render(<EdgeSetTogglePanel />);

    const input = screen.getByPlaceholderText('New edge set name');
    await user.type(input, 'Security');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByRole('checkbox', { name: /Security/i })).toBeChecked();
    const newSet = useDiagramStore.getState().diagram.edgeSets.find((s) => s.name === 'Security');
    expect(newSet).toBeDefined();
    expect(useDiagramStore.getState().activeSets.has(newSet!.id)).toBe(true);
  });
});
