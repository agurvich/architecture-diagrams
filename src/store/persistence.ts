import type { Diagram } from '../types/diagram';

const STORAGE_KEY = 'architecture-diagrams:working-diagram';
// A separate snapshot of whatever JSON was last successfully imported, so
// "Reset to imported" can return to it even after further edits — distinct
// from STORAGE_KEY, which always reflects the live working diagram (and
// starts drifting from the import the moment you touch anything).
const LAST_IMPORTED_STORAGE_KEY = 'architecture-diagrams:last-imported-diagram';
const DEBOUNCE_MS = 300;

let saveTimer: ReturnType<typeof setTimeout> | undefined;

// `window.localStorage`, not the bare `localStorage` global: in a real
// browser they're identical, but Node 22+'s own experimental global
// `localStorage` (unrelated to jsdom's, and non-functional without a
// `--localstorage-file` flag neither this app nor its test runner pass)
// otherwise shadows jsdom's in every test that runs under Node rather than
// a browser, silently turning every read/write here into a no-op.
export function loadFromLocalStorage(): Diagram | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isDiagramShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveToLocalStorageDebounced(diagram: Diagram): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
    } catch {
      // localStorage unavailable or quota exceeded — silently skip auto-save
    }
  }, DEBOUNCE_MS);
}

export function loadLastImportedDiagram(): Diagram | null {
  try {
    const raw = window.localStorage.getItem(LAST_IMPORTED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isDiagramShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Not debounced, unlike the working diagram — this fires once per
// successful import (a deliberate user action), not on every keystroke of
// ongoing editing.
export function saveLastImportedDiagram(diagram: Diagram): void {
  try {
    window.localStorage.setItem(LAST_IMPORTED_STORAGE_KEY, JSON.stringify(diagram));
  } catch {
    // localStorage unavailable or quota exceeded — the diagram itself
    // already imported successfully either way, so just skip the snapshot
  }
}

export function exportDiagramJSON(diagram: Diagram): string {
  return JSON.stringify(diagram, null, 2);
}

export class InvalidDiagramError extends Error {}

export function parseImportedDiagramJSON(json: string): Diagram {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidDiagramError('File is not valid JSON.');
  }
  if (!isDiagramShape(parsed)) {
    throw new InvalidDiagramError('File does not match the diagram schema (expected nodes, edges, edgeSets, frames arrays).');
  }
  return parsed;
}

function isDiagramShape(value: unknown): value is Diagram {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.nodes) && Array.isArray(v.edges) && Array.isArray(v.edgeSets) && Array.isArray(v.frames);
}
