import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { EdgeSet } from '../../types/diagram';

interface EdgeSetRowProps {
  set: EdgeSet;
  checked: boolean;
  onToggle: () => void;
  /** Unique id for this row's checkbox/label pair — callers vary the prefix so ids never collide across an instance with multiple lists on screen at once. */
  inputId: string;
  /** Tighter spacing/swatch/text for space-constrained contexts like ConnectionPopover. */
  compact?: boolean;
}

/** A single lens/edge-set row: checkbox + color swatch + name — the same control repeated across EdgeSetTogglePanel, EdgePropertiesPanel, and ConnectionPopover. */
export function EdgeSetRow({ set, checked, onToggle, inputId, compact }: EdgeSetRowProps) {
  return (
    <div className={cn('flex items-center', compact ? 'gap-1.5 text-xs' : 'gap-2')}>
      <Checkbox id={inputId} checked={checked} onCheckedChange={onToggle} />
      <span
        className={cn('inline-block rounded-sm', compact ? 'h-[9px] w-[9px]' : 'h-2.5 w-2.5')}
        style={{ background: set.color }}
      />
      <Label htmlFor={inputId} className="cursor-pointer font-normal">
        {set.name}
      </Label>
    </div>
  );
}
