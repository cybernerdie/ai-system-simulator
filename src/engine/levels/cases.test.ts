import { describe, expect, it } from 'vitest';
import { SCENARIOS } from './scenarios';
import { BOSSES } from './bosses';

/** Case files are read word for word by players, so their structure has to hold. */
describe('case files', () => {
  const withCase = [...SCENARIOS, ...BOSSES].filter((s) => s.case);

  it('cover the first four chapters and their bosses', () => {
    expect(SCENARIOS.slice(0, 20).every((s) => s.case)).toBe(true);
    expect(BOSSES.filter((b) => ['boss-launch', 'boss-pilot', 'boss-outage', 'boss-scale'].includes(b.id)).every((b) => b.case)).toBe(true);
  });

  for (const s of withCase) {
    const c = s.case!;
    it(`${s.id}: marks a phrase that's really in the bot's reply`, () => {
      if (c.chat.lie) expect(c.chat.bot).toContain(c.chat.lie);
    });
    it(`${s.id}: has three guesses with exactly one right, each explained`, () => {
      expect(c.predict.options).toHaveLength(3);
      expect(c.predict.options.filter((o) => o.right)).toHaveLength(1);
      for (const o of c.predict.options) expect(o.why.length).toBeGreaterThan(30);
    });
    it(`${s.id}: names the idea and states the job`, () => {
      expect(c.named.term.length).toBeGreaterThan(3);
      expect(c.job).toMatch(/\.$/);
    });
  }
});
