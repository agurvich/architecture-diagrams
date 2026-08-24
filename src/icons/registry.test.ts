import { describe, expect, it } from 'vitest';
import { ICON_OPTIONS, getIconComponent } from './registry';

describe('icon registry', () => {
  it('has no duplicate keys', () => {
    const keys = ICON_OPTIONS.map((opt) => opt.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('resolves a known key to its icon component', () => {
    expect(getIconComponent('server')).toBe(ICON_OPTIONS.find((opt) => opt.key === 'server')?.Icon);
  });

  it('returns undefined for an unknown or missing key', () => {
    expect(getIconComponent('not-a-real-key')).toBeUndefined();
    expect(getIconComponent(undefined)).toBeUndefined();
  });
});
