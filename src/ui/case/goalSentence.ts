import type { Goal, Metrics } from '../../engine/types';
import { goalMet } from '../../engine/pressures';
import { METRIC_META } from '../../lib/format';

export interface GoalPart {
  /** "raise", "cut" or "keep" */
  verb: string;
  what: string;
  /** Where it is now; absent when the goal is already met and only has to be kept. */
  from?: string;
  to: string;
}

/**
 * Each goal as part of one plain sentence about what has to change: "raise right answers from 23%
 * to at least 70%". Goals the starting design already meets (or rounds to) are ones to keep:
 * "keep cost per 1,000 requests at $35 or less".
 */
export function goalParts(goals: Goal[], now: Metrics, voice = false): GoalPart[] {
  return goals.map((g) => {
    const meta = METRIC_META[g.metric];
    const what = (g.metric === 'ttftP50' && voice ? 'time to first audio' : meta.label).toLowerCase();
    // in a sentence "1%" reads better than "1.0%"
    const tidy = (v: number) => meta.fmt(v).replace(/\.0(?=%)/, '');
    const from = tidy(now[g.metric]);
    const target = tidy(g.value);
    const atLeast = g.op === '>=';
    if (goalMet(now, g) || from === target) return { verb: 'keep', what, to: `${target} or ${atLeast ? 'more' : 'less'}` };
    return atLeast ? { verb: 'raise', what, from, to: `at least ${target}` } : { verb: 'cut', what, from, to: `${target} or less` };
  });
}
