import { simulate } from './simulate';
import { withDefaults, type Scenario } from './levels/scenarios';
import type { Metrics } from './types';

const cache = new Map<string, Metrics>();

/** How a level's starting design performs, so a goal can be shown as "now 23%, needs 70%". */
export function startingMetrics(s: Scenario): Metrics {
  const hit = cache.get(s.id);
  if (hit) return hit;
  const graph = { nodes: s.nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: n.config! })), edges: s.edges };
  const m = simulate(graph, s.traffic, { seed: 7, samples: 3000 });
  cache.set(s.id, m);
  return m;
}
