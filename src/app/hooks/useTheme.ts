import { useCallback, useEffect, useState } from 'react';
import { saveTheme, savedTheme, type Theme } from '../../lib/progress';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const systemTheme = (): Theme => (window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light');

/** Light or dark: the player's choice if they made one, otherwise the system's, followed live. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme());

  useEffect(() => {
    // Flip in one frame: transitions are paused while the colours change so nothing lags or sticks halfway.
    const root = document.documentElement;
    root.classList.add('theme-switching');
    root.dataset.theme = theme;
    void root.offsetHeight;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    return () => cancelAnimationFrame(id);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return;
    const follow = () => {
      if (!savedTheme()) setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  }, []);

  return [theme, toggle];
}
