import { COMPONENTS, MODEL_SPECS, PALETTE_ORDER, type ModelSize } from '../engine/components';
import { goalMet, type Pressure } from '../engine/pressures';
import type { Scenario } from '../engine/scenarios';
import type { ComponentType, ConfigValue, Goal, GoalMetric, Metrics, NodeConfig } from '../engine/types';

/* ---------- formatting ---------- */

export const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0)}%`;
export const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);
export const usd = (v: number) => `$${v < 10 ? v.toFixed(2) : v.toFixed(0)}`;

export const METRIC_META: Record<GoalMetric, { label: string; fmt: (v: number) => string }> = {
  accuracy: { label: 'Accuracy', fmt: pct },
  hallucination: { label: 'Hallucination', fmt: pct },
  injection: { label: 'Injection success', fmt: pct },
  errorRate: { label: 'Errors (429 / overflow)', fmt: pct },
  costPer1k: { label: 'Cost per 1k requests', fmt: usd },
  p50: { label: 'Latency p50', fmt: ms },
  ttftP50: { label: 'First token p50', fmt: ms },
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
              style={{ ['--kind' as string]: COMPONENTS[t].color }}
            >
              <span className="palette-badge">{COMPONENTS[t].short}</span>
              {COMPONENTS[t].name}
            </button>
          ))}
        </section>
      ))}
      <p className="palette-help">
        Click or drag to add. Drag from a node's right dot to another node to connect. Click a node or arrow and press Delete to remove it.
      </p>
    </aside>
  );
}

/* ---------- metrics bar ---------- */

export function MetricsBar({ m, goals }: { m: Metrics | null; goals: Goal[] }) {
  const cells: { label: string; value: string; metric?: GoalMetric }[] = m
    ? [
        { label: 'Accuracy', value: pct(m.accuracy), metric: 'accuracy' },
        { label: 'Hallucination', value: pct(m.hallucination), metric: 'hallucination' },
        { label: 'Retrieval recall', value: m.recall == null ? '—' : pct(m.recall) },
        { label: 'Injection success', value: pct(m.injection), metric: 'injection' },
        { label: 'Errors', value: pct(m.errorRate), metric: 'errorRate' },
        { label: 'p50 / p99', value: `${ms(m.p50)} / ${ms(m.p99)}`, metric: 'p50' },
        { label: 'First token', value: ms(m.ttftP50), metric: 'ttftP50' },
        { label: 'Cost / 1k req', value: usd(m.costPer1k), metric: 'costPer1k' },
      ]
    : [];
  return (
    <footer className="metrics" aria-live="polite">
      {!m && <span className="metrics-empty">Press Run to push traffic through your design.</span>}
      {cells.map((c) => {
        const goal = c.metric ? goals.find((g) => g.metric === c.metric) : undefined;
        const state = goal && m ? (goalMet(m, goal) ? 'met' : 'unmet') : '';
        return (
          <div key={c.label} className={`metric ${state}`}>
            <div className="metric-label">{c.label}</div>
            <div className="metric-value">{c.value}</div>
          </div>
        );
      })}
    </footer>
  );
}

/* ---------- right column ---------- */

export function PressureCard({ p, running, warnings }: { p: Pressure | null; running: boolean; warnings: string[] }) {
  return (
    <section className={`pressure ${p && p.key !== 'stable' ? 'is-binding' : ''}`}>
      <h2 className="pressure-kicker">Binding pressure</h2>
      {!running || !p ? (
        <p className="pressure-why">Run the simulation. The one limit hurting you most will show up here.</p>
      ) : (
        <>
          <p className="pressure-title">{p.title}</p>
          <p className="pressure-why">{p.why}</p>
          <p className="pressure-try">
            <strong>Try:</strong> {p.try}
          </p>
        </>
      )}
      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ScenarioBrief({
  s,
  m,
  streak,
  needed,
  showHint,
  onHint,
}: {
  s: Scenario;
  m: Metrics | null;
  streak: number;
  needed: number;
  showHint: boolean;
  onHint: () => void;
}) {
  return (
    <section className="brief">
      <h2>{s.tagline}</h2>
      <p>{s.brief}</p>
      {s.goals.length > 0 && (
        <>
          <ul className="goals">
            {s.goals.map((g) => {
              const meta = METRIC_META[g.metric];
              const met = m ? goalMet(m, g) : false;
              return (
                <li key={g.metric} className={m ? (met ? 'met' : 'unmet') : ''}>
                  <span className="goal-check" aria-hidden>{m ? (met ? '✓' : '✕') : '○'}</span>
                  <span>
                    {meta.label} {g.op === '>=' ? 'at least' : 'at most'} {meta.fmt(g.value)}
                  </span>
                  {m && <span className="goal-now">{meta.fmt(m[g.metric])}</span>}
                </li>
              );
            })}
          </ul>
          {m && streak > 0 && (
            <div className="hold" aria-label="Holding all goals">
              <div className="hold-bar" style={{ width: `${(streak / needed) * 100}%` }} />
              <span>Holding all goals… {streak}/{needed}</span>
            </div>
          )}
          {showHint ? <p className="hint">{s.hint}</p> : <button className="link" onClick={onHint}>Show a hint</button>}
        </>
      )}
    </section>
  );
}

export function Inspector({
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
    <section className="inspector" style={{ ['--kind' as string]: spec.color }}>
      <h2>{spec.name}</h2>
      <p className="inspector-blurb">{spec.blurb}</p>
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
            <input type="checkbox" checked={config[f.key] === true} onChange={(e) => onChange(id, f.key, e.target.checked)} />
          )}
          <span className="field-help">{f.help}</span>
        </label>
      ))}
      {kind === 'llm' && size && (
        <dl className="spec">
          <dt>Context window</dt>
          <dd>{(MODEL_SPECS[size].context / 1000).toFixed(0)}k tokens</dd>
          <dt>Rate limit</dt>
          <dd>{(MODEL_SPECS[size].tpm / 1_000_000).toFixed(1)}M tokens/min</dd>
          <dt>Price (in / out)</dt>
          <dd>
            ${MODEL_SPECS[size].inPerM} / ${MODEL_SPECS[size].outPerM} per 1M
          </dd>
        </dl>
      )}
      {kind !== 'users' && (
        <button className="danger" onClick={() => onDelete(id)}>
          Remove {spec.name}
        </button>
      )}
    </section>
  );
}

/* ---------- dialogs ---------- */

const INTRO = [
  {
    title: 'Build an AI system. Watch where it breaks.',
    body: 'Every AI product is a pipeline: retrieval, models, caches, agents, guardrails. Each scenario gives you a broken one and real-shaped traffic. Your job is to fix it.',
  },
  {
    title: 'AI systems fail two ways',
    body: 'Like any system, they hit load walls: rate limits, latency, cost. But they also fail on quality: hallucinations, bad retrieval, prompt injection. The bar at the bottom tracks both.',
  },
  {
    title: 'Name the binding pressure',
    body: 'At any moment, one limit is hurting you most. The panel on the right names it. Fix that one thing, run again, and find the next wall. That habit is the actual skill.',
  },
  {
    title: 'How to play',
    body: 'Add components from the left. Connect them by dragging from one node\'s right dot to the next. Click a node to tune it. Press Run (or Space). Hold every goal for a few seconds to clear the scenario.',
  },
];

export function IntroDialog({ step, setStep, onClose }: { step: number; setStep: (n: number) => void; onClose: () => void }) {
  const s = INTRO[step];
  const last = step === INTRO.length - 1;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="dialog">
        <p className="dialog-step">
          {step + 1} of {INTRO.length}
        </p>
        <h2 id="intro-title">{s.title}</h2>
        <p>{s.body}</p>
        <div className="dialog-actions">
          <button className="link" onClick={onClose}>
            Skip
          </button>
          {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
          <button className="primary" autoFocus onClick={() => (last ? onClose() : setStep(step + 1))}>
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
      <div className="dialog win">
        <p className="dialog-step">Scenario cleared</p>
        <h2 id="win-title">{s.title.replace(/^\d+ · /, '')}</h2>
        <p>{s.lesson}</p>
        <div className="dialog-actions">
          <button className="link" onClick={onStay}>
            Keep experimenting
          </button>
          <button className="primary" autoFocus onClick={onNext}>
            {next ? `Next: ${next.title.replace(/^\d+ · /, '')}` : 'Open the sandbox'}
          </button>
        </div>
      </div>
    </div>
  );
}
