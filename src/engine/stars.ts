/**
 * Stars: 1 for clearing a level, +1 for doing it within budget, +1 for a lean build.
 * "Par" comes from the level's reference solution, so every level is fair and 3 stars is always possible.
 */
import { simulate } from './simulate';
import { withDefaults, type Scenario } from './levels/scenarios';
import { removeAndHeal } from './autowire';
import { COMPONENTS } from './components';
import { goalMet } from './pressures';
import type { Goal, Metrics, SimGraph, TrafficProfile } from './types';

export interface Par {
  /** cost per 1k requests the reference solution achieves, with a little slack */
  cost: number;
  /** components the reference solution uses (not counting Users) */
  parts: number;
}

const cache = new Map<string, Par>();

function parFor(s: Scenario): Par {
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

export interface StarTips {
  /** How to get within budget without losing a goal, when that star was missed. */
  budget?: string;
  /** How to match the par component count, when that star was missed. */
  lean?: string;
}

const SMALLER: Record<string, string> = { large: 'medium', medium: 'small' };
const money2 = (v: number) => `$${v.toFixed(2)}`;

/**
 * For each star the player missed, one change that would have earned it: found by trying it, so it's
 * always true for their design. Tries removing each component (rewiring around it) and shrinking each
 * model by one size, and keeps the first change that still meets every goal and earns the star.
 * If nothing single does, it says what the reference build manages without.
 */
export function starTips(s: Scenario, graph: SimGraph, traffic: TrafficProfile, goals: Goal[], r: StarResult): StarTips {
  if (r.underBudget && r.lean) return {};
  const run = (g: SimGraph) => simulate(g, traffic, { seed: 7, samples: 1500 });
  const holds = (m: Metrics) => goals.every((g) => goalMet(m, g));
  const tips: StarTips = {};

  const removals = graph.nodes
    .filter((n) => n.type !== 'users')
    .map((n) => ({ node: n, m: run({ nodes: graph.nodes.filter((x) => x.id !== n.id), edges: removeAndHeal(graph.edges, n.id) }) }))
    .filter((x) => holds(x.m))
    .sort((a, b) => a.m.costPer1k - b.m.costPer1k);
  const shrinks = graph.nodes
    .filter((n) => n.type === 'llm' && SMALLER[String(n.config?.size)])
    .map((n) => {
      const to = SMALLER[String(n.config!.size)];
      return { node: n, to, m: run({ ...graph, nodes: graph.nodes.map((x) => (x.id === n.id ? { ...x, config: { ...x.config, size: to } } : x)) }) };
    })
    .filter((x) => holds(x.m));

  if (!r.lean) {
    const cut = removals[0];
    if (cut) tips.lean = `Try it without the ${COMPONENTS[cut.node.type].name}: every goal still holds.`;
    else {
      // the player's components that the reference build has no counterpart for
      const left = new Map<string, number>();
      for (const n of s.solution.nodes) left.set(n.type, (left.get(n.type) ?? 0) + 1);
      const names: string[] = [];
      for (const n of graph.nodes) {
        if (n.type === 'users') continue;
        const spare = left.get(n.type) ?? 0;
        if (spare > 0) left.set(n.type, spare - 1);
        else if (!names.includes(COMPONENTS[n.type].name)) names.push(COMPONENTS[n.type].name);
      }
      tips.lean = names.length
        ? `The reference build manages without ${names.length === 1 ? 'the ' + names[0] : names.slice(0, -1).join(', ') + ' and ' + names.at(-1)}. Removing it on its own breaks a goal here, so something else has to change too.`
        : `The reference build uses ${r.par.parts} components. Look for two that do the same job.`;
    }
  }

  if (!r.underBudget) {
    const shrink = shrinks.filter((x) => x.m.costPer1k <= r.par.cost).sort((a, b) => a.m.costPer1k - b.m.costPer1k)[0];
    const cut = removals.find((x) => x.m.costPer1k <= r.par.cost);
    if (shrink)
      tips.budget = `Try a ${shrink.to} model instead of ${String(shrink.node.config!.size)}: every goal still holds, and cost falls to ${money2(shrink.m.costPer1k)} per 1k.`;
    else if (cut) tips.budget = `Try it without the ${COMPONENTS[cut.node.type].name}: every goal still holds, and cost falls to ${money2(cut.m.costPer1k)} per 1k.`;
    else tips.budget = `No single part or smaller model gets under ${money2(r.par.cost)} while keeping every goal. The full review shows what each part costs and buys you.`;
  }
  return tips;
}
