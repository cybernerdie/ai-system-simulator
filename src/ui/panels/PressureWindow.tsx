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
  hud?: React.ReactNode;
}

export function PressureWindow({ p, running, hasRun, hold, hud }: Props) {
  const met = !!hold && hold.streak > 0;
  const state = !hasRun || !p ? 'idle' : met ? 'met' : p.key === 'stable' ? 'stable' : 'binding';
  const [showFix, setShowFix] = useState(false);
  useEffect(() => setShowFix(false), [p?.key]);
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
            {state === 'binding' &&
              (showFix ? (
                <p className="pressure-try">
                  <Lightbulb size={14} strokeWidth={2.25} aria-hidden />
                  <span>{p!.try}</span>
                </p>
              ) : (
                <button className="link-btn pressure-ask" onClick={() => setShowFix(true)}>
                  <Lightbulb size={13} aria-hidden /> What could fix this?
                </button>
              ))}
            {state === 'stable' && <p className="pressure-try">{p!.try}</p>}
          </>
        )}
      </div>
    </section>
  );
}
