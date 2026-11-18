import { useEffect } from 'react';
import { Check, Shapes, X } from 'lucide-react';
import type { Scenario } from '../engine/scenarios';

const LEVEL: Record<Scenario['difficulty'], string> = { 0: 'Open', 1: 'Intro', 2: 'Core', 3: 'Advanced' };

function Difficulty({ level }: { level: Scenario['difficulty'] }) {
  if (level === 0) return <span className="diff-label">Open</span>;
  return (
    <span className="diff" aria-label={`Difficulty: ${LEVEL[level]}`} title={LEVEL[level]}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= level ? 'on' : ''} />
      ))}
    </span>
  );
}

export function ScenarioPicker({
  scenarios,
  sandbox,
  currentId,
  cleared,
  onPick,
  onClose,
}: {
  scenarios: Scenario[];
  sandbox: Scenario;
  currentId: string;
  cleared: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const done = scenarios.filter((s) => cleared.has(s.id)).length;

  const card = (s: Scenario, i?: number) => {
    const isDone = cleared.has(s.id);
    return (
      <button
        key={s.id}
        className={`scard${s.id === currentId ? ' is-current' : ''}${isDone ? ' is-done' : ''}`}
        onClick={() => onPick(s.id)}
        autoFocus={s.id === currentId}
      >
        <div className="scard-top">
          <span className="scard-num">{i === undefined ? '∞' : String(i + 1).padStart(2, '0')}</span>
          <Difficulty level={s.difficulty} />
        </div>
        <h3 className="scard-title">{s.title.replace(/^\d+ · /, '')}</h3>
        <p className="scard-tagline">{s.tagline}</p>
        <div className="scard-foot">
          <span className="scard-skills">
            {s.skills.map((k) => (
              <span key={k}>{k}</span>
            ))}
          </span>
          {isDone && (
            <span className="scard-done">
              <Check size={12} strokeWidth={3} aria-hidden /> Cleared
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="picker-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker">
        <header className="picker-head">
          <div>
            <h2 id="picker-title">Scenarios</h2>
            <p>
              Each one hands you a broken AI system and real-shaped traffic. Fix whatever binds first, then the next thing.
            </p>
          </div>
          <div className="picker-progress">
            <span className="picker-count">
              {done}/{scenarios.length}
            </span>
            <span>cleared</span>
            <div className="picker-bar">
              <div style={{ width: `${(done / scenarios.length) * 100}%` }} />
            </div>
          </div>
          <button className="btn btn-ghost picker-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="picker-grid">
          {scenarios.map((s, i) => card(s, i))}
          {card(sandbox)}
        </div>
      </div>
    </div>
  );
}

export function ScenarioTrigger({ scenario, index, onOpen }: { scenario: Scenario; index: number; onOpen: () => void }) {
  return (
    <button className="scenario-trigger" onClick={onOpen} title="Choose a scenario">
      <Shapes size={15} aria-hidden />
      <span className="scenario-trigger-num">{index >= 0 ? String(index + 1).padStart(2, '0') : '∞'}</span>
      <span className="scenario-trigger-title">{scenario.title.replace(/^\d+ · /, '')}</span>
      <span className="scenario-trigger-all">All scenarios</span>
    </button>
  );
}
