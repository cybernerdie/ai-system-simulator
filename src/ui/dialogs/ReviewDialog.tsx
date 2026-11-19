import {  Check, X } from 'lucide-react';
import { useEscape } from '../hooks/useEscape';

/* ---------- design review ---------- */

export function ReviewDialog({ review, onFocusNode, onClose }: { review: import('../../engine/review').Review | null; onFocusNode: (id: string) => void; onClose: () => void }) {
  useEscape(onClose);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="review-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog review">
        <button className="btn btn-ghost picker-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        {!review ? (
          <p className="review-loading" role="status">
            Reviewing your design: running it with and without each component…
          </p>
        ) : (
          <>
            <header className="review-head">
              <span className={`review-grade is-${review.grade.toLowerCase()}`} aria-label={`Grade ${review.grade}`}>
                {review.grade}
              </span>
              <div>
                <p className="dialog-kicker">
                  Design review{review.goalsTotal ? ` · ${review.goalsMet}/${review.goalsTotal} goals` : ''} · {review.score}/100
                </p>
                <h2 id="review-title">{review.summary}</h2>
              </div>
            </header>
            {review.scores.length > 0 && (
              <ul className="review-scores">
                {review.scores.map((s) => (
                  <li key={s.key}>
                    <span className="review-score-label">{s.label}</span>
                    <span className="review-bar" aria-hidden>
                      <i className={s.score >= 80 ? 'is-ok' : s.score >= 60 ? 'is-warn' : 'is-hot'} style={{ width: `${s.score}%` }} />
                    </span>
                    <em>{s.score}</em>
                    <span className="review-score-note">{s.note}</span>
                  </li>
                ))}
              </ul>
            )}
            <ul className="review-notes">
              {review.notes.map((n, i) => (
                <li key={i} className={`review-note is-${n.tone}`}>
                  <span className="review-note-icon" aria-hidden>
                    {n.tone === 'good' ? <Check size={13} strokeWidth={3} /> : n.tone === 'bad' ? <X size={13} strokeWidth={3} /> : '!'}
                  </span>
                  <div>
                    <strong>{n.title}</strong>
                    <span>{n.text}</span>
                    {n.nodeId && (
                      <button className="link-btn review-show" onClick={() => onFocusNode(n.nodeId!)}>
                        Show it on the canvas
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="dialog-note review-how">Every note comes from the simulation: it reruns your design on the same traffic, with and without each component, and compares it with the level's reference design. No AI writes this.</p>
          </>
        )}
      </div>
    </div>
  );
}
