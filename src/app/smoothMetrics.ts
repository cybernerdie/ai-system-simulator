import type { Metrics } from '../engine/types';

/** Exponential smoothing across ticks, so the numbers settle instead of flickering with sampling noise. */
export function smoothMetrics(prev: Metrics | null, next: Metrics, weight = 0.35): Metrics {
  if (!prev) return next;
  const mix = (p: number, n: number) => p + (n - p) * weight;
  return {
    ...next,
    accuracy: mix(prev.accuracy, next.accuracy),
    hallucination: mix(prev.hallucination, next.hallucination),
    injection: mix(prev.injection, next.injection),
    errorRate: mix(prev.errorRate, next.errorRate),
    costPer1k: mix(prev.costPer1k, next.costPer1k),
    p50: mix(prev.p50, next.p50),
    p99: mix(prev.p99, next.p99),
    ttftP50: mix(prev.ttftP50, next.ttftP50),
    recall: next.recall == null || prev.recall == null ? next.recall : mix(prev.recall, next.recall),
  };
}
