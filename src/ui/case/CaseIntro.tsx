import { useState } from 'react';
import { ArrowRight, Check, Target, X } from 'lucide-react';
import type { Scenario } from '../../engine/levels/kit';
import { displayTitle } from '../../engine/levels/kit';
import { goalText } from '../../lib/format';
import { useEscape } from '../hooks/useEscape';
import { CaseChat } from './CaseChat';

/**
 * How a level opens: what went wrong for one customer, the job in plain words, then a quick
 * guess at the cause, so the player thinks before they build.
 */
export function CaseIntro({ s, kicker, onStart }: { s: Scenario & { case: NonNullable<Scenario['case']> }; kicker: string; onStart: () => void }) {
  const [step, setStep] = useState<'case' | 'predict'>('case');
  const [picked, setPicked] = useState<number[]>([]);
  useEscape(onStart);
  const c = s.case;
  const gotIt = picked.some((i) => c.predict.options[i].right);
  const last = picked[picked.length - 1];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="case-title">
      <div className="dialog case-intro">
        <p className="dialog-kicker">
          {kicker} · {step === 'case' ? 'The problem' : 'Your guess'}
        </p>
        <h2 id="case-title">{displayTitle(s)}</h2>

        {step === 'case' ? (
          <>
            <CaseChat chat={c.chat} />
            <section className="case-job">
              <p className="case-job-label">
                <Target size={14} aria-hidden /> Your job
              </p>
              <p className="case-job-text">{c.job}</p>
              <p className="case-goals-label">You clear the level when these stay true for a few seconds:</p>
              <ul className="case-goals">
                {s.goals.map((g) => (
                  <li key={g.metric}>{goalText(g, !!s.traffic.voice)}</li>
                ))}
              </ul>
            </section>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={onStart}>
                Skip to the level
              </button>
              <button className="btn btn-primary" autoFocus onClick={() => setStep('predict')}>
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
            <div className="dialog-actions">
              {!gotIt && (
                <button className="btn btn-ghost" onClick={onStart}>
                  Skip
                </button>
              )}
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
