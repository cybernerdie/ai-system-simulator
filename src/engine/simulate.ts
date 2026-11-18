import {
  CHUNK_SPECS,
  MODEL_RANK,
  MODEL_SPECS,
  type ChunkSize,
  type ModelSize,
} from './components';
import type {
  Cause,
  ComponentType,
  Metrics,
  NodeStat,
  Outcome,
  SimGraph,
  SimNode,
  TrafficProfile,
} from './types';

/** Deterministic PRNG so runs (and tests) are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_PROMPT_TOKENS = 450;
const OUTPUT_TOKENS = 220;
const AGENT_STEP_TOKENS = 350;
const NETWORK_MS = 40;

interface Req {
  kb: boolean;
  exact: boolean;
  tool: boolean;
  adversarial: boolean;
  easy: boolean;
  repeat: boolean;
}

interface Trace {
  req: Req;
  outcome: Outcome;
  cause?: Cause;
  latency: number;
  ttft: number;
  cost: number;
  /** tokens charged to each LLM node id */
  llmTokens: Record<string, number>;
  touched: string[];
  recallHit?: boolean;
  cacheHit?: boolean;
}

const cfgNum = (n: SimNode, k: string, d: number) => {
  const v = n.config[k];
  return typeof v === 'number' ? v : d;
};
const cfgStr = <T extends string>(n: SimNode, k: string, d: T): T => {
  const v = n.config[k];
  return (typeof v === 'string' ? v : d) as T;
};

/** Nodes that sit on some path from Users to an LLM. Only those take part. */
export function activeNodes(graph: SimGraph): Set<string> {
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const e of graph.edges) {
    out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
    inc.set(e.target, [...(inc.get(e.target) ?? []), e.source]);
  }
  const walk = (starts: string[], adj: Map<string, string[]>) => {
    const seen = new Set(starts);
    const stack = [...starts];
    while (stack.length) {
      const id = stack.pop()!;
      for (const nx of adj.get(id) ?? []) {
        if (!seen.has(nx)) {
          seen.add(nx);
          stack.push(nx);
        }
      }
    }
    return seen;
  };
  const users = graph.nodes.filter((n) => n.type === 'users').map((n) => n.id);
  const llms = graph.nodes.filter((n) => n.type === 'llm').map((n) => n.id);
  const fwd = walk(users, out);
  const back = walk(llms, inc);
  const core = new Set([...fwd].filter((id) => back.has(id)));
  // post-processing nodes hanging off a live LLM (e.g. an output judge) count too
  const liveLLMs = llms.filter((id) => core.has(id));
  for (const id of walk(liveLLMs, out)) core.add(id);
  return core;
}

function jitter(rng: () => number) {
  // log-normal-ish body with an occasional slow tail
  const u = rng() + rng() + rng() - 1.5; // ~N(0, 0.5)
  let f = Math.exp(u * 0.35);
  if (rng() < 0.02) f *= 2.5 + rng() * 2;
  return f;
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[i];
}

export interface SimOptions {
  samples?: number;
  seed?: number;
}

