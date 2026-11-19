import { describe, expect, it } from 'vitest';
import { customScenario, decodeLevel, encodeLevel, verifyLevel, type CustomLevel } from './customLevel';
import { SANDBOX, SCENARIOS, withDefaults } from '../engine/levels/scenarios';
import type { SharedDesign } from './designLink';

const design = (nodes: (typeof SCENARIOS)[number]['nodes'], edges: { source: string; target: string }[]): SharedDesign => ({
  scenarioId: 'sandbox',
  nodes: nodes.map(withDefaults).map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: n.config! })),
  edges,
});

describe('player-made levels', () => {
  const s = SCENARIOS[0];
  const level: CustomLevel = {
    title: 'My docs bot',
    brief: 'It makes things up.',
    traffic: s.traffic,
    goals: s.goals,
    start: design(s.nodes, s.edges),
    solution: design(s.solution.nodes, s.solution.edges),
  };
  it('round-trips through a link', () => {
    const back = decodeLevel(encodeLevel(level))!;
    expect(back.title).toBe('My docs bot');
    expect(back.goals).toEqual(s.goals);
    expect(back.solution.nodes.map((n) => n.type)).toEqual(s.solution.nodes.map((n) => n.type));
    expect(customScenario(encodeLevel(level), back).kind).toBe('custom');
  });
  it('checks the level is fair', () => {
    expect(verifyLevel(level)).toEqual({ startFails: true, solutionWins: true });
    expect(verifyLevel({ ...level, start: level.solution })).toEqual({ startFails: false, solutionWins: true });
  });
  it('rejects junk and clamps hostile values', () => {
    expect(decodeLevel('not-a-level')).toBeNull();
    const evil = encodeLevel({ ...level, title: 'x'.repeat(500), traffic: { ...SANDBOX.traffic, rps: 1e9, kbShare: 7 } });
    const back = decodeLevel(evil)!;
    expect(back.title.length).toBeLessThanOrEqual(60);
    expect(back.traffic.rps).toBeLessThanOrEqual(200);
    expect(back.traffic.kbShare).toBeLessThanOrEqual(1);
  });
});
