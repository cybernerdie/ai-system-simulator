import type { Goal, GoalMetric } from '../engine/types';

export const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0)}%`;
export const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);
export const usd = (v: number) => `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`;

/** Each goal metric in plain words, with the industry term it's known by for when players are ready for it. */
export const METRIC_META: Record<GoalMetric, { label: string; term?: string; fmt: (v: number) => string }> = {
  diagnoseHours: { label: 'Time to find a bug', fmt: (v) => (v >= 10 ? `${Math.round(v)}h` : `${+v.toFixed(1)}h`) },
  fairnessGap: { label: 'Gap between user groups', fmt: (v) => `${Math.round(v * 100)} pts` },
  piiLeak: { label: 'Personal data leaked', term: 'PII: personally identifiable information', fmt: pct },
  harmfulActions: { label: 'Hijacked actions', fmt: (v) => (v > 0 && v < 0.001 ? '<0.1%' : `${(v * 100).toFixed(1)}%`) },
  evalGap: { label: 'Gap between eval score and reality', fmt: (v) => `${Math.round(v * 100)} pts` },
  accuracy: { label: 'Right answers', term: 'accuracy', fmt: pct },
  hallucination: { label: 'Made-up answers', term: 'hallucination', fmt: pct },
  injection: { label: 'Attacks that worked', term: 'injection success', fmt: pct },
  errorRate: { label: 'Failed requests', term: 'error rate', fmt: pct },
  costPer1k: { label: 'Cost per 1,000 requests', fmt: usd },
  p50: { label: 'Typical response time', term: 'p50 latency', fmt: ms },
  ttftP50: { label: 'Time to first word', term: 'time to first token', fmt: ms },
};

/** "Right answers: at least 70%" */
export function goalText(g: Goal, voice = false): string {
  const label = g.metric === 'ttftP50' && voice ? 'Time to first audio' : METRIC_META[g.metric].label;
  return `${label}: ${g.op === '>=' ? 'at least' : 'at most'} ${METRIC_META[g.metric].fmt(g.value)}`;
}

/**
 * A goal's current value, precise enough that a missed goal never reads as exactly its target:
 * "$16.04" against "at most $16", not "$16" with a red cross beside it.
 */
export function goalValue(g: Goal, v: number, met: boolean): string {
  const fmt = METRIC_META[g.metric].fmt;
  const shown = fmt(v);
  if (met || shown !== fmt(g.value)) return shown;
  if (g.metric === 'costPer1k') return `$${v.toFixed(2)}`;
  if (g.metric === 'p50' || g.metric === 'ttftP50') return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v.toFixed(1)}ms`;
  if (g.metric === 'diagnoseHours') return `${v.toFixed(2)}h`;
  return g.metric === 'fairnessGap' || g.metric === 'evalGap' ? `${(v * 100).toFixed(1)} pts` : `${(v * 100).toFixed(2)}%`;
}
