import type { Diagram } from '../types/diagram';

const STORAGE_KEY = 'architecture-diagrams:working-diagram';
const DEBOUNCE_MS = 300;

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function loadFromLocalStorage(): Diagram | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
    } catch {
      // localStorage unavailable or quota exceeded — silently skip auto-save
    }
  }, DEBOUNCE_MS);
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
