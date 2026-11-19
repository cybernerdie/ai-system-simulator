import { useEffect } from 'react';
import { Check, ClipboardCheck, Circle, Share2, Star } from 'lucide-react';
import { type Lesson } from '../../content/learn';
import type { StarResult } from '../../engine/stars';
import type { Scenario } from '../../engine/levels/scenarios';
import type { QuizQuestion } from '../../content/quiz';
import { QuizBlock } from './QuizBlock';

/* ---------- dialogs ---------- */

export function WinDialog({
  s,
  kicker,
  result,
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
}: {
  onReview?: () => void;
  s: Scenario;
  kicker: string;
  result: StarResult | null;
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
        <h2 id="win-title">{s.title.replace(/^\d+ · /, '')}</h2>
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
              </span>
            </li>
            <li className={result.lean ? 'is-met' : ''}>
              {result.lean ? <Check size={14} strokeWidth={3} aria-hidden /> : <Circle size={14} aria-hidden />}
              <span>
                Lean build: {result.parts} component{result.parts === 1 ? '' : 's'} <em>(par {result.par.parts})</em>
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
        {(!quiz || quizPick !== null) && s.lesson && (
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
