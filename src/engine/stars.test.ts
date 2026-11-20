import { describe, expect, it } from 'vitest';
import { scoreStars, starTips } from './stars';
import { simulate } from './simulate';
import { SCENARIOS, withDefaults } from './levels/scenarios';
import type { SimGraph } from './types';

const level1 = SCENARIOS[0];
const solution: SimGraph = { nodes: level1.solution.nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: n.config! })), edges: level1.solution.edges };
const score = (g: SimGraph) => scoreStars(level1, simulate(g, level1.traffic, { seed: 7, samples: 3000 }), g.nodes.length - 1);

describe('starTips', () => {
  it('has nothing to say about a three-star build', () => {
    const r = score(solution);
    expect(r.stars).toBe(3);
    expect(starTips(level1, solution, level1.traffic, level1.goals, r)).toEqual({});
  });

  it('names a smaller model when a large one costs the budget star', () => {
    const big: SimGraph = { ...solution, nodes: solution.nodes.map((n) => (n.type === 'llm' ? { ...n, config: { ...n.config, size: 'large' } } : n)) };
    const r = score(big);
    expect(r.underBudget).toBe(false);
    expect(starTips(level1, big, level1.traffic, level1.goals, r).budget).toMatch(
      /^Try a medium model instead of large: every goal still holds, and cost falls to \$[\d.]+ per 1k\.$/,
    );
  });

  it('names a component that can go when the build is over par', () => {
    const llm = solution.nodes.find((n) => n.type === 'llm')!;
    const into = solution.edges.find((e) => e.target === llm.id)!;
    const extra: SimGraph = {
      nodes: [...solution.nodes, { id: 'cache', type: 'semantic_cache', config: withDefaults({ id: 'cache', type: 'semantic_cache', x: 0, y: 0 }).config! }],
      edges: [...solution.edges.filter((e) => e !== into), { source: into.source, target: 'cache' }, { source: 'cache', target: llm.id }],
    };
    const r = score(extra);
    expect(r.lean).toBe(false);
    expect(starTips(level1, extra, level1.traffic, level1.goals, r).lean).toBe('Try it without the Semantic Cache: every goal still holds.');
  });
});
