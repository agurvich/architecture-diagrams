import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FrameSequencerPanel } from './FrameSequencerPanel';
import { useDiagramStore } from '../../store/diagramStore';

function setNoFrames() {
  useDiagramStore.getState().loadSeed();
  useDiagramStore.setState((state) => ({
    diagram: { ...state.diagram, frames: [] },
    currentFrameId: null,
    editingHighlightsForFrameId: null,
  }));
}

describe('FrameSequencerPanel', () => {
  beforeEach(() => {
    setNoFrames();
  });

  it('Capture current state with a typed name saves a frame with that name and clears the input', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.type(screen.getByPlaceholderText('New frame name'), 'Intro');
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));

    expect(useDiagramStore.getState().diagram.frames.map((f) => f.name)).toEqual(['Intro']);
    expect(screen.getByPlaceholderText('New frame name')).toHaveValue('');
  });

  it('Capture with a blank name falls back to "Frame N"', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));
    expect(useDiagramStore.getState().diagram.frames.map((f) => f.name)).toEqual(['Frame 1']);
  });

  it('pressing Enter in the name field also captures', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.type(screen.getByPlaceholderText('New frame name'), 'Via Enter{Enter}');
    expect(useDiagramStore.getState().diagram.frames.map((f) => f.name)).toEqual(['Via Enter']);
  });

  it('the ▲/▼ reorder buttons are disabled at the respective ends of the list', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));

    const ups = screen.getAllByRole('button', { name: '▲' });
    const downs = screen.getAllByRole('button', { name: '▼' });
    expect(ups[0]).toBeDisabled();
    expect(downs.at(-1)).toBeDisabled();
    expect(ups.at(-1)).not.toBeDisabled();
    expect(downs[0]).not.toBeDisabled();
  });

  it('clicking ▼ on the first frame reorders it after the second', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.type(screen.getByPlaceholderText('New frame name'), 'First{Enter}');
    await user.type(screen.getByPlaceholderText('New frame name'), 'Second{Enter}');

    await user.click(screen.getAllByRole('button', { name: '▼' })[0]);

    expect(useDiagramStore.getState().diagram.frames.map((f) => f.name)).toEqual(['Second', 'First']);
  });

  it('renaming a frame via its inline input updates the store', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));
    const nameInput = screen.getByDisplayValue('Frame 1');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed');
    expect(useDiagramStore.getState().diagram.frames[0].name).toBe('Renamed');
  });

  it('editing the notes textarea updates the frame\'s notes', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));
    await user.type(screen.getByPlaceholderText('Narration notes…'), 'Some notes');
    expect(useDiagramStore.getState().diagram.frames[0].notes).toBe('Some notes');
  });

  it('"Go to this frame" jumps playback to it', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));
    const frameId = useDiagramStore.getState().diagram.frames[0].id;
    useDiagramStore.setState({ currentFrameId: null });

    await user.click(screen.getByRole('button', { name: '▶' }));
    expect(useDiagramStore.getState().currentFrameId).toBe(frameId);
  });

  it('"Delete frame" removes just that frame', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.type(screen.getByPlaceholderText('New frame name'), 'Keep{Enter}');
    await user.type(screen.getByPlaceholderText('New frame name'), 'Remove{Enter}');

    const deleteButtons = screen.getAllByRole('button', { name: '✕' });
    await user.click(deleteButtons[1]);

    expect(useDiagramStore.getState().diagram.frames.map((f) => f.name)).toEqual(['Keep']);
  });

  it('toggles between "Edit highlights" and "Done editing highlights"', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));
    const frameId = useDiagramStore.getState().diagram.frames[0].id;

    await user.click(screen.getByRole('button', { name: 'Edit highlights (0)' }));
    expect(useDiagramStore.getState().editingHighlightsForFrameId).toBe(frameId);
    expect(screen.getByRole('button', { name: 'Done editing highlights' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done editing highlights' }));
    expect(useDiagramStore.getState().editingHighlightsForFrameId).toBeNull();
  });

  it('shows a Clear button only once the frame has highlights, and it clears them', async () => {
    const user = userEvent.setup();
    render(<FrameSequencerPanel />);
    await user.click(screen.getByRole('button', { name: 'Capture current state' }));
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    const frameId = useDiagramStore.getState().diagram.frames[0].id;
    useDiagramStore.getState().toggleFrameHighlightIds(frameId, ['node-a']);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(useDiagramStore.getState().diagram.frames[0].highlighted).toBeUndefined();
  });
});
