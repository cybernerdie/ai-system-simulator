import { COMPONENTS } from '../engine/components';
import type { ComponentType, NodeConfig } from '../engine/types';

/* ---------- shareable designs (URL hash) ---------- */

export interface SharedDesign {
  scenarioId: string;
  nodes: { id: string; type: ComponentType; x: number; y: number; config: NodeConfig }[];
  edges: { source: string; target: string }[];
}

type Packed = { v: 1; s: string; n: [string, ComponentType, number, number, NodeConfig][]; e: [string, string][] };

const toB64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64Url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
};

export function encodeDesign(d: SharedDesign): string {
  const packed: Packed = {
    v: 1,
    s: d.scenarioId,
    n: d.nodes.map((n) => [n.id, n.type, Math.round(n.x), Math.round(n.y), n.config]),
    e: d.edges.map((e) => [e.source, e.target]),
  };
  return toB64Url(JSON.stringify(packed));
}

/** Parse and validate; returns null for anything malformed. */
export function decodeDesign(raw: string): SharedDesign | null {
  try {
    const p = JSON.parse(fromB64Url(raw)) as Packed;
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

/* ---------- progress (localStorage, best effort) ---------- */

const KEY_CLEARED = 'aisim.cleared.v1';
const KEY_INTRO = 'aisim.introSeen.v1';

export function loadCleared(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_CLEARED) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
export function saveCleared(s: Set<string>) {
  try {
    localStorage.setItem(KEY_CLEARED, JSON.stringify([...s]));
  } catch {
    /* storage unavailable: progress just won't persist */
  }
}
export function introSeen(): boolean {
  try {
    return localStorage.getItem(KEY_INTRO) === '1';
  } catch {
    return false;
  }
}
export function markIntroSeen() {
  try {
    localStorage.setItem(KEY_INTRO, '1');
  } catch {
    /* ignore */
  }
}

const KEY_READ = 'aisim.lessonsRead.v1';

export function loadRead(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_READ) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
export function saveRead(s: Set<string>) {
  try {
    localStorage.setItem(KEY_READ, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/* ---------- theme ---------- */

export type Theme = 'light' | 'dark';
const KEY_THEME = 'aisim.theme.v1';

/** Saved choice, or null if the user hasn't picked one (follow the system). */
export function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY_THEME);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}
export function saveTheme(t: Theme) {
  try {
    localStorage.setItem(KEY_THEME, t);
  } catch {
    /* ignore */
  }
}
export function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* ---------- work in progress (per scenario) ---------- */

const KEY_LAST = 'aisim.lastScenario.v1';
const KEY_DESIGNS = 'aisim.designs.v1';

export function loadLastScenario(): string | null {
  try {
    return localStorage.getItem(KEY_LAST);
  } catch {
    return null;
  }
}
export function saveLastScenario(id: string) {
  try {
    localStorage.setItem(KEY_LAST, id);
  } catch {
    /* ignore */
  }
}
function readDesigns(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_DESIGNS) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
/** The design you last left in this scenario, if you changed it. */
export function loadDesign(scenarioId: string): SharedDesign | null {
  const raw = readDesigns()[scenarioId];
  if (typeof raw !== 'string') return null;
  const d = decodeDesign(raw);
  return d && d.scenarioId === scenarioId ? d : null;
}
export function saveDesign(d: SharedDesign) {
  try {
    const all = readDesigns();
    all[d.scenarioId] = encodeDesign(d);
    localStorage.setItem(KEY_DESIGNS, JSON.stringify(all));
  } catch {
    /* storage full or unavailable: work just won't persist */
  }
}
export function clearDesign(scenarioId: string) {
  try {
    const all = readDesigns();
    delete all[scenarioId];
    localStorage.setItem(KEY_DESIGNS, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
export function savedScenarioIds(): Set<string> {
  return new Set(Object.keys(readDesigns()));
}
