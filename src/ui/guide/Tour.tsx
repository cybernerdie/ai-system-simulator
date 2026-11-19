import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { measure, place, type Rect } from './spotlight';

const MOBILE = 900;

/**
 * Guided product tour (coach marks). Each step spotlights one part of the UI
 * and explains it in a small card placed beside it.
 */

export interface TourStep {
  /** CSS selector. If it matches several elements, the spotlight covers all of them. */
  target: string;
  title: string;
  body: string;
  /** Called when the step becomes active (e.g. start the simulation, switch a tab). */
  onEnter?: () => void;
}

export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [dockTop, setDockTop] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(steps.length - 1, n))), [steps.length]);

  // enter hook + bring the target into view (mobile stacks everything)
  useEffect(() => {
    step.onEnter?.();
    const el = document.querySelector<HTMLElement>(step.target);
    el?.scrollIntoView({ block: window.innerWidth > MOBILE ? 'center' : 'start', behavior: 'smooth' });
    card.current?.focus();
  }, [step]);

  // follow the target as layout changes (metrics appearing, scrolling, resizing)
  useLayoutEffect(() => {
    let raf = 0;
    let lastKey = '';
    const tick = () => {
      const r = measure(step.target);
      const h = card.current?.offsetHeight ?? 180;
      const key = r ? `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)},${h},${window.innerWidth}` : 'none';
      if (key !== lastKey) {
        lastKey = key;
        setRect(r);
        setPos(r && window.innerWidth > MOBILE ? place(r, h) : null);
        // phones: dock the card to whichever edge the spotlight isn't near
        setDockTop(!!r && r.top + r.height / 2 > window.innerHeight * 0.55);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight' || (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON')) {
        e.preventDefault();
        if (last) onClose();
        else go(i + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(i - 1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [go, i, last, onClose]);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {/* catches clicks so the app underneath stays still during the tour */}
      <div className="tour-blocker" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div className="tour-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden />
      ) : (
        <div className="tour-scrim" aria-hidden />
      )}
      <div ref={card} tabIndex={-1} className={`tour-card${pos ? '' : dockTop ? ' is-docked is-top' : ' is-docked'}`} style={pos ? { top: pos.top, left: pos.left } : undefined}>
        <div className="tour-head">
          <span className="tour-count">
            {i + 1} of {steps.length}
          </span>
          <button className="tour-close" onClick={onClose} aria-label="End tour">
            <X size={14} aria-hidden />
          </button>
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-actions">
          <div className="tour-dots" aria-hidden>
            {steps.map((_, n) => (
              <i key={n} className={n === i ? 'on' : n < i ? 'done' : ''} />
            ))}
          </div>
          {i > 0 && (
            <button className="btn btn-ghost btn-icon" onClick={() => go(i - 1)} aria-label="Previous step">
              <ArrowLeft size={14} aria-hidden />
            </button>
          )}
          <button className="btn btn-primary" onClick={() => (last ? onClose() : go(i + 1))}>
            {last ? 'Start building' : 'Next'}
            {!last && <ArrowRight size={14} aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
