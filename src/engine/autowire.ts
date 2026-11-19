import type { ComponentType } from './types';

/**
 * When someone taps a component in the palette, put it where it belongs in the pipeline
 * and connect it, so beginners never have to drag wires to see an effect.
 * Wires can still be edited by hand afterwards.
 */

export interface WNode {
  id: string;
  type: ComponentType;
}
export interface WEdge {
  source: string;
  target: string;
}

/** Rough order of stages from the user to the answer. */
const RANK: Record<ComponentType, number> = {
  users: 0,
  auth: 1,
  user_limits: 1,
  stt: 2,
  pii_redactor: 3,
  input_guard: 4,
  content_sanitizer: 5,
  semantic_cache: 6,
  memory: 7,
  embedding: 8,
  vector_db: 9,
  keyword_search: 9,
  reranker: 10,
  router: 11,
  fallback: 11,
  batch_queue: 11,
  agent: 12,
  agent_team: 12,
  llm: 20,
  gpu_llm: 20,
  validator: 21,
  output_guard: 22,
  action_approval: 23,
  tts: 24,
  eval_harness: 25,
  fairness_eval: 25,
  tracing: 26,
};

const isModel = (t: ComponentType) => t === 'llm' || t === 'gpu_llm';

/** The main line from Users onwards, following the first non-side branch at each step. */
function mainPath(nodes: WNode[], edges: WEdge[]): WNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = nodes.find((n) => n.type === 'users');
  if (!start) return [];
  const path: WNode[] = [start];
  const seen = new Set([start.id]);
  let cur = start;
  for (;;) {
    const outs = edges
      .filter((e) => e.source === cur.id && byId.has(e.target) && !seen.has(e.target))
      .map((e) => byId.get(e.target)!)
      // keyword search is a side branch in hybrid search; stay on the main line
      .sort((a, b) => Number(a.type === 'keyword_search') - Number(b.type === 'keyword_search'));
    if (!outs.length) break;
    cur = outs[0];
    seen.add(cur.id);
    path.push(cur);
  }
  return path;
}

/** Edges after connecting `added` into the design. */
export function autoWire(nodes: WNode[], edges: WEdge[], added: WNode): WEdge[] {
  const path = mainPath(nodes, edges);
  if (!path.length) return edges;
  const out = [...edges];
  const has = (s: string, t: string) => out.some((e) => e.source === s && e.target === t);
  const add = (s: string, t: string) => {
    if (s !== t && !has(s, t)) out.push({ source: s, target: t });
  };

  // Hybrid search: keyword search runs alongside vector search, from Users into the reranker (or the model)
  if (added.type === 'keyword_search') {
    const into = path.find((n) => n.type === 'reranker') ?? path.find((n) => isModel(n.type) || n.type === 'agent' || n.type === 'agent_team');
    add(path[0].id, added.id);
    if (into) add(added.id, into.id);
    return out;
  }

  // A second model behind a router or fallback becomes its other branch
  if (isModel(added.type)) {
    const splitter = path.find((n) => n.type === 'router' || n.type === 'fallback');
    if (splitter && path.some((n) => isModel(n.type))) {
      add(splitter.id, added.id);
      return out;
    }
  }

  // Otherwise splice it into the main line at its stage
  const r = RANK[added.type];
  let i = 0;
  for (let k = 0; k < path.length; k++) if (RANK[path[k].type] <= r) i = k;
  const before = path[i];
  const after = path[i + 1];
  if (after) {
    const at = out.findIndex((e) => e.source === before.id && e.target === after.id);
    if (at >= 0) out.splice(at, 1);
    add(before.id, added.id);
    add(added.id, after.id);
    // keep side branches that fed the node we displaced pointed at the right place
  } else {
    add(before.id, added.id);
  }
  return out;
}

/**
 * Tidy positions: columns by distance from Users, side branches below.
 * Returns a map of id → position.
 */
export function tidyLayout(nodes: WNode[], edges: WEdge[], colW = 270, rowH = 170): Map<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const start = nodes.find((n) => n.type === 'users');
  const pos = new Map<string, { x: number; y: number }>();
  if (!start) return pos;
  // longest-path depth on the (mostly) DAG, guarded against cycles
  depth.set(start.id, 0);
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      const d = depth.get(e.source);
      if (d === undefined) continue;
      if (d + 1 > (depth.get(e.target) ?? -1) && d + 1 < nodes.length) {
        depth.set(e.target, d + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const main = new Set(mainPath(nodes, edges).map((n) => n.id));
  const rowsUsed = new Map<number, number>();
  const unplaced: WNode[] = [];
  for (const n of nodes) {
    const d = depth.get(n.id);
    if (d === undefined) {
      unplaced.push(n);
      continue;
    }
    const row = main.has(n.id) ? 0 : (rowsUsed.get(d) ?? 0) + 1;
    if (!main.has(n.id)) rowsUsed.set(d, row);
    pos.set(n.id, { x: d * colW, y: row * rowH });
  }
  // anything not connected yet sits in a row underneath
  const lowest = Math.max(0, ...[...pos.values()].map((p) => p.y));
  unplaced.forEach((n, k) => pos.set(n.id, { x: k * colW, y: lowest + rowH }));
  return pos;
}

/**
 * Remove a component and reconnect what was on either side of it,
 * so deleting the middle of a pipeline doesn't silently cut it in two.
 */
export function removeAndHeal(edges: WEdge[], id: string): WEdge[] {
  const ins = edges.filter((e) => e.target === id).map((e) => e.source);
  const outs = edges.filter((e) => e.source === id).map((e) => e.target);
  const kept = edges.filter((e) => e.source !== id && e.target !== id);
  for (const s of ins) for (const t of outs) if (s !== t && !kept.some((e) => e.source === s && e.target === t)) kept.push({ source: s, target: t });
  return kept;
}