export function simulate(graph: SimGraph, traffic: TrafficProfile, opts: SimOptions = {}): Metrics {
  const N = opts.samples ?? 500;
  const rng = mulberry32(opts.seed ?? 1);
  const active = activeNodes(graph);
  const on = (t: ComponentType) => graph.nodes.filter((n) => n.type === t && active.has(n.id));
  const first = (t: ComponentType) => on(t)[0];

  const warnings: string[] = [];
  const users = graph.nodes.find((n) => n.type === 'users');
  const llms = on('llm');
  if (!users) warnings.push('Add a Users node — nothing is sending traffic.');
  if (!llms.length) warnings.push('No LLM is reachable from Users. Connect a path Users → … → LLM.');

  const inputGuard = first('input_guard');
  const cache = first('semantic_cache');
  const router = first('router');
  const embedding = first('embedding');
  const vdb = first('vector_db');
  const kw = first('keyword_search');
  const reranker = first('reranker');
  const agent = first('agent');
  const judge = first('output_guard');

  if (vdb && !embedding)
    warnings.push('Vector DB has no Embedding Model on its path — queries can\'t be turned into vectors, so it returns nothing.');
  if (reranker && !vdb && !kw) warnings.push('Reranker has nothing to rerank — add a retriever before it.');
  const sizes = new Set(llms.map((l) => cfgStr<ModelSize>(l, 'size', 'medium')));
  if (router && sizes.size < 2)
    warnings.push('Router needs at least two different model sizes downstream to route between.');
  for (const n of graph.nodes) {
    if (n.type !== 'users' && !active.has(n.id) && graph.nodes.length > 1)
      warnings.push(`${labelOf(n)} isn't on a path from Users to an LLM, so it's doing nothing.`);
  }

  const vectorOn = !!(vdb && embedding);
  const retrievalOn = vectorOn || !!kw;
  const topK = vdb ? cfgNum(vdb, 'topK', 4) : 5;
  const chunk = vdb ? cfgStr<ChunkSize>(vdb, 'chunk', 'medium') : 'medium';
  const cs = CHUNK_SPECS[chunk];
  const keep = reranker ? Math.min(cfgNum(reranker, 'keep', 4), topK) : topK;
  const chunksToLLM = retrievalOn ? keep : 0;

  // Recall for one request
  const curve = (k: number) => 1 - Math.exp(-k / 2.2);
  const recallFor = (exact: boolean) => {
    if (!retrievalOn) return 0;
    const rv = vectorOn ? cs.cap * (exact ? 0.45 : 1) * curve(topK) : 0;
    const rk = kw ? (exact ? 0.93 : 0.45) * curve(topK) : 0;
    let r = 1 - (1 - rv) * (1 - rk);
    if (reranker && keep < topK) r *= 0.97; // reranker occasionally drops the right chunk
    return r * cs.completeness;
  };

  // "Lost in the middle": many unranked chunks confuse the model
  const noisePenalty = (() => {
    if (!retrievalOn) return 1;
    const effTokens = chunksToLLM * cs.tokens;
    const unranked = reranker ? 0.4 : 1;
    const over = Math.max(0, effTokens - 2000) / 1000;
    return Math.max(0.55, 1 - 0.045 * over * unranked);
  })();

  // LLM choice
  const sortedLLMs = [...llms].sort(
    (a, b) => MODEL_RANK[cfgStr<ModelSize>(a, 'size', 'medium')] - MODEL_RANK[cfgStr<ModelSize>(b, 'size', 'medium')],
  );
  const pickLLM = (req: Req, i: number): SimNode => {
    if (router && sizes.size >= 2) return req.easy ? sortedLLMs[0] : sortedLLMs[sortedLLMs.length - 1];
    return llms[i % llms.length];
  };

  const strictness = inputGuard ? cfgNum(inputGuard, 'strictness', 0.7) : 0;
  const threshold = cache ? cfgNum(cache, 'threshold', 0.9) : 0.9;
  const cacheHitP = Math.max(0.3, Math.min(0.98, 0.98 - (threshold - 0.8) * 2.5));
  const cacheFalseHitP = Math.max(0, 0.92 - threshold) * 1.6;
  const maxSteps = agent ? cfgNum(agent, 'maxSteps', 20) : 0;

  const traces: Trace[] = [];

  for (let i = 0; i < N; i++) {
    const req: Req = {
      adversarial: rng() < traffic.adversarialShare,
      kb: rng() < traffic.kbShare,
      exact: false,
      tool: rng() < traffic.toolShare,
      easy: rng() < traffic.easyShare,
      repeat: rng() < traffic.repeatShare,
    };
    req.exact = req.kb && rng() < traffic.exactTermShare;
    if (req.adversarial) req.repeat = false;

    const t: Trace = { req, outcome: 'correct', latency: NETWORK_MS, ttft: 0, cost: 0, llmTokens: {}, touched: [] };
    traces.push(t);
    if (!llms.length) {
      t.outcome = 'rate_limited';
      continue;
    }
    const touch = (n: SimNode, ms: number, usd: number) => {
      t.touched.push(n.id);
      t.latency += ms * jitter(rng);
      t.cost += usd;
    };

    // 1. Input guardrail
    if (inputGuard) {
      touch(inputGuard, 35, 0.00008);
      const catchP = 0.55 + 0.44 * strictness;
      const fpP = Math.max(0, (strictness - 0.5) * 0.06);
      if (req.adversarial && rng() < catchP) {
        t.outcome = 'blocked';
        t.ttft = t.latency;
        continue;
      }
      if (!req.adversarial && rng() < fpP) {
        t.outcome = 'declined';
        t.cause = 'guard_false_positive';
        t.ttft = t.latency;
        continue;
      }
    }

    // 2. Semantic cache
    if (cache) {
      touch(cache, 15, 0.00001);
      if (req.repeat && rng() < cacheHitP) {
        t.outcome = 'correct';
        t.cacheHit = true;
        t.ttft = t.latency;
        continue;
      }
      if (!req.repeat && !req.adversarial && rng() < cacheFalseHitP) {
        t.outcome = 'hallucinated';
        t.cause = 'cache_false_hit';
        t.ttft = t.latency;
        continue;
      }
    }

    // 3. Retrieval
    let grounded = false;
    if (router) touch(router, 12, 0.00002);
    if (retrievalOn) {
      if (vectorOn) {
        touch(embedding!, 25, 0.00002);
        touch(vdb!, 30, 0.00001);
      }
      if (kw) touch(kw, 15, 0.000005);
      if (reranker) touch(reranker, 50 + topK * 6, 0.00002 * topK);
      if (req.kb) {
        grounded = rng() < recallFor(req.exact);
        t.recallHit = grounded;
      }
    }

    // 4. LLM (+ agent loop)
    const llm = pickLLM(req, i);
    const size = cfgStr<ModelSize>(llm, 'size', 'medium');
    const m = MODEL_SPECS[size];
    const streaming = llm.config.streaming === true;
    const inputTokens = BASE_PROMPT_TOKENS + chunksToLLM * cs.tokens;

    let steps = 1;
    let toolOk = !req.tool;
    let toolCause: Cause | undefined;
    if (agent) {
      t.touched.push(agent.id);
      if (req.tool) {
        const needed = 2 + Math.floor(rng() * 4); // 2..5
        const stuck = rng() < 0.1;
        if (stuck) {
          steps = maxSteps;
          toolOk = false;
          toolCause = 'agent_loop';
        } else if (needed > maxSteps) {
          steps = maxSteps;
          toolOk = false;
          toolCause = 'agent_limit';
        } else {
          steps = needed;
          toolOk = true;
        }
      }
    } else if (req.tool) {
      toolCause = 'no_tools';
    }

    let totalIn = 0;
    let llmMs = 0;
    let firstTokenMs = 0;
    for (let s = 0; s < steps; s++) {
      const stepIn = inputTokens + s * AGENT_STEP_TOKENS;
      const out = s === steps - 1 ? OUTPUT_TOKENS : 60;
      totalIn += stepIn;
      if (stepIn > m.context) {
        t.outcome = 'overflow';
        t.cause = 'context_overflow';
        break;
      }
      const ttft = m.ttftBase + stepIn * m.prefillMsPerTok;
      const gen = out * m.msPerOutTok;
      const j = jitter(rng);
      if (s === steps - 1) firstTokenMs = llmMs + ttft * j;
      llmMs += (ttft + gen) * j;
      t.cost += (stepIn * m.inPerM + out * m.outPerM) / 1_000_000;
      t.llmTokens[llm.id] = (t.llmTokens[llm.id] ?? 0) + stepIn + out;
    }
    t.touched.push(llm.id);
    if (t.outcome === 'overflow') {
      t.latency += m.ttftBase;
      t.ttft = t.latency;
      continue;
    }
    const beforeLLM = t.latency;
    t.latency += llmMs;
    t.ttft = streaming ? beforeLLM + firstTokenMs : t.latency;

    // 5. Decide the answer
    if (req.adversarial) {
      t.outcome = rng() < m.injectable ? 'injected' : 'blocked';
      if (t.outcome === 'injected') t.cause = 'injection';
    } else {
      const unsure = (cause: Cause) => {
        if (rng() < m.hallucinateWhenUnsure) {
          t.outcome = 'hallucinated';
        } else t.outcome = 'declined';
        t.cause = cause;
      };
      if (!toolOk) unsure(toolCause!);
      else if (req.kb && !grounded) unsure(retrievalOn ? 'retrieval_miss' : 'no_knowledge');
      else {
        let acc = req.easy ? m.accEasy : m.accHard;
        if (req.kb) acc = (acc + (1 - acc) * 0.5) * noisePenalty; // the right chunk in context makes it easier
        if (rng() >= acc) {
          t.outcome = 'hallucinated';
          t.cause = req.kb && noisePenalty < 0.93 && rng() < 0.7 ? 'context_noise' : 'weak_reasoning';
        } else t.outcome = 'correct';
      }
    }

    // 6. Output judge
    if (judge) {
      touch(judge, 380, 0.0004);
      t.ttft = t.latency; // has to see the whole answer before releasing it
      if (t.outcome === 'hallucinated' && rng() < 0.72) t.outcome = 'declined';
      else if (t.outcome === 'injected' && rng() < 0.6) {
        t.outcome = 'blocked';
        t.cause = undefined;
      } else if (t.outcome === 'correct' && rng() < 0.03) {
        t.outcome = 'declined';
        t.cause = 'guard_false_positive';
      }
    }
  }

  // Rate limits: tokens-per-minute per LLM node
  const rps = traffic.rps;
  const tpmUse: Record<string, number> = {};
  for (const l of llms) {
    const toks = traces.reduce((s, t) => s + (t.llmTokens[l.id] ?? 0), 0);
    tpmUse[l.id] = (toks / N) * rps * 60;
  }
  const rejectP: Record<string, number> = {};
  for (const l of llms) {
    const limit = MODEL_SPECS[cfgStr<ModelSize>(l, 'size', 'medium')].tpm;
    rejectP[l.id] = tpmUse[l.id] > limit ? 1 - limit / tpmUse[l.id] : 0;
  }
  for (const t of traces) {
    const ids = Object.keys(t.llmTokens);
    if (ids.some((id) => rng() < rejectP[id])) {
      t.outcome = 'rate_limited';
      t.cause = 'rate_limit';
      t.latency = NETWORK_MS + 80;
      t.ttft = t.latency;
    }
  }

  // Aggregate
  const outcomes: Record<Outcome, number> = {
    correct: 0, hallucinated: 0, declined: 0, blocked: 0, injected: 0, rate_limited: 0, overflow: 0,
  };
  const causes: Partial<Record<Cause, number>> = {};
  for (const t of traces) {
    outcomes[t.outcome]++;
    if (t.cause) causes[t.cause] = (causes[t.cause] ?? 0) + 1;
  }
  const legit = traces.filter((t) => !t.req.adversarial && t.outcome !== 'rate_limited' && t.outcome !== 'overflow');
  const adv = traces.filter((t) => t.req.adversarial && t.outcome !== 'rate_limited' && t.outcome !== 'overflow');
  const kbT = traces.filter((t) => t.req.kb && t.recallHit !== undefined);
  const lat = traces.filter((t) => t.outcome !== 'rate_limited').map((t) => t.latency).sort((a, b) => a - b);
  const ttfts = traces.filter((t) => t.outcome !== 'rate_limited').map((t) => t.ttft).sort((a, b) => a - b);

  const costByNode: Record<string, number> = {};
  // attribute LLM cost to LLM nodes, the rest proportionally is small; keep it simple: LLM tokens
  for (const l of llms) {
    const s = MODEL_SPECS[cfgStr<ModelSize>(l, 'size', 'medium')];
    const toks = traces.reduce((acc, t) => acc + (t.llmTokens[l.id] ?? 0), 0);
    costByNode[l.id] = ((toks / N) * ((s.inPerM * 0.85 + s.outPerM * 0.15) / 1_000_000)) * 1000;
  }
  const servedCost = traces.filter((t) => t.outcome !== 'rate_limited').reduce((s, t) => s + t.cost, 0);
  const costPer1k = (servedCost / Math.max(1, N - outcomes.rate_limited)) * 1000;

  // Per-node stats for the canvas
  const nodeStats: Record<string, NodeStat> = {};
  for (const n of graph.nodes) {
    const through = traces.filter((t) => t.touched.includes(n.id)).length;
    const nrps = n.type === 'users' ? rps : (through / N) * rps;
    let status: NodeStat['status'] = active.has(n.id) || n.type === 'users' ? (nrps > 0 ? 'ok' : 'idle') : 'idle';
    let label = nrps > 0 ? `${fmtRps(nrps)} rps` : 'idle';
    if (n.type === 'llm' && active.has(n.id)) {
      const limit = MODEL_SPECS[cfgStr<ModelSize>(n, 'size', 'medium')].tpm;
      const util = tpmUse[n.id] / limit;
      label = `${Math.round(util * 100)}% TPM`;
      status = util > 1 ? 'hot' : util > 0.75 ? 'warn' : nrps > 0 ? 'ok' : 'idle';
      if (outcomes.overflow > 0 && traces.some((t) => t.outcome === 'overflow' && t.touched.includes(n.id))) {
        status = 'hot';
        label = 'context overflow';
      }
    }
    if (n.type === 'semantic_cache' && through) {
      const hits = traces.filter((t) => t.cacheHit).length;
      label = `${Math.round((hits / through) * 100)}% hits`;
      if (cacheFalseHitP > 0.05) status = 'warn';
    }
    if ((n.type === 'vector_db' || n.type === 'keyword_search') && kbT.length && active.has(n.id)) {
      const r = kbT.filter((t) => t.recallHit).length / kbT.length;
      label = `recall ${Math.round(r * 100)}%`;
      status = r < 0.7 ? 'hot' : r < 0.85 ? 'warn' : 'ok';
      if (n.type === 'vector_db' && !embedding) {
        status = 'hot';
        label = 'no embeddings';
      }
    }
    if (n.type === 'agent' && active.has(n.id)) {
      const loops = causes.agent_loop ?? 0;
      if (loops / N > 0.02 && maxSteps > 10) status = 'warn';
    }
    nodeStats[n.id] = { rps: nrps, status, label };
  }

  const recall = kbT.length ? kbT.filter((t) => t.recallHit).length / kbT.length : retrievalOn ? null : traffic.kbShare > 0 ? 0 : null;

  return {
    offered: rps,
    served: (rps * (N - outcomes.rate_limited - outcomes.overflow)) / N,
    errorRate: (outcomes.rate_limited + outcomes.overflow) / N,
    accuracy: legit.length ? legit.filter((t) => t.outcome === 'correct').length / legit.length : 0,
    hallucination: legit.length ? legit.filter((t) => t.outcome === 'hallucinated').length / legit.length : 0,
    injection: adv.length ? adv.filter((t) => t.outcome === 'injected').length / adv.length : 0,
    recall,
    p50: percentile(lat, 0.5),
    p99: percentile(lat, 0.99),
    ttftP50: percentile(ttfts, 0.5),
    costPer1k,
    outcomes,
    causes,
    costByNode,
    nodeStats,
    warnings,
    activeNodeIds: [...active],
  };
}

function fmtRps(n: number) {
  return n >= 10 ? Math.round(n).toString() : n.toFixed(1);
}

function labelOf(n: SimNode) {
  const names: Record<ComponentType, string> = {
    users: 'Users', input_guard: 'Input Guardrail', semantic_cache: 'Semantic Cache', router: 'Model Router',
    embedding: 'Embedding Model', vector_db: 'Vector DB', keyword_search: 'Keyword Search', reranker: 'Reranker',
    agent: 'Agent Loop', llm: 'LLM', output_guard: 'Output Judge',
  };
  return names[n.type];
}
