import { SCENARIOS } from './levels/scenarios';
import type { ComponentType } from './types';

/**
 * Components that no level's start or reference solution uses, but that a level teaches.
 * They unlock with that level.
 */
const TAUGHT_BY: Partial<Record<ComponentType, string>> = {
  validator: 'broke-parser',
};

/** The level (1-based) where each component first becomes available. */
export function unlockLevels(): Map<ComponentType, number> {
  const first = new Map<ComponentType, number>();
  SCENARIOS.forEach((s, i) =>
    [...s.nodes, ...s.solution.nodes].forEach((n) => {
      if (!first.has(n.type)) first.set(n.type, i + 1);
    }),
  );
  for (const [type, id] of Object.entries(TAUGHT_BY) as [ComponentType, string][]) {
    const i = SCENARIOS.findIndex((s) => s.id === id);
    if (i >= 0 && (!first.has(type) || first.get(type)! > i + 1)) first.set(type, i + 1);
  }
  return first;
}
