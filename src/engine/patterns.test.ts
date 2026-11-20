import { describe, expect, it } from 'vitest';
import { liveTraffic } from './patterns';
import { SANDBOX, SCENARIOS } from './levels/scenarios';

describe('liveTraffic', () => {
  const level = SCENARIOS.find((s) => s.id === 'launch-day')!;
  const sandbox = SANDBOX;

  it("holds a level at its own traffic, so turning it down can't clear a rate-limit level", () => {
    expect(liveTraffic(level, 1, 'wave')).toEqual({ locked: true, rps: level.traffic.rps, pattern: 'steady' });
  });

  it('lets the sandbox set any traffic and pattern', () => {
    expect(liveTraffic(sandbox, 120, 'spike')).toEqual({ locked: false, rps: 120, pattern: 'spike' });
  });

  it('leaves incidents free, since their traffic is scaled from the slider', () => {
    expect(liveTraffic({ goals: [{}], kind: 'incident', traffic: { rps: 10 } }, 40, 'steady').locked).toBe(false);
  });
});
