import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { RequestSample } from '../../engine/types';
import { complaintFor, SLOW_COMPLAINT } from '../../content/guide';

interface Bubble {
  key: number;
  text: string;
  asked: string;
}

/** Failed requests, shown as what a real customer would say. */
export function Complaints({ samples, running }: { samples: RequestSample[] | undefined; running: boolean }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const latest = useRef(samples);
  latest.current = samples;
  const n = useRef(0);

  useEffect(() => {
    if (!running) {
      setBubbles([]);
      return;
    }
    const tick = () => {
      const pool = (latest.current ?? []).filter((s) => s.outcome !== 'correct' && s.outcome !== 'blocked' && s.kind !== 'attack');
      const slow = (latest.current ?? []).filter((s) => s.outcome === 'correct' && s.latency > 8000);
      const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : slow[0];
      if (!pick) {
        setBubbles((b) => b.slice(1));
        return;
      }
      const key = ++n.current;
      const text = pick.outcome === 'correct' ? SLOW_COMPLAINT : complaintFor(pick.outcome, pick.cause, key);
      if (!text) return;
      const phone = window.innerWidth <= 900;
      setBubbles((b) => {
        if (b.some((x) => x.text === text && x.asked === pick.question)) return b;
        return [...b.slice(phone ? b.length : -1), { key, text, asked: pick.question }];
      });
    };
    const first = window.setTimeout(tick, 1200);
    const id = window.setInterval(tick, 2600);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [running]);

  // sit just above the metrics dock, whatever its height
  // phones: just inside the top of the diagram area
  const [place, setPlace] = useState<CSSProperties | undefined>();
  useLayoutEffect(() => {
    const t = document.querySelector('.telemetry');
    const c = document.querySelector('.canvas');
    const f = document.querySelector<HTMLElement>('.canvas .react-flow');
    if (!c) return;
    const cr = c.getBoundingClientRect();
    if (window.innerWidth <= 900) {
      if (f) setPlace({ top: f.getBoundingClientRect().top - cr.top + 10, bottom: 'auto' });
    } else if (t) setPlace({ bottom: cr.bottom - t.getBoundingClientRect().top + 12 });
  }, [bubbles]);

  if (!bubbles.length) return null;
  return (
    <div className="complaints" aria-live="off" style={place}>
      {bubbles.map((b) => (
        <div key={b.key} className="complaint">
          <span className="complaint-avatar" aria-hidden>
            {['🙁', '😠', '😕', '😤'][b.key % 4]}
          </span>
          <div>
            <p>{b.text}</p>
            <span className="complaint-asked">Asked: {b.asked}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
