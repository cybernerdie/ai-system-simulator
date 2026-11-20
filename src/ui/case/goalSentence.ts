import type { Goal, Metrics } from '../../engine/types';
import { METRIC_META } from '../../lib/format';

/**
 * The goals as one plain sentence about the distance to cover:
 * "raise right answers from 23% to at least 70%, and cut made-up answers from 62% to 25% or less."
 */
export function goalParts(goals: Goal[], now: Metrics, voice = false): { verb: string; what: string; from: string; to: string }[] {
  return goals.map((g) => {
    const meta = METRIC_META[g.metric];
    const what = (g.metric === 'ttftP50' && voice ? 'time to first audio' : meta.label).toLowerCase();
    return g.op === '>='
      ? { verb: 'raise', what, from: meta.fmt(now[g.metric]), to: `at least ${meta.fmt(g.value)}` }
      : { verb: 'cut', what, from: meta.fmt(now[g.metric]), to: `${meta.fmt(g.value)} or less` };
  });
}
