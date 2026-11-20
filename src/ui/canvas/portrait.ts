import { createContext } from 'react';
import type { SimFlowNode } from './SimNodeView';

/**
 * Phones show the pipeline top to bottom. Designs are stored left to right (levels, saved designs
 * and share links all use that), so portrait is only a view: positions are transposed on the way into
 * the canvas, and phones don't drag cards, so nothing needs mapping back.
 */
export const PortraitContext = createContext(false);

/** Authored columns are 270 apart and rows about 130, so the axes are rescaled as well as swapped. */
const ACROSS = 1.9;
const DOWN = 0.63;

export function toPortrait(nodes: SimFlowNode[]): SimFlowNode[] {
  return nodes.map((n) => ({ ...n, position: { x: n.position.y * ACROSS, y: n.position.x * DOWN } }));
}

const CARD = { width: 230, height: 110 };
/** Group bands reach this far beyond their cards (see zones.ts), and fit view includes them. */
const BAND = { x: 32, y: 54 };

/**
 * How tall the phone canvas needs to be to show the whole diagram at the zoom that fits its width,
 * so a short pipeline doesn't sit in a mostly empty box and a long one isn't shrunk to fit a fixed height.
 */
export function portraitHeight(nodes: SimFlowNode[], width: number, pad: { top: number; side: number }, min = 280, max = 900): number {
  if (!nodes.length) return min;
  const xs = nodes.map((n) => n.position.x);
  const ys = nodes.map((n) => n.position.y);
  const right = Math.max(...nodes.map((n) => n.position.x + (n.measured?.width ?? CARD.width)));
  const bottom = Math.max(...nodes.map((n) => n.position.y + (n.measured?.height ?? CARD.height)));
  const zoom = Math.min(1, (width - 2 * pad.side) / (right - Math.min(...xs) + BAND.x));
  return Math.round(Math.min(max, Math.max(min, (bottom - Math.min(...ys) + BAND.y) * zoom + pad.top + pad.side)));
}
