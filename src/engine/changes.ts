/** What a design change was, in words, and which goals it moved: the cause and effect a level is teaching. */
import { COMPONENTS, type ConfigField } from './components';
import { QUALITY_METRICS, metricValue } from './pressures';
import type { Goal, GoalMetric, Metrics, NodeConfig, SimGraph } from './types';

const nameOf = (g: SimGraph, id: string) => {
  const n = g.nodes.find((x) => x.id === id);
  return n ? COMPONENTS[n.type].name : id;
};

const list = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** "Small (fast, cheap)" reads as "Small" in a one-line summary. */
function valueText(f: ConfigField, v: NodeConfig[string]): string {
  if (f.kind === 'toggle') return v ? 'on' : 'off';
  if (f.kind === 'select') return (f.options?.find((o) => o.value === String(v))?.label ?? String(v)).replace(/\s*\(.*\)$/, '');
  return String(v);
}

/** One line saying what changed between two designs, or null if nothing that matters did. */
export function describeChange(before: SimGraph, after: SimGraph): string | null {
  const had = new Set(before.nodes.map((n) => n.id));
  const has = new Set(after.nodes.map((n) => n.id));
  const added = after.nodes.filter((n) => !had.has(n.id)).map((n) => COMPONENTS[n.type].name);
  const removed = before.nodes.filter((n) => !has.has(n.id)).map((n) => COMPONENTS[n.type].name);
  if (added.length === 1 && removed.length === 1) return `Swapped ${removed[0]} for ${added[0]}`;
  if (added.length && removed.length) return `Added ${list(added)}, removed ${list(removed)}`;
  if (added.length) return `Added ${list(added)}`;
  if (removed.length) return `Removed ${list(removed)}`;

  const settings: string[] = [];
  for (const n of after.nodes) {
    const old = before.nodes.find((x) => x.id === n.id);
    if (!old) continue;
    for (const f of COMPONENTS[n.type].fields) {
      if (old.config?.[f.key] === n.config?.[f.key]) continue;
      settings.push(`${COMPONENTS[n.type].name}: ${f.label} ${valueText(f, old.config?.[f.key])} → ${valueText(f, n.config?.[f.key])}`);
    }
  }
  if (settings.length === 1) return settings[0];
  if (settings.length) return `Changed ${settings.length} settings`;

  const pairs = (g: SimGraph) => new Set(g.edges.map((e) => `${e.source}>${e.target}`));
  const was = pairs(before);
  const now = pairs(after);
  const linked = after.edges.filter((e) => !was.has(`${e.source}>${e.target}`));
  const unlinked = before.edges.filter((e) => !now.has(`${e.source}>${e.target}`));
  if (linked.length === 1 && !unlinked.length) return `Connected ${nameOf(after, linked[0].source)} to ${nameOf(after, linked[0].target)}`;
  if (unlinked.length === 1 && !linked.length) return `Disconnected ${nameOf(before, unlinked[0].source)} from ${nameOf(before, unlinked[0].target)}`;
  if (linked.length || unlinked.length) return 'Changed the connections';
  return null;
}

export interface Shift {
  metric: GoalMetric;
  from: number;
  to: number;
  /** Moved in the direction its goal (or common sense, in the sandbox) wants. */
  better: boolean;
  /** Nothing measured it before this change: `from` means nothing, and measuring it is the news. */
  revealed?: boolean;
}

/** Shares of requests, as opposed to money, time or hours. */
const RATES = new Set<GoalMetric>(['accuracy', 'hallucination', 'injection', 'errorRate', 'piiLeak', 'harmfulActions', 'fairnessGap', 'evalGap']);

/**
 * Whether a move is bigger than sampling noise. A rate has to move a full point, or half a point if
 * it's also a big relative change (0.6% → 1.4% errors matters; 2.5% → 2.8% is noise). Money and time
 * have to move 5%.
 */
function moved(metric: GoalMetric, from: number, to: number): boolean {
  const d = Math.abs(to - from);
  if (RATES.has(metric)) return d >= 0.01 || (d >= 0.005 && d / Math.max(from, to) >= 0.4);
  return d / Math.max(Math.abs(from), Math.abs(to), 1e-9) >= 0.05;
}

/** In the sandbox there are no goals, so these stand in: what anyone building one would watch. */
const SANDBOX_GOALS: Goal[] = [
  { metric: 'accuracy', op: '>=', value: 1 },
  { metric: 'errorRate', op: '<=', value: 0 },
  { metric: 'p50', op: '<=', value: 0 },
  { metric: 'costPer1k', op: '<=', value: 0 },
];

/**
 * How each goal's number moved between two runs. A number the change made visible (adding evals or a
 * per-group check) is reported as newly measured. One still unmeasured is left out rather than shown
 * as a number the player can't see; so are moves within sampling noise.
 */
export function goalShifts(before: Metrics, after: Metrics, goals: Goal[]): Shift[] {
  const out: Shift[] = [];
  for (const g of goals.length ? goals : SANDBOX_GOALS) {
    const seen = (m: Metrics) => (QUALITY_METRICS.includes(g.metric) ? m.qualityVisible : g.metric === 'fairnessGap' ? m.fairnessVisible : true);
    if (!seen(after)) continue;
    const from = metricValue(before, g.metric);
    const to = metricValue(after, g.metric);
    if (!seen(before)) out.push({ metric: g.metric, from, to, better: true, revealed: true });
    else if (moved(g.metric, from, to)) out.push({ metric: g.metric, from, to, better: g.op === '>=' ? to > from : to < from });
  }
  return out;
}
