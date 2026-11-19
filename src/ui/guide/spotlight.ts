/** Measuring what to spotlight and where to put the card beside it, shared by the tour and guide cards. */

export type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const GAP = 14;
const CARD_W = 340;

export function measure(selector: string): Rect | null {
  const els = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!els.length) return null;
  let top = Infinity,
    left = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  // keep the spotlight on screen
  top = Math.max(top - PAD, 4);
  left = Math.max(left - PAD, 4);
  right = Math.min(right + PAD, window.innerWidth - 4);
  bottom = Math.min(bottom + PAD, window.innerHeight - 4);
  return { top, left, width: right - left, height: bottom - top };
}

/** Put the card on whichever side of the spotlight has the most room. */
export function place(r: Rect, cardH: number): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 24);
  const clampX = (x: number) => Math.min(Math.max(x, 12), vw - w - 12);
  const clampY = (y: number) => Math.min(Math.max(y, 12), vh - cardH - 12);
  const room = {
    right: vw - (r.left + r.width),
    left: r.left,
    bottom: vh - (r.top + r.height),
    top: r.top,
  };
  if (room.right >= w + GAP + 12) return { left: r.left + r.width + GAP, top: clampY(r.top) };
  if (room.left >= w + GAP + 12) return { left: r.left - w - GAP, top: clampY(r.top) };
  if (room.bottom >= cardH + GAP + 12) return { left: clampX(r.left + r.width / 2 - w / 2), top: r.top + r.height + GAP };
  if (room.top >= cardH + GAP + 12) return { left: clampX(r.left + r.width / 2 - w / 2), top: r.top - cardH - GAP };
  // nothing fits: overlap the bottom of the spotlight
  return { left: clampX(r.left + r.width / 2 - w / 2), top: vh - cardH - 16 };
}
