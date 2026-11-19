/**
 * Finding any level by id, and how to label it: numbered levels, bosses, the daily, incident mode, the sandbox.
 * (Levels made by players are looked up by the app, which owns their storage.)
 */
import { SANDBOX, SCENARIOS } from './levels/scenarios';
import { BOSSES } from './levels/bosses';
import { dailyScenario, isDailyId } from './modes/daily';
import { INCIDENT_SCENARIO } from './modes/incident';
import { CHAPTERS } from './levels/chapters';
import type { Scenario } from './levels/kit';

const BUILT_IN: Scenario[] = [...SCENARIOS, ...BOSSES, SANDBOX, INCIDENT_SCENARIO];

export function findBuiltIn(id: string): Scenario | undefined {
  const s = BUILT_IN.find((x) => x.id === id);
  if (s) return s;
  if (isDailyId(id)) return dailyScenario(id.slice(6));
  return undefined;
}

/** Short tag shown before a level's name: "07", "Boss", "Daily"... */
export function levelTag(s: Scenario): string {
  const i = SCENARIOS.findIndex((x) => x.id === s.id);
  if (i >= 0) return String(i + 1).padStart(2, '0');
  switch (s.kind) {
    case 'boss':
      return 'Boss';
    case 'daily':
      return 'Daily';
    case 'incident':
      return 'On call';
    case 'custom':
      return 'Shared';
    default:
      return '∞';
  }
}

/** 1-based level number for numbered levels, else null. */
export function levelNumber(s: Scenario): number | null {
  const i = SCENARIOS.findIndex((x) => x.id === s.id);
  return i >= 0 ? i + 1 : null;
}

/**
 * Components unlock as you progress. Returns the level number whose components are open here,
 * or null when everything is open (sandbox, daily, incident, shared levels).
 */
export function unlockCap(s: Scenario): number | null {
  const n = levelNumber(s);
  if (n) return n;
  if (s.kind === 'boss' && s.chapter !== undefined) {
    const last = CHAPTERS[s.chapter].ids.at(-1)!;
    return SCENARIOS.findIndex((x) => x.id === last) + 1;
  }
  return null;
}

/** The level that follows this one on the map (a chapter's boss comes after its last level). */
export function nextAfter(s: Scenario, cleared: Set<string>): Scenario | undefined {
  const ci = CHAPTERS.findIndex((c) => c.ids.includes(s.id));
  if (ci >= 0) {
    const ch = CHAPTERS[ci];
    const last = ch.ids.at(-1) === s.id;
    const chapterDone = ch.ids.every((id) => id === s.id || cleared.has(id));
    if (last && chapterDone && !cleared.has(ch.boss)) return BOSSES.find((b) => b.id === ch.boss);
    const i = SCENARIOS.findIndex((x) => x.id === s.id);
    return SCENARIOS[i + 1];
  }
  if (s.kind === 'boss' && s.chapter !== undefined) {
    const nextCh = CHAPTERS[s.chapter + 1];
    return nextCh ? SCENARIOS.find((x) => x.id === nextCh.ids[0]) : undefined;
  }
  return undefined;
}
