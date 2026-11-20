import { SCENARIOS, type Scenario } from './levels/scenarios';
import { levelNumber, unlockCap } from './catalog';
import { COMPONENTS } from './components';
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

/**
 * Settings that teach the component itself, so they show whenever it does: size and temperature
 * are what level 1 points at, keep and threshold are the reranker's and cache's whole idea.
 */
const ALWAYS_SHOWN = new Set(['llm.size', 'llm.temperature', 'reranker.keep', 'semantic_cache.threshold']);
/** A setting first used this many levels after its component appeared is a separate lesson. */
const LATER_LESSON = 5;

let fieldCache: Map<string, number> | null = null;

/**
 * The level (1-based) where each `type.key` setting first matters: the first level whose start or
 * reference solution sets it away from its default. Settings that are part of a component's basic
 * idea, or that matter soon after it appears, are left out: they show with the component.
 */
export function settingLevels(): Map<string, number> {
  if (fieldCache) return fieldCache;
  const comps = unlockLevels();
  const first = new Map<string, number>();
  SCENARIOS.forEach((s, i) =>
    [...s.nodes, ...s.solution.nodes].forEach((n) => {
      const defaults = COMPONENTS[n.type].defaults;
      for (const [k, v] of Object.entries(n.config ?? {})) {
        const id = `${n.type}.${k}`;
        if (defaults[k] !== v && !first.has(id)) first.set(id, i + 1);
      }
    }),
  );
  for (const [id, lvl] of first) {
    const type = id.split('.')[0] as ComponentType;
    if (ALWAYS_SHOWN.has(id) || lvl - (comps.get(type) ?? 1) < LATER_LESSON) first.delete(id);
  }
  fieldCache = first;
  return first;
}

/**
 * Settings a level keeps out of the inspector because a later level teaches them (`hidden`), and the
 * ones this level is the first to show (`fresh`, badged "New"), as `type.key`. Null when everything
 * is open (sandbox, modes, "unlock everything").
 */
export function settingLocks(s: Scenario, unlockAll: boolean): { hidden: Set<string>; fresh: Set<string> } | null {
  const cap = unlockCap(s);
  if (unlockAll || cap === null) return null;
  const hidden = new Set<string>();
  const fresh = new Set<string>();
  settingLevels().forEach((lvl, id) => {
    if (lvl > cap) hidden.add(id);
    else if (lvl === levelNumber(s)) fresh.add(id);
  });
  return { hidden, fresh };
}
