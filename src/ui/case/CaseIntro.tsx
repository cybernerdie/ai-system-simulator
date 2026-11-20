import { useMemo, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import type { Scenario } from '../../engine/levels/kit';
import { displayTitle } from '../../engine/levels/kit';
import { startingMetrics } from '../../engine/baseline';
import { useEscape } from '../hooks/useEscape';
import { CaseChat } from './CaseChat';
import { GoalMeters } from './GoalMeters';

const STEPS = ['The problem', 'Your guess', 'Fix it'];

function Stepper({ at }: { at: number }) {
  return (
    <ol className="case-steps" aria-label="Level steps">
      {STEPS.map((label, i) => (
        <li key={label} className={i < at ? 'is-done' : i === at ? 'is-current' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="case-step-dot" aria-hidden>
            {i < at ? <Check size={10} strokeWidth={3.5} /> : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

/**
 * How a level opens: an escalated ticket showing what went wrong for one customer, the job and how far
 * the system is from it, then a quick guess at the cause, so the player thinks before they build.
 */
export function CaseIntro({ s, kicker, onStart }: { s: Scenario & { case: NonNullable<Scenario['case']> }; kicker: string; onStart: () => void }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [picked, setPicked] = useState<number[]>([]);
  useEscape(onStart);
  const c = s.case;
  const now = useMemo(() => startingMetrics(s), [s]);
  const gotIt = picked.some((i) => c.predict.options[i].right);
  const last = picked[picked.length - 1];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="case-title">
      <div className="dialog case-intro">
        <Stepper at={step} />
        <p className="case-level">{kicker}</p>
        <h2 id="case-title">{displayTitle(s)}</h2>

        {step === 0 ? (
          <>
            <p className="case-lede">A customer complaint has been escalated to you.</p>
            <CaseChat chat={c.chat} />
            <section className="case-job" aria-labelledby="case-job-title">
              <h3 id="case-job-title">Your job</h3>
              <p className="case-job-text">{c.job}</p>
              <GoalMeters goals={s.goals} now={now} voice={!!s.traffic.voice} />
              <p className="case-job-note">Hold every goal for a few seconds to clear the level.</p>
            </section>
            <div className="case-actions">
              <button className="btn btn-ghost" onClick={onStart}>
                Skip to the level
              </button>
              <button className="btn btn-primary" onClick={() => setStep(1)}>
                Why is this happening? <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="case-question">{c.predict.question}</p>
            <div className="case-options" role="group" aria-label="Pick the most likely cause">
              {c.predict.options.map((o, i) => {
                const chosen = picked.includes(i);
                return (
                  <button
                    key={o.text}
                    className={`case-option${chosen ? (o.right ? ' is-right' : ' is-wrong') : ''}`}
                    disabled={gotIt && !chosen}
                    aria-pressed={chosen}
                    onClick={() => setPicked((p) => (p.includes(i) ? p : [...p, i]))}
                  >
                    <span className="case-option-mark" aria-hidden>
                      {chosen ? o.right ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} /> : String.fromCharCode(65 + i)}
                    </span>
                    <span>{o.text}</span>
                  </button>
                );
              })}
            </div>
            {last !== undefined && (
              <p className={`case-why ${c.predict.options[last].right ? 'is-right' : 'is-wrong'}`} aria-live="polite">
                {c.predict.options[last].why}
                {!c.predict.options[last].right && !gotIt && ' Try another answer.'}
              </p>
            )}
            <div className="case-actions">
              <button className="btn btn-ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="btn btn-primary" autoFocus={gotIt} disabled={!gotIt && picked.length === 0} onClick={onStart}>
                Start fixing <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
