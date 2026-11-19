import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Clock, Lightbulb, Play, Search, Sparkles, X } from 'lucide-react';
import { LESSON_BY_ID, LESSON_ORDER, MODULES, MODULE_OF, TERMS, TERM_BY_ID, type Lesson, type TermCategory } from '../../content/learn';
import { loadRead, saveRead } from '../../lib/progress';
import { SCENARIOS } from '../../engine/levels/scenarios';
import { KindIcon } from '../canvas/icons';
import { COMPONENTS } from '../../engine/components';

// Phones: don't pop the keyboard up the moment a sheet opens
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export type HubView = { tab: 'lessons'; lessonId: string } | { tab: 'glossary'; termId?: string };

const CATEGORIES: TermCategory[] = ['Models', 'Retrieval', 'Memory', 'Inference', 'Voice', 'Production', 'Agents', 'Safety', 'Quality'];

/** Where to open the lessons tab: the first lesson not read yet. */
export function firstUnreadLesson(): string {
  const read = loadRead();
  return LESSON_ORDER.find((id) => !read.has(id)) ?? LESSON_ORDER[0];
}

export function LearnHub({
  view,
  setView,
  onClose,
  onTryScenario,
  onReplayIntro,
}: {
  view: HubView;
  setView: (v: HubView) => void;
  onClose: () => void;
  onTryScenario: (id: string) => void;
  onReplayIntro: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="learn-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hub">
        <header className="hub-head">
          <h2 id="learn-title">
            <BookOpen size={18} aria-hidden /> Learn
          </h2>
          <div className="seg" role="tablist">
            <button role="tab" aria-pressed={view.tab === 'lessons'} onClick={() => setView({ tab: 'lessons', lessonId: view.tab === 'lessons' ? view.lessonId : firstUnreadLesson() })}>
              Lessons
            </button>
            <button role="tab" aria-pressed={view.tab === 'glossary'} onClick={() => setView({ tab: 'glossary' })}>
              Glossary
            </button>
          </div>
          <div className="topbar-spacer" />
          <button className="btn btn-ghost" onClick={onReplayIntro}>
            How to play
          </button>
          <button className="btn btn-ghost picker-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        {view.tab === 'lessons' ? (
          <Lessons
            lesson={LESSON_BY_ID[view.lessonId] ?? LESSON_BY_ID[LESSON_ORDER[0]]}
            onPick={(id) => setView({ tab: 'lessons', lessonId: id })}
            onTerm={(id) => setView({ tab: 'glossary', termId: id })}
            onTry={onTryScenario}
          />
        ) : (
          <Glossary
            focusId={view.termId}
            onTerm={(id) => setView({ tab: 'glossary', termId: id })}
            onLesson={(id) => setView({ tab: 'lessons', lessonId: id })}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- lessons ---------- */

function Lessons({ lesson, onPick, onTerm, onTry }: { lesson: Lesson; onPick: (id: string) => void; onTerm: (id: string) => void; onTry: (id: string) => void }) {
  const idx = LESSON_ORDER.indexOf(lesson.id);
  const next = LESSON_BY_ID[LESSON_ORDER[idx + 1]];
  const mod = MODULE_OF[lesson.id];
  const modIdx = MODULES.indexOf(mod);
  const scenario = lesson.scenarioId ? SCENARIOS.find((s) => s.id === lesson.scenarioId) : undefined;
  const readRef = useRef<HTMLElement>(null);
  const [read, setRead] = useState<Set<string>>(() => loadRead());
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const hit = (id: string) => {
    if (!needle) return true;
    const l = LESSON_BY_ID[id];
    const text = [
      l.title,
      l.summary,
      ...l.terms.map((t) => `${TERM_BY_ID[t].term} ${TERM_BY_ID[t].aka ?? ''}`),
      ...l.blocks.map((b) => ('text' in b ? b.text : b.items.join(' '))),
    ]
      .join(' ')
      .toLowerCase();
    return text.includes(needle);
  };
  const hits = LESSON_ORDER.filter(hit).length;
  useEffect(() => {
    readRef.current?.scrollTo({ top: 0 });
  }, [lesson.id]);

  // A lesson only counts as read when the reader says so (or moves on from it), not when it's merely opened.
  const setDone = (id: string, done: boolean) =>
    setRead((r) => {
      if (r.has(id) === done) return r;
      const n = new Set(r);
      if (done) n.add(id);
      else n.delete(id);
      saveRead(n);
      return n;
    });
  const isDone = read.has(lesson.id);

  return (
    <div className="hub-body lessons">
      <nav className="lesson-nav" aria-label="Lessons">
        <div className="journey">
          <span>Your journey</span>
          <span className="journey-count">
            {read.size}/{LESSON_ORDER.length}
          </span>
          <div className="picker-bar">
            <div style={{ width: `${(read.size / LESSON_ORDER.length) * 100}%` }} />
          </div>
        </div>
        <label className="search lesson-search">
          <Search size={14} aria-hidden />
          <span className="sr-only">Search lessons</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons…" />
        </label>
        {needle && !hits && <p className="lesson-nohits">No lessons mention "{q}". Try the Glossary tab.</p>}
        {MODULES.filter((m) => m.lessons.some(hit)).map((m) => (
          <section key={m.id} className={`module${m.id === mod.id ? ' is-open' : ''}`}>
            <header className="module-head">
              <span className="module-num">Module {MODULES.indexOf(m) + 1}</span>
              <span className={`level level-${m.level.toLowerCase()}`}>{m.level}</span>
              <h3>{m.title}</h3>
            </header>
            <ol>
              {m.lessons.filter(hit).map((id) => {
                const l = LESSON_BY_ID[id];
                const done = read.has(id);
                return (
                  <li key={id}>
                    <button className={id === lesson.id ? 'is-current' : ''} onClick={() => onPick(id)} aria-current={id === lesson.id}>
                      <span className={`lesson-check${done ? ' done' : ''}`} aria-label={done ? 'Read' : 'Not read'}>
                        {done && <Check size={10} strokeWidth={3.5} />}
                      </span>
                      <span className="lesson-nav-title">{l.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </nav>
      <article className="lesson" ref={readRef}>
        <div className="lesson-inner">
          <p className="lesson-meta">
            <span>
              Module {modIdx + 1}: {mod.title}
            </span>
            <span className="dot-sep" aria-hidden />
            <span className={`level level-${mod.level.toLowerCase()}`}>{mod.level}</span>
            <span className="dot-sep" aria-hidden />
            <Clock size={12} aria-hidden /> {lesson.minutes} min
          </p>
          <h1>{lesson.title}</h1>
          <p className="lesson-summary">{lesson.summary}</p>
          {lesson.components && (
            <div className="lesson-components" aria-hidden>
              {lesson.components.map((c, i) => (
                <span key={c} className="lesson-chain">
                  {i > 0 && <ArrowRight size={13} />}
                  <span className="lesson-comp">
                    <KindIcon kind={c} size="sm" />
                    {COMPONENTS[c].name}
                  </span>
                </span>
              ))}
            </div>
          )}
          {lesson.blocks.map((b, i) => {
            if (b.kind === 'p') return <p key={i}>{b.text}</p>;
            if (b.kind === 'list')
              return (
                <ul key={i}>
                  {b.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              );
            if (b.kind === 'analogy')
              return (
                <aside key={i} className="analogy">
                  <span className="callout-label">
                    <Sparkles size={13} aria-hidden /> Think of it like this
                  </span>
                  <p>{b.text}</p>
                </aside>
              );
            return (
              <aside key={i} className="takeaway">
                <span className="callout-label">
                  <Lightbulb size={13} aria-hidden /> Takeaway
                </span>
                <p>{b.text}</p>
              </aside>
            );
          })}

          <section className="lesson-terms">
            <h2>Terms in this lesson</h2>
            <div className="chips">
              {lesson.terms.map((t) => (
                <button key={t} className="chip" onClick={() => onTerm(t)}>
                  {TERM_BY_ID[t].term}
                </button>
              ))}
            </div>
          </section>

          <footer className="lesson-foot">
            {scenario ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setDone(lesson.id, true);
                  onTry(scenario.id);
                }}
              >
                <Play size={13} fill="currentColor" aria-hidden /> Try it: {scenario.title.replace(/^\d+ · /, '')}
              </button>
            ) : (
              <span />
            )}
            <button
              className={`btn btn-ghost mark-read${isDone ? ' is-done' : ''}`}
              aria-pressed={isDone}
              onClick={() => setDone(lesson.id, !isDone)}
              title={isDone ? 'Mark as not read' : 'Mark as read'}
            >
              <Check size={14} strokeWidth={2.5} aria-hidden /> {isDone ? 'Read' : 'Mark as read'}
            </button>
            {next && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setDone(lesson.id, true);
                  onPick(next.id);
                }}
              >
                {MODULE_OF[next.id] !== mod ? `Next module: ${MODULE_OF[next.id].title}` : `Next: ${next.title}`} <ArrowRight size={14} aria-hidden />
              </button>
            )}
          </footer>
        </div>
      </article>
    </div>
  );
}

/* ---------- glossary ---------- */

function Glossary({ focusId, onTerm, onLesson }: { focusId?: string; onTerm: (id: string) => void; onLesson: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<TermCategory | 'All'>('All');
  const listRef = useRef<HTMLDivElement>(null);

  // Jumping to a term clears filters so it's guaranteed to be visible
  useEffect(() => {
    if (!focusId) return;
    setQ('');
    setCat('All');
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-term="${focusId}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [focusId]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TERMS.filter((t) => (cat === 'All' || t.category === cat) && (!needle || `${t.term} ${t.aka ?? ''} ${t.simple}`.toLowerCase().includes(needle))).sort((a, b) =>
      a.term.localeCompare(b.term),
    );
  }, [q, cat]);

  return (
    <div className="hub-body glossary">
      <div className="glossary-tools">
        <label className="search">
          <Search size={15} aria-hidden />
          <span className="sr-only">Search terms</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${TERMS.length} terms…`} autoFocus={!focusId && !TOUCH} />
        </label>
        <div className="chips" role="group" aria-label="Category">
          {(['All', ...CATEGORIES] as const).map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="term-list" ref={listRef}>
        {!list.length && <p className="side-empty">No terms match "{q}".</p>}
        {list.map((t) => (
          <article key={t.id} data-term={t.id} className={`term${t.id === focusId ? ' is-focus' : ''}`}>
            <header>
              <h3>
                {t.term}
                {t.aka && <span className="term-aka">{t.aka}</span>}
              </h3>
              <span className="term-cat">{t.category}</span>
            </header>
            <p className="term-simple">{t.simple}</p>
            {t.analogy && (
              <p className="term-line">
                <span>Think of it like</span>
                {t.analogy}
              </p>
            )}
            {t.why && (
              <p className="term-line">
                <span>Why it matters</span>
                {t.why}
              </p>
            )}
            {(t.related?.length || t.lesson) && (
              <footer>
                {t.related?.length ? (
                  <div className="term-related">
                    {t.related.map((r) => (
                      <button key={r} className="chip chip-sm" onClick={() => onTerm(r)}>
                        {TERM_BY_ID[r].term}
                      </button>
                    ))}
                  </div>
                ) : null}
                {t.lesson && (
                  <button className="term-lesson" onClick={() => onLesson(t.lesson!)}>
                    <BookOpen size={12} aria-hidden /> {LESSON_BY_ID[t.lesson].title}
                  </button>
                )}
              </footer>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
