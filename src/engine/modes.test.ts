import { describe, expect, it } from 'vitest';
import { simulate } from './simulate';
import { goalMet } from './pressures';
import { SCENARIOS, chain, withDefaults, type ScenarioNode } from './scenarios';
import { BOSSES } from './bosses';
import { dailyNumber, dailyScenario, dailyShareText, dailyStreak, todayKey } from './daily';
import { INCIDENT_KINDS, INCIDENT_SCENARIO, incidentGoals, incidentTick, incidentTraffic, newIncidentRun } from './incident';
import { findBuiltIn, levelTag, nextAfter, unlockCap } from './catalog';
import { ACHIEVEMENTS, newlyEarned, type Progress } from './achievements';
import { QUIZ } from '../content/quiz';
import type { SimEdge } from './types';

const graph = (nodes: ScenarioNode[], edges: SimEdge[]) => ({
  nodes: nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: { ...n.config! } })),
  edges,
});

describe('daily challenge', () => {
  it('numbers days from launch', () => {
    expect(dailyNumber('2026-11-19')).toBe(1);
    expect(dailyNumber('2026-12-19')).toBe(31);
  });
  it('is deterministic, winnable and starts broken, for two weeks of dailies', () => {
    const d = new Date(2026, 10, 19);
    const seen = new Set<string>();
    for (let i = 0; i < 14; i++) {
      const key = todayKey(d);
      const s = dailyScenario(key);
      expect(s.id).toBe(`daily-${key}`);
      expect(dailyScenario(key)).toBe(s);
      const sol = simulate(graph(s.solution.nodes, s.solution.edges), s.traffic, { seed: 42, samples: 6000 });
      for (const g of s.goals) expect({ day: key, metric: g.metric, met: goalMet(sol, g) }).toMatchObject({ met: true });
      const start = simulate(graph(s.nodes, s.edges), s.traffic, { seed: 42, samples: 6000 });
      expect(s.goals.every((g) => goalMet(start, g))).toBe(false);
      seen.add(s.title.replace(/^Daily #\d+ · /, ''));
      d.setDate(d.getDate() + 1);
    }
    // a different level every day within a cycle
    expect(seen.size).toBe(14);
  });
  it('counts streaks back from today, or yesterday if today is not done yet', () => {
    const today = new Date(2026, 11, 10);
    const r = { stars: 3, cost: 1, parts: 3 };
    expect(dailyStreak({ '2026-12-10': r, '2026-12-09': r, '2026-12-08': r, '2026-12-06': r }, today)).toBe(3);
    expect(dailyStreak({ '2026-12-09': r, '2026-12-08': r }, today)).toBe(2);
    expect(dailyStreak({ '2026-12-07': r }, today)).toBe(0);
  });
  it('makes a short, spoiler-free share text', () => {
    const t = dailyShareText('2026-11-21', { stars: 2, cost: 0.4123, parts: 4 }, 3);
    expect(t).toContain('AISim Daily #3');
    expect(t).toContain('⭐⭐☆');
    expect(t).toContain('$0.41');
    expect(t).toContain('3-day streak');
  });
});

describe('incident mode', () => {
  const start = graph(INCIDENT_SCENARIO.nodes, INCIDENT_SCENARIO.edges);
  // a well-defended design: one answer to every incident
  const strong = graph(
    [
      { id: 'users', type: 'users' },
      { id: 'lim', type: 'user_limits', config: { perUserRpm: 60 } },
      { id: 'pii', type: 'pii_redactor' },
      { id: 'ig', type: 'input_guard', config: { strictness: 0.8 } },
      { id: 'san', type: 'content_sanitizer' },
      { id: 'sc', type: 'semantic_cache', config: { threshold: 0.92 } },
      { id: 'emb', type: 'embedding' },
      { id: 'vdb', type: 'vector_db', config: { topK: 12, chunk: 'medium', refresh: 'live' } },
      { id: 'kw', type: 'keyword_search' },
      { id: 'rr', type: 'reranker', config: { keep: 4 } },
      { id: 'ag', type: 'agent', config: { maxSteps: 6, permissions: 'send' } },
      { id: 'fb', type: 'fallback', config: { retries: 1, failover: true } },
      { id: 'llm', type: 'llm', config: { size: 'medium', jsonMode: true } },
      { id: 'llmb', type: 'llm', config: { size: 'medium', provider: 'B', jsonMode: true } },
      { id: 'oj', type: 'output_guard' },
      { id: 'ap', type: 'action_approval' },
    ].map((n) => ({ x: 0, y: 0, ...n }) as ScenarioNode),
    [...chain('users', 'lim', 'pii', 'ig', 'san', 'sc', 'emb', 'vdb', 'rr', 'ag', 'fb', 'llm', 'oj', 'ap'), { source: 'sc', target: 'kw' }, { source: 'kw', target: 'rr' }, { source: 'fb', target: 'llmb' }, { source: 'llmb', target: 'oj' }],
  );
  const holds = (g: ReturnType<typeof graph>, kinds: typeof INCIDENT_KINDS) => {
    const m = simulate(g, incidentTraffic(kinds, 0), { seed: 3, samples: 5000 });
    return incidentGoals(kinds).every((goal) => goalMet(m, goal));
  };
  it('the starting system is healthy when nothing is wrong', () => expect(holds(start, [])).toBe(true));
  for (const k of INCIDENT_KINDS) {
    it(`${k}: breaks the starting system, and a well-defended one survives it`, () => {
      expect(holds(start, [k])).toBe(false);
      expect(holds(strong, [k])).toBe(true);
    });
  }
  it('missed goals drain health until the run ends; holding them heals', () => {
    let s = newIncidentRun(1);
    for (let i = 0; i < 10; i++) s = incidentTick(s, 0, 2);
    expect(s.health).toBe(100);
    let ticks = 0;
    while (!s.over && ticks < 500) {
      s = incidentTick(s, 2, 2);
      ticks++;
    }
    expect(s.over).toBe(true);
    expect(ticks).toBeGreaterThan(15);
    expect(s.count).toBeGreaterThan(0);
  });
  it('incidents arrive over time, never the same one twice at once', () => {
    let s = newIncidentRun(7);
    for (let i = 0; i < 200; i++) {
      s = incidentTick(s, 0, 2);
      expect(new Set(s.active.map((a) => a.kind)).size).toBe(s.active.length);
    }
    expect(s.count).toBeGreaterThanOrEqual(10);
    expect(s.over).toBe(false);
  });
  it('budget cuts tighten the cost goal', () => {
    const cost = (k: typeof INCIDENT_KINDS) => incidentGoals(k).find((g) => g.metric === 'costPer1k')!.value;
    expect(cost(['budget'])).toBeLessThan(cost([]));
  });
});

describe('catalog', () => {
  it('finds every built-in level, the daily and incident mode', () => {
    for (const s of [...SCENARIOS, ...BOSSES]) expect(findBuiltIn(s.id)).toBe(s);
    expect(findBuiltIn('incident')?.kind).toBe('incident');
    expect(findBuiltIn('daily-2026-11-20')?.kind).toBe('daily');
    expect(findBuiltIn('nope')).toBeUndefined();
  });
  it('labels levels', () => {
    expect(levelTag(SCENARIOS[6])).toBe('07');
    expect(levelTag(BOSSES[0])).toBe('Boss');
    expect(levelTag(INCIDENT_SCENARIO)).toBe('On call');
  });
  it('bosses open the components of their chapter, specials open everything', () => {
    expect(unlockCap(SCENARIOS[2])).toBe(3);
    expect(unlockCap(BOSSES[0])).toBe(5);
    expect(unlockCap(BOSSES[5])).toBe(30);
    expect(unlockCap(INCIDENT_SCENARIO)).toBeNull();
  });
  it('leads into the boss after a chapter, and out of it into the next chapter', () => {
    const ch1 = SCENARIOS.slice(0, 5).map((s) => s.id);
    expect(nextAfter(SCENARIOS[4], new Set(ch1))?.id).toBe('boss-launch');
    expect(nextAfter(SCENARIOS[4], new Set(ch1.slice(1)))?.id).toBe(SCENARIOS[5].id);
    expect(nextAfter(BOSSES[0], new Set())?.id).toBe(SCENARIOS[5].id);
    expect(nextAfter(BOSSES[5], new Set())).toBeUndefined();
  });
});

describe('quiz and achievements', () => {
  it('every numbered level and boss has one question, with a valid answer', () => {
    for (const s of [...SCENARIOS, ...BOSSES]) {
      const q = QUIZ[s.id];
      expect({ id: s.id, has: !!q }).toEqual({ id: s.id, has: true });
      expect(q.options).toHaveLength(3);
      expect([0, 1, 2]).toContain(q.answer);
    }
    expect(Object.keys(QUIZ).length).toBe(SCENARIOS.length + BOSSES.length);
  });
  it('earns achievements from progress', () => {
    const p: Progress = { cleared: new Set(), stars: {}, quiz: {}, daily: {}, dailyStreak: 0, incident: null, lessonsRead: 0, flags: new Set() };
    expect(newlyEarned(p, {})).toEqual([]);
    const p2: Progress = { ...p, cleared: new Set(['docs-bot', 'boss-launch']), stars: { 'docs-bot': 3 }, flags: new Set(['compared']) };
    expect(newlyEarned(p2, {}).map((a) => a.id)).toEqual(['first-fix', 'three-stars', 'boss', 'compare']);
    expect(newlyEarned(p2, { 'first-fix': 1 }).map((a) => a.id)).not.toContain('first-fix');
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
