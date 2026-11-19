import type { GoalMetric } from '../engine/types';

export const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0)}%`;
export const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);
export const usd = (v: number) => `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`;

export const METRIC_META: Record<GoalMetric, { label: string; fmt: (v: number) => string }> = {
  diagnoseHours: { label: 'Time to find a bug', fmt: (v) => (v >= 10 ? `${Math.round(v)}h` : `${+v.toFixed(1)}h`) },
  fairnessGap: { label: 'Gap between user groups', fmt: (v) => `${Math.round(v * 100)} pts` },
  piiLeak: { label: 'Personal data leaked', fmt: pct },
  harmfulActions: { label: 'Hijacked actions', fmt: (v) => (v > 0 && v < 0.001 ? '<0.1%' : `${(v * 100).toFixed(1)}%`) },
  evalGap: { label: 'Evals off from reality by', fmt: (v) => `${Math.round(v * 100)} pts` },
  accuracy: { label: 'Accuracy', fmt: pct },
  hallucination: { label: 'Hallucination', fmt: pct },
  injection: { label: 'Injection success', fmt: pct },
  errorRate: { label: 'Errors', fmt: pct },
  costPer1k: { label: 'Cost per 1k', fmt: usd },
  p50: { label: 'Latency p50', fmt: ms },
  ttftP50: { label: 'First token', fmt: ms },
};
