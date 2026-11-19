import { useCallback, useState } from 'react';
import { readFlag, writeFlag, type StorageKey } from '../../lib/storage';

/** A boolean preference that survives reloads. */
export function useStoredFlag(key: StorageKey, fallback: boolean, override?: boolean): [boolean, () => void] {
  const [on, setOn] = useState(() => override ?? readFlag(key, fallback));
  const toggle = useCallback(() => {
    setOn((v) => {
      writeFlag(key, !v);
      return !v;
    });
  }, [key]);
  return [on, toggle];
}
