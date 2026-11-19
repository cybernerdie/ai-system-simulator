import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Blocks, Code, Crown, Lock, Play, Search, Shapes, Star, X } from 'lucide-react';
import { CHAPTERS } from '../../content/chapters';
import type { Scenario } from '../../engine/levels/scenarios';

// Phones: don't pop the keyboard up the moment a sheet opens
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

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
  bosses,
  modes,
  onEmbed,
  sandbox,
  currentId,
  cleared,
  stars,
  unlockAll,
  onUnlockAll,
  onPick,
  onClose,
}: {
  scenarios: Scenario[];
  bosses: Scenario[];
  /** the daily / incident / achievements cards shown above the map */
  modes?: ReactNode;
  onEmbed?: (id: string) => void;
  sandbox: Scenario;
  currentId: string;
  cleared: Set<string>;
  stars: Record<string, number>;
  unlockAll: boolean;
  onUnlockAll: (on: boolean) => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const everything = [...scenarios, ...bosses];
  const done = everything.filter((s) => cleared.has(s.id)).length;
  const totalStars = everything.reduce((a, s) => a + (stars[s.id] ?? 0), 0);
  const indexOf = (id: string) => scenarios.findIndex((x) => x.id === id);
  const bossOf = (id: string) => bosses.find((b) => b.id === id);
  // a level opens once the one before it is cleared; a boss once its whole chapter is
  const isOpen = (id: string) => {
    if (unlockAll || id === currentId || cleared.has(id)) return true;
    const b = bossOf(id);
    if (b) return CHAPTERS[b.chapter ?? 0].ids.every((x) => cleared.has(x));
    const i = indexOf(id);
    return i <= 0 || cleared.has(scenarios[i - 1].id);
  };
  const firstOpenUncleared = scenarios.find((x) => isOpen(x.id) && !cleared.has(x.id));
  const [sel, setSel] = useState<string>(() => (everything.some((x) => x.id === currentId) ? currentId : (firstOpenUncleared ?? scenarios[0]).id));
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<'all' | 1 | 2 | 3 | 'todo'>('all');
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (s: Scenario) =>
      (level === 'all' || (level === 'todo' ? !cleared.has(s.id) : s.difficulty === level)) &&
      (!needle || `${s.title} ${s.tagline} ${s.brief} ${s.skills.join(' ')}`.toLowerCase().includes(needle));
  }, [q, level, cleared]);
  const shown = [...scenarios.map((s, i) => ({ s, i: i as number | undefined, boss: false })), ...bosses.map((s) => ({ s, i: undefined, boss: true }))].filter(({ s }) => matches(s));
  const showSandbox = level === 'all' && matches(sandbox);

  const card = (s: Scenario, i?: number, boss = false) => {
    const isDone = cleared.has(s.id);
    const open = (i === undefined && !boss) || isOpen(s.id);
    return (
      <button
        key={s.id}
        className={`scard${s.id === currentId ? ' is-current' : ''}${isDone ? ' is-done' : ''}${open ? '' : ' is-locked'}`}
        onClick={() => (open ? onPick(s.id) : undefined)}
        aria-disabled={!open}
        title={open ? undefined : boss ? 'Clear every level in its chapter to unlock it' : 'Clear the level before this one to unlock it'}
      >
        <div className="scard-top">
          <span className="scard-num">{boss ? 'Boss' : i === undefined ? '∞' : String(i + 1).padStart(2, '0')}</span>
          <Difficulty level={s.difficulty} />
        </div>
        <h3 className="scard-title">{plain(s.title)}</h3>
        <p className="scard-tagline">{s.tagline}</p>
        <div className="scard-foot">
          <span className="scard-skills">
            {s.skills.map((k) => (
              <span key={k}>{k}</span>
            ))}
          </span>
          {isDone ? (
            <StarRow n={stars[s.id] ?? 1} />
          ) : (
            !open && (
              <span className="scard-done">
                <Lock size={12} aria-hidden /> Locked
              </span>
            )
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
            <h2 id="picker-title">Levels</h2>
            <p>Each level hands you a broken AI app. Clear it to unlock the next, and clear a whole chapter to face its boss. Earn up to three stars: clear it, keep it within budget, build it lean.</p>
          </div>
          <div className="picker-progress">
            <span className="picker-count">
              {done}/{everything.length}
            </span>
            <span>
              cleared · <Star size={11} className="star-inline" aria-hidden /> {totalStars}/{everything.length * 3}
            </span>
            <div className="picker-bar">
              <div style={{ width: `${(done / everything.length) * 100}%` }} />
            </div>
          </div>
          <button className="btn btn-ghost picker-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="picker-tools">
          <label className="search">
            <Search size={15} aria-hidden />
            <span className="sr-only">Search scenarios</span>
            <input autoFocus={!TOUCH} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search levels by topic: memory, GPUs, agents…" />
          </label>
          <div className="chips" role="group" aria-label="Filter scenarios">
            {(
              [
                ['all', 'Map'],
                [1, 'Intro'],
                [2, 'Core'],
                [3, 'Advanced'],
                ['todo', 'Not cleared'],
              ] as const
            ).map(([v, label]) => (
              <button key={String(v)} className="chip" aria-pressed={level === v} onClick={() => setLevel(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {!q.trim() && level === 'all' ? (
          <div className="level-map">
            {modes}
            {CHAPTERS.map((ch, ci) => {
              const ids = ch.ids.filter((id) => indexOf(id) >= 0);
              const boss = bossOf(ch.boss);
              const all = boss ? [...ids, boss.id] : ids;
              const got = all.reduce((a, id) => a + (stars[id] ?? 0), 0);
              const selHere = all.includes(sel);
              const selS = everything.find((x) => x.id === sel);
              const selIsBoss = !!selS && !!bossOf(selS.id);
              return (
                <section key={ch.title} className="chapter">
                  <header className="chapter-head">
                    <div>
                      <span className="chapter-num">Chapter {ci + 1}</span>
                      <h3>{ch.title}</h3>
                      <p>{ch.blurb}</p>
                    </div>
                    <span className="chapter-stars" aria-label={`${got} of ${all.length * 3} stars`}>
                      <Star size={13} aria-hidden /> {got}/{all.length * 3}
                    </span>
                  </header>
                  <ol className="path">
                    {ids.map((id) => {
                      const i = indexOf(id);
                      const sc = scenarios[i];
                      const open = isOpen(id);
                      const isDone = cleared.has(id);
                      return (
                        <li key={id} className={`stop${isDone ? ' is-done' : ''}${open ? '' : ' is-locked'}${id === currentId ? ' is-current' : ''}${id === sel ? ' is-selected' : ''}`}>
                          <button
                            className="stop-dot"
                            onClick={() => setSel(id)}
                            onDoubleClick={() => open && onPick(id)}
                            aria-label={`Level ${i + 1}: ${sc.title.replace(/^\d+ · /, '')}${open ? '' : ' (locked)'}${isDone ? `, ${stars[id] ?? 1} stars` : ''}`}
                            aria-pressed={id === sel}
                          >
                            {open ? i + 1 : <Lock size={15} aria-hidden />}
                          </button>
                          <StarRow n={isDone ? (stars[id] ?? 1) : 0} />
                          <span className="stop-title">{plain(sc.title)}</span>
                        </li>
                      );
                    })}
                    {boss && (
                      <li className={`stop is-boss${cleared.has(boss.id) ? ' is-done' : ''}${isOpen(boss.id) ? '' : ' is-locked'}${boss.id === currentId ? ' is-current' : ''}${boss.id === sel ? ' is-selected' : ''}`}>
                        <button
                          className="stop-dot"
                          onClick={() => setSel(boss.id)}
                          onDoubleClick={() => isOpen(boss.id) && onPick(boss.id)}
                          aria-label={`Boss: ${plain(boss.title)}${isOpen(boss.id) ? '' : ' (locked)'}${cleared.has(boss.id) ? `, ${stars[boss.id] ?? 1} stars` : ''}`}
                          aria-pressed={boss.id === sel}
                        >
                          {isOpen(boss.id) ? <Crown size={17} aria-hidden /> : <Lock size={15} aria-hidden />}
                        </button>
                        <StarRow n={cleared.has(boss.id) ? (stars[boss.id] ?? 1) : 0} />
                        <span className="stop-title">Boss: {plain(boss.title)}</span>
                      </li>
                    )}
                  </ol>
                  {selHere && selS && (
                    <div className="stop-detail">
                      <div>
                        <span className="stop-detail-num">{selIsBoss ? `Chapter ${ci + 1} boss` : `Level ${indexOf(selS.id) + 1}`}</span>
                        <h4>{plain(selS.title)}</h4>
                        <p>{selS.tagline}</p>
                        <span className="scard-skills">
                          {selS.skills.map((k) => (
                            <span key={k}>{k}</span>
                          ))}
                        </span>
                      </div>
                      <div className="stop-detail-actions">
                        {isOpen(selS.id) ? (
                          <button className="btn btn-primary" onClick={() => onPick(selS.id)} autoFocus={!TOUCH}>
                            <Play size={14} fill="currentColor" aria-hidden />
                            {selS.id === currentId ? 'Continue' : cleared.has(selS.id) ? 'Play again' : 'Play'}
                          </button>
                        ) : (
                          <span className="stop-locked-note">
                            <Lock size={13} aria-hidden /> {selIsBoss ? 'Clear every level in this chapter to unlock' : `Clear level ${indexOf(selS.id)} to unlock`}
                          </span>
                        )}
                        {onEmbed && (
                          <button className="link-btn stop-embed" onClick={() => onEmbed(selS.id)} title="Copy HTML to embed this level in a blog post or page">
                            <Code size={13} aria-hidden /> Embed
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
            <div className="map-foot">
              <button className="btn btn-ghost" onClick={() => onPick(sandbox.id)}>
                <Blocks size={15} aria-hidden /> Free build (sandbox)
              </button>
              <label className="map-unlock">
                <input type="checkbox" checked={unlockAll} onChange={(e) => onUnlockAll(e.target.checked)} />
                Unlock every level
              </label>
            </div>
          </div>
        ) : (
        <div className="picker-grid">
          {shown.map(({ s, i, boss }) => card(s, i, boss))}
          {showSandbox && card(sandbox)}
          {!shown.length && !showSandbox && <p className="side-empty picker-empty">No levels match "{q}". Try a broader word, like "cost" or "retrieval".</p>}
        </div>
        )}
      </div>
    </div>
  );
}

const plain = (t: string) => t.replace(/^(\d+|Boss|Daily #\d+) · /, '');

export function ScenarioTrigger({ scenario, tag, onOpen }: { scenario: Scenario; tag: string; onOpen: () => void }) {
  return (
    <button className="scenario-trigger" onClick={onOpen} title="Choose a level">
      <Shapes size={15} aria-hidden />
      <span className="scenario-trigger-num">{tag}</span>
      <span className="scenario-trigger-title">{plain(scenario.title)}</span>
      <span className="scenario-trigger-all">All levels</span>
    </button>
  );
}

function StarRow({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="star-row" aria-label={n ? `${n} of 3 stars` : undefined} aria-hidden={!n || undefined}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={size} className={i <= n ? 'on' : ''} aria-hidden />
      ))}
    </span>
  );
}
