import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Clock, Lightbulb, Play, Search, Sparkles, X } from 'lucide-react';
import { LESSONS, LESSON_BY_ID, TERMS, TERM_BY_ID, type Lesson, type TermCategory } from '../content/learn';
import { SCENARIOS } from '../engine/scenarios';
import { KindIcon } from './icons';
import { COMPONENTS } from '../engine/components';

export type HubView = { tab: 'lessons'; lessonId: string } | { tab: 'glossary'; termId?: string };

const CATEGORIES: TermCategory[] = ['Models', 'Retrieval', 'Production', 'Agents', 'Safety', 'Quality'];

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
            <button role="tab" aria-pressed={view.tab === 'lessons'} onClick={() => setView({ tab: 'lessons', lessonId: view.tab === 'lessons' ? view.lessonId : LESSONS[0].id })}>
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
            lesson={LESSON_BY_ID[view.lessonId] ?? LESSONS[0]}
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
  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
  const next = LESSONS[idx + 1];
  const scenario = lesson.scenarioId ? SCENARIOS.find((s) => s.id === lesson.scenarioId) : undefined;
  const readRef = useRef<HTMLElement>(null);
  useEffect(() => {
    readRef.current?.scrollTo({ top: 0 });
  }, [lesson.id]);

  return (
    <div className="hub-body lessons">
      <nav className="lesson-nav" aria-label="Lessons">
        <ol>
          {LESSONS.map((l, i) => (
            <li key={l.id}>
              <button className={l.id === lesson.id ? 'is-current' : ''} onClick={() => onPick(l.id)} aria-current={l.id === lesson.id}>
                <span className="lesson-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="lesson-nav-title">{l.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <article className="lesson" ref={readRef}>
        <div className="lesson-inner">
          <p className="lesson-meta">
            <span>Lesson {idx + 1}</span>
            <span className="dot-sep" aria-hidden />
            <Clock size={12} aria-hidden /> {lesson.minutes} min read
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
              <button className="btn btn-primary" onClick={() => onTry(scenario.id)}>
                <Play size={13} fill="currentColor" aria-hidden /> Try it: {scenario.title.replace(/^\d+ · /, '')}
              </button>
            ) : (
              <span />
            )}
            {next && (
              <button className="btn btn-ghost" onClick={() => onPick(next.id)}>
                Next: {next.title} <ArrowRight size={14} aria-hidden />
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${TERMS.length} terms…`} autoFocus={!focusId} />
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
                {t.related?.map((r) => (
                  <button key={r} className="chip chip-sm" onClick={() => onTerm(r)}>
                    {TERM_BY_ID[r].term}
                  </button>
                ))}
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
