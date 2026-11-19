import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

/* ---------- command palette (keyboard play) ---------- */

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keys?: string;
  disabled?: string | false;
  run: () => void;
}

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return commands.filter((c) => !n || `${c.label} ${c.group} ${c.hint ?? ''}`.toLowerCase().includes(n));
  }, [q, commands]);
  useEffect(() => setI(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [i]);
  const run = (c: Command | undefined) => {
    if (!c || c.disabled) return;
    onClose();
    c.run();
  };
  return (
    <div className="overlay cmdk-overlay" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk">
        <label className="search cmdk-search">
          <Search size={15} aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Add a component or run a command…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={shown[i] ? `cmdk-${shown[i].id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setI((x) => Math.min(shown.length - 1, x + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(shown[i]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <ul className="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {shown.map((c, j) => (
            <li
              key={c.id}
              id={`cmdk-${c.id}`}
              data-i={j}
              role="option"
              aria-selected={j === i}
              aria-disabled={!!c.disabled}
              className={`cmdk-item${j === i ? ' is-active' : ''}${c.disabled ? ' is-disabled' : ''}`}
              onMouseMove={() => setI(j)}
              onClick={() => run(c)}
            >
              <span className="cmdk-group">{c.group}</span>
              <span className="cmdk-label">{c.label}</span>
              {c.disabled ? <em>{c.disabled}</em> : c.keys ? <kbd>{c.keys}</kbd> : c.hint ? <em>{c.hint}</em> : null}
            </li>
          ))}
          {!shown.length && <li className="cmdk-empty">Nothing matches "{q}".</li>}
        </ul>
        <footer className="cmdk-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> choose
          </span>
          <span>
            <kbd>Enter</kbd> run
          </span>
          <span>
            <kbd>Space</kbd> run or pause the simulation
          </span>
          <span>
            <kbd>/</kbd> open this
          </span>
        </footer>
      </div>
    </div>
  );
}
