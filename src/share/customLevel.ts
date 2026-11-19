/**
 * Levels made by players in the sandbox, shared as a link (#l=...).
 * A level carries its story, traffic, goals, a starting design and a verified solution.
 */
import { decodeDesign, encodeDesign, type SharedDesign } from './designLink';
import { fromBase64Url, toBase64Url } from '../lib/base64url';
import { recallLevelCode } from '../lib/progress';
import { simulate } from '../engine/simulate';
import { goalMet } from '../engine/pressures';
import { stripScenarioNumbers } from '../engine/levels/kit';
import type { Scenario, ScenarioNode } from '../engine/levels/kit';
import type { Goal, GoalMetric, SimGraph, TrafficProfile } from '../engine/types';

export interface CustomLevel {
  title: string;
  brief: string;
  traffic: TrafficProfile;
  goals: Goal[];
  start: SharedDesign;
  solution: SharedDesign;
}

const METRICS: GoalMetric[] = ['accuracy', 'hallucination', 'injection', 'errorRate', 'costPer1k', 'p50', 'ttftP50', 'piiLeak', 'evalGap', 'harmfulActions'];
const NUM_KEYS = [
  'rps',
  'kbShare',
  'exactTermShare',
  'toolShare',
  'adversarialShare',
  'easyShare',
  'repeatShare',
  'chatTurns',
  'recallShare',
  'complexShare',
  'structuredShare',
  'staleShare',
  'tableShare',
  'systemPromptTokens',
  'batchShare',
  'taskShare',
  'piiShare',
  'abuseShare',
  'extractShare',
  'creativeShare',
  'poisonShare',
  'sendShare',
] as const;
const BOOL_KEYS = ['qualityHidden', 'driftLatest', 'voice'] as const;

export function encodeLevel(l: CustomLevel): string {
  return toBase64Url(
    JSON.stringify({ v: 1, t: l.title, b: l.brief, tr: l.traffic, g: l.goals.map((g) => [g.metric, g.op, g.value]), s: encodeDesign(l.start), x: encodeDesign(l.solution) }),
  );
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function decodeLevel(code: string): CustomLevel | null {
  try {
    const p = JSON.parse(fromBase64Url(code));
    if (p?.v !== 1) return null;
    const start = decodeDesign(String(p.s));
    const solution = decodeDesign(String(p.x));
    if (!start || !solution) return null;
    const traffic: TrafficProfile = { rps: 5, kbShare: 0, exactTermShare: 0, toolShare: 0, adversarialShare: 0, easyShare: 0.6, repeatShare: 0.2 };
    const tr = p.tr ?? {};
    for (const k of NUM_KEYS)
      if (k in tr) (traffic as unknown as Record<string, number>)[k] = clamp(tr[k], 0, k === 'rps' ? 200 : k === 'chatTurns' ? 60 : k === 'systemPromptTokens' ? 40000 : 1, 0);
    if (traffic.rps < 0.5) traffic.rps = 5;
    for (const k of BOOL_KEYS) if (tr[k] === true) (traffic as unknown as Record<string, boolean>)[k] = true;
    const goals: Goal[] = (Array.isArray(p.g) ? p.g : [])
      .filter((g: unknown[]) => Array.isArray(g) && METRICS.includes(g[0] as GoalMetric) && (g[1] === '>=' || g[1] === '<='))
      .slice(0, 6)
      .map((g: unknown[]) => ({ metric: g[0] as GoalMetric, op: g[1] as '>=' | '<=', value: clamp(g[2], 0, 1e6, 0) }));
    if (!goals.length) return null;
    const text = (v: unknown, max: number) =>
      typeof v === 'string'
        ? [...v]
            .map((ch) => (ch < ' ' ? ' ' : ch))
            .join('')
            .trim()
            .slice(0, max)
        : '';
    return { title: text(p.t, 60) || 'A shared level', brief: text(p.b, 600), traffic, goals, start, solution };
  } catch {
    return null;
  }
}

const graphOf = (d: SharedDesign): SimGraph => ({
  nodes: d.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config })),
  edges: d.edges.map((e) => ({ source: e.source, target: e.target })),
});

/** A level is fair if its starting design misses a goal and its solution holds them all (on two seeds). */
export function verifyLevel(l: Pick<CustomLevel, 'traffic' | 'goals' | 'start' | 'solution'>): { startFails: boolean; solutionWins: boolean } {
  const s = simulate(graphOf(l.start), l.traffic, { seed: 5, samples: 3000 });
  const a = simulate(graphOf(l.solution), l.traffic, { seed: 5, samples: 3000 });
  const b = simulate(graphOf(l.solution), l.traffic, { seed: 17, samples: 3000 });
  return {
    startFails: !l.goals.every((g) => goalMet(s, g)),
    solutionWins: l.goals.every((g) => goalMet(a, g) && goalMet(b, g)),
  };
}

const hash = (s: string) => ([...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) >>> 0).toString(36);

const toNodes = (d: SharedDesign): ScenarioNode[] => d.nodes.map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: n.config }));

export function customScenario(code: string, l: CustomLevel): Scenario {
  return {
    id: `custom-${hash(code)}`,
    kind: 'custom',
    difficulty: 2,
    skills: ['Made by a player'],
    title: stripScenarioNumbers(l.title),
    tagline: 'A level someone built and shared.',
    brief: l.brief || 'Someone built this level in the sandbox and shared it. Hit every goal.',
    traffic: l.traffic,
    goals: l.goals,
    nodes: toNodes(l.start),
    edges: l.start.edges,
    hint: 'Run it and read the binding pressure. The person who made this level has solved it, so it can be done.',
    lesson: '',
    solution: { nodes: toNodes(l.solution), edges: l.solution.edges },
  };
}

/** A player-made level saved earlier by id (see lib/progress), rebuilt for play. */
export function recallLevel(id: string): Scenario | null {
  const code = recallLevelCode(id);
  const l = code ? decodeLevel(code) : null;
  return l && code ? customScenario(code, l) : null;
}

export function readHashLevel(): { code: string; level: CustomLevel } | null {
  const m = window.location.hash.match(/^#l=([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const level = decodeLevel(m[1]);
  return level ? { code: m[1], level } : null;
}
