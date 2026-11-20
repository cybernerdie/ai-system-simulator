import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';

export interface MoreItem {
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
  /** A link out instead of an action. */
  href?: string;
  /** Shown as a switch (sound effects); `undefined` for a plain action. */
  checked?: boolean;
  /** Keyboard shortcut to show beside the label. */
  keys?: string;
  /** Hidden on touch screens, where there's no keyboard to use it with. */
  keysOnly?: boolean;
}

/**
 * The top bar's "More" menu: settings and extras a player rarely needs mid-level, so the bar itself
 * only holds what a level asks of them. A menu button with arrow-key navigation, closed by Escape,
 * an outside tap or choosing an item.
 */
export function MoreMenu({ items }: { items: MoreItem[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const all = [...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => all[(i + all.length) % all.length]?.focus();
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(all.length - 1);
    else if (e.key === 'Tab') setOpen(false);
    else return;
    if (e.key !== 'Tab') e.preventDefault();
  };

  return (
    <div className="more" ref={box}>
      <button
        ref={button}
        className="btn btn-ghost btn-icon"
        data-tour="more"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Theme, sound, shortcuts and help"
        onClick={() => setOpen((o) => !o)}
      >
        <Ellipsis size={15} aria-hidden />
        <span>More</span>
      </button>
      {open && (
        <div className="more-menu" role="menu" aria-label="More" ref={list} onKeyDown={onKey}>
          {items.map((it) => {
            const body = (
              <>
                <span className="more-icon" aria-hidden>
                  {it.icon}
                </span>
                <span className="more-label">{it.label}</span>
                {it.checked !== undefined && <span className={`more-switch${it.checked ? ' is-on' : ''}`} aria-hidden />}
                {it.keys && <kbd>{it.keys}</kbd>}
              </>
            );
            const cls = `more-item${it.keysOnly ? ' only-keys' : ''}`;
            return it.href ? (
              <a key={it.label} className={cls} role="menuitem" tabIndex={-1} href={it.href} target="_blank" rel="noreferrer" onClick={() => close(false)}>
                {body}
              </a>
            ) : (
              <button
                key={it.label}
                className={cls}
                role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={it.checked}
                tabIndex={-1}
                onClick={() => {
                  it.onSelect?.();
                  // switches stay open so a player can see the change; actions close the menu
                  if (it.checked === undefined) close(false);
                }}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
