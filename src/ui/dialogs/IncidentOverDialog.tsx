import { Copy, Siren, Trophy } from 'lucide-react';
import { formatDuration, type IncidentBest } from '../../engine/modes/incident';

export function IncidentOverDialog({
  seconds,
  incidents,
  best,
  onRetry,
  onShare,
  onLevels,
}: {
  seconds: number;
  incidents: number;
  best: IncidentBest | null;
  onRetry: () => void;
  onShare: () => void;
  onLevels: () => void;
}) {
  const isBest = !!best && best.seconds <= seconds;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="over-title">
      <div className="dialog win">
        <p className="dialog-kicker">{isBest ? 'New best run' : 'Your system went down'}</p>
        <h2 id="over-title">You lasted {formatDuration(seconds)}</h2>
        <ul className="win-criteria">
          <li className="is-met">
            <Siren size={14} aria-hidden />
            <span>
              {incidents} incident{incidents === 1 ? '' : 's'} hit your system
            </span>
          </li>
          {best && !isBest && (
            <li>
              <Trophy size={14} aria-hidden />
              <span>
                Your best: {formatDuration(best.seconds)}, {best.incidents} incidents
              </span>
            </li>
          )}
        </ul>
        <p className="dialog-note">Your design is still on the canvas. Strengthen it before the next run: incidents come in a different order each time.</p>
        <div className="dialog-actions win-actions">
          <button className="btn btn-ghost win-share" onClick={onShare}>
            <Copy size={14} aria-hidden /> Copy result
          </button>
          <button className="btn btn-ghost" onClick={onLevels}>
            Levels
          </button>
          <button className="btn btn-primary" autoFocus onClick={onRetry}>
            Go again
          </button>
        </div>
      </div>
    </div>
  );
}
