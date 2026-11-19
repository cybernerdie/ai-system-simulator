import { Lightbulb } from 'lucide-react';
import { type Pressure } from '../../engine/pressures';

export function PressureWindow({ p, running, hasRun, hud }: { p: Pressure | null; running: boolean; hasRun: boolean; hud?: React.ReactNode }) {
  const state = !hasRun || !p ? 'idle' : p.key === 'stable' ? 'stable' : 'binding';
  return (
    <section className={`pressure-window is-${state}`} aria-live="polite">
      <header className="window-bar">
        <span className="lights" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="window-title">Binding pressure</span>
        {running && <span className="live-pill">Live</span>}
      </header>
      {hud}
      <div className="pressure-body">
        {state === 'idle' ? (
          <p className="pressure-why">Run the simulation. The one limit hurting your system most will show up here.</p>
        ) : (
          <>
            <p className="pressure-title">
              <span className="pressure-dot" aria-hidden />
              {p!.title}
            </p>
            <p className="pressure-why">{p!.why}</p>
            <p className="pressure-try">
              <Lightbulb size={14} strokeWidth={2.25} aria-hidden />
              <span>{p!.try}</span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
