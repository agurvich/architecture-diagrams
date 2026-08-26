import { FALLBACK_ICON_KEY, ICON_MATCH_RULES } from './infraMatchRules';

/**
 * Automatic icon matching for node labels/metadata — no AI/LLM call, a
 * hand-authored ordered keyword table (see infraMatchRules.ts), matched the
 * same way LoopIconMatcher.swift did (see git history for that source):
 * (1) rule order — specific terms are checked before broad catch-alls, so
 * the first matching rule in ICON_MATCH_RULES wins; (2) field cascade — see
 * guessIconKey, which tries the node's own label before falling back to its
 * metadata values.
 */

function wordMatches(pattern: string, word: string): boolean {
  return pattern === word || pattern + 's' === word || word + 's' === pattern;
}

/**
 * A single-word alternative matches as a whole word (with simple
 * singular/plural handling in both directions), so a short keyword like
 * "car" doesn't false-positive match substrings inside unrelated words
 * like "carpet". A multi-word alternative (contains a space, e.g. "load
 * balancer") matches as a plain substring, since a real phrase isn't at
 * meaningful risk of appearing inside an unrelated word.
 */
function patternMatches(pattern: string, text: string): boolean {
  const lowered = text.toLowerCase();
  const words = new Set(lowered.split(/[^a-z]+/).filter(Boolean));
  for (const alternative of pattern.split('|')) {
    if (alternative.includes(' ')) {
      if (lowered.includes(alternative)) return true;
    } else if ([...words].some((w) => wordMatches(alternative, w))) {
      return true;
    }
  }
  return false;
}

function matchOne(text: string): string | null {
  for (const rule of ICON_MATCH_RULES) {
    if (patternMatches(rule.pattern, text)) return rule.iconKey;
  }
  return null;
}

/**
 * Tries `name` first; if nothing matches, tries each `extraFields` entry in
 * order (e.g. a node's metadata values); only then falls back to the
 * generic icon.
 */
export function guessIconKey(name: string, extraFields: string[] = []): string {
  const direct = matchOne(name);
  if (direct) return direct;
  for (const field of extraFields) {
    const match = matchOne(field);
    if (match) return match;
  }
  return FALLBACK_ICON_KEY;
}

/**
 * The three-state icon rule shared by every place that renders a node's
 * icon: a pinned key always wins; a pinned `null` means no icon at all;
 * `undefined` (the default) guesses live from the label and metadata
 * values via guessIconKey, so renaming a node updates its icon
 * automatically unless the user has pinned one explicitly.
 */
export function resolveNodeIcon(
  icon: string | null | undefined,
  label: string,
  metadata: Record<string, string>,
): string | null {
  if (icon === null) return null;
  return icon ?? guessIconKey(label, Object.values(metadata));
}
