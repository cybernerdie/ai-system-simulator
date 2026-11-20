import { useEffect } from 'react';
import { ArrowRight, Check, ClipboardCheck, Circle, Share2, Star } from 'lucide-react';
import { CaseChat } from '../case/CaseChat';
import { type Lesson } from '../../content/learn';
import type { StarResult, StarTips } from '../../engine/stars';
import type { Scenario } from '../../engine/levels/scenarios';
import type { QuizQuestion } from '../../content/quiz';
import { QuizBlock } from './QuizBlock';
import { displayTitle } from '../../engine/levels/kit';

export function WinDialog({
  s,
  kicker,
  result,
  tips,
  best,
  nextLabel,
  lesson,
  quiz,
  quizPick,
  onQuiz,
  onLesson,
  onNext,
  onStay,
  onShare,
  onReview,
  shareLabel = 'Share result',
  path,
}: {
  /** The route a request took through the winning design, by component name. */
  path?: string[];
  onReview?: () => void;
  s: Scenario;
  kicker: string;
  result: StarResult | null;
  /** For each missed star, one change that would have earned it. */
  tips?: StarTips | null;
  best: number;
  nextLabel: string;
  lesson?: Lesson;
  quiz?: QuizQuestion;
  quizPick: number | null;
  onQuiz: (i: number) => void;
  onLesson: (id: string) => void;
  onNext: () => void;
  onStay: () => void;
  onShare: () => void;
  shareLabel?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);
  const n = result?.stars ?? 1;
  const takeaway = lesson?.blocks.find((b) => b.kind === 'takeaway');
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="win-title">
      <div className="dialog win">
        <div className="win-stars" aria-label={`${n} of 3 stars`}>
          {[1, 2, 3].map((i) => (
            <Star key={i} size={i === 2 ? 40 : 32} className={i <= n ? 'on' : ''} style={{ animationDelay: `${0.15 + i * 0.18}s` }} aria-hidden />
          ))}
        </div>
        <p className="dialog-kicker">
          {result?.improved ? 'New best' : kicker}
          {best > n && ` · your best is ${best} stars`}
        </p>
        <h2 id="win-title">{displayTitle(s)}</h2>
        {s.case && (
          <section className="win-replay">
            <p className="win-replay-label">{s.case.chat.userLabel ? 'Same request, this time:' : 'Same customer, same question:'}</p>
            <CaseChat chat={s.case.chat} fixed compact />
            {path && path.length > 2 && (
              <p className="win-path" aria-label={`How it got there: ${path.join(', then ')}`}>
                {path.map((step, i) => (
                  <span key={`${step}-${i}`} className="win-path-step">
                    {i > 0 && <ArrowRight size={11} aria-hidden />} {step}
                  </span>
                ))}
              </p>
            )}
          </section>
        )}
        {result && (
          <ul className="win-criteria">
            <li className="is-met">
              <Check size={14} strokeWidth={3} aria-hidden />
              <span>Cleared every goal</span>
            </li>
            <li className={result.underBudget ? 'is-met' : ''}>
              {result.underBudget ? <Check size={14} strokeWidth={3} aria-hidden /> : <Circle size={14} aria-hidden />}
              <span>
                Within budget: ${result.cost.toFixed(2)} per 1k requests <em>(par ${result.par.cost.toFixed(2)})</em>
                {!result.underBudget && tips?.budget && <small className="win-tip">{tips.budget}</small>}
              </span>
            </li>
            <li className={result.lean ? 'is-met' : ''}>
              {result.lean ? <Check size={14} strokeWidth={3} aria-hidden /> : <Circle size={14} aria-hidden />}
              <span>
                Lean build: {result.parts} component{result.parts === 1 ? '' : 's'} <em>(par {result.par.parts})</em>
                {!result.lean && tips?.lean && <small className="win-tip">{tips.lean}</small>}
              </span>
            </li>
          </ul>
        )}
        {onReview && (
          <button className="link-btn win-review" onClick={onReview}>
            <ClipboardCheck size={13} aria-hidden /> See the full review of your design
          </button>
        )}
        {quiz && <QuizBlock q={quiz} picked={quizPick} onPick={onQuiz} />}
        {(!quiz || quizPick !== null) && s.case && (
          <div className="win-named">
            <strong>What you just built: {s.case.named.term}</strong>
            <p>{s.case.named.text}</p>
            {lesson && (
              <button className="link-btn" onClick={() => onLesson(lesson.id)}>
                Read the lesson: {lesson.title}
              </button>
            )}
          </div>
        )}
        {(!quiz || quizPick !== null) && s.lesson && !s.case && (
          <div className="win-learned">
            <span className="win-learned-label">What you just learned</span>
            <p>{takeaway?.kind === 'takeaway' ? takeaway.text : s.lesson.split(/(?<=[.!?])\s/)[0]}</p>
            <p className="win-learned-more">{s.lesson}</p>
            {lesson && (
              <button className="link-btn" onClick={() => onLesson(lesson.id)}>
                Read the lesson: {lesson.title}
              </button>
            )}
          </div>
        )}
        <div className="dialog-actions win-actions">
          <button className="btn btn-ghost win-share" onClick={onShare}>
            <Share2 size={14} aria-hidden /> {shareLabel}
          </button>
          <button className="btn btn-ghost" onClick={onStay}>
            {n < 3 ? 'Go for 3 stars' : 'Keep experimenting'}
          </button>
          <button className="btn btn-primary" autoFocus={!quiz || quizPick !== null} onClick={onNext}>
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
