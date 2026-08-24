import { useState } from 'react';
import { useDiagramStore } from '../../store/diagramStore';

const PALETTE = ['#4f8ff7', '#f7924f', '#38b06a', '#c05fd6', '#e0475a', '#2fb6c4'];

export function EdgeSetTogglePanel() {
  const edgeSets = useDiagramStore((s) => s.diagram.edgeSets);
  const activeSets = useDiagramStore((s) => s.activeSets);
  const toggleEdgeSet = useDiagramStore((s) => s.toggleEdgeSet);
  const addEdgeSet = useDiagramStore((s) => s.addEdgeSet);
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const color = PALETTE[edgeSets.length % PALETTE.length];
    addEdgeSet(name, color);
    setNewName('');
  };

  return (
    <div className="panel">
      <h3 className="panel__title">Lenses (edge sets)</h3>
      <ul className="edge-set-list">
        {edgeSets.map((s) => (
          <li key={s.id} className="edge-set-list__item">
            <label>
              <input type="checkbox" checked={activeSets.has(s.id)} onChange={() => toggleEdgeSet(s.id)} />
              <span className="edge-set-list__swatch" style={{ background: s.color }} />
              {s.name}
            </label>
          </li>
        ))}
      </ul>
      <div className="panel__add-row">
        <input
          type="text"
          placeholder="New edge set name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd}>Add</button>
      </div>
    </div>
  );
}
