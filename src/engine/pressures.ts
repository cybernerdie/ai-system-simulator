import type { Cause, Goal, GoalMetric, Metrics } from './types';

export type PressureKey = Cause | 'cost' | 'latency' | 'ttft' | 'stable' | 'history_bloat' | 'blind' | 'idle_gpus' | 'slow_decode' | 'sequential_agent' | 'background_jobs' | 'uncached_prompt';

export interface Pressure {
  key: PressureKey;
  title: string;
  why: string;
  try: string;
}

export const PRESSURES: Record<PressureKey, Omit<Pressure, 'key'>> = {
  no_knowledge: {
    title: 'Missing knowledge',
    why: 'Users are asking about your private docs, and the model has never seen them. When it doesn\'t know, it guesses — fluently.',
    try: 'Ground the model: add an Embedding Model → Vector DB in front of the LLM (retrieval-augmented generation).',
  },
  retrieval_miss: {
    title: 'Retrieval recall',
    why: 'The answer exists in your docs, but the retriever isn\'t finding the right chunk, so the model answers from a near-miss.',
    try: 'Check the query mix. Exact codes and names need Keyword Search (hybrid). Paraphrases need more Top-K or better chunking.',
  },
  context_noise: {
    title: 'Context noise',
    why: 'You\'re stuffing so many unranked chunks into the prompt that the model loses the relevant one in the middle.',
    try: 'Retrieve wide, then add a Reranker so only the best few chunks reach the model. Or shrink chunk size.',
  },
  weak_reasoning: {
    title: 'Model capability',
    why: 'The context is right but the model isn\'t strong enough for the hard requests.',
    try: 'Give hard requests more brainpower: a thinking budget or a larger model. A Router lets you do that without paying for it on easy requests too.',
  },
  no_tools: {
    title: 'No way to act',
    why: 'Users want things done (check an order, issue a refund). A plain LLM can only talk, so it makes up a status.',
    try: 'Add an Agent Loop + Tools between your pipeline and the LLM.',
  },
  agent_limit: {
    title: 'Step budget too tight',
    why: 'Real tasks need several tool calls. The agent hits its step cap before finishing.',
    try: 'Raise Max steps until legit tasks complete (look at how many steps they actually need).',
  },
  agent_loop: {
    title: 'Runaway agents',
    why: 'Some agents get stuck repeating themselves. With a huge step cap, each stuck run burns dozens of LLM calls.',
    try: 'Cap Max steps (or an Agent Team\'s Max rounds) just above what real tasks need. Stuck runs then fail fast and cheap instead of slow and expensive. Fewer agents also means fewer chances to loop.',
  },
  rate_limit: {
    title: 'Tokens-per-minute limit',
    why: 'Your provider caps tokens per minute per model. Demand is over the cap, so requests bounce with 429s.',
    try: 'Send fewer tokens to the capped model: cache repeats, route easy requests to a small model, or trim the prompt.',
  },
  context_overflow: {
    title: 'Context window overflow',
    why: 'The prompt (system + retrieved chunks + agent history) is bigger than the model\'s context window.',
    try: 'Retrieve fewer/smaller chunks, add a Reranker to keep only the best, or use a model with a bigger window.',
  },
  injection: {
    title: 'Prompt injection',
    why: 'Attackers are smuggling instructions into the prompt, and the model follows them.',
    try: 'Layer defenses: an Input Guardrail before the model and an Output Judge after it. Neither alone is enough.',
  },
  cache_false_hit: {
    title: 'Cache serving wrong answers',
    why: 'Your similarity threshold is so loose that different questions match each other and get someone else\'s answer.',
    try: 'Raise the cache similarity threshold. Fewer hits, but the hits are actually the same question.',
  },
  guard_false_positive: {
    title: 'Over-blocking',
    why: 'Your guardrails are rejecting legitimate users.',
    try: 'Lower Input Guardrail strictness a bit — and rely on the Output Judge for defense in depth.',
  },
  forgot_context: {
    title: 'Memory loss',
    why: 'Users refer back to things they said earlier, but your memory strategy dropped those turns, so the model guesses.',
    try: 'Keep the facts that matter, not every word: summarise older turns, or store them as long-term memory and retrieve what each message needs.',
  },
  invalid_output: {
    title: 'Broken structured output',
    why: 'Your code expects JSON, but some answers come back malformed, and the parser crashes.',
    try: 'Turn on structured output (JSON mode) on the model so answers must match your schema, and add an Output Validator as a safety net.',
  },
  stale_index: {
    title: 'Stale index',
    why: 'Your docs changed but the index didn\'t. Retrieval finds the old version and the model repeats it confidently. Even an output judge can\'t tell, because the sources agree with the answer.',
    try: 'Re-index more often (nightly or live) so changes reach the index before users ask about them.',
  },
  parse_miss: {
    title: 'Scrambled documents',
    why: 'Answers inside tables and complex PDFs were flattened into word soup when the docs were ingested, so retrieval can\'t find them.',
    try: 'Switch the Vector DB to layout-aware parsing so tables and page structure survive ingestion.',
  },
  background_jobs: {
    title: 'Background jobs in the fast lane',
    why: 'Bulk jobs nobody is waiting on run through the real-time API. They pay full price and eat the rate limit your live users need.',
    try: 'Add a Batch Queue so background work goes to the batch API: about half price, and off your real-time rate limit.',
  },
  uncached_prompt: {
    title: 'Paying for the same prompt again',
    why: 'Every request resends a huge, unchanging system prompt and pays full price to process it, plus the time to read it.',
    try: 'Turn on prompt caching on the model, so the fixed start of every prompt is read from cache for a fraction of the price.',
  },
  handoff_loss: {
    title: 'Lost in hand-offs',
    why: 'Each agent passes a summary to the next, and details fall through the cracks. More agents means more cracks.',
    try: 'Use fewer, better-scoped workers (about one per sub-question), and add a reviewer agent to catch what the hand-offs dropped.',
  },
  sequential_agent: {
    title: 'One agent doing everything',
    why: 'A single agent works through every sub-question one after another, and its prompt grows with each one. It\'s slow, and the details get buried in its own context.',
    try: 'Split the work: an Agent Team runs worker agents in parallel, each with a small, focused context, and combines their results.',
  },
  provider_down: {
    title: 'Provider outage',
    why: 'Your model provider is failing most requests, and every call depends on it. A single provider is a single point of failure.',
    try: 'Put Retry & Fallback in front of your model, connect a second model on another provider (or your own GPUs), and turn on failover. Retries alone won\'t survive a real outage.',
  },
  gpu_saturated: {
    title: 'GPU capacity',
    why: 'Your self-hosted GPUs can\'t write tokens as fast as requests arrive. Requests queue, then time out.',
    try: 'Add GPUs, raise the batch size (more total throughput, slower per request), or quantize the model so each GPU does more.',
  },
  idle_gpus: {
    title: 'Paying for idle GPUs',
    why: 'GPUs cost the same per hour whether they\'re busy or not. At this traffic most of yours sit idle, so each request carries a big share of the bill.',
    try: 'Use fewer GPUs with bigger batches, or a smaller or quantized model. If traffic is low or spiky, an API may simply be cheaper.',
  },
  slow_decode: {
    title: 'Slow token generation',
    why: 'Each request is written slowly: big batches share the GPU between many requests, and big models write fewer tokens per second.',
    try: 'Lower the batch size and add GPUs, quantize to speed up decoding, or turn on streaming so users see words sooner.',
  },
  blind: {
    title: 'Flying blind',
    why: 'You can see speed, cost and errors, but not whether answers are right. Every quality fix is a guess until you measure it.',
    try: 'Add an Eval Harness after the LLM so a sample of real answers gets scored. Then fix whatever the numbers point at.',
  },
  history_bloat: {
    title: 'History bloat',
    why: 'Models are stateless, so every message resends the whole conversation. Long chats pay for the same tokens again and again, and eat your rate limit.',
    try: 'Add Conversation Memory and stop sending everything: a window, a rolling summary, or long-term memory retrieval.',
  },
  cost: {
    title: 'Cost per request',
    why: 'Quality is fine, but every request pays for your most expensive model and longest prompt.',
    try: 'Cache repeats, route easy traffic to a small model, and don\'t retrieve more chunks than you need.',
  },
  latency: {
    title: 'End-to-end latency',
    why: 'Requests take too long, mostly in model generation (big models and agent steps are slow).',
    try: 'Smaller models for easy requests, fewer agent steps, caching repeats.',
  },
  ttft: {
    title: 'Time to first token',
    why: 'Users stare at a blank screen until the whole answer is generated.',
    try: 'Turn on streaming. Note: anything that must read the full answer first (an Output Judge) blocks streaming.',
  },
  stable: {
    title: 'Holding',
    why: 'Nothing is binding right now. Push more traffic or change the mix to find the next wall.',
    try: 'Crank the traffic slider and see what breaks next.',
  },
};

