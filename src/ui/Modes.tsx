import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CalendarDays, Check, Copy, Download, Flame, GitCompareArrows, HeartPulse, Lock, Pin, Search, Siren, Trophy, X } from 'lucide-react';
import { simulate } from '../engine/simulate';
import { goalMet } from '../engine/pressures';
import { INCIDENTS, formatDuration, type IncidentBest, type IncidentState } from '../engine/incident';
import { ACHIEVEMENTS, type Progress } from '../engine/achievements';
import type { QuizQuestion } from '../content/quiz';
import type { Goal, GoalMetric, Metrics, SimGraph, TrafficProfile } from '../engine/types';
import type { SharedDesign } from './persist';
import { encodeLevel, verifyLevel, type CustomLevel } from './customLevel';
import { METRIC_META } from './Panels';

/* ---------- quiz after a win ---------- */

export function QuizBlock({ q, picked, onPick }: { q: QuizQuestion; picked: number | null; onPick: (i: number) => void }) {
  const answered = picked !== null;
  return (
    <div className="quiz" role="group" aria-label="Quick check">
      <span className="win-learned-label">Quick check</span>
      <p className="quiz-q">{q.q}</p>
      <div className="quiz-options">
        {q.options.map((o, i) => {
          const state = !answered ? '' : i === q.answer ? ' is-right' : i === picked ? ' is-wrong' : ' is-dim';
          return (
            <button key={i} className={`quiz-option${state}`} onClick={() => !answered && onPick(i)} disabled={answered && i !== q.answer && i !== picked} aria-pressed={picked === i}>
              <span className="quiz-letter" aria-hidden>
                {answered && i === q.answer ? <Check size={13} strokeWidth={3} /> : answered && i === picked ? <X size={13} strokeWidth={3} /> : 'ABC'[i]}
              </span>
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={`quiz-why${picked === q.answer ? ' is-right' : ''}`} role="status">
          <strong>{picked === q.answer ? 'Right. ' : 'Not quite. '}</strong>
          {q.why}
        </p>
      )}
    </div>
  );
}

/* ---------- incident mode ---------- */

export function IncidentHud({ s }: { s: IncidentState }) {
  const tone = s.health > 60 ? 'ok' : s.health > 30 ? 'warn' : 'hot';
  return (
    <div className={`incident-hud is-${tone}`}>
      <div className="incident-health" title="Health: missed goals drain it, holding them all heals it">
        <HeartPulse size={14} aria-hidden />
        <span className="incident-bar" role="meter" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.health)}>
          <i style={{ width: `${s.health}%` }} />
        </span>
        <em>{Math.round(s.health)}</em>
      </div>
      <span className="incident-time" aria-label="Time survived">
        {formatDuration(s.t)}
      </span>
      <div className="incident-chips">
        {s.active.length === 0 ? (
          <span className="incident-chip is-calm">All quiet. Get ready.</span>
        ) : (
          s.active.map((a) => (
            <span key={a.kind} className="incident-chip" title={INCIDENTS[a.kind].text}>
              <Siren size={12} aria-hidden />
              {INCIDENTS[a.kind].title}
              <em>{Math.max(0, Math.ceil(a.until - s.t))}s</em>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function IncidentBanner({ text, title }: { title: string; text: string }) {
  return (
    <div className="incident-banner" role="alert">
      <Siren size={18} aria-hidden />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

export function IncidentOverDialog({
  seconds,
  incidents,
  best,
  onRetry,
  onShare,
  onLevels,
}: {
  seconds: number;
  incidents: number;
  best: IncidentBest | null;
  onRetry: () => void;
  onShare: () => void;
  onLevels: () => void;
}) {
  const isBest = !!best && best.seconds <= seconds;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="over-title">
      <div className="dialog win">
        <p className="dialog-kicker">{isBest ? 'New best run' : 'Your system went down'}</p>
        <h2 id="over-title">You lasted {formatDuration(seconds)}</h2>
        <ul className="win-criteria">
          <li className="is-met">
            <Siren size={14} aria-hidden />
            <span>
              {incidents} incident{incidents === 1 ? '' : 's'} hit your system
            </span>
          </li>
          {best && !isBest && (
            <li>
              <Trophy size={14} aria-hidden />
              <span>
                Your best: {formatDuration(best.seconds)}, {best.incidents} incidents
              </span>
            </li>
          )}
        </ul>
        <p className="dialog-note">Your design is still on the canvas. Strengthen it before the next run: incidents come in a different order each time.</p>
        <div className="dialog-actions win-actions">
          <button className="btn btn-ghost win-share" onClick={onShare}>
            <Copy size={14} aria-hidden /> Copy result
          </button>
          <button className="btn btn-ghost" onClick={onLevels}>
            Levels
          </button>
          <button className="btn btn-primary" autoFocus onClick={onRetry}>
            Go again
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- compare two designs ---------- */

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
  useEsc(onClose);
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
                    {g && <em>goal {g.op === '>=' ? '≥' : '≤'} {METRIC_META[k].fmt(g.value)}</em>}
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
  useEsc(onClose);
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
      const suggested = op === '>=' ? Math.floor((v - 0.03) * 100) : unit === '%' ? Math.max(1, Math.ceil((v + 0.01) * 100)) : unit === '$' ? Math.ceil(v * 1.2 * 10) / 10 : Math.ceil((v * 1.2) / 100) * 100;
      const on = k === 'accuracy' || k === 'costPer1k' || (k === 'injection' && traffic.adversarialShare > 0) || (k === 'piiLeak' && (traffic.piiShare ?? 0) > 0);
      return { k, op, unit, on, value: suggested };
    }),
  );
  const blank: SharedDesign = {
    scenarioId: 'sandbox',
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 132, config: {} },
      { id: 'llm', type: 'llm', x: 270, y: 132, config: { size: 'medium', streaming: false, provider: 'A', thinking: 'off', jsonMode: false, promptCache: false, fineTuned: false, version: 'pinned', temperature: 0.7 } },
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

/* ---------- achievements and certificate ---------- */

export function AchievementsDialog({
  progress,
  unlocked,
  levelsTotal,
  levelsCleared,
  totalStars,
  onCertificate,
  onClose,
}: {
  progress: Progress;
  unlocked: Record<string, number>;
  levelsTotal: number;
  levelsCleared: number;
  totalStars: number;
  onCertificate: (name: string) => void;
  onClose: () => void;
}) {
  useEsc(onClose);
  const got = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const eligible = levelsCleared >= levelsTotal;
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('aisim.certName.v1') ?? '';
    } catch {
      return '';
    }
  });
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="ach-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog achievements">
        <button className="btn btn-ghost picker-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <p className="dialog-kicker">
          {got} of {ACHIEVEMENTS.length} earned
        </p>
        <h2 id="ach-title">Achievements</h2>
        <ul className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const done = !!unlocked[a.id];
            const c = a.count?.(progress);
            return (
              <li key={a.id} className={`ach${done ? ' is-done' : ''}`}>
                <span className="ach-icon" aria-hidden>
                  {done ? <Trophy size={16} /> : <Lock size={14} />}
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <span>{a.text}</span>
                  {!done && c && (
                    <span className="ach-progress" aria-label={`${c[0]} of ${c[1]}`}>
                      <i style={{ width: `${(c[0] / c[1]) * 100}%` }} />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <section className={`cert${eligible ? ' is-open' : ''}`}>
          <Award size={22} aria-hidden />
          <div>
            <strong>Certificate of completion</strong>
            {eligible ? (
              <>
                <span>You cleared every level. Put your name on it.</span>
                <div className="cert-form">
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} placeholder="Your name" aria-label="Name on the certificate" />
                  <button
                    className="btn btn-primary"
                    disabled={!name.trim()}
                    onClick={() => {
                      try {
                        localStorage.setItem('aisim.certName.v1', name.trim());
                      } catch {
                        /* ignore */
                      }
                      onCertificate(name.trim());
                    }}
                  >
                    <Download size={14} aria-hidden /> Download
                  </button>
                </div>
              </>
            ) : (
              <>
                <span>
                  Clear all {levelsTotal} levels to earn it. You've cleared {levelsCleared}, with {totalStars} stars.
                </span>
                <span className="ach-progress">
                  <i style={{ width: `${(levelsCleared / levelsTotal) * 100}%` }} />
                </span>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AchievementToast({ title }: { title: string }) {
  return (
    <div className="ach-toast" role="status">
      <Trophy size={16} aria-hidden />
      <div>
        <span>Achievement</span>
        <strong>{title}</strong>
      </div>
    </div>
  );
}

/* ---------- mode cards on the level map ---------- */

export function ModeCards({
  dailyNumber,
  dailyDone,
  streak,
  incidentBest,
  achievements,
  onDaily,
  onIncident,
  onAchievements,
}: {
  dailyNumber: number;
  dailyDone: number | null;
  streak: number;
  incidentBest: IncidentBest | null;
  achievements: [number, number];
  onDaily: () => void;
  onIncident: () => void;
  onAchievements: () => void;
}) {
  return (
    <div className="modes">
      <button className="mode-card is-daily" onClick={onDaily}>
        <CalendarDays size={18} aria-hidden />
        <strong>Daily challenge #{dailyNumber}</strong>
        <span>{dailyDone ? `Solved today · ${'★'.repeat(dailyDone)}${'☆'.repeat(3 - dailyDone)}` : 'A new remixed level every day. Same one for everyone.'}</span>
        {streak > 0 && (
          <em className="mode-streak">
            <Flame size={12} aria-hidden /> {streak}-day streak
          </em>
        )}
      </button>
      <button className="mode-card is-incident" onClick={onIncident}>
        <Siren size={18} aria-hidden />
        <strong>Incident mode</strong>
        <span>{incidentBest ? `Best: ${formatDuration(incidentBest.seconds)}, ${incidentBest.incidents} incidents` : 'Keep a system alive while outages, spikes and attacks hit it.'}</span>
      </button>
      <button className="mode-card is-ach" onClick={onAchievements}>
        <Trophy size={18} aria-hidden />
        <strong>Achievements</strong>
        <span>
          {achievements[0]} of {achievements[1]} earned, plus a certificate when you clear every level.
        </span>
      </button>
    </div>
  );
}

/* ---------- command palette (keyboard play) ---------- */

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keys?: string;
  disabled?: string | false;
  run: () => void;
}

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return commands.filter((c) => !n || `${c.label} ${c.group} ${c.hint ?? ''}`.toLowerCase().includes(n));
  }, [q, commands]);
  useEffect(() => setI(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [i]);
  const run = (c: Command | undefined) => {
    if (!c || c.disabled) return;
    onClose();
    c.run();
  };
  return (
    <div className="overlay cmdk-overlay" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk">
        <label className="search cmdk-search">
          <Search size={15} aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a component or run a command…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={shown[i] ? `cmdk-${shown[i].id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setI((x) => Math.min(shown.length - 1, x + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(shown[i]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <ul className="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {shown.map((c, j) => (
            <li
              key={c.id}
              id={`cmdk-${c.id}`}
              data-i={j}
              role="option"
              aria-selected={j === i}
              aria-disabled={!!c.disabled}
              className={`cmdk-item${j === i ? ' is-active' : ''}${c.disabled ? ' is-disabled' : ''}`}
              onMouseMove={() => setI(j)}
              onClick={() => run(c)}
            >
              <span className="cmdk-group">{c.group}</span>
              <span className="cmdk-label">{c.label}</span>
              {c.disabled ? <em>{c.disabled}</em> : c.keys ? <kbd>{c.keys}</kbd> : c.hint ? <em>{c.hint}</em> : null}
            </li>
          ))}
          {!shown.length && <li className="cmdk-empty">Nothing matches "{q}".</li>}
        </ul>
        <footer className="cmdk-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> choose
          </span>
          <span>
            <kbd>Enter</kbd> run
          </span>
          <span>
            <kbd>Space</kbd> run or pause the simulation
          </span>
          <span>
            <kbd>/</kbd> open this
          </span>
        </footer>
      </div>
    </div>
  );
}

/** Small icon button for the top bar to open Compare. */
export const CompareIcon = GitCompareArrows;

function useEsc(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
