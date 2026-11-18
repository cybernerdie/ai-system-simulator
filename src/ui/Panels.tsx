import { useState } from 'react';
import { Check, ChevronDown, Lightbulb, Trash2, TriangleAlert, X } from 'lucide-react';
import { COMPONENTS, MODEL_SPECS, PALETTE_ORDER, type ModelSize } from '../engine/components';
import { goalMet, type Pressure } from '../engine/pressures';
import type { Scenario } from '../engine/scenarios';
import type { ComponentType, ConfigValue, Goal, GoalMetric, Metrics, NodeConfig, RequestSample } from '../engine/types';
import { KindIcon } from './icons';
import { RequestsPanel } from './Requests';

/* ---------- formatting ---------- */

export const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0)}%`;
export const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);
export const usd = (v: number) => `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`;

export const METRIC_META: Record<GoalMetric, { label: string; fmt: (v: number) => string }> = {
  accuracy: { label: 'Accuracy', fmt: pct },
  hallucination: { label: 'Hallucination', fmt: pct },
  injection: { label: 'Injection success', fmt: pct },
  errorRate: { label: 'Errors', fmt: pct },
  costPer1k: { label: 'Cost per 1k', fmt: usd },
  p50: { label: 'Latency p50', fmt: ms },
  ttftP50: { label: 'First token', fmt: ms },
};

/* ---------- palette ---------- */

const GROUPS = ['Retrieval', 'Generation', 'Efficiency', 'Safety'] as const;

export function Palette({ onAdd }: { onAdd: (t: ComponentType) => void }) {
  return (
    <aside className="palette" aria-label="Components">
      {GROUPS.map((g) => (
        <section key={g}>
          <h3>{g}</h3>
          {PALETTE_ORDER.filter((t) => COMPONENTS[t].group === g).map((t) => (
            <button
              key={t}
              className="palette-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/aisim', t);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onAdd(t)}
              title={COMPONENTS[t].blurb}
            >
              <KindIcon kind={t} size="sm" />
              <span>{COMPONENTS[t].name}</span>
            </button>
          ))}
        </section>
      ))}
      <p className="palette-help">Click or drag onto the canvas. Connect from a node's right edge to the next node.</p>
    </aside>
  );
}

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
        <span>Press</span>
        <kbd>Space</kbd>
        <span>to send traffic through your design.</span>
      </div>
    );
  }
  const cells: { key: string; label: string; value: string; series: number[]; metric?: GoalMetric }[] = [
    { key: 'acc', label: 'Accuracy', value: pct(m.accuracy), series: history.map((h) => h.accuracy), metric: 'accuracy' },
    { key: 'hal', label: 'Hallucination', value: pct(m.hallucination), series: history.map((h) => h.hallucination), metric: 'hallucination' },
    { key: 'rec', label: 'Recall', value: m.recall == null ? '—' : pct(m.recall), series: history.map((h) => h.recall ?? 0) },
    { key: 'inj', label: 'Injection', value: pct(m.injection), series: history.map((h) => h.injection), metric: 'injection' },
    { key: 'err', label: 'Errors', value: pct(m.errorRate), series: history.map((h) => h.errorRate), metric: 'errorRate' },
    { key: 'p50', label: 'p50 latency', value: ms(m.p50), series: history.map((h) => h.p50), metric: 'p50' },
    { key: 'ttft', label: 'First token', value: ms(m.ttftP50), series: history.map((h) => h.ttftP50), metric: 'ttftP50' },
    { key: 'cost', label: 'Cost / 1k', value: usd(m.costPer1k), series: history.map((h) => h.costPer1k), metric: 'costPer1k' },
  ];
  return (
    <div className="telemetry" aria-live="polite">
      {cells.map((c) => {
        const goal = c.metric ? goals.find((g) => g.metric === c.metric) : undefined;
        const state = goal ? (goalMet(m, goal) ? 'met' : 'unmet') : '';
        return (
          <div key={c.key} className={`tele ${state}`}>
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
            <Spark values={c.series} />
          </div>
        );
      })}
    </div>
  );
}

/* ---------- binding pressure (floating window) ---------- */

export function PressureWindow({ p, running, hasRun }: { p: Pressure | null; running: boolean; hasRun: boolean }) {
  const state = !hasRun || !p ? 'idle' : p.key === 'stable' ? 'stable' : 'binding';
  return (
    <section className={`pressure-window is-${state}`} aria-live="polite">
      <header className="window-bar">
        <span className="lights" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="window-title">Binding pressure</span>
        {running && <span className="live-pill">Live</span>}
      </header>
      <div className="pressure-body">
        {state === 'idle' ? (
          <p className="pressure-why">Run the simulation. The one limit hurting your system most will show up here.</p>
        ) : (
          <>
            <p className="pressure-title">
              <span className="pressure-dot" aria-hidden />
              {p!.title}
            </p>
            <p className="pressure-why">{p!.why}</p>
            <p className="pressure-try">
              <Lightbulb size={14} strokeWidth={2.25} aria-hidden />
              <span>{p!.try}</span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- side panel ---------- */

export type Tab = 'mission' | 'requests' | 'component';

export function SidePanel({
  scenario,
  m,
  streak,
  needed,
  warnings,
  selected,
  onChange,
  onDelete,
  tab,
  setTab,
  running,
  picked,
  onPick,
}: {
  running: boolean;
  picked: RequestSample | null;
  onPick: (r: RequestSample | null) => void;
  scenario: Scenario;
  m: Metrics | null;
  streak: number;
  needed: number;
  warnings: string[];
  selected?: { id: string; kind: ComponentType; config: NodeConfig };
  onChange: (id: string, key: string, v: ConfigValue) => void;
  onDelete: (id: string) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  return (
    <aside className="side">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'mission'} onClick={() => setTab('mission')}>
          Mission
        </button>
        <button role="tab" aria-selected={tab === 'requests'} onClick={() => setTab('requests')}>
          Requests
          {m && m.samples.some((r) => r.outcome !== 'correct' && r.outcome !== 'blocked') && <span className="tab-dot" aria-hidden />}
        </button>
        <button role="tab" aria-selected={tab === 'component'} onClick={() => setTab('component')}>
          Component
        </button>
      </div>
      {tab === 'mission' ? (
        <Mission scenario={scenario} m={m} streak={streak} needed={needed} warnings={warnings} />
      ) : tab === 'requests' ? (
        <RequestsPanel samples={m?.samples ?? []} running={running} picked={picked} onPick={onPick} />
      ) : selected ? (
        <Inspector {...selected} onChange={onChange} onDelete={onDelete} />
      ) : (
        <p className="side-empty">Select a component on the canvas to tune it.</p>
      )}
    </aside>
  );
}

function Group({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="group">
      <button className="group-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        {count && <span className="group-count">{count}</span>}
        <ChevronDown size={14} className="group-chev" aria-hidden />
      </button>
      {open && <div className="group-body">{children}</div>}
    </section>
  );
}

function Mission({ scenario: s, m, streak, needed, warnings }: { scenario: Scenario; m: Metrics | null; streak: number; needed: number; warnings: string[] }) {
  const [hint, setHint] = useState(false);
  const met = m ? s.goals.filter((g) => goalMet(m, g)).length : 0;
  return (
    <div className="mission">
      <h2 className="mission-title">{s.title.replace(/^\d+ · /, '')}</h2>
      <p className="mission-tagline">{s.tagline}</p>
      <p className="mission-brief">{s.brief}</p>

      {s.goals.length > 0 && (
        <Group title="Goals" count={m ? `${met}/${s.goals.length}` : String(s.goals.length)}>
          <ul className="goals">
            {s.goals.map((g) => {
              const meta = METRIC_META[g.metric];
              const ok = m ? goalMet(m, g) : null;
              return (
                <li key={g.metric} className={ok === null ? '' : ok ? 'met' : 'unmet'}>
                  <span className="goal-icon" aria-hidden>
                    {ok === null ? <span className="goal-ring" /> : ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                  </span>
                  <span className="goal-text">
                    {meta.label} {g.op === '>=' ? 'at least' : 'at most'} {meta.fmt(g.value)}
                  </span>
                  {m && <span className="goal-now">{meta.fmt(m[g.metric])}</span>}
                </li>
              );
            })}
          </ul>
          {m && streak > 0 && (
            <div className="hold">
              <div className="hold-track">
                <div className="hold-bar" style={{ width: `${(streak / needed) * 100}%` }} />
              </div>
              <span>Holding all goals</span>
            </div>
          )}
        </Group>
      )}

      {warnings.length > 0 && (
        <Group title="Wiring" count={String(warnings.length)}>
          <ul className="warnings">
            {warnings.map((w) => (
              <li key={w}>
                <TriangleAlert size={14} aria-hidden />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Group>
      )}

      {s.goals.length > 0 &&
        (hint ? (
          <div className="hint">
            <Lightbulb size={14} aria-hidden />
            <span>{s.hint}</span>
          </div>
        ) : (
          <button className="btn btn-ghost btn-block" onClick={() => setHint(true)}>
            <Lightbulb size={14} aria-hidden /> Show a hint
          </button>
        ))}
    </div>
  );
}

function Inspector({
  id,
  kind,
  config,
  onChange,
  onDelete,
}: {
  id: string;
  kind: ComponentType;
  config: NodeConfig;
  onChange: (id: string, key: string, v: ConfigValue) => void;
  onDelete: (id: string) => void;
}) {
  const spec = COMPONENTS[kind];
  const size = config.size as ModelSize | undefined;
  return (
    <div className="inspector">
      <div className="inspector-head">
        <KindIcon kind={kind} size="lg" />
        <h2>{spec.name}</h2>
      </div>
      <p className="inspector-blurb">{spec.blurb}</p>
      {spec.fields.length > 0 && (
        <Group title="Settings">
          {spec.fields.map((f) => (
            <label key={f.key} className="field">
              <span className="field-label">
                {f.label}
                {f.kind === 'range' && <output>{String(config[f.key])}</output>}
              </span>
              {f.kind === 'select' && (
                <select value={String(config[f.key])} onChange={(e) => onChange(id, f.key, e.target.value)}>
                  {f.options!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {f.kind === 'range' && (
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={Number(config[f.key])}
                  onChange={(e) => onChange(id, f.key, Number(e.target.value))}
                />
              )}
              {f.kind === 'toggle' && (
                <span className="switch">
                  <input type="checkbox" role="switch" checked={config[f.key] === true} onChange={(e) => onChange(id, f.key, e.target.checked)} />
                  <span className="switch-track" aria-hidden />
                </span>
              )}
              <span className="field-help">{f.help}</span>
            </label>
          ))}
        </Group>
      )}
      {kind === 'llm' && size && (
        <Group title="Model card">
          <dl className="spec">
            <dt>Context window</dt>
            <dd>{(MODEL_SPECS[size].context / 1000).toFixed(0)}k tokens</dd>
            <dt>Rate limit</dt>
            <dd>{(MODEL_SPECS[size].tpm / 1_000_000).toFixed(1)}M tokens/min</dd>
            <dt>Input price</dt>
            <dd>${MODEL_SPECS[size].inPerM} / 1M tokens</dd>
            <dt>Output price</dt>
            <dd>${MODEL_SPECS[size].outPerM} / 1M tokens</dd>
          </dl>
        </Group>
      )}
      {kind !== 'users' && (
        <button className="btn btn-ghost btn-danger btn-block" onClick={() => onDelete(id)}>
          <Trash2 size={14} aria-hidden /> Remove {spec.name}
        </button>
      )}
    </div>
  );
}

/* ---------- dialogs ---------- */

const INTRO = [
  {
    title: 'Build an AI system. Watch where it breaks.',
    body: 'Every AI product is a pipeline of retrieval, models, caches, agents and guardrails. Each scenario hands you a broken one and realistic traffic. Your job is to fix it.',
  },
  {
    title: 'AI systems fail two ways at once',
    body: 'They hit load walls like rate limits, latency and cost. They also fail on quality: hallucinations, missed retrieval, prompt injection. The dock at the bottom tracks both.',
  },
  {
    title: 'Name the binding pressure',
    body: 'At any moment one limit hurts more than the rest. The floating window names it. Fix that one thing, run again, and find the next wall. That habit is the real skill.',
  },
  {
    title: 'How to play',
    body: 'Add components from the left and connect them by dragging between nodes. Select a node to tune it. Press Space to run. Hold every goal for a few seconds to clear the scenario.',
  },
];

export function IntroDialog({ step, setStep, onClose }: { step: number; setStep: (n: number) => void; onClose: () => void }) {
  const s = INTRO[step];
  const last = step === INTRO.length - 1;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="dialog">
        <div className="dialog-art" aria-hidden>
          {(['vector_db', 'llm', 'agent', 'input_guard'] as ComponentType[]).map((k) => (
            <KindIcon key={k} kind={k} size="lg" />
          ))}
        </div>
        <h2 id="intro-title">{s.title}</h2>
        <p>{s.body}</p>
        <div className="dialog-actions">
          <div className="steps" aria-label={`Step ${step + 1} of ${INTRO.length}`}>
            {INTRO.map((_, i) => (
              <i key={i} className={i === step ? 'on' : ''} />
            ))}
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Skip
          </button>
          <button className="btn btn-primary" autoFocus onClick={() => (last ? onClose() : setStep(step + 1))}>
            {last ? 'Start scenario 1' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WinDialog({ s, next, onNext, onStay }: { s: Scenario; next?: Scenario; onNext: () => void; onStay: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="win-title">
      <div className="dialog">
        <div className="win-badge" aria-hidden>
          <Check size={18} strokeWidth={3} />
        </div>
        <p className="dialog-kicker">Scenario cleared</p>
        <h2 id="win-title">{s.title.replace(/^\d+ · /, '')}</h2>
        <p>{s.lesson}</p>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onStay}>
            Keep experimenting
          </button>
          <button className="btn btn-primary" autoFocus onClick={onNext}>
            {next ? `Next: ${next.title.replace(/^\d+ · /, '')}` : 'Open the sandbox'}
          </button>
        </div>
      </div>
    </div>
  );
}
