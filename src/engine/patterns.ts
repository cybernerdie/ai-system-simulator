/** Traffic over time. Each simulation tick advances the clock by TICK_SECONDS. */
export type Pattern = 'steady' | 'spike' | 'wave' | 'ramp';

export const TICK_SECONDS = 2;

export const PATTERNS: Record<Pattern, { label: string; help: string }> = {
  steady: { label: 'Steady', help: 'Constant traffic.' },
  spike: { label: 'Spikes', help: 'Every 90s, a 15s burst at 4× traffic (a launch, a viral post).' },
  wave: { label: 'Daily wave', help: 'Traffic rises and falls between 0.25× and 1.75× over a 2-minute "day".' },
  ramp: { label: 'Ramp', help: 'Traffic climbs from 1× to 4× over two minutes, then starts again.' },
};

/** Multiplier on the base request rate at simulated time t (seconds). */
export function trafficMultiplier(p: Pattern, t: number): number {
  switch (p) {
    case 'spike': {
      const c = t % 90;
      if (c < 30 || c >= 45) return 1;
      const edge = Math.min(c - 30, 45 - c); // quick ramp in and out
      return 1 + 3 * Math.min(1, edge / 3);
    }
    case 'wave':
      return 1 + 0.75 * Math.sin((2 * Math.PI * t) / 120);
    case 'ramp':
      return 1 + 3 * Math.min(1, (t % 150) / 120);
    default:
      return 1;
  }
}
