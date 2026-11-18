import type { Cause, Goal, GoalMetric, Metrics } from './types';

export type PressureKey = Cause | 'cost' | 'latency' | 'ttft' | 'stable';

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
    try: 'Use a larger model for hard requests — a Router lets you do that without paying large-model prices for easy ones.',
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
    try: 'Cap Max steps just above what real tasks need. Stuck runs fail fast and cheap instead of slow and expensive.',
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

export function goalMet(m: Metrics, g: Goal) {
  const v = metricValue(m, g.metric);
  return g.op === '>=' ? v >= g.value : v <= g.value;
}

/** Name the single limit that hurts most right now. */
export function bindingPressure(m: Metrics, goals: Goal[]): Pressure {
  const unmet = goals.filter((g) => !goalMet(m, g)).map((g) => g.metric);
  const causes = Object.entries(m.causes) as [Cause, number][];
  causes.sort((a, b) => b[1] - a[1]);
  const pick = (k: PressureKey): Pressure => ({ key: k, ...PRESSURES[k] });

  const errorCause = causes.find(([c]) => c === 'rate_limit' || c === 'context_overflow');
  if (unmet.includes('errorRate') && errorCause) return pick(errorCause[0]);
  if (unmet.includes('injection')) return pick('injection');
  if (unmet.some((u) => QUALITY.includes(u))) {
    const q = causes.find(([c]) => c !== 'rate_limit' && c !== 'context_overflow' && c !== 'injection');
    if (q) return pick(q[0]);
  }
  if (unmet.includes('costPer1k')) {
    if ((m.causes.agent_loop ?? 0) > 0) return pick('agent_loop');
    return pick('cost');
  }
  if (unmet.includes('ttftP50')) return pick('ttft');
  if (unmet.includes('p50')) return pick('latency');
  if (unmet.length && causes.length) return pick(causes[0][0]);

  // Sandbox: no goals — flag anything clearly bad
  if (!goals.length) {
    if (m.errorRate > 0.02 && errorCause) return pick(errorCause[0]);
    const total = causes.reduce((s, [, n]) => s + n, 0);
    if (causes.length && total > 25) return pick(causes[0][0]);
  }
  return pick('stable');
}
