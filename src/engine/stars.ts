/**
 * Stars: 1 for clearing a level, +1 for doing it within budget, +1 for a lean build.
 * "Par" comes from the level's reference solution, so every level is fair and 3 stars is always possible.
 */
import { simulate } from './simulate';
import { withDefaults, type Scenario } from './scenarios';
import type { Metrics } from './types';

export interface Par {
  /** cost per 1k requests the reference solution achieves, with a little slack */
  cost: number;
  /** components the reference solution uses (not counting Users) */
  parts: number;
}

const cache = new Map<string, Par>();

export function parFor(s: Scenario): Par {
  const hit = cache.get(s.id);
  if (hit) return hit;
  const graph = {
    nodes: s.solution.nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: n.config! })),
    edges: s.solution.edges.map((e) => ({ source: e.source, target: e.target })),
  };
  const m = simulate(graph, s.traffic, { seed: 7, samples: 3000 });
  const par = { cost: Math.max(0.05, m.costPer1k * 1.15), parts: s.solution.nodes.filter((n) => n.type !== 'users').length };
  cache.set(s.id, par);
  return par;
}

export interface StarResult {
  stars: 1 | 2 | 3;
  underBudget: boolean;
  lean: boolean;
  cost: number;
  parts: number;
  par: Par;
  /** this beat an earlier result on the same level */
  improved?: boolean;
}

export function scoreStars(s: Scenario, m: Metrics, partsUsed: number): StarResult {
  const par = parFor(s);
  const underBudget = m.costPer1k <= par.cost;
  const lean = partsUsed <= par.parts;
  return { stars: (1 + Number(underBudget) + Number(lean)) as 1 | 2 | 3, underBudget, lean, cost: m.costPer1k, parts: partsUsed, par };
}
