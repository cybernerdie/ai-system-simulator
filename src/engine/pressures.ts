import type { Cause, ComponentType, Goal, GoalMetric, Metrics, SimGraph } from './types';

export type PressureKey =
  | Cause
  | 'blind_cohort'
  | 'unauthenticated'
  | 'no_traces'
  | 'cost'
  | 'latency'
  | 'ttft'
  | 'stable'
  | 'history_bloat'
  | 'blind'
  | 'idle_gpus'
  | 'slow_decode'
  | 'sequential_agent'
  | 'background_jobs'
  | 'uncached_prompt'
  | 'pii_leak'
  | 'abuse'
  | 'slow_voice'
  | 'no_model'
  | 'eval_blindspot';

export interface Pressure {
  key: PressureKey;
  title: string;
  why: string;
  /** Hint 1: where to look on screen, without saying what's wrong. */
  look: string;
  /** Hint 2: the kind of fix, without naming the part. */
  idea: string;
  /** Hint 3: the exact change. */
  try: string;
}

export const PRESSURES: Record<PressureKey, Omit<Pressure, 'key'>> = {
  no_knowledge: {
    title: 'Missing knowledge',
    why: "Customers are asking about your own policies and manuals, and the model has never seen them. When it doesn't know, it guesses, and sounds sure of itself.",
    look: 'Open the Requests tab and read a few made-up answers. What would the bot need to know to get them right?',
    idea: 'The model has never seen your documents. Give it a way to look up the right page before it answers.',
    try: 'Give the model your documents to read: add an Embedding Model and a Vector DB in front of the LLM. Together they look up the right page for each question before the model answers (retrieval-augmented generation, or RAG).',
  },
  retrieval_miss: {
    title: 'Search misses the right page',
    why: "The answer is in your documents, but search isn't finding the right chunk (its recall is low), so the model answers from a near-miss.",
    look: 'Open a few failed requests and look at what search returned. Is the right page there at all?',
    idea: "Search by meaning blurs exact codes and names, and one page per question isn't always enough. Change how search finds pages.",
    try: 'Open a few failed requests. Questions with exact codes or names need Keyword Search alongside meaning search. Reworded questions need more chunks per question (Top-K) or a different chunk size.',
  },
  context_noise: {
    title: 'Context noise',
    why: "You're stuffing so many unranked chunks into the prompt that the model loses the relevant one in the middle.",
    look: 'Look at how many chunks each request sends to the model. Are most of them about the question?',
    idea: 'Fewer, better chunks beat many loose ones. Keep only the most relevant ones before they reach the model.',
    try: 'Retrieve wide, then add a Reranker so only the best few chunks reach the model. Or shrink chunk size.',
  },
  weak_reasoning: {
    title: 'Model capability',
    why: "The context is right but the model isn't strong enough for the hard requests.",
    look: 'Filter the requests to the ones that failed. Are they the hard, multi-step ones?',
    idea: "The right information is there; the model isn't strong enough for the hard questions. Give those questions more brainpower without paying for it on easy ones.",
    try: 'Give hard requests more brainpower: a thinking budget or a larger model. A Router lets you do that without paying for it on easy requests too.',
  },
  no_tools: {
    title: 'No way to act',
    why: 'Users want things done (check an order, issue a refund). A plain LLM can only talk, so it makes up a status.',
    look: 'Read what customers are asking. Can a model answer that by talking, or does someone have to look something up?',
    idea: 'Some requests need an action, like checking an order. The bot needs a way to use your systems, not just words.',
    try: 'Add an Agent Loop + Tools between your pipeline and the LLM.',
  },
  agent_limit: {
    title: 'Step budget too tight',
    why: 'Real tasks need several tool calls. The agent hits its step cap before finishing.',
    look: 'Open a failed request and count the steps it took. Did it stop before finishing?',
    idea: "Real tasks need a few steps. The agent's step budget is too small for them.",
    try: 'Raise Max steps until legit tasks complete (look at how many steps they actually need).',
  },
  agent_loop: {
    title: 'Runaway agents',
    why: 'Some agents get stuck repeating themselves. With a huge step cap, each stuck run burns dozens of LLM calls.',
    look: 'Look at the cost and the steps per request. Are a few requests taking dozens of steps?',
    idea: "Stuck agents keep going as long as they're allowed to. Stop them sooner.",
    try: "Cap Max steps (or an Agent Team's Max rounds) just above what real tasks need. Stuck runs then fail fast and cheap instead of slow and expensive. Fewer agents also means fewer chances to loop.",
  },
  rate_limit: {
    title: 'Rate limit (tokens per minute)',
    why: 'Your provider caps how many tokens (pieces of words) each model can take per minute. Demand is over that cap, so requests bounce with 429 "too many requests" errors.',
    look: "Look at the model card: how close is it to its rate limit? Then check the failed requests' errors.",
    idea: "Your provider only accepts so many tokens a minute, and you're over. Not every request needs to reach that model, at that size, with that much text.",
    try: 'Send fewer tokens to the capped model: cache repeats, route easy requests to a small model, or trim the prompt.',
  },
  context_overflow: {
    title: 'Context window overflow',
    why: "The prompt (system + retrieved chunks + agent history) is bigger than the model's context window.",
    look: 'Look at how much text each request sends: chunks, history, the system prompt. Does it fit the model?',
    idea: 'The prompt is bigger than the model can read at once. Send less, or use a model that can read more.',
    try: 'Retrieve fewer/smaller chunks, add a Reranker to keep only the best, or use a model with a bigger window.',
  },
  injection: {
    title: 'Prompt injection',
    why: 'Attackers are smuggling instructions into the prompt, and the model follows them.',
    look: "Open a request marked as an attack. Did the model follow instructions it shouldn't have?",
    idea: 'Some users try to talk the bot into breaking its rules. Check what goes into the model and what comes out of it.',
    try: 'Layer defenses: an Input Guardrail before the model and an Output Judge after it. Neither alone is enough.',
  },
  cache_false_hit: {
    title: 'Cache serving wrong answers',
    why: "Answers are being reused for questions that only sound alike, so customers get someone else's answer.",
    look: 'Open a few wrong answers. Did the model write them, or were they reused from another question?',
    idea: 'Questions that are only similar are being treated as the same. Make the match stricter.',
    try: 'Raise the cache similarity threshold. Fewer hits, but the hits are actually the same question.',
  },
  guard_false_positive: {
    title: 'Over-blocking',
    why: 'Your guardrails are rejecting legitimate users.',
    look: 'Look at the blocked requests. Are they attacks, or ordinary questions?',
    idea: 'The safety check is so strict it blocks real customers. Loosen it a little and keep a second check after the model.',
    try: 'Lower Input Guardrail strictness a bit — and rely on the Output Judge for defense in depth.',
  },
  forgot_context: {
    title: 'Memory loss',
    why: 'Users refer back to things they said earlier, but your memory strategy dropped those turns, so the model guesses.',
    look: 'Open a failed request in a long chat. Did the model get the earlier message it needed?',
    idea: 'Your memory drops older messages, including the important ones. Keep the facts that matter, not just the latest messages.',
    try: 'Keep the facts that matter, not every word: summarise older turns, or store them as long-term memory and retrieve what each message needs.',
  },
  invalid_output: {
    title: 'Broken structured output',
    why: 'Your code expects JSON, but some answers come back malformed, and the parser crashes.',
    look: 'Open a failed request and look at the raw answer. Is it valid JSON?',
    idea: "Asking for JSON in the prompt doesn't guarantee it. Make the model produce valid JSON, and check it before your code reads it.",
    try: 'Turn on structured output (JSON mode) on the model so answers must match your schema, and add an Output Validator as a safety net.',
  },
  stale_index: {
    title: 'Stale index',
    why: "Your docs changed but the index didn't. Retrieval finds the old version and the model repeats it confidently. Even an output judge can't tell, because the sources agree with the answer.",
    look: "Compare a wrong answer with today's documents. Is the answer from an older version?",
    idea: "Your documents changed, but what search reads didn't. Keep the index up to date.",
    try: 'Re-index more often (nightly or live) so changes reach the index before users ask about them.',
  },
  parse_miss: {
    title: 'Scrambled documents',
    why: "Answers inside tables and complex PDFs were flattened into word soup when the docs were ingested, so retrieval can't find them.",
    look: 'Open a failed request whose answer sits in a table. What did search find?',
    idea: 'Tables and page layout got flattened when the documents were read in. Read them in a way that keeps their structure.',
    try: 'Switch the Vector DB to layout-aware parsing so tables and page structure survive ingestion.',
  },
  background_jobs: {
    title: 'Background jobs in the fast lane',
    why: 'Bulk jobs nobody is waiting on run through the real-time API. They pay full price and eat the rate limit your live users need.',
    look: 'Look at the traffic: how much of it is work nobody is waiting for?',
    idea: 'Work that can wait is paying full price and using the capacity live customers need. Send it somewhere slower and cheaper.',
    try: 'Add a Batch Queue so background work goes to the batch API: about half price, and off your real-time rate limit.',
  },
  uncached_prompt: {
    title: 'Paying for the same prompt again',
    why: 'Every request resends a huge, unchanging system prompt and pays full price to process it, plus the time to read it.',
    look: 'Look at the prompt size on each request. Which part is the same every time?',
    idea: 'You pay to process the same long prompt on every request. Let the provider reuse the part that never changes.',
    try: 'Turn on prompt caching on the model, so the fixed start of every prompt is read from cache for a fraction of the price.',
  },
  task_unknown: {
    title: "The model doesn't know your task",
    why: 'Your requests use your own labels, format and house style. An off-the-shelf model has never seen them, so it guesses, even a large one.',
    look: "Open a few wrong answers. Are they using labels or formats that aren't yours?",
    idea: 'The model has never seen your own labels and format. Teach it with your past examples rather than a bigger model.',
    try: 'Fine-tune a model on a few thousand of your own examples. A fine-tuned small model often beats a general large one on a narrow task, for a fraction of the price.',
  },
  model_drift: {
    title: 'Silent model update',
    why: 'You\'re on the provider\'s "latest" alias. They shipped a new model version, and prompts tuned for the old one now regress. Nothing in your code changed.',
    look: "Nothing in your design changed. Look at which model version you're calling.",
    idea: 'Your model changed under you. Stop following whatever the provider calls newest.',
    try: 'Pin a specific model version. Upgrade on purpose, after your evals pass on the new one.',
  },
  voice_pipeline: {
    title: 'Broken voice pipeline',
    why: 'Voice needs a chain: speech-to-text in, the model, text-to-speech out. Part of the chain is missing.',
    look: 'Trace the path from Users to the model and back. Is a step missing?',
    idea: 'Speech has to become text before the model, and text has to become speech after it.',
    try: 'Connect Users → Speech-to-Text → … → LLM → Text-to-Speech.',
  },
  slow_voice: {
    title: 'Dead air',
    why: 'People expect a reply to start within about a second. Your pipeline waits for each step to finish completely before the next one starts: transcribe everything, generate everything, synthesise everything.',
    look: 'Look at time to first word. Which stages wait for the one before to finish completely?',
    idea: 'Each stage waits for the whole of the previous one. Let them all work on small pieces as they arrive.',
    try: 'Stream every stage: transcribe while the user speaks, stream tokens from the model, and start speaking the first sentence immediately. A faster model helps too.',
  },
  pii_leak: {
    title: 'Personal data leaving your systems',
    why: "Requests contain names, emails and health or card details, and they're sent as-is to a third-party model provider. That's a compliance problem, whatever the provider promises.",
    look: 'Open a request marked with personal data. Where does it go, and what does the provider see?',
    idea: 'Personal details are leaving your systems. Hide them before the prompt leaves, or keep that traffic inside.',
    try: 'Add a PII Redactor before the model to swap personal details for placeholders, or keep sensitive traffic on a self-hosted model.',
  },
  language_gap: {
    title: 'One group gets worse answers',
    why: 'People asking in another language get far worse answers than everyone else. English-only embeddings put their questions nowhere near the English docs that answer them, so retrieval comes back empty.',
    look: 'Filter the requests by language. Which group fails, and what did search find for them?',
    idea: 'Search only understands one language, so questions in another find the wrong pages. Change how meaning is measured.',
    try: 'Open the Embedding Model and switch on the multilingual model. Measure the gap per group to be sure it closed.',
  },
  blind_cohort: {
    title: 'A gap hiding inside the average',
    why: 'Overall quality looks fine, but some users keep complaining. Your evals score everyone together, so if one group is served much worse, the average hides it.',
    look: 'The average looks fine. Is anything measuring how each group of customers is served?',
    idea: "An average can hide a group that's doing badly. Measure each group separately.",
    try: 'Add a Fairness Evaluator after the model. It scores each group separately, so you can see who is being served worse and why.',
  },
  unauthenticated: {
    title: 'Strangers using your API',
    why: 'Your key shipped inside the app, and scripts are calling your endpoint with it. They rotate accounts and addresses, so per-user limits barely slow them, and you pay for every call.',
    look: 'Look at who is calling. Are these requests from your own signed-in users?',
    idea: "Anyone with the key can call you. Check who's calling before anything else runs.",
    try: 'Add Auth in front of everything else, so calls without valid credentials are rejected before they cost anything. Then move the provider key to your server.',
  },
  no_traces: {
    title: "You can't see why it failed",
    why: 'A customer reports a wrong answer and nobody can tell what the model was sent or what retrieval found. Without traces of failed requests, every bug report takes days of guessing.',
    look: 'A customer reported a wrong answer. What could you look at to find out why?',
    idea: 'Nothing records what failed requests saw and did. Start keeping a record of them.',
    try: 'Add a Trace Collector after the model. Keep every failure (and a small sample of the rest), and store the prompts, with personal data redacted first.',
  },
  abuse: {
    title: 'A few accounts eating your capacity',
    why: 'A handful of scripted accounts send hundreds of long requests a minute. They burn your rate limit and your budget, and real users pay for it with errors.',
    look: 'Look at the traffic by account. Are a few accounts sending most of it?',
    idea: 'Nothing limits how much one account can send. Give each account a budget.',
    try: 'Add Per-user Limits. Real people send a few messages a minute; a sensible cap stops scripts without anyone else noticing.',
  },
  handoff_loss: {
    title: 'Lost in hand-offs',
    why: 'Each agent passes a summary to the next, and details fall through the cracks. More agents means more cracks.',
    look: 'Open a failed request. Which agent dropped the detail?',
    idea: 'Every hand-off between agents can lose detail. Use fewer agents, and check their combined work.',
    try: 'Use fewer, better-scoped workers (about one per sub-question), and add a reviewer agent to catch what the hand-offs dropped.',
  },
  sequential_agent: {
    title: 'One agent doing everything',
    why: "A single agent works through every sub-question one after another, and its prompt grows with each one. It's slow, and the details get buried in its own context.",
    look: 'Open a slow request. Is one agent doing every part, one after another?',
    idea: 'One agent with an ever-growing prompt is slow and loses track. Split the work so parts run side by side.',
    try: 'Split the work: an Agent Team runs worker agents in parallel, each with a small, focused context, and combines their results.',
  },
  provider_down: {
    title: 'Provider outage',
    why: 'Your model provider is failing most requests, and every call depends on it. A single provider is a single point of failure.',
    look: 'Look at the errors on the failed requests. Where do they come from?',
    idea: 'Everything depends on one provider. Give requests somewhere else to go when it fails.',
    try: "Put Retry & Fallback in front of your model, connect a second model on another provider (or your own GPUs), and turn on failover. Retries alone won't survive a real outage.",
  },
  gpu_saturated: {
    title: 'GPU capacity',
    why: "Your self-hosted GPUs can't write tokens as fast as requests arrive. Requests queue, then time out.",
    look: 'Look at the GPU card: are requests waiting in a queue?',
    idea: "Your GPUs can't keep up with the traffic. Make each GPU handle more, or add more.",
    try: 'Add GPUs, raise the batch size (more total throughput, slower per request), or quantize the model so each GPU does more.',
  },
  idle_gpus: {
    title: 'Paying for idle GPUs',
    why: "GPUs cost the same per hour whether they're busy or not. At this traffic most of yours sit idle, so each request carries a big share of the bill.",
    look: 'Look at how busy the GPUs are. Are you paying for capacity nobody uses?',
    idea: 'GPUs cost the same busy or idle. Use fewer and keep them busy.',
    try: 'Use fewer GPUs with bigger batches, or a smaller or quantized model. If traffic is low or spiky, an API may simply be cheaper.',
  },
  slow_decode: {
    title: 'Slow token generation',
    why: 'Each request is written slowly: big batches share the GPU between many requests, and big models write fewer tokens per second.',
    look: 'Look at how long each answer takes to write, not to start.',
    idea: 'Each answer is written slowly. Trade some batching for speed, or make the model faster.',
    try: 'Lower the batch size and add GPUs, quantize to speed up decoding, or turn on streaming so users see words sooner.',
  },
  blind: {
    title: 'Flying blind',
    why: 'You can see speed, cost and errors, but not whether answers are right. Every quality fix is a guess until you measure it.',
    look: 'Look at the numbers you can see. Which of them tells you whether answers are right?',
    idea: 'Nothing measures answer quality yet. Measure it before you try to fix it.',
    try: 'Add an Eval Harness after the LLM so a sample of real answers gets scored. Then fix whatever the numbers point at.',
  },
  history_bloat: {
    title: 'History bloat',
    why: 'Models are stateless, so every message resends the whole conversation. Long chats pay for the same tokens again and again, and eat your rate limit.',
    look: 'Look at the prompt size in long chats. How much of it is old messages?',
    idea: 'Every message resends the whole chat. Send only what each message needs.',
    try: 'Add Conversation Memory and stop sending everything: a window, a rolling summary, or long-term memory retrieval.',
  },
  cost: {
    title: 'Cost per request',
    why: 'Quality is fine, but every request pays for your most expensive model and longest prompt.',
    look: 'Look at where the money goes: which model, how many chunks, how much text per request?',
    idea: 'Every request pays for your most expensive setup. Spend less on the easy ones.',
    try: "Cache repeats, route easy traffic to a small model, and don't retrieve more chunks than you need.",
  },
  latency: {
    title: 'End-to-end latency',
    why: 'Requests take too long, mostly in model generation (big models and agent steps are slow).',
    look: 'Look at where the time goes on a slow request: which step takes longest?',
    idea: 'Most of the time is the model writing. Use faster paths for the requests that allow it.',
    try: 'Smaller models for easy requests, fewer agent steps, caching repeats.',
  },
  ttft: {
    title: 'Time to first token',
    why: 'Users stare at a blank screen until the whole answer is generated.',
    look: 'Watch a request: does anything appear before the whole answer is ready?',
    idea: "Customers wait for the full answer before seeing a word. Show it as it's written.",
    try: 'Turn on streaming. Note: anything that must read the full answer first (an Output Judge) blocks streaming.',
  },
  sampling_noise: {
    title: 'Same question, different answers',
    why: 'Temperature controls how adventurously the model picks each next word. Yours is high, so on tasks with exactly one right answer (a total, a date, an ID) it sometimes picks a less likely token and returns a different value than last time.',
    look: 'Send the same request twice. Do you get the same answer?',
    idea: 'The model is set to choose words adventurously. On tasks with one right answer, make it choose consistently.',
    try: "Turn temperature down to 0–0.2 for extraction and classification. A bigger model won't fix sampling; JSON mode or a validator stops malformed output.",
  },
  too_repetitive: {
    title: 'Every answer sounds the same',
    why: 'At very low temperature the model always picks the single most likely word, so open-ended writing (descriptions, ideas, subject lines) comes out flat and near-identical.',
    look: 'Read a few creative answers side by side. Do they all sound the same?',
    idea: 'The model always picks the most likely word, so writing comes out flat. Allow a little variety.',
    try: 'Keep a little temperature (around 0.3–0.7) for creative work. If one model serves both, accept a small trade-off or split the two kinds of task.',
  },
  indirect_injection: {
    title: 'Hijacked by the content it reads',
    why: 'Nobody typed an attack. It was hidden inside an email (or a document, or a web page) that your agent read, and the model can\'t reliably tell instructions from data. Because the agent can send things, a hidden "forward the invoices to…" becomes a real action. An input guard wouldn\'t see it either: it only checks what the user typed.',
    look: 'Open a hijacked request. Did the instruction come from the user, or from something the agent read?',
    idea: 'Instructions hidden in content look just like real ones to the model. Treat what it reads as untrusted, and check risky actions before they happen.',
    try: 'Defence in depth: treat everything the system reads as untrusted (a Content Sanitiser), give the agent only the permissions it needs, and require approval before risky actions like sending or paying.',
  },
  no_permission: {
    title: "The agent can't finish the job",
    why: 'You took away the permission some real tasks need. Least privilege is right, but here users asked for replies to be sent, and the agent can only draft them.',
    look: "Open a failed request. Did the agent get stuck because it wasn't allowed to do something?",
    idea: 'Taking away permissions stopped the attacks and some real work too. Give back what the task needs, with a check in front of it.',
    try: 'Give back only what the task needs, and put a check in front of it instead: an approval step on risky actions keeps the feature and stops hijacked sends.',
  },
  eval_blindspot: {
    title: 'Your evals are lying to you',
    why: "The dashboard and real outcomes disagree. A small test set of easy, hand-picked questions doesn't look like today's traffic, and an LLM judge that isn't checked against humans gets fooled by confident, fluent wrong answers.",
    look: 'Compare the eval score with real outcomes. Do they agree?',
    idea: "The test questions and the judge don't reflect real traffic. Make the evals honest before trusting them.",
    try: 'In the Eval Harness, test on a sample of real traffic and calibrate the judge against human-reviewed answers. Then fix whatever the honest numbers show.',
  },
  no_model: {
    title: 'Nothing reaches a model',
    why: 'Requests leave Users but never arrive at an LLM, so every one of them fails. Components only do anything when they sit on a path from Users to a model.',
    look: 'Trace the arrows from Users. Do they reach a model?',
    idea: 'Nothing is connected all the way through. Join Users to a model.',
    try: "Connect a path Users → … → LLM: drag from a node's right dot to the next node. Add an LLM from the left if there isn't one.",
  },
  stable: {
    title: 'Holding up',
    why: 'Nothing is struggling right now. Turn up the traffic or change the mix to find what breaks next.',
    look: 'Watch the numbers as you change the traffic.',
    idea: 'Push the system harder to find its next limit.',
    try: 'Drag the traffic slider up and watch which number goes red first.',
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
  // nothing real was answered, so answer quality can't be judged either way
  if (m.answered === 0 && (g.metric === 'accuracy' || g.metric === 'hallucination')) return false;
  if (!m.fairnessVisible && g.metric === 'fairnessGap') return false;
  const v = metricValue(m, g.metric);
  return g.op === '>=' ? v >= g.value : v <= g.value;
}

/** Name the single limit that hurts most right now. */
export function bindingPressure(m: Metrics, goals: Goal[]): Pressure {
  if (m.noModel) return { key: 'no_model', ...PRESSURES.no_model };
  const unmet = goals.filter((g) => !goalMet(m, g)).map((g) => g.metric);
  if (!m.qualityVisible && unmet.some((u) => QUALITY_METRICS.includes(u))) return { key: 'blind', ...PRESSURES.blind };
  if (m.evalSetup && m.evalGap > 0.05 && unmet.some((u) => u === 'evalGap' || QUALITY_METRICS.includes(u))) return { key: 'eval_blindspot', ...PRESSURES.eval_blindspot };
  const causes = Object.entries(m.causes) as [Cause, number][];
  causes.sort((a, b) => b[1] - a[1]);
  const pick = (k: PressureKey): Pressure => ({ key: k, ...PRESSURES[k] });

  const errorCause = causes.find(([c]) => ['rate_limit', 'context_overflow', 'provider_down', 'gpu_saturated', 'invalid_output'].includes(c));
  const bloated = m.avgHistoryTokens > 4000;
  if (m.unauthUnchecked && unmet.some((u) => u === 'errorRate' || u === 'costPer1k')) return pick('unauthenticated');
  if (m.abuseUnchecked && unmet.some((u) => u === 'errorRate' || u === 'costPer1k')) return pick('abuse');
  if (unmet.includes('errorRate') && errorCause) {
    if (errorCause[0] === 'rate_limit' && m.offlineInRealtime) return pick('background_jobs');
    return pick(bloated ? 'history_bloat' : errorCause[0]);
  }
  if (unmet.length && (m.causes.model_drift ?? 0) > 0) return pick('model_drift');
  if (unmet.includes('piiLeak')) return pick('pii_leak');
  if (unmet.includes('fairnessGap')) return pick(m.fairnessVisible ? 'language_gap' : 'blind_cohort');
  if (unmet.includes('diagnoseHours')) return pick('no_traces');
  if (unmet.includes('harmfulActions') || (m.harmfulActions > 0.005 && unmet.length)) return pick('indirect_injection');
  if ((m.causes.voice_pipeline ?? 0) > 0) return pick('voice_pipeline');
  if (unmet.includes('injection')) return pick('injection');
  if (m.singleAgentResearch && unmet.some((u) => u === 'p50' || QUALITY.includes(u))) return pick('sequential_agent');
  if (unmet.some((u) => QUALITY.includes(u))) {
    // In a team, wrong answers mostly come from loops and detail lost between agents
    if (m.teamResearch) {
      const loops = m.causes.agent_loop ?? 0;
      const other = (m.causes.weak_reasoning ?? 0) + (m.causes.handoff_loss ?? 0);
      return pick(loops > other ? 'agent_loop' : 'handoff_loss');
    }
    // thousands of tokens of old chat per message bury the facts that matter: that's the cause of these wrong
    // answers, even though they read as noise or reasoning failures, and a bigger model would only cost more
    if (bloated) return pick('history_bloat');
    const q = causes.find(([c]) => !['rate_limit', 'context_overflow', 'injection', 'provider_down', 'gpu_saturated', 'invalid_output', 'voice_pipeline'].includes(c));
    // an out-of-date index and scrambled tables are one problem (how documents get in), so weigh them together
    const stale = m.causes.stale_index ?? 0;
    const parse = m.causes.parse_miss ?? 0;
    if (q && stale + parse >= q[1]) return pick(stale >= parse ? 'stale_index' : 'parse_miss');
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
  if (unmet.includes('ttftP50')) return pick(m.voice ? 'slow_voice' : 'ttft');
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

/**
 * Hint 3 for this design: the general fix, unless it would suggest something the player already has.
 * Then it says what they have and what's left to try, so a hint never sends them in a circle.
 */
export function fixFor(p: Pressure, g: SimGraph): string {
  const has = (t: ComponentType) => g.nodes.some((n) => n.type === t);
  const llms = g.nodes.filter((n) => n.type === 'llm');
  switch (p.key) {
    case 'retrieval_miss':
      if (has('keyword_search')) return 'You already search by keyword and by meaning. Now give each question more chunks (Top-K on the Vector DB), or try a different chunk size.';
      break;
    case 'context_noise':
      if (has('reranker')) return 'You already rerank. Have the Reranker keep fewer chunks, or use smaller chunks.';
      break;
    case 'injection':
      if (has('input_guard') && !has('output_guard')) return 'You check what goes in. Add an Output Judge after the model to catch what slips past.';
      if (has('output_guard') && !has('input_guard')) return 'You check what comes out. Add an Input Guardrail before the model too: neither alone is enough.';
      break;
    case 'forgot_context': {
      const mem = g.nodes.find((n) => n.type === 'memory');
      if (mem && mem.config?.strategy !== 'retrieval')
        return 'Your memory keeps only recent messages or a summary, which drops details. Switch it to long-term memory, so each message gets back the earlier ones it needs.';
      break;
    }
    case 'weak_reasoning':
      if (has('router')) return 'You already route. Give the model that gets the hard questions a thinking budget, or make it the larger one.';
      break;
    case 'invalid_output':
      if (llms.length && llms.every((n) => n.config?.jsonMode)) return 'JSON mode is on. Add an Output Validator as a safety net, and keep temperature low.';
      break;
    case 'provider_down': {
      const fb = g.nodes.find((n) => n.type === 'fallback');
      if (fb && !fb.config?.failover) return 'Retry & Fallback is there, but failover is off. Turn it on, so failed calls go to your second model.';
      if (fb && new Set(llms.map((n) => n.config?.provider ?? 'A')).size < 2 && !has('gpu_llm'))
        return 'Failover is on, but there is no second model on another provider to fail over to. Add one, or set your second model to provider B.';
      break;
    }
    case 'rate_limit':
    case 'cost':
      if (has('semantic_cache') && has('router'))
        return 'You already cache and route. Now send less: fewer chunks per question, a shorter prompt, or a small model for more of the traffic.';
      break;
  }
  return p.try;
}
