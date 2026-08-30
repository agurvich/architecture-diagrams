import type { Diagram } from '../types/diagram';

/**
 * Packs a Diagram into a URL-safe string compact enough to live in a query
 * param: JSON -> gzip (native CompressionStream, no dependency) -> base64,
 * made URL-safe (`+`/`/` -> `-`/`_`, padding stripped, restored on decode).
 * Falls back to uncompressed base64 of the raw JSON if CompressionStream
 * isn't available (older browsers) — bigger, but still correct.
 */
export async function encodeDiagramForURL(diagram: Diagram): Promise<string> {
  const json = JSON.stringify(diagram);
  const bytes = typeof CompressionStream !== 'undefined' ? await gzip(json) : new TextEncoder().encode(json);
  return toUrlSafeBase64(bytes);
}

export async function decodeDiagramFromURL(param: string): Promise<Diagram> {
  const bytes = fromUrlSafeBase64(param);
  const json =
    typeof DecompressionStream !== 'undefined'
      ? await gunzip(bytes).catch(() => new TextDecoder().decode(bytes)) // param predates compression, or came from a fallback-only sender
      : new TextDecoder().decode(bytes);
  const parsed: unknown = JSON.parse(json);
  if (!isDiagramShape(parsed)) throw new Error('Decoded data does not match the diagram schema.');
  return parsed;
}

async function gzip(text: string): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  // Errors on the writable side of a broken pipe surface again on the
  // readable side below (what callers actually await) — swallow this copy
  // so malformed input to gunzip() doesn't also crash the process as an
  // unhandled rejection.
  const writeDone = writer.write(new TextEncoder().encode(text)).then(() => writer.close());
  writeDone.catch(() => {});
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  // @types/node's ambient Uint8Array<ArrayBufferLike> and lib.dom's
  // BufferSource (which wants specifically Uint8Array<ArrayBuffer>)
  // disagree here regardless of how `bytes` was constructed — a real
  // ArrayBuffer backs it either way at runtime.
  const writeDone = writer.write(bytes as BufferSource).then(() => writer.close());
  writeDone.catch(() => {});
  return new Response(ds.readable).text();
}

function toUrlSafeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromUrlSafeBase64(param: string): Uint8Array {
  const padded = param.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(param.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function isDiagramShape(value: unknown): value is Diagram {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.nodes) && Array.isArray(v.edges) && Array.isArray(v.edgeSets) && Array.isArray(v.frames);
}
