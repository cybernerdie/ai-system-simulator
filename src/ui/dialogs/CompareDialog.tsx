import { useMemo } from 'react';
import { Pin, X } from 'lucide-react';
import { simulate } from '../../engine/simulate';
import { goalMet } from '../../engine/pressures';
import type { Goal, GoalMetric, Metrics, SimGraph, TrafficProfile } from '../../engine/types';
import { METRIC_META } from '../../lib/format';
import { useEscape } from '../hooks/useEscape';

const ROWS: GoalMetric[] = ['accuracy', 'hallucination', 'errorRate', 'injection', 'p50', 'ttftP50', 'costPer1k'];
const HIGHER_BETTER = new Set<GoalMetric>(['accuracy']);

export function CompareDialog({
  pinned,
  current,
  traffic,
  goals,
  onRestore,
  onPinCurrent,
  onClear,
  onClose,
}: {
  pinned: { graph: SimGraph; parts: number };
  current: { graph: SimGraph; parts: number };
  traffic: TrafficProfile;
  goals: Goal[];
  onRestore: () => void;
  onPinCurrent: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const [a, b] = useMemo(() => {
    // same traffic, same random draws: the only difference is the design
    const run = (g: SimGraph) => simulate(g, traffic, { seed: 73, samples: 5000 });
    return [run(pinned.graph), run(current.graph)];
  }, [pinned.graph, current.graph, traffic]);
  const rows = [...new Set<GoalMetric>([...goals.map((g) => g.metric), ...ROWS])];
  const goalFor = (k: GoalMetric) => goals.find((g) => g.metric === k);
  const met = (m: Metrics) => goals.filter((g) => goalMet(m, g)).length;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="cmp-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog compare">
        <button className="btn btn-ghost picker-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <p className="dialog-kicker">Same traffic, same luck</p>
        <h2 id="cmp-title">Pinned design vs. current design</h2>
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">
                <Pin size={12} aria-hidden /> Pinned
              </th>
              <th scope="col">Current</th>
            </tr>
          </thead>
          <tbody>
            {goals.length > 0 && (
              <tr className="compare-goals">
                <th scope="row">Goals met</th>
                <td className={met(a) > met(b) ? 'is-better' : ''}>
                  {met(a)}/{goals.length}
                </td>
                <td className={met(b) > met(a) ? 'is-better' : ''}>
                  {met(b)}/{goals.length}
                </td>
              </tr>
            )}
            {rows.map((k) => {
              const va = a[k];
              const vb = b[k];
              const hi = HIGHER_BETTER.has(k);
              const close = Math.abs(va - vb) <= Math.max(Math.abs(va), Math.abs(vb)) * 0.02;
              const aBetter = !close && (hi ? va > vb : va < vb);
              const bBetter = !close && !aBetter;
              const g = goalFor(k);
              return (
                <tr key={k}>
                  <th scope="row">
                    {METRIC_META[k].label}
                    {g && (
                      <em>
                        goal {g.op === '>=' ? '≥' : '≤'} {METRIC_META[k].fmt(g.value)}
                      </em>
                    )}
                  </th>
                  <td className={`${aBetter ? 'is-better' : ''}${g && !goalMet(a, g) ? ' is-miss' : ''}`}>{METRIC_META[k].fmt(va)}</td>
                  <td className={`${bBetter ? 'is-better' : ''}${g && !goalMet(b, g) ? ' is-miss' : ''}`}>{METRIC_META[k].fmt(vb)}</td>
                </tr>
              );
            })}
            <tr>
              <th scope="row">Components</th>
              <td className={pinned.parts < current.parts ? 'is-better' : ''}>{pinned.parts}</td>
              <td className={current.parts < pinned.parts ? 'is-better' : ''}>{current.parts}</td>
            </tr>
          </tbody>
        </table>
        <p className="dialog-note">Green marks the better number in each row. Red marks a missed goal.</p>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClear}>
            Unpin
          </button>
          <button className="btn btn-ghost" onClick={onRestore}>
            Go back to the pinned design
          </button>
          <button className="btn btn-primary" onClick={onPinCurrent}>
            <Pin size={14} aria-hidden /> Pin the current one instead
          </button>
        </div>
      </div>
    </div>
  );
}
