interface PanelHeaderProps {
  title: string;
  onClose: () => void;
}

/** The title-row + ✕ close button every properties panel opens with. */
export function PanelHeader({ title, onClose }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <button className="cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 hover:bg-accent" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
