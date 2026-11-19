import type { Metrics } from './types';

/** What a month of this traffic costs: cost per 1k requests × requests in 30 days. */
export function monthlyCost(m: Pick<Metrics, 'costPer1k' | 'offered'>): number {
  return (m.costPer1k / 1000) * m.offered * 86400 * 30;
}

/** "$1.4k", "$38k", "$1.2M" */
export function money(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k`;
  return `$${Math.round(v)}`;
}
