import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Blocks, Compass, Music2, Play, Volume2, VolumeX, X } from 'lucide-react';
import type { RequestSample } from '../engine/types';
import { complaintFor, SLOW_COMPLAINT } from '../content/guide';
import { measure, place } from './Tour';
import { onVoiceChange, setVoice, voiceOn } from './voice';
import { onSfxChange, setSfx, sfxOn } from './sfx';

/* ---------- voice toggle state ---------- */

export function useVoice(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(voiceOn());
  useEffect(() => onVoiceChange(setOn), []);
  return [on, setVoice];
}

/* ---------- welcome screen ---------- */

export function WelcomeScreen({ onPlay, onBrowse, onFree, onClose }: { onPlay: () => void; onBrowse: () => void; onFree: () => void; onClose: () => void }) {
  const [voice, set] = useVoice();
  const [sounds, setSounds] = useState(sfxOn());
  useEffect(() => onSfxChange(setSounds), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome">
        {/* a 6-second loop of what playing looks like: broken → add a part → fixed */}
        <div className="demo" aria-hidden>
          <div className="demo-bubble">It made that up!</div>
          <div className="demo-row">
            <span className="wa-node">Users</span>
            <span className="wa-wire" />
            <span className="demo-slot">
              <span className="demo-q">?</span>
              <span className="demo-part">Vector DB</span>
            </span>
            <span className="wa-wire demo-wire2" />
            <span className="wa-node wa-llm">AI</span>
          </div>
          <div className="demo-metric">
            <span className="demo-bad">Accuracy 23%</span>
            <span className="demo-good">Accuracy 81% ✓</span>
          </div>
        </div>
        <h1 id="welcome-title">Learn how AI apps really work, by fixing broken ones.</h1>
        <p>Each level hands you an AI app with a real problem: it makes things up, falls over under load, gets tricked. Find the problem, fix it, watch the numbers turn green. No code, no setup.</p>
        <button className="btn btn-primary welcome-play" autoFocus onClick={onPlay}>
          <Play size={16} aria-hidden /> Play level 1 <span className="welcome-time">2 min</span>
        </button>
        <div className="welcome-toggles">
          <label className="welcome-voice">
            <input type="checkbox" checked={voice} onChange={(e) => set(e.target.checked)} />
            {voice ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
            Voice guide
          </label>
          <label className="welcome-voice">
            <input type="checkbox" checked={sounds} onChange={(e) => setSfx(e.target.checked)} />
            <Music2 size={15} aria-hidden />
            Sound effects
          </label>
        </div>
        <div className="welcome-alt">
          <button className="btn btn-ghost" onClick={onBrowse}>
            <Compass size={15} aria-hidden /> Choose a level
          </button>
          <button className="btn btn-ghost" onClick={onFree}>
            <Blocks size={15} aria-hidden /> Free build
          </button>
        </div>
      </div>
    </div>
  );
}

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

/* ---------- customer complaints ---------- */

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

/* ---------- celebration ---------- */

export function Confetti() {
  const bits = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div className="confetti" aria-hidden>
      {bits.map((i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 9) * 0.06}s`,
            background: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7'][i % 5],
            transform: `rotate(${i * 23}deg)`,
          }}
        />
      ))}
    </div>
  );
}
