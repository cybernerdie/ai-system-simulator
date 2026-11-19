import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** State that resets to null a fixed time after it's set. */
export function useAutoClear<T>(ms: number): [T | null, Dispatch<SetStateAction<T | null>>] {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (value === null) return;
    const t = window.setTimeout(() => setValue(null), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return [value, setValue];
}
