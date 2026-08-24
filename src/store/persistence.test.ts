import { describe, expect, it } from 'vitest';
import type { Diagram } from '../types/diagram';
import { InvalidDiagramError, exportDiagramJSON, parseImportedDiagramJSON } from './persistence';

const validDiagram: Diagram = {
  nodes: [{ id: 'n1', label: 'N1', position: { x: 0, y: 0 }, metadata: {} }],
  edges: [],
  edgeSets: [{ id: 's1', name: 'S1', color: '#fff' }],
  frames: [],
};

describe('persistence', () => {
  it('round-trips a diagram through export and import', () => {
    const json = exportDiagramJSON(validDiagram);
    const parsed = parseImportedDiagramJSON(json);
    expect(parsed).toEqual(validDiagram);
  });

  it('rejects malformed JSON with InvalidDiagramError instead of throwing a raw parse error', () => {
    expect(() => parseImportedDiagramJSON('{not valid json')).toThrow(InvalidDiagramError);
  });

  it('rejects well-formed JSON that does not match the diagram shape', () => {
    expect(() => parseImportedDiagramJSON(JSON.stringify({ foo: 'bar' }))).toThrow(InvalidDiagramError);
    expect(() => parseImportedDiagramJSON(JSON.stringify({ nodes: [] }))).toThrow(InvalidDiagramError);
    expect(() => parseImportedDiagramJSON('null')).toThrow(InvalidDiagramError);
    expect(() => parseImportedDiagramJSON('42')).toThrow(InvalidDiagramError);
  });
});
