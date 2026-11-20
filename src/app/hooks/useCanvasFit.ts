import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FitViewOptions, ReactFlowInstance } from '@xyflow/react';

/** React Flow's own floor is 0.5, too high to fit a four-part pipeline across a phone. */
export const MIN_ZOOM = 0.2;
// padding is in pixels: a bare number here would be read as 0.08px
// the top keeps the first card clear of the complaint bubble that floats over the canvas
export const PHONE_PAD = { top: 84, side: 20 };
const PHONE_FIT: FitViewOptions = {
  padding: { top: `${PHONE_PAD.top}px`, right: `${PHONE_PAD.side}px`, bottom: `${PHONE_PAD.side}px`, left: `${PHONE_PAD.side}px` },
  maxZoom: 1,
  minZoom: MIN_ZOOM,
};
const OVERLAYS = '.pressure-window, .telemetry, .canvas, .react-flow';

/** Fit the diagram into the space the floating pressure window and metrics dock leave free. */
export function fitOptions(): FitViewOptions {
  // On phones the overlays sit outside the canvas, so there's nothing to leave room for.
  if (window.innerWidth <= 900) return PHONE_FIT;
  const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
  const top = document.querySelector('.pressure-window')?.getBoundingClientRect();
  const bottom = document.querySelector('.telemetry')?.getBoundingClientRect();
  const padTop = canvas && top ? Math.max(top.bottom - canvas.top + 24, 120) : 190;
  const padBottom = canvas && bottom ? Math.max(canvas.bottom - bottom.top + 24, 100) : 150;
  const px = (n: number) => `${Math.round(n)}px` as `${number}px`;
  return { padding: { top: px(padTop), bottom: px(padBottom), left: px(48), right: px(48) }, maxZoom: 1.05, minZoom: 0.35 };
}

/**
 * Keep the diagram framed as the overlays around it change size, until the player pans or zooms
 * themselves. `fit` reframes on demand and resumes auto-fitting.
 */
export function useCanvasFit(flow: Pick<ReactFlowInstance, 'fitView'>) {
  const userMoved = useRef(false);

  useEffect(() => {
    let last = '';
    let timer = 0;
    const check = () => {
      const h = (sel: string) => Math.round(document.querySelector(sel)?.getBoundingClientRect().height ?? 0);
      const rf = document.querySelector('.react-flow')?.getBoundingClientRect();
      const key = `${h('.pressure-window')}:${h('.telemetry')}:${Math.round(rf?.width ?? 0)}x${Math.round(rf?.height ?? 0)}:${window.innerWidth}`;
      if (key === last) return;
      last = key;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!userMoved.current) void flow.fitView({ ...fitOptions(), duration: 200 });
      }, 120);
    };
    const resize = new ResizeObserver(check);
    const observe = () => {
      resize.disconnect();
      document.querySelectorAll(OVERLAYS).forEach((el) => resize.observe(el));
    };
    observe();
    // the overlays remount when they switch between their empty and live states
    const remount = new MutationObserver(observe);
    const canvas = document.querySelector('.canvas');
    if (canvas) remount.observe(canvas, { childList: true });
    return () => {
      resize.disconnect();
      remount.disconnect();
      window.clearTimeout(timer);
    };
  }, [flow]);

  const fit = useCallback(
    (duration = 250) => {
      userMoved.current = false;
      requestAnimationFrame(() => void flow.fitView({ ...fitOptions(), duration }));
    },
    [flow],
  );
  const markMoved = useCallback(() => {
    userMoved.current = true;
  }, []);
  return useMemo(() => ({ fit, markMoved }), [fit, markMoved]);
}
