import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, X } from 'lucide-react';
import type { Shift } from '../../engine/changes';
import { METRIC_META } from '../../lib/format';

/**
 * What the player just changed and how their goals moved, e.g. "Added Vector DB: Right answers
 * 23% → 74%". The before and after are what the live numbers are heading towards, so the card can
 * say it before they've finished moving.
 */
export function ChangeNote({ what, shifts, onClose }: { what: string; shifts: Shift[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState<number | undefined>();
  // on desktop it sits just under the problem panel, which floats over the same corner and changes height
  useLayoutEffect(() => {
    const panel = box.current?.closest('.canvas')?.querySelector<HTMLElement>('.pressure-window');
    if (!panel || getComputedStyle(panel).position !== 'absolute') return;
    const place = () => setBelow(panel.offsetTop + panel.offsetHeight + 8);
    place();
    const ro = new ResizeObserver(place);
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="change-note" role="status" style={below === undefined ? undefined : { top: below }}>
      <div className="change-note-head">
        <p className="change-what">{what}</p>
        <button className="change-close" onClick={onClose} aria-label="Dismiss">
          <X size={14} aria-hidden />
        </button>
      </div>
      {shifts.length ? (
        <ul className="change-shifts">
          {shifts.map((s) => {
            const meta = METRIC_META[s.metric];
            const Arrow = s.to > s.from ? ArrowUpRight : ArrowDownRight;
            return (
              <li key={s.metric} className={s.better ? 'is-better' : 'is-worse'}>
                <span className="change-label">{meta.label}</span>
                <span className="change-values">
                  {meta.fmt(s.from)} → <strong>{meta.fmt(s.to)}</strong>
                  <Arrow size={14} aria-hidden />
                  <span className="sr-only">{s.better ? ', better' : ', worse'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="change-none">None of your goals moved.</p>
      )}
    </div>
  );
}
