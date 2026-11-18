import { useMemo, useState } from 'react';
import { ArrowLeft, Pause } from 'lucide-react';
import { CAUSE_TEXT } from '../engine/simulate';
import type { Outcome, RequestSample } from '../engine/types';
import { KindIcon } from './icons';

export const OUTCOME_META: Record<Outcome, { label: string; tone: 'ok' | 'bad' | 'warn' }> = {
  correct: { label: 'Correct', tone: 'ok' },
  blocked: { label: 'Blocked attack', tone: 'ok' },
  declined: { label: "Said I don't know", tone: 'warn' },
  hallucinated: { label: 'Hallucinated', tone: 'bad' },
  injected: { label: 'Injected', tone: 'bad' },
  rate_limited: { label: '429 rate limited', tone: 'bad' },
  overflow: { label: 'Context overflow', tone: 'bad' },
};

const KIND_LABEL: Record<RequestSample['kind'], string> = {
  knowledge: 'Docs question',
  exact: 'Exact-term lookup',
  tool: 'Needs an action',
  attack: 'Attack',
  general: 'General',
  memory: 'Refers to earlier chat',
};

const fmtMs = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);
const fmtUsd = (v: number) => (v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`);

function verdict(r: RequestSample) {
  if (r.outcome === 'correct') return 'Answered correctly.';
  if (r.outcome === 'blocked') return 'The attack was stopped before it did damage.';
  if (r.outcome === 'declined' && r.cause && r.cause !== 'guard_false_positive')
    return `${CAUSE_TEXT[r.cause]} The model admitted it didn't know, which is safer than guessing but still unhelpful.`;
  return r.cause ? CAUSE_TEXT[r.cause] : '';
}

export function RequestsPanel({
  samples,
  running,
  picked,
  onPick,
}: {
  samples: RequestSample[];
  running: boolean;
  picked: RequestSample | null;
  onPick: (r: RequestSample | null) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'failed'>('failed');
  const list = useMemo(
    () => samples.filter((r) => filter === 'all' || OUTCOME_META[r.outcome].tone !== 'ok'),
    [samples, filter],
  );

  if (picked) return <RequestDetail r={picked} onBack={() => onPick(null)} />;

  return (
    <div className="requests">
      <div className="requests-head">
        <div className="seg" role="group" aria-label="Filter requests">
          <button aria-pressed={filter === 'failed'} onClick={() => setFilter('failed')}>
            Failed
          </button>
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </button>
        </div>
        <span className="requests-note">{running ? 'Sampled live' : samples.length ? 'Last sample' : ''}</span>
      </div>
      {!samples.length ? (
        <p className="side-empty">Run the simulation to see individual requests flow through your design.</p>
      ) : !list.length ? (
        <p className="side-empty">No failures in this sample. Push more traffic to find some.</p>
      ) : (
        <ul className="req-list">
          {list.map((r) => {
            const meta = OUTCOME_META[r.outcome];
            return (
              <li key={r.id}>
                <button className="req-row" onClick={() => onPick(r)}>
                  <span className={`req-dot tone-${meta.tone}`} aria-hidden />
                  <span className="req-main">
                    <span className="req-q">{r.question}</span>
                    <span className="req-meta">
                      <span className={`tone-text-${meta.tone}`}>{meta.label}</span> · {KIND_LABEL[r.kind]}
                    </span>
                  </span>
                  <span className="req-ms">{fmtMs(r.latency)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RequestDetail({ r, onBack }: { r: RequestSample; onBack: () => void }) {
  const meta = OUTCOME_META[r.outcome];
  return (
    <div className="req-detail">
      <button className="btn btn-ghost req-back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden /> All requests
      </button>
      <p className="req-kind">
        <Pause size={11} aria-hidden /> Frozen snapshot · {KIND_LABEL[r.kind]}
      </p>
      <h2 className="req-title">“{r.question}”</h2>
      <div className={`req-verdict tone-${meta.tone}`}>
        <strong>{meta.label}</strong>
        <span>{verdict(r)}</span>
      </div>
      <ol className="timeline">
        {r.steps.map((s, i) => (
          <li key={i} className={`tl tone-${s.tone ?? 'neutral'}`}>
            <KindIcon kind={s.kind} size="sm" />
            <span className="tl-text">{s.text}</span>
            {s.ms !== undefined && <span className="tl-ms">{fmtMs(s.ms)}</span>}
          </li>
        ))}
      </ol>
      <dl className="spec req-totals">
        <dt>Total latency</dt>
        <dd>{fmtMs(r.latency)}</dd>
        <dt>Cost</dt>
        <dd>{fmtUsd(r.cost)}</dd>
      </dl>
    </div>
  );
}
