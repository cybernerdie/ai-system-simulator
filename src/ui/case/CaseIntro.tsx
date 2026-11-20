import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Scenario } from '../../engine/levels/kit';
import { displayTitle } from '../../engine/levels/kit';
import { startingMetrics } from '../../engine/baseline';
import { caseLine, guessLine } from '../../content/guide';
import { speak } from '../audio/voice';
import { useEscape } from '../hooks/useEscape';
import { CaseChat } from './CaseChat';
import { goalParts } from './goalSentence';

/**
 * How a level opens: what went wrong for one customer and what the player has to change, then a
 * quick guess at the cause, so they think before they build.
 */
export function CaseIntro({ s, kicker, onStart }: { s: Scenario; kicker: string; onStart: () => void }) {
  const [guessing, setGuessing] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  useEscape(onStart);
  const parts = useMemo(() => goalParts(s.goals, startingMetrics(s), !!s.traffic.voice), [s]);
  const c = s.case;
  const gotIt = !!c && picked.some((i) => c.predict.options[i].right);
  const last = picked[picked.length - 1];

  useEffect(() => {
    const line = caseLine(s);
    if (line) void speak(line.id, line.text);
  }, [s]);

  const pick = (i: number) => {
    setPicked((p) => (p.includes(i) ? p : [...p, i]));
    const line = guessLine(s, i);
    if (line) void speak(line.id, line.text);
  };

  if (!c) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="case-title">
      <div className="dialog case-intro">
        <p className="case-level">{kicker}</p>
        <h2 id="case-title">{displayTitle(s)}</h2>

        {!guessing ? (
          <>
            <CaseChat chat={c.chat} />
            <p className="case-job">
              <strong>{c.job}</strong>{' '}
              {parts.map((p, i) => (
                <Fragment key={p.what}>
                  {i === 0 ? p.verb[0].toUpperCase() + p.verb.slice(1) : p.verb} {p.what} from {p.from} to <strong>{p.to}</strong>
                  {i < parts.length - 2 ? ', ' : i === parts.length - 2 ? ', and ' : '.'}
                </Fragment>
              ))}
            </p>
            <div className="case-actions">
              <button className="link-btn" onClick={onStart}>
                Skip
              </button>
              <button className="btn btn-primary" onClick={() => setGuessing(true)}>
                Why is this happening? <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="case-question">{c.predict.question}</p>
            <ul className="case-options">
              {c.predict.options.map((o, i) => {
                const chosen = picked.includes(i);
                return (
                  <li key={o.text}>
                    <button
                      className={`case-option${chosen ? (o.right ? ' is-right' : ' is-wrong') : ''}`}
                      disabled={gotIt && !chosen}
                      aria-pressed={chosen}
                      onClick={() => pick(i)}
                    >
                      {o.text}
                    </button>
                  </li>
                );
              })}
            </ul>
            {last !== undefined && (
              <p className="case-why" aria-live="polite">
                <strong>{c.predict.options[last].right ? 'Right.' : 'Not quite.'}</strong> {c.predict.options[last].why.replace(/^Right\.\s*/, '')}
                {!c.predict.options[last].right && !gotIt && ' Try another.'}
              </p>
            )}
            <div className="case-actions">
              <button className="link-btn" onClick={() => setGuessing(false)}>
                Back
              </button>
              <button className="btn btn-primary" disabled={!gotIt && picked.length === 0} onClick={onStart}>
                Start fixing <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
