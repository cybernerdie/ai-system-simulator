import type { Goal, GoalMetric, Metrics } from '../../engine/types';
import { goalMet } from '../../engine/pressures';
import { METRIC_META } from '../../lib/format';

/** Metrics that are shares of requests, so they fit on a 0–100% bar. */
const SHARES: GoalMetric[] = ['accuracy', 'hallucination', 'injection', 'errorRate', 'piiLeak', 'harmfulActions'];

/**
 * Each goal as a distance to cover: where the system is now, where it has to get to. Shares get a
 * bar with the target marked; everything else reads as "now → needed".
 */
export function GoalMeters({ goals, now, voice = false }: { goals: Goal[]; now: Metrics; voice?: boolean }) {
  return (
    <ul className="goal-meters">
      {goals.map((g) => {
        const meta = METRIC_META[g.metric];
        const label = g.metric === 'ttftP50' && voice ? 'Time to first audio' : meta.label;
        const value = now[g.metric];
        const ok = goalMet(now, g);
        const share = SHARES.includes(g.metric);
        return (
          <li key={g.metric} className={ok ? 'is-met' : 'is-unmet'}>
            <span className="goal-meter-label">{label}</span>
            <span className="goal-meter-values">
              <span className="goal-meter-now">now {meta.fmt(value)}</span>
              <span className="goal-meter-need">
                {g.op === '>=' ? 'needs at least' : 'needs at most'} {meta.fmt(g.value)}
              </span>
            </span>
            {share && (
              <span className="goal-meter-track" aria-hidden>
                <span className="goal-meter-fill" style={{ width: `${Math.min(100, value * 100)}%` }} />
                <span className="goal-meter-target" style={{ left: `${g.value * 100}%` }} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
