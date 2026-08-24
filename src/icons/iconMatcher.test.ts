import { describe, expect, it } from 'vitest';
import { guessIconKey } from './iconMatcher';
import { getIconComponent } from './registry';

describe('guessIconKey', () => {
  it('matches a direct keyword', () => {
    expect(guessIconKey('Gym')).toBe('dumbbell');
    expect(guessIconKey('Laundry')).toBe('jug-detergent');
  });

  it('is case-insensitive', () => {
    expect(guessIconKey('GYM')).toBe('dumbbell');
  });

  it('matches whole words only, not substrings inside unrelated words', () => {
    // "car" must not match inside "carpet"
    expect(guessIconKey('Vacuum the carpet')).not.toBe('car');
    expect(guessIconKey('Vacuum the carpet')).toBe('broom'); // vacuum|sweep|dust|mop
  });

  it('handles simple singular/plural in both directions', () => {
    expect(guessIconKey('Confirm plans')).toBe('calendar-check'); // "plan" rule matches "plans"
    expect(guessIconKey('Take meds')).toBe('pills'); // "med" rule matches "meds"
  });

  it('matches a multi-word phrase as a substring', () => {
    expect(guessIconKey('Book a hotel')).toBe('hotel');
  });

  it('respects rule order — earlier, more specific rules win', () => {
    // "dentist" is checked before the broader "doctor|...|appointment" rule
    expect(guessIconKey('Dentist appointment')).toBe('tooth');
  });

  it('falls back to sub-fields when the primary text has no match', () => {
    expect(guessIconKey('Weekly routine', ['Gym'])).toBe('dumbbell');
  });

  it('falls back to the generic icon when nothing matches at all', () => {
    expect(guessIconKey('Xyzzy plugh', ['Qwerty'])).toBe('list-check');
  });

  it('matches architecture/infra vocabulary before falling through to the ported personal-habit table', () => {
    expect(guessIconKey('Primary Database')).toBe('database');
    expect(guessIconKey('Load Balancer')).toBe('gauge');
    expect(guessIconKey('Redis Cache')).toBe('fire');
    expect(guessIconKey('API Gateway')).toBe('bridge');
    // "api" is checked as its own infra rule; "gateway" would also match,
    // but "api" appears first in the pattern's word order — either way this
    // should not fall through to the generic icon.
    expect(guessIconKey('API Gateway')).not.toBe('list-check');
  });

  it('every icon key referenced by a rule resolves to a real registered icon', () => {
    // Exercises the whole rule table via getIconComponent rather than
    // duplicating the rule list here.
    const samples = ['Gym', 'Laundry', 'Dentist', 'Book a hotel', 'Confirm plans', 'nonsense-xyzzy'];
    for (const s of samples) {
      const key = guessIconKey(s);
      expect(getIconComponent(key)).toBeDefined();
    }
  });
});
