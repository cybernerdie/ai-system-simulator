import { useCallback, useRef, useState } from 'react';

import type { ToastAction, ToastData } from '../../ui/Toast';

/** One toast at a time. Toasts with an action stay longer, so there's time to use it. */
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string, action?: ToastAction) => {
    setToast({ text, action });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), action ? 6000 : 2600);
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return { toast, show, dismiss };
}
