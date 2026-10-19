import { describe, expect, it } from 'vitest';
import { cardTop } from './placement';

describe('cardTop', () => {
  it('goes below the row when it fits', () => {
    expect(cardTop({ top: 100, bottom: 128 }, 200, 700)).toBe(132);
  });

  it('goes above the row near the bottom', () => {
    expect(cardTop({ top: 600, bottom: 628 }, 200, 700)).toBe(396);
  });

  it('stays inside a short viewport', () => {
    expect(cardTop({ top: 150, bottom: 178 }, 250, 300)).toBe(42);
    expect(cardTop({ top: 150, bottom: 178 }, 400, 300)).toBe(8);
  });
});
