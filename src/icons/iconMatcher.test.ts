import { describe, expect, it } from 'vitest';
import { guessIconKey } from './iconMatcher';
import { getIconComponent } from './registry';

describe('guessIconKey', () => {
  it('matches a direct keyword', () => {
    expect(guessIconKey('Primary Database')).toBe('database');
    expect(guessIconKey('Redis Cache')).toBe('fire');
  });

  it('is case-insensitive', () => {
    expect(guessIconKey('REDIS CACHE')).toBe('fire');
  });

  it('matches whole words only, not substrings inside unrelated words', () => {
    // "key" must not match inside unrelated words like "monkey"/"keyboard"
    expect(guessIconKey('Monkey keyboard service')).not.toBe('key');
  });

  it('handles simple singular/plural in both directions', () => {
    expect(guessIconKey('Users table')).toBe('users'); // "users" rule matches directly
    expect(guessIconKey('Secrets store')).toBe('key'); // "secret" rule matches "secrets"
  });

  it('matches a multi-word phrase as a substring', () => {
    expect(guessIconKey('Load Balancer')).toBe('gauge'); // "load balancer" phrase
  });

  it('matches a specific bucket/S3 rule ahead of the broader storage rule', () => {
    expect(guessIconKey('S3 Bucket')).toBe('bucket');
    expect(guessIconKey('Object Storage Volume')).toBe('hard-drive');
  });

  it('falls back to sub-fields when the primary text has no match', () => {
    expect(guessIconKey('Widget', ['PostgreSQL'])).toBe('database');
  });

  it('falls back to the generic icon when nothing matches at all', () => {
    expect(guessIconKey('Xyzzy plugh', ['Qwerty'])).toBe('list-check');
  });

  it('matches core architecture/infra vocabulary', () => {
    expect(guessIconKey('Primary Database')).toBe('database');
    expect(guessIconKey('Load Balancer')).toBe('gauge');
    expect(guessIconKey('Redis Cache')).toBe('fire');
    expect(guessIconKey('API Gateway')).toBe('bridge');
    expect(guessIconKey('API Gateway')).not.toBe('list-check');
  });

  it('every icon key referenced by a rule resolves to a real registered icon', () => {
    const samples = ['Primary Database', 'Load Balancer', 'Redis Cache', 'S3 Bucket', 'nonsense-xyzzy'];
    for (const s of samples) {
      const key = guessIconKey(s);
      expect(getIconComponent(key)).toBeDefined();
    }
  });
});
