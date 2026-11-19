import { CalendarDays, Flame, Siren, Trophy } from 'lucide-react';
import { formatDuration, type IncidentBest } from '../../engine/modes/incident';

export function ModeCards({
  dailyNumber,
  dailyDone,
  streak,
  incidentBest,
  achievements,
  onDaily,
  onIncident,
  onAchievements,
}: {
  dailyNumber: number;
  dailyDone: number | null;
  streak: number;
  incidentBest: IncidentBest | null;
  achievements: [number, number];
  onDaily: () => void;
  onIncident: () => void;
  onAchievements: () => void;
}) {
  return (
    <div className="modes">
      <button className="mode-card is-daily" onClick={onDaily}>
        <CalendarDays size={18} aria-hidden />
        <strong>Daily challenge #{dailyNumber}</strong>
        <span>{dailyDone ? `Solved today · ${'★'.repeat(dailyDone)}${'☆'.repeat(3 - dailyDone)}` : 'A new remixed level every day. Same one for everyone.'}</span>
        {streak > 0 && (
          <em className="mode-streak">
            <Flame size={12} aria-hidden /> {streak}-day streak
          </em>
        )}
      </button>
      <button className="mode-card is-incident" onClick={onIncident}>
        <Siren size={18} aria-hidden />
        <strong>Incident mode</strong>
        <span>
          {incidentBest ? `Best: ${formatDuration(incidentBest.seconds)}, ${incidentBest.incidents} incidents` : 'Keep a system alive while outages, spikes and attacks hit it.'}
        </span>
      </button>
      <button className="mode-card is-ach" onClick={onAchievements}>
        <Trophy size={18} aria-hidden />
        <strong>Achievements</strong>
        <span>
          {achievements[0]} of {achievements[1]} earned, plus a certificate when you clear every level.
        </span>
      </button>
    </div>
  );
}