const QUALITY: GoalMetric[] = ['accuracy', 'hallucination'];

export function metricValue(m: Metrics, g: GoalMetric): number {
  return m[g];
}

/** Metrics you can only see with evals in place. */
export const QUALITY_METRICS: GoalMetric[] = ['accuracy', 'hallucination', 'injection'];

export function goalMet(m: Metrics, g: Goal) {
  if (!m.qualityVisible && QUALITY_METRICS.includes(g.metric)) return false;
  const v = metricValue(m, g.metric);
  return g.op === '>=' ? v >= g.value : v <= g.value;
}

/** Name the single limit that hurts most right now. */
export function bindingPressure(m: Metrics, goals: Goal[]): Pressure {
  const unmet = goals.filter((g) => !goalMet(m, g)).map((g) => g.metric);
  if (!m.qualityVisible && unmet.some((u) => QUALITY_METRICS.includes(u))) return { key: 'blind', ...PRESSURES.blind };
  const causes = Object.entries(m.causes) as [Cause, number][];
  causes.sort((a, b) => b[1] - a[1]);
  const pick = (k: PressureKey): Pressure => ({ key: k, ...PRESSURES[k] });

  const errorCause = causes.find(([c]) => ['rate_limit', 'context_overflow', 'provider_down', 'gpu_saturated', 'invalid_output'].includes(c));
  const bloated = m.avgHistoryTokens > 4000;
  if (unmet.includes('errorRate') && errorCause) {
    if (errorCause[0] === 'rate_limit' && m.offlineInRealtime) return pick('background_jobs');
    return pick(bloated ? 'history_bloat' : errorCause[0]);
  }
  if (unmet.includes('injection')) return pick('injection');
  if (m.singleAgentResearch && unmet.some((u) => u === 'p50' || QUALITY.includes(u))) return pick('sequential_agent');
  if (unmet.some((u) => QUALITY.includes(u))) {
    // In a team, wrong answers mostly come from loops and detail lost between agents
    if (m.teamResearch) {
      const loops = m.causes.agent_loop ?? 0;
      const other = (m.causes.weak_reasoning ?? 0) + (m.causes.handoff_loss ?? 0);
      return pick(loops > other ? 'agent_loop' : 'handoff_loss');
    }
    const q = causes.find(([c]) => !['rate_limit', 'context_overflow', 'injection', 'provider_down', 'gpu_saturated', 'invalid_output'].includes(c));
    if (q) return pick(q[0]);
  }
  if (unmet.includes('costPer1k')) {
    if (m.offlineInRealtime) return pick('background_jobs');
    if (m.bigUncachedPrompt) return pick('uncached_prompt');
    if (m.gpuUtil !== null && m.gpuUtil < 0.45) return pick('idle_gpus');
    if (m.teamResearch) return pick('agent_loop');
    if (bloated) return pick('history_bloat');
    if ((m.causes.agent_loop ?? 0) > 0) return pick('agent_loop');
    return pick('cost');
  }
  if (unmet.includes('ttftP50')) return pick('ttft');
  if (unmet.includes('p50')) return pick(m.gpuUtil !== null ? 'slow_decode' : 'latency');
  if (unmet.length && causes.length) return pick(causes[0][0]);

  // Sandbox: no goals — flag anything clearly bad
  if (!goals.length) {
    if (m.errorRate > 0.02 && errorCause) return pick(errorCause[0]);
    const total = causes.reduce((s, [, n]) => s + n, 0);
    if (causes.length && total > 25) return pick(causes[0][0]);
  }
  return pick('stable');
}
