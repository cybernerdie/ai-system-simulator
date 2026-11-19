import { goalMet } from '../../engine/pressures';
import type { Goal, GoalMetric, Metrics } from '../../engine/types';
import { money, monthlyCost } from '../../engine/review';
import { METRIC_META, ms, pct, usd } from '../format';

/* ---------- telemetry dock ---------- */

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <svg className="spark" viewBox="0 0 64 18" aria-hidden />;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 64).toFixed(1)},${(16 - ((v - lo) / span) * 14).toFixed(1)}`);
  return (
    <svg className="spark" viewBox="0 0 64 18" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts.join(' ')} />
    </svg>
  );
}

export function Telemetry({ m, history, goals }: { m: Metrics | null; history: Metrics[]; goals: Goal[] }) {
  if (!m) {
    return (
      <div className="telemetry is-empty">
        <span className="only-keys">Press</span>
        <kbd className="only-keys">Space</kbd>
        <span className="only-keys">to send traffic through your design.</span>
        <span className="only-touch">Tap Run to send traffic through your design.</span>
      </div>
    );
  }
  // With no real user requests answered (all attacks, all abuse, or all errors) there's nothing to score
  const noAnswers = m.answered === 0;
  const NO_ANSWERS = 'No real user requests were answered, so there is nothing to score.';
  const cells: { key: string; label: string; value: string; series: number[]; metric?: GoalMetric; title?: string }[] = [
    // With an Eval Harness, the dashboard shows what your evals report, which is only as honest as they are
    {
      key: 'acc',
      label: m.evalSetup ? 'Accuracy (evals)' : 'Accuracy',
      value: noAnswers ? '—' : pct(m.evalSetup ? m.measuredAccuracy : m.accuracy),
      series: history.map((h) => (h.evalSetup ? h.measuredAccuracy : h.accuracy)),
      metric: 'accuracy',
      title: noAnswers ? NO_ANSWERS : m.evalSetup ? 'As reported by your Eval Harness. Goals are judged on real outcomes.' : undefined,
    },
    {
      key: 'hal',
      label: m.evalSetup ? 'Halluc. (evals)' : 'Hallucination',
      value: noAnswers ? '—' : pct(m.evalSetup ? m.measuredHallucination : m.hallucination),
      series: history.map((h) => (h.evalSetup ? h.measuredHallucination : h.hallucination)),
      metric: 'hallucination',
      title: noAnswers ? NO_ANSWERS : m.evalSetup ? 'As reported by your Eval Harness. Goals are judged on real outcomes.' : undefined,
    },
    m.recall == null && m.avgHistoryTokens > 0
      ? {
          key: 'hist',
          label: 'History / message',
          value: m.avgHistoryTokens >= 1000 ? `${(m.avgHistoryTokens / 1000).toFixed(1)}k` : String(Math.round(m.avgHistoryTokens)),
          series: history.map((h) => h.avgHistoryTokens),
        }
      : { key: 'rec', label: 'Recall', value: m.recall == null ? '—' : pct(m.recall), series: history.map((h) => h.recall ?? 0) },
    goals.some((g) => g.metric === 'fairnessGap')
      ? {
          key: 'fair',
          label: 'Group gap',
          value: m.fairnessVisible ? METRIC_META.fairnessGap.fmt(m.fairnessGap) : '?',
          series: history.map((h) => (h.fairnessVisible ? h.fairnessGap : 0)),
          metric: 'fairnessGap' as const,
          title: m.fairnessVisible ? undefined : 'Nothing measures quality per group yet',
        }
      : goals.some((g) => g.metric === 'diagnoseHours')
        ? { key: 'diag', label: 'Find a bug', value: METRIC_META.diagnoseHours.fmt(m.diagnoseHours), series: history.map((h) => h.diagnoseHours), metric: 'diagnoseHours' as const }
        : goals.some((g) => g.metric === 'harmfulActions')
          ? {
              key: 'harm',
              label: 'Hijacked',
              value: METRIC_META.harmfulActions.fmt(m.harmfulActions),
              series: history.map((h) => h.harmfulActions),
              metric: 'harmfulActions' as const,
            }
          : goals.some((g) => g.metric === 'piiLeak')
            ? { key: 'pii', label: 'PII leaked', value: pct(m.piiLeak), series: history.map((h) => h.piiLeak), metric: 'piiLeak' as const }
            : { key: 'inj', label: 'Injection', value: pct(m.injection), series: history.map((h) => h.injection), metric: 'injection' as const },
    { key: 'err', label: 'Errors', value: pct(m.errorRate), series: history.map((h) => h.errorRate), metric: 'errorRate' },
    { key: 'p50', label: 'p50 latency', value: ms(m.p50), series: history.map((h) => h.p50), metric: 'p50' },
    { key: 'ttft', label: m.voice ? 'First audio' : 'First token', value: ms(m.ttftP50), series: history.map((h) => h.ttftP50), metric: 'ttftP50' },
    { key: 'cost', label: 'Cost / 1k', value: usd(m.costPer1k), series: history.map((h) => h.costPer1k), metric: 'costPer1k' },
  ];
  const hidden = new Set(m.qualityVisible ? [] : ['acc', 'hal', 'inj', 'rec']);
  return (
    <div className="telemetry" aria-live="polite">
      {cells.map((c) => {
        if (hidden.has(c.key))
          return (
            <div key={c.key} className="tele is-hidden" title="Invisible without evals">
              <div className="tele-label">{c.label}</div>
              <div className="tele-row">
                <span className="tele-value">?</span>
                <span className="tele-goal">needs evals</span>
              </div>
              <Spark values={[]} />
            </div>
          );
        const goal = c.metric ? goals.find((g) => g.metric === c.metric) : undefined;
        // the dashboard colours by what it can see: your evals' numbers, not the truth
        const seen = m.evalSetup ? { ...m, accuracy: m.measuredAccuracy, hallucination: m.measuredHallucination } : m;
        const state = goal ? (goalMet(seen, goal) ? 'met' : 'unmet') : '';
        return (
          <div key={c.key} className={`tele ${state}`} title={c.title}>
            <div className="tele-label">{c.label}</div>
            <div className="tele-row">
              <span className="tele-value">{c.value}</span>
              {goal && (
                <span className="tele-goal">
                  {goal.op === '>=' ? '≥' : '≤'}
                  {METRIC_META[goal.metric].fmt(goal.value)}
                </span>
              )}
            </div>
            {c.key === 'cost' && (
              <div className="tele-sub" title="What a month of this traffic would cost">
                ≈ {money(monthlyCost(m))}/mo
              </div>
            )}
            <Spark values={c.series} />
          </div>
        );
      })}
    </div>
  );
}
