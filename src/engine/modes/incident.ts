/**
 * Incident mode: an endless survival run. Your system serves a steady mixed workload while incidents hit it,
 * a few at a time. Missing a service-level goal drains health; holding them all slowly heals.
 * Score is how long you last. Everything here is pure so it can be tested without the UI.
 */
import { mulberry32 } from '../simulate';
import { base, chain, type Scenario } from '../levels/kit';
import type { Goal, TrafficProfile } from '../types';

export type IncidentKind = 'spike' | 'outage' | 'jailbreaks' | 'poison' | 'budget' | 'pii' | 'stale' | 'json' | 'abuse';

export interface IncidentDef {
  kind: IncidentKind;
  title: string;
  /** What the voice and the banner say when it starts. */
  text: string;
  apply: (t: TrafficProfile) => TrafficProfile;
  /** Multiplies the cost budget while active. */
  budget?: number;
}

export const INCIDENTS: Record<IncidentKind, IncidentDef> = {
  spike: {
    kind: 'spike',
    title: 'Traffic spike',
    text: "You're on the front page. Traffic just tripled.",
    apply: (t) => ({ ...t, rps: t.rps * 3, repeatShare: Math.min(0.6, t.repeatShare + 0.15) }),
  },
  outage: {
    kind: 'outage',
    title: 'Provider A is down',
    text: 'Provider A is failing most calls. Keep answering.',
    apply: (t) => ({ ...t, providerErrors: { ...(t.providerErrors ?? {}), A: 0.65 } }),
  },
  jailbreaks: {
    kind: 'jailbreaks',
    title: 'Jailbreak wave',
    text: 'A jailbreak prompt is going viral. Lots of people are trying it on you.',
    apply: (t) => ({ ...t, adversarialShare: Math.min(0.3, t.adversarialShare + 0.15) }),
  },
  poison: {
    kind: 'poison',
    title: 'Poisoned emails',
    text: 'Someone is mailing your agent hidden instructions.',
    apply: (t) => ({ ...t, poisonShare: Math.min(0.2, (t.poisonShare ?? 0) + 0.08) }),
  },
  budget: {
    kind: 'budget',
    title: 'Budget cut',
    text: 'Finance just cut your budget by forty percent.',
    apply: (t) => t,
    budget: 0.6,
  },
  pii: {
    kind: 'pii',
    title: 'Personal data',
    text: 'A new customer segment is pasting personal details into every message.',
    apply: (t) => ({ ...t, piiShare: Math.min(0.6, (t.piiShare ?? 0) + 0.4) }),
  },
  stale: {
    kind: 'stale',
    title: 'Docs changed',
    text: 'Product just shipped a big update. Many of your docs changed overnight.',
    apply: (t) => ({ ...t, staleShare: Math.min(0.5, (t.staleShare ?? 0) + 0.4) }),
  },
  json: {
    kind: 'json',
    title: 'New integration',
    text: 'A partner integration went live. Half your answers now have to be valid JSON.',
    apply: (t) => ({ ...t, structuredShare: Math.min(0.7, (t.structuredShare ?? 0) + 0.5) }),
  },
  abuse: {
    kind: 'abuse',
    title: 'Scripted abuse',
    text: 'A few accounts are hammering you from scripts.',
    apply: (t) => ({ ...t, abuseShare: Math.min(0.5, (t.abuseShare ?? 0) + 0.35) }),
  },
};

export const INCIDENT_KINDS = Object.keys(INCIDENTS) as IncidentKind[];

/** Seconds of simulated time between incidents, and how long each one lasts. */
const INCIDENT_EVERY = 40;
const INCIDENT_LASTS = 120;
const FIRST_AT = 16;
const BUDGET = 22;

const INCIDENT_TRAFFIC: TrafficProfile = {
  ...base,
  rps: 8,
  kbShare: 0.5,
  exactTermShare: 0.25,
  toolShare: 0.2,
  adversarialShare: 0,
  easyShare: 0.6,
  repeatShare: 0.3,
  sendShare: 0.25,
};

