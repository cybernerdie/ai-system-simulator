import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { type Pressure } from '../../engine/pressures';

/**
 * The single biggest problem right now, and why it's happening. What to try is held back until the
 * player asks, so the panel points them at the problem without solving the level for them.
 */
export function PressureWindow({ p, running, hasRun, hud }: { p: Pressure | null; running: boolean; hasRun: boolean; hud?: React.ReactNode }) {
  const state = !hasRun || !p ? 'idle' : p.key === 'stable' ? 'stable' : 'binding';
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
