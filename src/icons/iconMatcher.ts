import { FALLBACK_ICON_KEY, ICON_MATCH_RULES } from './matcherRules';
import { INFRA_ICON_MATCH_RULES } from './infraMatchRules';

// Infra rules first: this app's nodes are servers and databases, not
// laundry and gym sessions, so architecture-domain terms should win before
// falling through to the ported personal-habit vocabulary.
const ALL_RULES = [...INFRA_ICON_MATCH_RULES, ...ICON_MATCH_RULES];

/**
 * Ports LoopIconMatcher.swift's matching algorithm (see
 * NOTE-FOR-CLAUDE-AGENT-ICON-LABELING-BRIEF.md): a hand-authored keyword
 * dictionary, no AI/LLM call. "Hierarchical" the same way the source does:
 * (1) rule order — specific terms are checked before broad catch-alls, so
 * the first matching rule in ALL_RULES wins (infra-domain rules first, see
 * infraMatchRules.ts, then the ported table); (2) field cascade — see
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
 * like "carpet". A multi-word alternative (contains a space, e.g. "physical
 * therapy") matches as a plain substring, since a real phrase isn't at
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
  for (const rule of ALL_RULES) {
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
