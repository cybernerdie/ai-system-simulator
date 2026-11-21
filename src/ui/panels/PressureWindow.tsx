import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { type Pressure } from '../../engine/pressures';

/**
 * The single biggest problem right now, and why it's happening. What to try is held back until the
 * player asks, so the panel points them at the problem without solving the level for them.
 */
interface Props {
  p: Pressure | null;
  running: boolean;
  hasRun: boolean;
  /** On a level: how many ticks every goal has held, out of how many it takes to clear. */
  hold?: { streak: number; needed: number };
  /** The last hint, tailored to the design (it won't suggest what's already there). */
  fix?: string;
  /** Told how far into the hints the player has gone (1 to 3). */
  onHint?: (depth: number) => void;
  hud?: React.ReactNode;
}

const HINT_LABELS = ['Look:', 'Idea:', 'Fix:'];

export function PressureWindow({ p, running, hasRun, hold, fix, onHint, hud }: Props) {
  const met = !!hold && hold.streak > 0;
  const state = !hasRun || !p ? 'idle' : met ? 'met' : p.key === 'stable' ? 'stable' : 'binding';
  // hints come one step at a time: where to look, the kind of fix, then the exact change
  const [depth, setDepth] = useState(0);
  useEffect(() => setDepth(0), [p?.key]);
  const steps = p ? [p.look, p.idea, fix ?? p.try] : [];
  const more = () => {
    const next = Math.min(3, depth + 1);
    setDepth(next);
    onHint?.(next);
  };
  return (
    <section className={`pressure-window is-${state}`} aria-live="polite">
      <header className="window-bar">
        <span className="lights" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="window-title">Biggest problem right now</span>
        {running && <span className="live-pill">Live</span>}
      </header>
      {hud}
      <div className="pressure-body">
        {state === 'idle' ? (
          <p className="pressure-why">Press Run to send customers' requests through your system. The biggest problem it has will show up here.</p>
        ) : state === 'met' ? (
          <>
            <p className="pressure-title">
              <span className="pressure-dot" aria-hidden />
              Every goal is met
            </p>
            <p className="pressure-why">Keep it running. The level clears once the numbers hold for a few seconds.</p>
            <div className="hold pressure-hold" role="progressbar" aria-label="Holding every goal" aria-valuemin={0} aria-valuemax={hold!.needed} aria-valuenow={hold!.streak}>
              <div className="hold-track">
                <div className="hold-bar" style={{ width: `${(hold!.streak / hold!.needed) * 100}%` }} />
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="pressure-title">
              <span className="pressure-dot" aria-hidden />
              {p!.title}
            </p>
            <p className="pressure-why">{p!.why}</p>
            {state === 'binding' && (
              <div className="pressure-hints" aria-live="polite">
                {depth > 0 && (
                  <div className="pressure-try">
                    <Lightbulb size={14} strokeWidth={2.25} aria-hidden />
                    <div className="pressure-steps">
                      {steps.slice(0, depth).map((text, i) => (
                        <p key={i}>
                          <strong>{HINT_LABELS[i]}</strong> {text}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {depth < 3 && (
                  <button className="link-btn pressure-ask" onClick={more}>
                    <Lightbulb size={13} aria-hidden /> {depth === 0 ? 'Need a hint?' : depth === 1 ? 'Another hint' : 'Show me the fix'}
                  </button>
                )}
              </div>
            )}
            {state === 'stable' && <p className="pressure-try">{p!.try}</p>}
          </>
        )}
      </div>
    </section>
  );
}
