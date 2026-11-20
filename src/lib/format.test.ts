import { describe, expect, it } from 'vitest';
import { goalValue } from './format';

describe('goalValue', () => {
  const cost = { metric: 'costPer1k' as const, op: '<=' as const, value: 16 };

  it('shows a missed goal precisely enough not to look met', () => {
    expect(goalValue(cost, 16.04, false)).toBe('$16.04');
  });

  it('keeps the usual format otherwise', () => {
    expect(goalValue(cost, 15.6, true)).toBe('$16');
    expect(goalValue(cost, 21.3, false)).toBe('$21');
  });
});
