import { HeartPulse, Siren } from 'lucide-react';
import { INCIDENTS, formatDuration, type IncidentState } from '../../engine/modes/incident';

export function IncidentHud({ s }: { s: IncidentState }) {
  const tone = s.health > 60 ? 'ok' : s.health > 30 ? 'warn' : 'hot';
  return (
    <div className={`incident-hud is-${tone}`}>
      <div className="incident-health" title="Health: missed goals drain it, holding them all heals it">
        <HeartPulse size={14} aria-hidden />
        <span className="incident-bar" role="meter" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.health)}>
          <i style={{ width: `${s.health}%` }} />
        </span>
        <em>{Math.round(s.health)}</em>
      </div>
      <span className="incident-time" aria-label="Time survived">
        {formatDuration(s.t)}
      </span>
      <div className="incident-chips">
        {s.active.length === 0 ? (
          <span className="incident-chip is-calm">All quiet. Get ready.</span>
        ) : (
          s.active.map((a) => (
            <span key={a.kind} className="incident-chip" title={INCIDENTS[a.kind].text}>
              <Siren size={12} aria-hidden />
              {INCIDENTS[a.kind].title}
              <em>{Math.max(0, Math.ceil(a.until - s.t))}s</em>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function IncidentBanner({ text, title }: { title: string; text: string }) {
  return (
    <div className="incident-banner" role="alert">
      <Siren size={18} aria-hidden />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}
