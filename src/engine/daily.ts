/**
 * The daily challenge: one remixed level per day, the same for everyone.
 * The date seeds which level is remixed and how its traffic changes; goals are then set from what the
 * level's reference solution achieves on that traffic, so every daily is winnable and the starting design isn't.
 */
import { mulberry32, simulate } from './simulate';
import { goalMet } from './pressures';
import { SCENARIOS, withDefaults } from './scenarios';
import type { Scenario } from './scenarioKit';
import type { Goal, Metrics, TrafficProfile } from './types';

/** Daily #1 is this date. */
const EPOCH = Date.UTC(2026, 10, 19);

/** Local calendar date as YYYY-MM-DD. */
export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dailyNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

type ShareKey = Exclude<{ [K in keyof TrafficProfile]: TrafficProfile[K] extends number | undefined ? K : never }[keyof TrafficProfile], 'rps' | 'chatTurns' | 'systemPromptTokens' | undefined>;
const SHARES: ShareKey[] = ['kbShare', 'exactTermShare', 'toolShare', 'adversarialShare', 'repeatShare', 'complexShare', 'structuredShare', 'staleShare', 'tableShare', 'batchShare', 'taskShare', 'piiShare', 'abuseShare', 'extractShare', 'creativeShare', 'poisonShare', 'sendShare', 'recallShare'];

const SHARE_WORDS: Partial<Record<ShareKey, string>> = {
  kbShare: 'docs questions',
  exactTermShare: 'exact codes and names',
  toolShare: 'requests that need tools',
  adversarialShare: 'jailbreak attempts',
  repeatShare: 'repeat questions',
  structuredShare: 'requests that need JSON',
  staleShare: 'questions about changed docs',
  piiShare: 'messages with personal data',
  abuseShare: 'scripted abuse',
  extractShare: 'extraction requests',
  poisonShare: 'poisoned content',
  batchShare: 'background jobs',
  taskShare: 'custom-task requests',
};

const graphOf = (g: Scenario['solution']) => ({
  nodes: g.nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: n.config! })),
  edges: g.edges.map((e) => ({ source: e.source, target: e.target })),
});

const RATE = new Set(['accuracy', 'hallucination', 'injection', 'errorRate', 'piiLeak', 'evalGap', 'harmfulActions']);

/** Loosen each goal just enough that the reference solution meets it on today's traffic. */
function goalsFor(base: Goal[], m: Metrics): Goal[] {
  return base.map((g) => {
    const v = m[g.metric];
    if (g.op === '>=') {
      const room = Math.floor((v - 0.03) * 100) / 100;
      return { ...g, value: Math.min(g.value, Math.max(0.3, room)) };
    }
    const room = RATE.has(g.metric) ? Math.ceil((v + 0.01) * 1000) / 1000 : v * 1.12;
    const value = Math.max(g.value, room);
    return { ...g, value: RATE.has(g.metric) ? value : Math.round(value * (value < 10 ? 100 : 1)) / (value < 10 ? 100 : 1) };
  });
}

const cache = new Map<string, Scenario>();

/** The daily level for a date key (YYYY-MM-DD). Deterministic. */
export function dailyScenario(key: string): Scenario {
  const hit = cache.get(key);
  if (hit) return hit;
  const n = dailyNumber(key);
  const pool = SCENARIOS.filter((s) => s.goals.length && s.solution.nodes.length);
  // every level comes up once per cycle, in a fresh random order each cycle
  const cycle = Math.floor((n - 1) / pool.length);
  const order = pool.map((_, i) => i);
  const shuffle = mulberry32(hash(`cycle-${cycle}`));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(shuffle() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const base = pool[order[(((n - 1) % pool.length) + pool.length) % pool.length]];
  const name = base.title.replace(/^\d+ · /, '');
  for (let attempt = 0; attempt < 12; attempt++) {
    const rng = mulberry32(hash(`${key}#${attempt}`));
    const t: TrafficProfile = { ...base.traffic };
    const changes: string[] = [];
    // traffic volume: quieter or busier than usual
    const vol = [0.6, 0.8, 1.25, 1.5, 2][Math.floor(rng() * 5)];
    t.rps = Math.max(1, Math.round(base.traffic.rps * vol));
    if (vol >= 1.25) changes.push(`${vol}× the usual traffic`);
    else changes.push('a quieter day');
    // reshape two of the request types it already has
    const present = SHARES.filter((k) => (t[k] ?? 0) > 0);
    for (let i = 0; i < 2 && present.length; i++) {
      const k = present.splice(Math.floor(rng() * present.length), 1)[0];
      const up = rng() < 0.6;
      t[k] = Math.min(0.95, Math.round((t[k] as number) * (up ? 1.35 : 0.7) * 100) / 100);
      const w = SHARE_WORDS[k];
      if (w) changes.push(`${up ? 'more' : 'fewer'} ${w}`);
    }
    const sol = simulate(graphOf(base.solution), t, { seed: 11, samples: 4000 });
    const goals = goalsFor(base.goals, sol);
    const start = simulate(graphOf(base), t, { seed: 11, samples: 4000 });
    // the starting design must still be broken, and the solution must clearly hold
    if (goals.every((g) => goalMet(start, g))) continue;
    const check = simulate(graphOf(base.solution), t, { seed: 29, samples: 4000 });
    if (!goals.every((g) => goalMet(check, g))) continue;
    const s: Scenario = {
      ...base,
      id: `daily-${key}`,
      kind: 'daily',
      title: `Daily #${n} · ${name}`,
      tagline: `Today: ${changes.join(', ')}.`,
      brief: `${base.brief}\n\nToday's twist: ${changes.join(', ')}. Everyone gets the same level today; come back tomorrow for a new one.`,
      traffic: t,
      goals,
      skills: [...base.skills],
    };
    cache.set(key, s);
    return s;
  }
  // no remix worked: play the level as it is (always winnable)
  const fb: Scenario = { ...base, id: `daily-${key}`, kind: 'daily', title: `Daily #${n} · ${name}`, tagline: `Today: ${base.tagline}` };
  cache.set(key, fb);
  return fb;
}

export const isDailyId = (id: string) => /^daily-\d{4}-\d{2}-\d{2}$/.test(id);

/* ---------- results and streaks ---------- */

export interface DailyResult {
  stars: number;
  cost: number;
  parts: number;
}

const KEY = 'aisim.daily.v1';

export function loadDaily(): Record<string, DailyResult> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function saveDaily(key: string, r: DailyResult): Record<string, DailyResult> {
  const all = loadDaily();
  const prev = all[key];
  if (!prev || r.stars > prev.stars || (r.stars === prev.stars && r.cost < prev.cost)) all[key] = r;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return all;
}

/** Consecutive days solved, counting back from today (or yesterday, if today isn't done yet). */
export function dailyStreak(results: Record<string, DailyResult>, today = new Date()): number {
  const d = new Date(today);
  if (!results[todayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (results[todayKey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function dailyShareText(key: string, r: DailyResult, streak: number): string {
  const stars = '⭐'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  const cost = r.cost < 1 ? r.cost.toFixed(2) : r.cost.toFixed(1);
  return `AISim Daily #${dailyNumber(key)} ${stars}\n$${cost} per 1k requests · ${r.parts} parts${streak > 1 ? ` · ${streak}-day streak` : ''}`;
}
