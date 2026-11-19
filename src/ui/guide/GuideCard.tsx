import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { measure, place } from './spotlight';

/* ---------- guide card: coaching, hints, nudges ---------- */

export interface GuideCardProps {
  /** element(s) to glow and sit next to */
  target?: string;
  kicker: string;
  title?: string;
  text: string;
  /** buttons on the card */
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  onClose?: () => void;
  closeLabel?: string;
}

/**
 * A speech-bubble style card that points at part of the screen and makes it glow.
 * Unlike the tour it doesn't block the app: you act, and it moves on.
 */
export function GuideCard({ target, kicker, title, text, actions, onClose, closeLabel = 'Skip' }: GuideCardProps) {
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [dockTop, setDockTop] = useState(false);

  // glow the target and bring it into view
  useEffect(() => {
    if (!target) return;
    const els = [...document.querySelectorAll<HTMLElement>(target)];
    els.forEach((el) => el.classList.add('coach-glow'));
    els[0]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    return () => els.forEach((el) => el.classList.remove('coach-glow'));
  }, [target]);

  useLayoutEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      const r = target ? measure(target) : null;
      const h = card.current?.offsetHeight ?? 160;
      const desktop = window.innerWidth > 900;
      const key = r ? `${r.top | 0},${r.left | 0},${r.width | 0},${r.height | 0},${h},${window.innerWidth}` : `none,${h},${window.innerWidth}`;
      if (key !== last) {
        last = key;
        setPos(r && desktop ? place(r, h) : null);
        setDockTop(!!r && r.top + r.height / 2 > window.innerHeight * 0.55);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <div
      ref={card}
      className={`guide-card${pos ? '' : dockTop ? ' is-docked is-top' : ' is-docked'}`}
      style={pos ? { top: pos.top, left: pos.left } : undefined}
      role="status"
      aria-live="polite"
    >
      <div className="guide-head">
        <span className="guide-kicker">{kicker}</span>
        {onClose && (
          <button className="guide-close" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      {title && <h2>{title}</h2>}
      <p>{text}</p>
      {actions && actions.length > 0 && (
        <div className="guide-actions">
          {actions.map((a) => (
            <button key={a.label} className={`btn ${a.primary ? 'btn-primary' : 'btn-ghost'}`} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