export const INCIDENT_SCENARIO: Scenario = {
  id: 'incident',
  kind: 'incident',
  difficulty: 3,
  skills: ['Everything', 'On call'],
  title: 'Incident mode',
  tagline: 'Keep it up as long as you can.',
  brief:
    "You're on call for a working assistant: docs questions, exact codes, a few tool calls. Incidents will hit it, a few at a time: spikes, outages, attacks, budget cuts. Every goal you miss drains your health; holding them all heals it. Last as long as you can.",
  traffic: INCIDENT_TRAFFIC,
  goals: incidentGoals([]),
  nodes: [
    { id: 'users', type: 'users', x: 0, y: 120 },
    { id: 'emb', type: 'embedding', x: 170, y: 60 },
    { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
    { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
    { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
    { id: 'ag', type: 'agent', x: 650, y: 120, config: { maxSteps: 6, permissions: 'send' } },
    { id: 'llm', type: 'llm', x: 800, y: 120, config: { size: 'medium' } },
  ],
  edges: [...chain('users', 'emb', 'vdb', 'rr', 'ag', 'llm'), { source: 'users', target: 'kw' }, { source: 'kw', target: 'rr' }],
  hint: "Read the banner: each incident has a component that answers it. You don't need all of them on day one.",
  lesson: '',
  solution: { nodes: [], edges: [] },
};

/** The service-level goals, given which incidents are active. */
export function incidentGoals(active: IncidentKind[]): Goal[] {
  const budget = active.reduce((b, k) => b * (INCIDENTS[k].budget ?? 1), BUDGET);
  return [
    { metric: 'accuracy', op: '>=', value: 0.8 },
    { metric: 'errorRate', op: '<=', value: 0.03 },
    { metric: 'injection', op: '<=', value: 0.08 },
    { metric: 'harmfulActions', op: '<=', value: 0.005 },
    { metric: 'piiLeak', op: '<=', value: 0.05 },
    { metric: 'costPer1k', op: '<=', value: Math.round(budget * 10) / 10 },
  ];
}

export function incidentTraffic(active: IncidentKind[], escalation: number): TrafficProfile {
  let t: TrafficProfile = { ...INCIDENT_TRAFFIC, rps: INCIDENT_TRAFFIC.rps * (1 + 0.06 * escalation) };
  for (const k of active) t = INCIDENTS[k].apply(t);
  return { ...t, rps: Math.round(t.rps * 10) / 10 };
}

export interface ActiveIncident {
  kind: IncidentKind;
  until: number;
}

export interface IncidentState {
  /** simulated seconds survived */
  t: number;
  health: number;
  active: ActiveIncident[];
  nextAt: number;
  /** incidents started so far (drives escalation) */
  count: number;
  seed: number;
  over: boolean;
  /** set on the tick a new incident starts, for the banner and voice */
  started?: IncidentKind;
}

export function newIncidentRun(seed: number): IncidentState {
  return { t: 0, health: 100, active: [], nextAt: FIRST_AT, count: 0, seed, over: false };
}

/**
 * Advance one tick. `missed` is how many goals are failing this tick.
 * The first few ticks after a start are a grace period while the numbers settle.
 */
export function incidentTick(s: IncidentState, missed: number, dt: number): IncidentState {
  if (s.over) return s;
  const t = s.t + dt;
  let health = s.health;
  if (t > 6) health = missed > 0 ? health - (1.6 + 1.2 * missed) * (dt / 2) : Math.min(100, health + 1.2 * (dt / 2));
  let active = s.active.filter((a) => a.until > t);
  let { nextAt, count } = s;
  let started: IncidentKind | undefined;
  if (t >= nextAt) {
    const rng = mulberry32(s.seed * 7919 + count);
    const free = INCIDENT_KINDS.filter((k) => !active.some((a) => a.kind === k));
    started = free[Math.floor(rng() * free.length)];
    active = [...active, { kind: started, until: t + INCIDENT_LASTS }];
    count += 1;
    // incidents come a little faster as the run goes on
    nextAt = t + Math.max(24, INCIDENT_EVERY - count * 1.5);
  }
  health = Math.max(0, health);
  return { ...s, t, health, active, nextAt, count, started, over: health <= 0 };
}

/* ---------- best run ---------- */

export interface IncidentBest {
  seconds: number;
  incidents: number;
}

/** The longer run is the better one. */
export function betterRun(prev: IncidentBest | null, next: IncidentBest): IncidentBest {
  return !prev || next.seconds > prev.seconds ? next : prev;
}

export const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
};
