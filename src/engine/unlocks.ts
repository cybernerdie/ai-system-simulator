import { SCENARIOS, type Scenario } from './levels/scenarios';
import { levelNumber, unlockCap } from './catalog';
import type { ComponentType } from './types';

/**
 * Components that no level's start or reference solution uses, but that a level teaches.
 * They unlock with that level.
 */
const TAUGHT_BY: Partial<Record<ComponentType, string>> = {
  validator: 'broke-parser',
};

let cache: Map<ComponentType, number> | null = null;

/** The level (1-based) where each component first becomes available. */
export function unlockLevels(): Map<ComponentType, number> {
  if (cache) return cache;
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
  cache = first;
  return first;
}

export interface PaletteLocks {
  /** Components not yet reachable, with the level that unlocks each. */
  locks: Map<ComponentType, number>;
  /** Components this level introduces, highlighted as new. */
  fresh: Set<ComponentType>;
}

/**
 * Which components a level offers. Everything introduced up to the level is open, plus anything
 * already on the canvas. Returns null when nothing is locked (sandbox, modes, "unlock everything").
 */
export function paletteLocks(s: Scenario, onCanvas: Set<ComponentType>, unlockAll: boolean): PaletteLocks | null {
  const cap = unlockCap(s);
  if (unlockAll || cap === null) return null;
  const first = unlockLevels();
  const locks = new Map<ComponentType, number>();
  first.forEach((lvl, t) => {
    if (lvl > cap && !onCanvas.has(t)) locks.set(t, lvl);
  });
  const startsHere = new Set(s.nodes.map((n) => n.type));
  const fresh = new Set<ComponentType>();
  if (levelNumber(s) !== null) first.forEach((lvl, t) => lvl === cap && !startsHere.has(t) && fresh.add(t));
  return { locks, fresh };
}
