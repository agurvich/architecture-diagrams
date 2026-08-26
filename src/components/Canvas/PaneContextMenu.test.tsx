import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaneContextMenu } from './PaneContextMenu';

describe('PaneContextMenu', () => {
  it('clicking "Add node" calls onAddNode', async () => {
    const user = userEvent.setup();
    const onAddNode = vi.fn();
    render(<PaneContextMenu screenX={50} screenY={50} onAddNode={onAddNode} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    expect(onAddNode).toHaveBeenCalledTimes(1);
  });

  it('clicking outside the menu calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <PaneContextMenu screenX={50} screenY={50} onAddNode={() => {}} onClose={onClose} />
      </div>,
    );
    await user.click(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the menu does not call onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PaneContextMenu screenX={50} screenY={50} onAddNode={() => {}} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Add node' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('pressing Escape calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PaneContextMenu screenX={50} screenY={50} onAddNode={() => {}} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unmounting removes its document-level listeners (no stray onClose calls after unmount)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = render(<PaneContextMenu screenX={50} screenY={50} onAddNode={() => {}} onClose={onClose} />);
    unmount();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});
