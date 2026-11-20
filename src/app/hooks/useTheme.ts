import { useCallback, useEffect, useState } from 'react';
import { saveTheme, savedTheme, type Theme } from '../../lib/progress';

/** Light unless the player has switched to dark. The choice is remembered. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? 'light');

  useEffect(() => {
    // Flip in one frame: transitions are paused while the colours change so nothing lags or sticks halfway.
    const root = document.documentElement;
    root.classList.add('theme-switching');
    root.dataset.theme = theme;
    void root.offsetHeight;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    return () => cancelAnimationFrame(id);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  }, []);

  return [theme, toggle];
}
