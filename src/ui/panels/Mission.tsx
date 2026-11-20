import { useState } from 'react';
import { Check, ClipboardCheck, Lightbulb, MessagesSquare, TriangleAlert, X } from 'lucide-react';
import { QUALITY_METRICS, goalMet } from '../../engine/pressures';
import type { Scenario } from '../../engine/levels/scenarios';
import type { Metrics, TrafficProfile } from '../../engine/types';
import { METRIC_META, goalText } from '../../lib/format';
import { CaseChat } from '../case/CaseChat';
import { Group } from './Group';
import { displayTitle } from '../../engine/levels/kit';

const MIX_FIELDS: { key: keyof TrafficProfile; label: string; help: string; max?: number; step?: number; unit?: 'pct' | 'turns' }[] = [
  { key: 'kbShare', label: 'Questions about your docs', help: 'Need your private knowledge base to answer.' },
  { key: 'exactTermShare', label: 'Exact-term lookups', help: 'Of the docs questions, how many hinge on codes, SKUs or names.' },
  { key: 'toolShare', label: 'Need an action', help: 'Look up an order, issue a refund: needs tools.' },
  { key: 'adversarialShare', label: 'Attacks', help: 'Prompt injection and jailbreak attempts.' },
  { key: 'easyShare', label: 'Easy requests', help: 'A small model handles these fine.' },
  { key: 'repeatShare', label: 'Repeat questions', help: 'Near-duplicates of something already asked.' },
  { key: 'chatTurns', label: 'Average chat length', help: 'Earlier turns per conversation. 0 means one-off questions.', max: 60, step: 1, unit: 'turns' },
  { key: 'recallShare', label: 'Refers back to earlier chat', help: 'Messages that depend on something said before.' },
];

function TrafficMix({ traffic, onMix, onReset }: { traffic: TrafficProfile; onMix: (p: Partial<TrafficProfile>) => void; onReset: () => void }) {
  return (
    <Group title="Traffic mix">
      {MIX_FIELDS.map((f) => {
        const v = Number(traffic[f.key] ?? 0);
        const isTurns = f.unit === 'turns';
        return (
          <label key={f.key} className="field field-compact">
            <span className="field-label">
              {f.label}
              <output>{isTurns ? `${v}` : `${Math.round(v * 100)}%`}</output>
            </span>
            <input type="range" min={0} max={f.max ?? 1} step={f.step ?? 0.05} value={v} onChange={(e) => onMix({ [f.key]: Number(e.target.value) } as Partial<TrafficProfile>)} />
            <span className="field-help">{f.help}</span>
          </label>
        );
      })}
      <button className="btn btn-ghost btn-block" onClick={onReset}>
        Reset to the default mix
      </button>
    </Group>
  );
}

export function Mission({
  scenario: s,
  m,
  streak,
  needed,
  warnings,
  traffic,
  onMix,
  onResetMix,
  onReview,
  onShowCase,
}: {
  onShowCase?: () => void;
  scenario: Scenario;
  m: Metrics | null;
  streak: number;
  needed: number;
  warnings: string[];
  traffic: TrafficProfile;
  onMix: (p: Partial<TrafficProfile>) => void;
  onResetMix: () => void;
  onReview?: () => void;
}) {
  const [hint, setHint] = useState(false);
  const met = m ? s.goals.filter((g) => goalMet(m, g)).length : 0;
  return (
    <div className="mission">
      <h2 className="mission-title">{displayTitle(s)}</h2>
      {s.case ? (
        <>
          <p className="mission-job">{s.case.job}</p>
          <CaseChat chat={s.case.chat} compact />
          {onShowCase && (
            <button className="link-btn mission-case-link" onClick={onShowCase}>
              <MessagesSquare size={13} aria-hidden /> See the problem again
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mission-tagline">{s.tagline}</p>
          <p className="mission-brief">{s.brief}</p>
        </>
      )}

      {s.goals.length > 0 && (
        <Group title="Goals" count={m ? `${met}/${s.goals.length}` : String(s.goals.length)}>
          <ul className="goals">
            {s.goals.map((g) => {
              const meta = METRIC_META[g.metric];
              const unknown = !!m && ((!m.qualityVisible && QUALITY_METRICS.includes(g.metric)) || (!m.fairnessVisible && g.metric === 'fairnessGap'));
              const ok = m && !unknown ? goalMet(m, g) : null;
              return (
                <li key={g.metric} className={unknown ? 'unknown' : ok === null ? '' : ok ? 'met' : 'unmet'}>
                  <span className="goal-icon" aria-hidden>
                    {unknown ? '?' : ok === null ? <span className="goal-ring" /> : ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
                  </span>
                  <span className="goal-text">
                    {goalText(g, !!s.traffic.voice)}
                    {meta.term && <span className="goal-term">{meta.term}</span>}
                  </span>
                  {m && <span className="goal-now">{unknown ? 'unknown' : meta.fmt(m[g.metric])}</span>}
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

      {s.goals.length === 0 && <TrafficMix traffic={traffic} onMix={onMix} onReset={onResetMix} />}

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
      {onReview && (
        <button className="btn btn-ghost btn-block review-btn" onClick={onReview}>
          <ClipboardCheck size={14} aria-hidden /> Review my design
        </button>
      )}
    </div>
  );
}
