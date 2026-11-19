import {  useState } from 'react';
import { Award, Download, Lock, Trophy, X } from 'lucide-react';
import { ACHIEVEMENTS, type Progress } from '../../engine/modes/achievements';
import { loadCertName, saveCertName } from '../../lib/progress';
import { useEscape } from '../hooks/useEscape';

/* ---------- achievements and certificate ---------- */

export function AchievementsDialog({
  progress,
  unlocked,
  levelsTotal,
  levelsCleared,
  totalStars,
  onCertificate,
  onClose,
}: {
  progress: Progress;
  unlocked: Record<string, number>;
  levelsTotal: number;
  levelsCleared: number;
  totalStars: number;
  onCertificate: (name: string) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const got = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const eligible = levelsCleared >= levelsTotal;
  const [name, setName] = useState(loadCertName);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="ach-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog achievements">
        <button className="btn btn-ghost picker-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <p className="dialog-kicker">
          {got} of {ACHIEVEMENTS.length} earned
        </p>
        <h2 id="ach-title">Achievements</h2>
        <ul className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const done = !!unlocked[a.id];
            const c = a.count?.(progress);
            return (
              <li key={a.id} className={`ach${done ? ' is-done' : ''}`}>
                <span className="ach-icon" aria-hidden>
                  {done ? <Trophy size={16} /> : <Lock size={14} />}
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <span>{a.text}</span>
                  {!done && c && (
                    <span className="ach-progress" aria-label={`${c[0]} of ${c[1]}`}>
                      <i style={{ width: `${(c[0] / c[1]) * 100}%` }} />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <section className={`cert${eligible ? ' is-open' : ''}`}>
          <Award size={22} aria-hidden />
          <div>
            <strong>Certificate of completion</strong>
            {eligible ? (
              <>
                <span>You cleared every level. Put your name on it.</span>
                <div className="cert-form">
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} placeholder="Your name" aria-label="Name on the certificate" />
                  <button
                    className="btn btn-primary"
                    disabled={!name.trim()}
                    onClick={() => {
                      saveCertName(name.trim());
                      onCertificate(name.trim());
                    }}
                  >
                    <Download size={14} aria-hidden /> Download
                  </button>
                </div>
              </>
            ) : (
              <>
                <span>
                  Clear all {levelsTotal} levels to earn it. You've cleared {levelsCleared}, with {totalStars} stars.
                </span>
                <span className="ach-progress">
                  <i style={{ width: `${(levelsCleared / levelsTotal) * 100}%` }} />
                </span>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AchievementToast({ title }: { title: string }) {
  return (
    <div className="ach-toast" role="status">
      <Trophy size={16} aria-hidden />
      <div>
        <span>Achievement</span>
        <strong>{title}</strong>
      </div>
    </div>
  );
}
