import { COMPONENTS } from '../engine/components';
import type { ComponentType, NodeConfig } from '../engine/types';
import { fromBase64Url, toBase64Url } from '../lib/base64url';

/** A design as it travels in a link (#d=...) or sits in storage. */
export interface SharedDesign {
  scenarioId: string;
  nodes: { id: string; type: ComponentType; x: number; y: number; config: NodeConfig }[];
  edges: { source: string; target: string }[];
}

type Packed = { v: 1; s: string; n: [string, ComponentType, number, number, NodeConfig][]; e: [string, string][] };

export function encodeDesign(d: SharedDesign): string {
  const packed: Packed = {
    v: 1,
    s: d.scenarioId,
    n: d.nodes.map((n) => [n.id, n.type, Math.round(n.x), Math.round(n.y), n.config]),
    e: d.edges.map((e) => [e.source, e.target]),
  };
  return toBase64Url(JSON.stringify(packed));
}

/** Parse and validate; returns null for anything malformed. */
export function decodeDesign(raw: string): SharedDesign | null {
  try {
    const p = JSON.parse(fromBase64Url(raw)) as Packed;
    if (p.v !== 1 || typeof p.s !== 'string' || !Array.isArray(p.n) || !Array.isArray(p.e)) return null;
    const nodes = p.n
      .filter((n) => Array.isArray(n) && typeof n[0] === 'string' && n[1] in COMPONENTS)
      .slice(0, 60)
      .map(([id, type, x, y, config]) => {
        const defaults = COMPONENTS[type].defaults;
        const clean: NodeConfig = { ...defaults };
        for (const k of Object.keys(defaults)) {
          const v = config?.[k];
          if (typeof v === typeof defaults[k]) clean[k] = v;
        }
        return { id: id.slice(0, 40), type, x: Number(x) || 0, y: Number(y) || 0, config: clean };
      });
    if (!nodes.some((n) => n.type === 'users')) return null;
    const ids = new Set(nodes.map((n) => n.id));
    const edges = p.e
      .filter((e) => Array.isArray(e) && ids.has(e[0]) && ids.has(e[1]) && e[0] !== e[1])
      .slice(0, 200)
      .map(([source, target]) => ({ source, target }));
    return { scenarioId: p.s, nodes, edges };
  } catch {
    return null;
  }
}

export function readHashDesign(): SharedDesign | null {
  const m = window.location.hash.match(/^#d=([A-Za-z0-9_-]+)$/);
  return m ? decodeDesign(m[1]) : null;
}
