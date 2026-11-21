import { describe, expect, it } from 'vitest';
import { PRESSURES, fixFor, type Pressure } from './pressures';
import type { SimGraph } from './types';

const p = (key: keyof typeof PRESSURES): Pressure => ({ key, ...PRESSURES[key] });
const graph = (...types: SimGraph['nodes'][number]['type'][]): SimGraph => ({ nodes: types.map((type, i) => ({ id: `n${i}`, type, config: {} })), edges: [] });

describe('hints', () => {
  it('come in three steps for every problem', () => {
    for (const [key, v] of Object.entries(PRESSURES)) {
      expect(v.look.length, key).toBeGreaterThan(20);
      expect(v.idea.length, key).toBeGreaterThan(20);
      expect(v.try.length, key).toBeGreaterThan(20);
    }
  });

  it('give the general fix when the design has none of it yet', () => {
    expect(fixFor(p('retrieval_miss'), graph('users', 'llm'))).toBe(PRESSURES.retrieval_miss.try);
  });

  it("don't suggest a part that's already there", () => {
    expect(fixFor(p('retrieval_miss'), graph('users', 'keyword_search', 'llm'))).toMatch(/^You already search by keyword/);
    expect(fixFor(p('injection'), graph('users', 'input_guard', 'llm'))).toMatch(/Add an Output Judge/);
  });

  it('point out failover with nowhere to fail over to', () => {
    const g = graph('users', 'fallback', 'llm');
    g.nodes[1].config = { failover: true };
    expect(fixFor(p('provider_down'), g)).toMatch(/no second model on another provider/);
  });
});
