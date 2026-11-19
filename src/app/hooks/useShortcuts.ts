import { useEffect, useRef } from 'react';

const isTyping = (el: HTMLElement) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable;

/**
 * Space runs and pauses; '/' or Ctrl/Cmd+K opens the command palette. Both stand down while a
 * dialog is open or the player is typing.
 */
export function useShortcuts({ blocked, onToggleRun, onCommands }: { blocked: boolean; onToggleRun: () => void; onCommands?: () => void }) {
  const latest = useRef({ blocked, onToggleRun, onCommands });
  latest.current = { blocked, onToggleRun, onCommands };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { blocked: modal, onToggleRun: toggle, onCommands: commands } = latest.current;
      const el = e.target as HTMLElement;
      const typing = isTyping(el);
      if (modal) return;
      if (e.code === 'Space' && !typing && el.tagName !== 'BUTTON') {
        e.preventDefault();
        toggle();
      }
      const palette = (e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey));
      if (palette && commands) {
        e.preventDefault();
        commands();
      }
    };
    // After a mouse click, drop focus from toolbar buttons, so the next Space runs the
    // simulation instead of pressing the same button again.
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return;
      const b = (e.target as HTMLElement).closest?.('.palette-item, .topbar button, .topbar a');
      if (b instanceof HTMLElement) b.blur();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, []);
}
