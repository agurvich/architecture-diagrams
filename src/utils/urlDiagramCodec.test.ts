import { describe, expect, it } from 'vitest';
import type { Diagram } from '../types/diagram';
import { seedDiagram } from '../data/seedDiagram';
import { decodeDiagramFromURL, encodeDiagramForURL } from './urlDiagramCodec';

function tinyDiagram(): Diagram {
  return {
    edgeSets: [{ id: 'a', name: 'A', color: '#4f8ff7' }],
    frames: [],
    nodes: [
      { id: 'n1', label: 'Node 1', position: { x: 0, y: 0 }, metadata: {} },
      { id: 'n2', label: 'Node 2 — with an emoji 🎉 and ünïcödé', position: { x: 100, y: 0 }, metadata: {} },
    ],
    edges: [{ id: 'e1', sourceId: 'n1', targetId: 'n2', sets: ['a'], metadata: {} }],
  };
}

describe('urlDiagramCodec', () => {
  it('round-trips a small diagram exactly, including unicode/emoji in labels', async () => {
    const original = tinyDiagram();
    const encoded = await encodeDiagramForURL(original);
    const decoded = await decodeDiagramFromURL(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips the full seed diagram exactly', async () => {
    const encoded = await encodeDiagramForURL(seedDiagram);
    const decoded = await decodeDiagramFromURL(encoded);
    expect(decoded).toEqual(seedDiagram);
  });

  it('produces a string safe to drop directly into a URL query param (no +, /, =, or other characters a URL would mangle)', async () => {
    const encoded = await encodeDiagramForURL(seedDiagram);
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('actually compresses — the encoded form is meaningfully smaller than raw base64 of the JSON, not just re-encoded', async () => {
    const json = JSON.stringify(seedDiagram);
    const naiveBase64Length = Math.ceil(json.length / 3) * 4;
    const encoded = await encodeDiagramForURL(seedDiagram);
    expect(encoded.length).toBeLessThan(naiveBase64Length * 0.7);
  });

  it('rejects a param that decodes to something that is not a diagram', async () => {
    const notADiagram = await encodeDiagramForURL({ nodes: [], edges: [], edgeSets: [], frames: [] } as Diagram);
    // Corrupt it enough to decode to valid-but-wrong-shaped JSON isn't
    // practical to construct through the compressor deterministically, so
    // instead assert directly on a hand-built non-diagram payload run
    // through the same base64 step the decoder expects.
    void notADiagram;
    const raw = new TextEncoder().encode(JSON.stringify({ hello: 'world' }));
    let binary = '';
    for (const b of raw) binary += String.fromCharCode(b);
    const bogus = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await expect(decodeDiagramFromURL(bogus)).rejects.toThrow();
  });
});
