import { describe, expect, it } from 'vitest';
import { describeChange, goalShifts } from './changes';
import { simulate } from './simulate';
import { SCENARIOS, withDefaults } from './levels/scenarios';
import type { SimGraph } from './types';

const level1 = SCENARIOS[0];
const start: SimGraph = { nodes: level1.nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: n.config! })), edges: level1.edges };
const fixed: SimGraph = { nodes: level1.solution.nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: n.config! })), edges: level1.solution.edges };

describe('describeChange', () => {
  it('names a component that was added', () => {
    const llm = start.nodes.find((n) => n.type === 'llm')!;
    const g = { nodes: [...start.nodes, { id: 'v', type: 'vector_db' as const, config: {} }], edges: [...start.edges, { source: 'v', target: llm.id }] };
    expect(describeChange(start, g)).toBe('Added Vector DB');
  });

  it('describes one setting in words, with option labels shortened', () => {
    const g = { ...start, nodes: start.nodes.map((n) => (n.type === 'llm' ? { ...n, config: { ...n.config, size: 'large' } } : n)) };
    expect(describeChange(start, g)).toMatch(/^LLM: .+ Medium → Large$/);
  });

  it('says nothing when nothing changed', () => {
    expect(describeChange(start, start)).toBeNull();
  });
});

describe('goalShifts', () => {
  const run = (g: SimGraph) => simulate(g, level1.traffic, { seed: 7, samples: 1500 });

  it("reports level 1's fix as right answers up and made-up answers down, both for the better", () => {
    const shifts = goalShifts(run(start), run(fixed), level1.goals);
    expect(shifts.map((s) => [s.metric, s.better])).toEqual(level1.goals.map((g) => [g.metric, true]));
    expect(shifts.find((s) => s.metric === 'accuracy')!.to).toBeGreaterThan(shifts.find((s) => s.metric === 'accuracy')!.from);
  });

  it('leaves out numbers that barely moved', () => {
    expect(goalShifts(run(start), run(start), level1.goals)).toEqual([]);
  });
});
