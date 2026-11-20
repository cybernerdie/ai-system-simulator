import { useEffect, useRef, useState } from 'react';
import { newlyEarned, type Progress } from '../../engine/modes/achievements';
import { loadUnlocked, saveUnlocked } from '../../lib/progress';
import { track } from '../../lib/analytics';
import { play } from '../../ui/audio/sfx';

const TOAST_MS = 3400;

/**
 * Awards achievements as progress changes and queues a toast for each one, shown one at a time.
 * While `hold` is set (a phone's win screen, which the toast would cover) they wait their turn.
 */
export function useAchievements(progress: Progress, hold = false) {
  const [unlocked, setUnlocked] = useState(() => loadUnlocked());
  const [queue, setQueue] = useState<string[]>([]);
  const firstCheck = useRef(true);
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  useEffect(() => {
    const fresh = newlyEarned(progress, unlockedRef.current);
    const quietly = firstCheck.current;
    firstCheck.current = false;
    if (!fresh.length) return;
    const next = { ...unlockedRef.current };
    for (const a of fresh) next[a.id] = Date.now();
    saveUnlocked(next);
    setUnlocked(next);
    // earned before achievements existed (or in another tab): record them without fanfare
    if (quietly) return;
    setQueue((q) => [...q, ...fresh.map((a) => a.title)]);
    fresh.forEach((a) => track('achievement', { id: a.id }));
  }, [progress]);

  useEffect(() => {
    if (!queue.length || hold) return;
    play('star', 0.2);
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [queue, hold]);

  return { unlocked, showing: hold ? null : (queue[0] ?? null) };
}
