import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagramStore } from '../../store/diagramStore';
import { FramePlayerControls } from './FramePlayerControls';

beforeEach(() => {
  useDiagramStore.getState().loadSeed();
});

describe('FramePlayerControls', () => {
  it('shows a placeholder and disables Prev when no frame is active', () => {
    render(<FramePlayerControls />);
    expect(screen.getByText('Not viewing a frame')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prev/ })).toBeDisabled();
  });

  it('steps forward through frames and disables Next on the last one', async () => {
    const user = userEvent.setup();
    render(<FramePlayerControls />);
    const frameCount = useDiagramStore.getState().diagram.frames.length;
    expect(frameCount).toBeGreaterThan(1);

    const next = screen.getByRole('button', { name: /Next/ });
    for (let i = 0; i < frameCount; i++) {
      await user.click(next);
    }

    expect(useDiagramStore.getState().currentFrameId).toBe(
      useDiagramStore.getState().diagram.frames[frameCount - 1].id,
    );
    expect(next).toBeDisabled();
  });

  it('steps backward with Prev and updates the counter', async () => {
    const user = userEvent.setup();
    render(<FramePlayerControls />);
    const total = useDiagramStore.getState().diagram.frames.length;

    await user.click(screen.getByRole('button', { name: /Next/ }));
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText(`2 / ${total}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Prev/ }));
    expect(screen.getByText(`1 / ${total}`)).toBeInTheDocument();
  });
});
