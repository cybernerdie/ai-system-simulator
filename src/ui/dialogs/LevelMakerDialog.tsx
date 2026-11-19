import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { simulate } from '../../engine/simulate';
import type { Goal, GoalMetric, TrafficProfile } from '../../engine/types';
import type { SharedDesign } from '../../lib/designLink';
import { encodeLevel, verifyLevel, type CustomLevel } from '../../share/customLevel';
import { METRIC_META } from '../../lib/format';
import { useEscape } from '../hooks/useEscape';

/* ---------- make your own level (sandbox) ---------- */

const MAKER_METRICS: { k: GoalMetric; op: '>=' | '<='; unit: '%' | '$' | 'ms' }[] = [
  { k: 'accuracy', op: '>=', unit: '%' },
  { k: 'hallucination', op: '<=', unit: '%' },
  { k: 'errorRate', op: '<=', unit: '%' },
  { k: 'injection', op: '<=', unit: '%' },
  { k: 'harmfulActions', op: '<=', unit: '%' },
  { k: 'piiLeak', op: '<=', unit: '%' },
  { k: 'costPer1k', op: '<=', unit: '$' },
  { k: 'p50', op: '<=', unit: 'ms' },
  { k: 'ttftP50', op: '<=', unit: 'ms' },
];

export function LevelMakerDialog({
  traffic,
  solution,
  pinned,
  onPublish,
  onClose,
}: {
  traffic: TrafficProfile;
  solution: SharedDesign;
  pinned: SharedDesign | null;
  onPublish: (code: string, level: CustomLevel) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [startFrom, setStartFrom] = useState<'blank' | 'pinned'>(pinned ? 'pinned' : 'blank');
  const solM = useMemo(
    () => simulate({ nodes: solution.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config })), edges: solution.edges }, traffic, { seed: 5, samples: 3000 }),
    [solution, traffic],
  );
  // suggested goals: a little room around what your design achieves
  const [rows, setRows] = useState(() =>
    MAKER_METRICS.map(({ k, op, unit }) => {
      const v = solM[k];
      const suggested =
        op === '>='
          ? Math.floor((v - 0.03) * 100)
          : unit === '%'
            ? Math.max(1, Math.ceil((v + 0.01) * 100))
            : unit === '$'
              ? Math.ceil(v * 1.2 * 10) / 10
              : Math.ceil((v * 1.2) / 100) * 100;
      const on = k === 'accuracy' || k === 'costPer1k' || (k === 'injection' && traffic.adversarialShare > 0) || (k === 'piiLeak' && (traffic.piiShare ?? 0) > 0);
      return { k, op, unit, on, value: suggested };
    }),
  );
  const blank: SharedDesign = {
    scenarioId: 'sandbox',
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 132, config: {} },
      {
        id: 'llm',
        type: 'llm',
        x: 270,
        y: 132,
        config: { size: 'medium', streaming: false, provider: 'A', thinking: 'off', jsonMode: false, promptCache: false, fineTuned: false, version: 'pinned', temperature: 0.7 },
      },
    ],
    edges: [{ source: 'users', target: 'llm' }],
  };
  const start = startFrom === 'pinned' && pinned ? pinned : blank;
  const goals: Goal[] = rows.filter((r) => r.on).map((r) => ({ metric: r.k, op: r.op, value: r.unit === '%' ? r.value / 100 : r.value }));
  const [check, setCheck] = useState<{ startFails: boolean; solutionWins: boolean } | null>(null);
  const goalsKey = JSON.stringify(goals) + startFrom;
  useEffect(() => {
    setCheck(null);
    if (!goals.length) return;
    const t = window.setTimeout(() => setCheck(verifyLevel({ traffic, goals, start, solution })), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalsKey, traffic, solution]);
  const ok = !!check && check.startFails && check.solutionWins && title.trim().length > 2;
  const [copied, setCopied] = useState(false);
  const publish = () => {
    const level: CustomLevel = { title: title.trim(), brief: brief.trim(), traffic, goals, start, solution: { ...solution, scenarioId: 'sandbox' } };
    const code = encodeLevel(level);
    onPublish(code, level);
    setCopied(true);
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="maker-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog maker">
        <button className="btn btn-ghost picker-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <p className="dialog-kicker">Make a level</p>
        <h2 id="maker-title">Turn your sandbox into a challenge</h2>
        <p className="dialog-note">The design on your canvas is the answer. Players start from something weaker, with your traffic mix, and have to hit your goals.</p>
        <label className="maker-field">
          <span>Name</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="The chatbot that forgot everything" />
        </label>
        <label className="maker-field">
          <span>Story (optional)</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={600} rows={3} placeholder="What's broken, and who's complaining?" />
        </label>
        <fieldset className="maker-field">
          <legend>Players start from</legend>
          <label className="maker-radio">
            <input type="radio" checked={startFrom === 'blank'} onChange={() => setStartFrom('blank')} /> Just Users and an LLM
          </label>
          <label className={`maker-radio${pinned ? '' : ' is-disabled'}`}>
            <input type="radio" disabled={!pinned} checked={startFrom === 'pinned'} onChange={() => setStartFrom('pinned')} /> The design you pinned
            {!pinned && <em> (pin one first with Compare)</em>}
          </label>
        </fieldset>
        <fieldset className="maker-field">
          <legend>Goals</legend>
          <div className="maker-goals">
            {rows.map((r, i) => (
              <label key={r.k} className={`maker-goal${r.on ? ' is-on' : ''}`}>
                <input type="checkbox" checked={r.on} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                <span className="maker-goal-name">{METRIC_META[r.k].label}</span>
                <span className="maker-goal-op">{r.op === '>=' ? 'at least' : 'at most'}</span>
                <span className="maker-goal-value">
                  {r.unit === '$' && <i>$</i>}
                  <input
                    type="number"
                    inputMode="decimal"
                    value={r.value}
                    step={r.unit === '$' ? 0.1 : r.unit === 'ms' ? 100 : 1}
                    min={0}
                    disabled={!r.on}
                    aria-label={`${METRIC_META[r.k].label} goal`}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)))}
                  />
                  {r.unit !== '$' && <i>{r.unit}</i>}
                </span>
                <span className="maker-goal-now">yours: {METRIC_META[r.k].fmt(solM[r.k])}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <ul className="maker-checks" aria-live="polite">
          <li className={check?.solutionWins ? 'is-met' : ''}>
            {check?.solutionWins ? <Check size={14} strokeWidth={3} aria-hidden /> : <X size={14} aria-hidden />}
            Your design holds every goal
          </li>
          <li className={check?.startFails ? 'is-met' : ''}>
            {check?.startFails ? <Check size={14} strokeWidth={3} aria-hidden /> : <X size={14} aria-hidden />}
            The starting design misses at least one
          </li>
        </ul>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!ok} onClick={publish} title={ok ? undefined : 'Name it, and make sure both checks pass'}>
            {copied ? <Check size={14} strokeWidth={3} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copied ? 'Link copied' : 'Copy level link'}
          </button>
        </div>
      </div>
    </div>
  );
}
