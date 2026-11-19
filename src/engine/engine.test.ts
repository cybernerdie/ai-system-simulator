import { describe, expect, it } from 'vitest';
import { activeNodes, simulate } from './simulate';
import { SCENARIOS, withDefaults, type ScenarioNode } from './scenarios';
import { bindingPressure, goalMet } from './pressures';
import type { SimEdge } from './types';

const toGraph = (nodes: ScenarioNode[], edges: SimEdge[]) => ({
  nodes: nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, config: { ...n.config! } })),
  edges,
});

// Average a few seeds so tests check the model, not one lucky draw.
const run = (nodes: ScenarioNode[], edges: SimEdge[], traffic: (typeof SCENARIOS)[number]['traffic']) =>
  simulate(toGraph(nodes, edges), traffic, { seed: 42, samples: 6000 });

describe('scenarios', () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: starting design fails at least one goal`, () => {
      const m = run(s.nodes, s.edges, s.traffic);
      expect(s.goals.every((g) => goalMet(m, g))).toBe(false);
      expect(bindingPressure(m, s.goals).key).not.toBe('stable');
    });
    it(`${s.id}: reference solution meets every goal`, () => {
      const m = run(s.solution.nodes, s.solution.edges, s.traffic);
      for (const g of s.goals) expect({ metric: g.metric, met: goalMet(m, g), v: m[g.metric] }).toMatchObject({ met: true });
    });
  }

  it('names the expected first wall for each scenario', () => {
    const expected: Record<string, string> = {
      'docs-bot': 'no_knowledge',
      'wrong-chunks': 'retrieval_miss',
      'launch-day': 'rate_limit',
      'support-agent': 'no_tools',
      jailbreak: 'injection',
      'long-docs': 'context_overflow',
      'feels-slow': 'ttft',
      'endless-chat': 'history_bloat',
      'flying-blind': 'blind',
      'self-host': 'gpu_saturated',
      'provider-down': 'provider_down',
      'research-team': 'sequential_agent',
      'think-harder': 'weak_reasoning',
      'broke-parser': 'invalid_output',
      'stale-index': 'stale_index',
      'big-prompt': 'uncached_prompt',
      'nightly-job': 'background_jobs',
      'fine-tune': 'task_unknown',
      'model-drift': 'blind',
      pii: 'pii_leak',
      voice: 'slow_voice',
      abuse: 'abuse',
      temperature: 'sampling_noise',
      'eval-trust': 'eval_blindspot',
      'indirect-injection': 'indirect_injection',
    };
    for (const s of SCENARIOS) {
      const m = run(s.nodes, s.edges, s.traffic);
      expect([s.id, bindingPressure(m, s.goals).key]).toEqual([s.id, expected[s.id]]);
    }
  });
});

describe('engine behaviour', () => {
  const s = SCENARIOS.find((x) => x.id === 'support-agent')!;

  it('a huge agent step cap costs more than a tight one', () => {
    const at = (steps: number) =>
      run(
        s.solution.nodes.map((n) => (n.type === 'agent' ? { ...n, config: { maxSteps: steps } } : n)),
        s.solution.edges,
        s.traffic,
      );
    expect(at(20).costPer1k).toBeGreaterThan(at(6).costPer1k * 1.3);
    expect(at(3).accuracy).toBeLessThan(at(6).accuracy);
  });

  it('streaming lowers time-to-first-token, an output judge cancels it', () => {
    const traffic = SCENARIOS[0].traffic;
    const nodes: ScenarioNode[] = [
      { id: 'u', type: 'users', x: 0, y: 0 },
      { id: 'l', type: 'llm', x: 0, y: 0, config: { size: 'medium', streaming: true } },
    ];
    const plain = run([nodes[0], { ...nodes[1], config: { size: 'medium' } }], [{ source: 'u', target: 'l' }], traffic);
    const streamed = run(nodes, [{ source: 'u', target: 'l' }], traffic);
    const judged = run(
      [...nodes, { id: 'j', type: 'output_guard', x: 0, y: 0 }],
      [{ source: 'u', target: 'l' }, { source: 'l', target: 'j' }],
      traffic,
    );
    expect(streamed.ttftP50).toBeLessThan(plain.ttftP50 / 3);
    expect(judged.ttftP50).toBeGreaterThan(plain.ttftP50);
  });

  it('only nodes on a Users → LLM path (or after a live LLM) are active', () => {
    const active = activeNodes({
      nodes: [
        { id: 'u', type: 'users', config: {} },
        { id: 'c', type: 'semantic_cache', config: {} },
        { id: 'l', type: 'llm', config: {} },
        { id: 'j', type: 'output_guard', config: {} },
        { id: 'orphan', type: 'reranker', config: {} },
      ],
      edges: [
        { source: 'u', target: 'c' },
        { source: 'c', target: 'l' },
        { source: 'l', target: 'j' },
      ],
    });
    expect([...active].sort()).toEqual(['c', 'j', 'l', 'u']);
  });

  it('memory strategies trade cost against forgetting', () => {
    const chat = SCENARIOS.find((x) => x.id === 'endless-chat')!;
    const withMem = (strategy: string) =>
      run(
        [
          { id: 'u', type: 'users', x: 0, y: 0 },
          { id: 'm', type: 'memory', x: 0, y: 0, config: { strategy, windowTurns: 6 } },
          { id: 'l', type: 'llm', x: 0, y: 0, config: { size: 'medium' } },
        ],
        [
          { source: 'u', target: 'm' },
          { source: 'm', target: 'l' },
        ],
        chat.traffic,
      );
    const full = withMem('full');
    const win = withMem('window');
    const ret = withMem('retrieval');
    expect(full.avgHistoryTokens).toBeGreaterThan(win.avgHistoryTokens * 3);
    expect(full.costPer1k).toBeGreaterThan(ret.costPer1k * 2);
    expect(win.causes.forgot_context ?? 0).toBeGreaterThan((ret.causes.forgot_context ?? 0) * 3);
  });

  it('quality goals cannot be met without evals when quality is hidden', () => {
    const s = SCENARIOS.find((x) => x.id === 'flying-blind')!;
    const noEval = { nodes: s.solution.nodes.filter((n) => n.type !== 'eval_harness'), edges: s.solution.edges.filter((e) => e.target !== 'ev') };
    const m = run(noEval.nodes, noEval.edges, s.traffic);
    expect(m.qualityVisible).toBe(false);
    expect(s.goals.every((g) => goalMet(m, g))).toBe(false);
    expect(bindingPressure(m, s.goals).key).toBe('blind');
  });

  it('retries alone make an outage worse; failover fixes it', () => {
    const s = SCENARIOS.find((x) => x.id === 'provider-down')!;
    const withRetries = (r: number, failover: boolean, backup: boolean) =>
      run(
        [
          ...s.nodes.filter((n) => n.type !== 'llm'),
          { id: 'fb', type: 'fallback', x: 0, y: 0, config: { retries: r, failover } },
          { id: 'llm', type: 'llm', x: 0, y: 0, config: { size: 'medium', provider: 'A' } },
          ...(backup ? [{ id: 'b', type: 'llm' as const, x: 0, y: 0, config: { size: 'medium', provider: 'B' } }] : []),
        ],
        [
          { source: 'users', target: 'emb' },
          { source: 'emb', target: 'vdb' },
          { source: 'vdb', target: 'fb' },
          { source: 'fb', target: 'llm' },
          ...(backup ? [{ source: 'fb', target: 'b' }] : []),
        ],
        s.traffic,
      );
    expect(withRetries(5, false, false).errorRate).toBeGreaterThan(0.2);
    expect(withRetries(1, true, true).errorRate).toBeLessThan(0.01);
  });

  it('GPU batching trades per-request speed for throughput', () => {
    const gpu = (batch: number, quant = 'fp16') => profileOf({ id: 'g', type: 'gpu_llm', config: { model: 'open-70b', gpus: 4, batch, quant } }).gpu!;
    expect(gpu(32).capacityTps).toBeGreaterThan(gpu(1).capacityTps * 15);
    expect(gpu(32).perStreamTps).toBeLessThan(gpu(1).perStreamTps * 0.75);
    expect(gpu(8, 'int8').capacityTps).toBeGreaterThan(gpu(8).capacityTps);
  });

  it('agent teams: parallel is faster, too many workers backfires, round caps bound cost', () => {
    const s = SCENARIOS.find((x) => x.id === 'research-team')!;
    const team = (workers: number, maxRounds: number) =>
      run(
        [
          { id: 'users', type: 'users', x: 0, y: 0 },
          { id: 't', type: 'agent_team', x: 0, y: 0, config: { workers, reviewer: true, maxRounds } },
          { id: 'llm', type: 'llm', x: 0, y: 0, config: { size: 'medium' } },
        ],
        [
          { source: 'users', target: 't' },
          { source: 't', target: 'llm' },
        ],
        s.traffic,
      );
    const single = run(s.nodes, s.edges, s.traffic);
    const four = team(4, 3);
    expect(four.p50).toBeLessThan(single.p50);
    expect(team(8, 3).accuracy).toBeLessThan(four.accuracy);
    expect(team(4, 12).costPer1k).toBeGreaterThan(four.costPer1k * 1.3);
  });

  it('single-shot traffic sends no history', () => {
    const m = run(SCENARIOS[0].nodes, SCENARIOS[0].edges, SCENARIOS[0].traffic);
    expect(m.avgHistoryTokens).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const g = toGraph(s.nodes, s.edges);
    expect(simulate(g, s.traffic, { seed: 3 })).toEqual(simulate(g, s.traffic, { seed: 3 }));
  });
});

import { trafficMultiplier } from './patterns';
import { profileOf } from './models';
describe('traffic patterns', () => {
  it('steady is flat, spikes burst, waves stay positive, ramps climb', () => {
    expect(trafficMultiplier('steady', 37)).toBe(1);
    expect(trafficMultiplier('spike', 10)).toBe(1);
    expect(trafficMultiplier('spike', 38)).toBe(4);
    for (let t = 0; t < 240; t += 2) expect(trafficMultiplier('wave', t)).toBeGreaterThan(0.2);
    expect(trafficMultiplier('ramp', 120)).toBeCloseTo(4);
    expect(trafficMultiplier('ramp', 0)).toBe(1);
  });
});

describe('broken designs', () => {
  const s = SCENARIOS[0];
  it('names a missing path to the model as the binding pressure', () => {
    const lonely = run([{ id: 'u', type: 'users', x: 0, y: 0 }], [], s.traffic);
    expect(lonely.noModel).toBe(true);
    expect(bindingPressure(lonely, s.goals).key).toBe('no_model');
    const unplugged = run(
      [
        { id: 'u', type: 'users', x: 0, y: 0 },
        { id: 'l', type: 'llm', x: 200, y: 0 },
      ],
      [],
      s.traffic,
    );
    expect(bindingPressure(unplugged, s.goals).key).toBe('no_model');
  });
  it('survives cycles without hanging or producing NaN', () => {
    const m = run(
      [
        { id: 'u', type: 'users', x: 0, y: 0 },
        { id: 'l', type: 'llm', x: 200, y: 0 },
        { id: 'a', type: 'agent', x: 400, y: 0 },
      ],
      [
        { source: 'u', target: 'l' },
        { source: 'l', target: 'a' },
        { source: 'a', target: 'l' },
      ],
      s.traffic,
    );
    for (const k of ['accuracy', 'errorRate', 'costPer1k', 'p50'] as const) expect(Number.isFinite(m[k])).toBe(true);
  });
});

describe('unmeasurable quality', () => {
  it('reports no answered requests when every request is an attack', () => {
    const s = SCENARIOS[0];
    const m = run(
      [
        { id: 'u', type: 'users', x: 0, y: 0 },
        { id: 'l', type: 'llm', x: 200, y: 0 },
      ],
      [{ source: 'u', target: 'l' }],
      { ...s.traffic, adversarialShare: 1 },
    );
    expect(m.answered).toBe(0);
    expect(goalMet(m, { metric: 'hallucination', op: '<=', value: 0.25 })).toBe(false);
  });
});

describe('indirect prompt injection', () => {
  const s = SCENARIOS.find((x) => x.id === 'indirect-injection')!;
  const node = (id: string, type: string, config: Record<string, unknown> = {}) => ({ id, type, x: 0, y: 0, config }) as never;
  const chainOf = (...ids: string[]) => ids.slice(1).map((t, i) => ({ source: ids[i], target: t }));
  it('is not stopped by the input guard, and read-only agents cause no harm but fail sends', () => {
    const guarded = run([node('u', 'users'), node('g', 'input_guard'), node('a', 'agent'), node('l', 'llm')], chainOf('u', 'g', 'a', 'l'), s.traffic);
    expect(guarded.harmfulActions).toBeGreaterThan(0.02);
    const readOnly = run([node('u', 'users'), node('a', 'agent', { permissions: 'read' }), node('l', 'llm')], chainOf('u', 'a', 'l'), s.traffic);
    expect(readOnly.harmfulActions).toBe(0);
    expect(readOnly.accuracy).toBeLessThan(0.7);
  });
});
