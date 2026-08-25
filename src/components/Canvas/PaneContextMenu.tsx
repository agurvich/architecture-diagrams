import { useEffect, useRef } from 'react';

const MENU_WIDTH = 160;
const MENU_HEIGHT = 40;
const VIEWPORT_MARGIN = 10;

interface Props {
  screenX: number;
  screenY: number;
  onAddNode: () => void;
  onClose: () => void;
}

// Right-clicking empty canvas (not a node/edge) opens this — React Flow's
// own onPaneContextMenu already tells us it wasn't a node/edge click, so no
// nested-ContextMenu bubbling concerns like GraphNode/GraphEdge would have.
// Styled to match the shadcn ContextMenuContent/ContextMenuItem look for
// visual consistency with those menus.
export function PaneContextMenu({ screenX, screenY, onAddNode, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const left = Math.min(screenX, Math.max(window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN, VIEWPORT_MARGIN));
  const top = Math.min(screenY, Math.max(window.innerHeight - MENU_HEIGHT - VIEWPORT_MARGIN, VIEWPORT_MARGIN));

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-36 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left, top }}
    >
      <button
        className="flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground"
        onClick={onAddNode}
      >
        Add node
      </button>
    </div>
  );
}
