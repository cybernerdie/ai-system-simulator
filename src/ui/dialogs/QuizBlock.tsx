import {  Check, X } from 'lucide-react';
import type { QuizQuestion } from '../../content/quiz';

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
