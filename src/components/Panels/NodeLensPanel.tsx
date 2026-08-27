import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDiagramStore } from '../../store/diagramStore';
import { getMetadataKeys } from '../../utils/metadataKeys';

export function NodeLensPanel() {
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const nodeLensKey = useDiagramStore((s) => s.nodeLensKey);
  const setNodeLensKey = useDiagramStore((s) => s.setNodeLensKey);

  const metadataKeys = useMemo(() => getMetadataKeys(nodes), [nodes]);

  return (
    <Card className="gap-2 py-2.5">
      <CardHeader className="px-2.5">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Group by (node lens)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-2.5">
        <select
          className="h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
          title="Group nodes into regions by a metadata key"
          value={nodeLensKey ?? ''}
          onChange={(e) => setNodeLensKey(e.target.value || null)}
        >
          <option value="">(None — normal view)</option>
          {metadataKeys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        {nodeLensKey && (
          <p className="m-0 text-xs text-muted-foreground">
            Nodes tagged with their own <code>{nodeLensKey}</code> value are pulled into their own region; everything
            else rides along with its nearest tagged ancestor.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
