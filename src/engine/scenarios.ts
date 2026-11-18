import { COMPONENTS } from './components';
import type { ComponentType, Goal, NodeConfig, SimEdge, TrafficProfile } from './types';

export interface ScenarioNode {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  config?: NodeConfig;
}

export interface Scenario {
  id: string;
  title: string;
  tagline: string;
  /** 1 = intro, 2 = core, 3 = advanced (0 for the sandbox) */
  difficulty: 0 | 1 | 2 | 3;
  /** Concepts the scenario teaches, shown on its card. */
  skills: string[];
  brief: string;
  traffic: TrafficProfile;
  goals: Goal[];
  nodes: ScenarioNode[];
  edges: SimEdge[];
  hint: string;
  lesson: string;
  /** A known-good design, used by tests to prove the scenario is winnable. */
  solution: { nodes: ScenarioNode[]; edges: SimEdge[] };
}

const base: TrafficProfile = {
  rps: 5,
  kbShare: 0,
  exactTermShare: 0,
  toolShare: 0,
  adversarialShare: 0,
  easyShare: 0.6,
  repeatShare: 0.2,
};

const chain = (...ids: string[]): SimEdge[] => ids.slice(1).map((id, i) => ({ source: ids[i], target: id }));

export const SCENARIOS: Scenario[] = [
  {
    id: 'docs-bot',
    difficulty: 1,
    skills: ['RAG', 'Grounding'],
    title: '1 · The docs chatbot',
    tagline: 'It sounds confident. It\'s making things up.',
    brief:
      'Your company shipped a chatbot that answers questions about its product docs. It\'s just a prompt and an LLM. Support tickets are piling up: customers got detailed, confident, wrong answers.',
    traffic: { ...base, kbShare: 0.75, exactTermShare: 0.1 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.7 },
      { metric: 'hallucination', op: '<=', value: 0.25 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'The model has never seen your docs. What component lets it look things up at question time?',
    lesson:
      'You built retrieval-augmented generation (RAG). A model can only be as right as the information it\'s given — when the answer lives in private data, the fix is retrieval, not a bigger model. Notice recall: it\'s not 100%, and every miss is still a potential hallucination. That\'s the next wall.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'emb', 'vdb', 'llm'),
    },
  },
  {
    id: 'wrong-chunks',
    difficulty: 2,
    skills: ['Hybrid search', 'Chunking', 'Reranking'],
    title: '2 · Confidently wrong RAG',
    tagline: 'Retrieval is on. Answers are still wrong.',
    brief:
      'You added RAG and things got better — but not good enough. Half the questions mention exact product codes and error numbers ("what does E1043 mean on the X-200?"). Someone also set huge chunks and Top-K 2 to "save tokens".',
    traffic: { ...base, kbShare: 0.85, exactTermShare: 0.5 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.85 },
      { metric: 'hallucination', op: '<=', value: 0.13 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 2, chunk: 'large' } },
      { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Look at what kind of questions are failing. Embeddings blur "E1043" and "E1034" together. What matches exact strings? And once you retrieve more, what keeps the prompt clean?',
    lesson:
      'Retrieval quality is usually the real bottleneck in RAG, not the model. Hybrid search (keywords + vectors) covers both exact identifiers and paraphrases, chunk size trades precision against completeness, and a reranker lets you retrieve wide while still handing the model a short, clean context.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
        { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'medium' } },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'rr', 'llm'), ...chain('users', 'kw', 'rr')],
    },
  },
  {
    id: 'launch-day',
    difficulty: 2,
    skills: ['Semantic cache', 'Model routing', 'Rate limits'],
    title: '3 · Launch day',
    tagline: 'It works. Now 40× more people want it.',
    brief:
      'Quality is great — you\'re running the large model on everything. Then you hit the front page: traffic jumps to 60 req/s. The provider starts returning 429s and finance asks why the bill looks like a phone number. Lots of these questions are repeats, and most are easy.',
    traffic: { ...base, rps: 60, kbShare: 0.6, exactTermShare: 0.2, easyShare: 0.7, repeatShare: 0.4 },
    goals: [
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'costPer1k', op: '<=', value: 15 },
      { metric: 'accuracy', op: '>=', value: 0.8 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'large' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Do repeat questions need the model at all? Do easy questions need the large model?',
    lesson:
      'At scale, the expensive part of an AI system is tokens through your biggest model. A semantic cache removes repeats entirely, and a router sends easy traffic to a model that\'s ~100× cheaper with its own rate limit. You kept the large model — just for the requests that need it.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'sc', type: 'semantic_cache', x: 150, y: 120, config: { threshold: 0.9 } },
        { id: 'emb', type: 'embedding', x: 300, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 450, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'rt', type: 'router', x: 600, y: 120 },
        { id: 'small', type: 'llm', x: 780, y: 40, config: { size: 'small' } },
        { id: 'llm', type: 'llm', x: 780, y: 200, config: { size: 'large' } },
      ],
      edges: [...chain('users', 'sc', 'emb', 'vdb', 'rt', 'llm'), { source: 'rt', target: 'small' }],
    },
  },
  {
    id: 'support-agent',
    difficulty: 2,
    skills: ['Agents', 'Step budgets', 'Cost'],
    title: '4 · The support agent',
    tagline: 'Users want things done, not explained.',
    brief:
      'Most support requests are actions: "where is my order?", "cancel my subscription". Your bot can only talk, so it invents an order status. Leadership wants an agent that actually uses tools — without a surprise bill.',
    traffic: { ...base, rps: 4, toolShare: 0.65, kbShare: 0.2, easyShare: 0.5 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.78 },
      { metric: 'costPer1k', op: '<=', value: 35 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Add an Agent Loop. Then watch the cost: what happens to the runs that get stuck with a step cap of 20?',
    lesson:
      'Agents turn one LLM call into many. Real tasks here need 2–5 steps, but ~10% of runs get stuck repeating themselves — and a stuck agent spends its entire step budget. The step cap is a cost control, not just a safety net: set it just above what real work needs.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'ag', type: 'agent', x: 500, y: 120, config: { maxSteps: 6 } },
        { id: 'llm', type: 'llm', x: 680, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'emb', 'vdb', 'ag', 'llm'),
    },
  },
  {
    id: 'jailbreak',
    difficulty: 2,
    skills: ['Prompt injection', 'Guardrails'],
    title: '5 · Someone pasted a jailbreak',
    tagline: '"Ignore previous instructions and…"',
    brief:
      'Your assistant is public. 15% of traffic is now people trying to make it leak the system prompt, insult customers, or promise refunds it can\'t give. A screenshot is already on social media.',
    traffic: { ...base, rps: 6, kbShare: 0.6, exactTermShare: 0.2, adversarialShare: 0.15 },
    goals: [
      { metric: 'injection', op: '<=', value: 0.03 },
      { metric: 'hallucination', op: '<=', value: 0.07 },
      { metric: 'accuracy', op: '>=', value: 0.7 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 6, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'No single defense is enough. What checks the input? What checks the output? Watch the accuracy cost of being too strict.',
    lesson:
      'Safety is layered. An input classifier catches most attacks cheaply, an output judge catches what slips through (and many hallucinations too) — but each layer has false positives, and the judge must see the full answer, which breaks streaming. Defense in depth is a trade-off, not a checkbox.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'ig', type: 'input_guard', x: 150, y: 120, config: { strictness: 0.8 } },
        { id: 'emb', type: 'embedding', x: 300, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 450, y: 120, config: { topK: 6, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 620, y: 120, config: { size: 'medium' } },
        { id: 'oj', type: 'output_guard', x: 800, y: 120 },
      ],
      edges: [...chain('users', 'ig', 'emb', 'vdb', 'llm'), { source: 'llm', target: 'oj' }],
    },
  },
  {
    id: 'long-docs',
    difficulty: 3,
    skills: ['Context windows', 'Reranking', 'Cost'],
    title: '6 · The contract reviewer',
    tagline: 'Every answer is buried in a 90-page PDF.',
    brief:
      'Legal wants a bot that answers questions about long contracts. To "not miss anything", someone set retrieval to grab 12 huge chunks per question and pinned the cheap small model to save money. Half the requests now fail outright.',
    traffic: { ...base, rps: 4, kbShare: 0.9, exactTermShare: 0.25, easyShare: 0.4, repeatShare: 0.1 },
    goals: [
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'accuracy', op: '>=', value: 0.72 },
      { metric: 'costPer1k', op: '<=', value: 6 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 12, chunk: 'large' } },
      { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'small' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Count the tokens: 12 chunks × 1,000 tokens won\'t fit in a small model\'s window. You can buy a bigger window, or send fewer, better chunks. Which one keeps the bill down?',
    lesson:
      'Context windows are a budget, not a bucket. Stuffing more into the prompt costs money, adds latency and drowns the answer ("lost in the middle"). Retrieving wide and reranking down to a few precise chunks fits a small, cheap model, and is usually more accurate than a huge prompt on a big one.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
        { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'small' } },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'rr', 'llm'), ...chain('users', 'kw', 'rr')],
    },
  },
  {
    id: 'feels-slow',
    difficulty: 3,
    skills: ['Streaming', 'Time to first token'],
    title: '7 · "It feels slow"',
    tagline: 'Users stare at a spinner for eight seconds.',
    brief:
      'Answers are good, but users bounce before they arrive. You run the large model on everything and an Output Judge checks every answer before it ships. Product wants the first words on screen in under a second, without letting hallucinations climb.',
    traffic: { ...base, rps: 3, kbShare: 0.6, exactTermShare: 0.2, easyShare: 0.65 },
    goals: [
      { metric: 'ttftP50', op: '<=', value: 1200 },
      { metric: 'accuracy', op: '>=', value: 0.75 },
      { metric: 'hallucination', op: '<=', value: 0.1 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'large' } },
      { id: 'oj', type: 'output_guard', x: 700, y: 120 },
    ],
    edges: [...chain('users', 'emb', 'vdb', 'llm'), { source: 'llm', target: 'oj' }],
    hint: 'Turn on streaming and watch first-token time. Why doesn\'t it move? Something downstream has to read the whole answer first. What can replace it on the quality side?',
    lesson:
      'Perceived speed is time to first token, and streaming is the biggest lever. But anything that must read the full answer first, like an output judge, silently cancels streaming. Here better retrieval protects quality up front, so the model can stream straight to the user.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 10, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
        { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'large', streaming: true } },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'rr', 'llm'), ...chain('users', 'kw', 'rr')],
    },
  },
  {
    id: 'endless-chat',
    difficulty: 3,
    skills: ['Memory optimization', 'Stateless models', 'Cost'],
    title: '8 · The chat that never ends',
    tagline: 'Memory optimization: it either forgets what you said, or costs a fortune.',
    brief:
      'Your AI coaching app is a hit: conversations run 20, 40, 80 messages. Users constantly refer back ("like I said earlier, my budget is…"). The prototype resends the entire conversation with every message. The bill grows every week, answers get worse as chats get longer, and the longest chats have started failing.',
    traffic: { ...base, rps: 6, easyShare: 0.6, repeatShare: 0.05, chatTurns: 22, recallShare: 0.35 },
    goals: [
      { metric: 'costPer1k', op: '<=', value: 12 },
      { metric: 'accuracy', op: '>=', value: 0.85 },
      { metric: 'errorRate', op: '<=', value: 0.01 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'Open a few requests and look at what each one sends. Does the model need every word from 40 turns ago, or only the few facts this message depends on? Try each memory strategy and watch which goal breaks.',
    lesson:
      'Models are stateless: they remember nothing between calls, so "memory" is whatever you choose to resend. Resending everything is accurate at first, then gets expensive, slow and noisy, and eventually overflows. A sliding window is cheap but forgets. A summary keeps the gist but loses specifics. Storing the conversation as long-term memory and retrieving only what each message needs keeps prompts small and the important facts in view.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'mem', type: 'memory', x: 260, y: 120, config: { strategy: 'retrieval' } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'mem', 'llm'),
    },
  },
  {
    id: 'flying-blind',
    difficulty: 2,
    skills: ['Evals', 'LLM-as-judge', 'Observability'],
    title: '9 · Flying blind',
    tagline: 'Costs are down 95%. Is anything else down?',
    brief:
      'A contractor "optimised" your docs assistant: the small model, one huge chunk per question. The dashboard looks fantastic (fast, cheap, zero errors) and they\'ve already invoiced. Support says answers have got worse, but nobody can prove it, because nothing measures whether answers are right.',
    traffic: { ...base, rps: 5, kbShare: 0.8, exactTermShare: 0.3, easyShare: 0.5, repeatShare: 0.1, qualityHidden: true },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.82 },
      { metric: 'hallucination', op: '<=', value: 0.15 },
      { metric: 'costPer1k', op: '<=', value: 15 },
      { metric: 'p50', op: '<=', value: 6000 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 1, chunk: 'large' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'small' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Before you change anything, make quality visible: add an Eval Harness after the LLM. Then let the numbers, and the failed requests, tell you what to fix.',
    lesson:
      'You can\'t improve what you can\'t see. Speed, cost and errors are easy to measure, so teams optimise them and quietly wreck quality. An eval harness (a test set with known answers, plus an LLM judge scoring a sample of real traffic) turns "I think it\'s worse" into a number, and tells you whether each change actually helped.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
        { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'medium' } },
        { id: 'ev', type: 'eval_harness', x: 880, y: 120 },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'rr', 'llm', 'ev'), ...chain('users', 'kw', 'rr')],
    },
  },
  {
    id: 'self-host',
    difficulty: 3,
    skills: ['Self-hosting', 'Batching', 'Quantization', 'GPU capacity'],
    title: '10 · Bring it in-house',
    tagline: 'We moved off the API to save money. Now everything times out.',
    brief:
      'The API bill was about $10 per 1,000 requests, so the team moved to an open 70B model on rented GPUs: 4 GPUs, one request at a time, full precision. The bill dropped to almost nothing, because almost nothing gets answered. Find a setup that is cheap, fast enough and still as good as the API.',
    traffic: { ...base, rps: 30, kbShare: 0.6, exactTermShare: 0.2, easyShare: 0.6, repeatShare: 0.1 },
    goals: [
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'accuracy', op: '>=', value: 0.88 },
      { metric: 'p50', op: '<=', value: 7000 },
      { metric: 'costPer1k', op: '<=', value: 0.7 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 60 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
      { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
      { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
      { id: 'gpu', type: 'gpu_llm', x: 700, y: 120, config: { model: 'open-70b', gpus: 4, batch: 1, quant: 'fp16' } },
    ],
    edges: [...chain('users', 'emb', 'vdb', 'rr', 'gpu'), ...chain('users', 'kw', 'rr')],
    hint: 'One request per GPU wastes almost all of it. Raise the batch size and watch throughput jump while each answer slows down. Then decide how many GPUs you really need, and whether you can afford full precision.',
    lesson:
      'Self-hosting turns a per-token bill into a capacity-planning problem. Batching is the biggest lever (one GPU serves many requests at once), quantization makes each GPU faster for a small quality cost, and the GPU count sets your bill whether the GPUs are busy or not. The sweet spot is busy but not saturated: too few GPUs and requests queue and time out, too many and you pay for idle silicon.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
        { id: 'gpu', type: 'gpu_llm', x: 700, y: 120, config: { model: 'open-70b', gpus: 16, batch: 16, quant: 'int8' } },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'rr', 'gpu'), ...chain('users', 'kw', 'rr')],
    },
  },
  {
    id: 'provider-down',
    difficulty: 2,
    skills: ['Outages', 'Retries', 'Failover'],
    title: '11 · The provider is down',
    tagline: '503, 503, 503. Your status page is getting traffic.',
    brief:
      'Your model provider is having a bad day: 70% of calls fail with 503 errors. Your whole product depends on that one provider, so your users see errors too. Keep the product up without wrecking speed or quality.',
    traffic: { ...base, rps: 8, kbShare: 0.6, exactTermShare: 0.2, easyShare: 0.6, repeatShare: 0.1, providerErrors: { A: 0.7 } },
    goals: [
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'accuracy', op: '>=', value: 0.74 },
      { metric: 'p50', op: '<=', value: 6000 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'medium', provider: 'A' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Try Retry & Fallback with only retries first, and push them up. Does it get better or worse? Then give it somewhere else to go: a second model on provider B, or your own GPUs.',
    lesson:
      'Retries help with brief blips, but during a real outage they pile more load onto a struggling provider and make things worse (a retry storm). Resilience means having somewhere else to go: a second provider or a self-hosted model, with automatic failover, timeouts and a cap on retries. The backup doesn\'t need to be identical, just good enough to keep you up.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'fb', type: 'fallback', x: 510, y: 120, config: { retries: 1, failover: true } },
        { id: 'llm', type: 'llm', x: 690, y: 40, config: { size: 'medium', provider: 'A' } },
        { id: 'llmb', type: 'llm', x: 690, y: 200, config: { size: 'medium', provider: 'B' } },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'fb', 'llm'), { source: 'fb', target: 'llmb' }],
    },
  },
  {
    id: 'research-team',
    difficulty: 3,
    skills: ['Multi-agent', 'Orchestration', 'Hand-offs'],
    title: '12 · The research assistant',
    tagline: 'One agent, twenty tabs open, forty seconds per answer.',
    brief:
      'Analysts ask your assistant multi-part research questions: compare three vendors, summarise five competitors, build a briefing. A single agent works through every sub-question one after another, its prompt growing with each search result. Answers are slow and keep missing things. Leadership heard "multi-agent" on a podcast.',
    traffic: { ...base, rps: 1, easyShare: 0.6, repeatShare: 0, complexShare: 0.7 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.8 },
      { metric: 'p50', op: '<=', value: 20000 },
      { metric: 'costPer1k', op: '<=', value: 150 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'ag', type: 'agent', x: 260, y: 120, config: { maxSteps: 20 } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'ag', 'llm'),
    hint: 'Swap the single agent for an Agent Team. Then tune it: how many workers before hand-offs and loops cost more than they save? What do you do about the answers that come back wrong, and about teams that bounce work around forever?',
    lesson:
      'Multi-agent systems trade money for speed and focus. Parallel workers with small, focused contexts beat one agent drowning in its own history, but every agent is more calls, every hand-off loses detail, and agents can loop. Good teams are small (about one worker per sub-task), have a reviewer to catch what the hand-offs dropped, and have a hard cap on rounds.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'team', type: 'agent_team', x: 260, y: 120, config: { workers: 4, reviewer: true, maxRounds: 3 } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'team', 'llm'),
    },
  },
  {
    id: 'think-harder',
    difficulty: 2,
    skills: ['Reasoning models', 'Thinking budgets', 'Model routing'],
    title: '13 · Think harder?',
    tagline: 'The hard questions keep coming back wrong.',
    brief:
      'Your tutoring assistant handles a lot of genuinely hard questions: multi-step maths, tricky logic, "explain why this proof is wrong". The medium model gets too many of them wrong. One engineer wants the large model for everything, another wants the new reasoning mode turned all the way up.',
    traffic: { ...base, rps: 3, easyShare: 0.3, repeatShare: 0 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.91 },
      { metric: 'costPer1k', op: '<=', value: 15 },
      { metric: 'p50', op: '<=', value: 20000 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'Try the large model, then try the thinking budget at low and high. Which one is accurate enough without blowing the cost or the wait? Do the easy questions need any of it?',
    lesson:
      'Reasoning ("thinking") lets a model work through a problem before answering, which buys real accuracy on hard questions. But the hidden thinking tokens are paid for, and they\'re written before the first visible word, so more thinking is slower too. A modest budget usually captures most of the gain. Spend it only where questions are hard, for example by routing easy ones to a small model.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'rt', type: 'router', x: 260, y: 120 },
        { id: 'small', type: 'llm', x: 520, y: 40, config: { size: 'small' } },
        { id: 'llm', type: 'llm', x: 520, y: 200, config: { size: 'medium', thinking: 'low' } },
      ],
      edges: [...chain('users', 'rt', 'llm'), { source: 'rt', target: 'small' }],
    },
  },
  {
    id: 'broke-parser',
    difficulty: 1,
    skills: ['Structured outputs', 'JSON mode', 'Validation'],
    title: '14 · It broke the parser',
    tagline: 'One in nine responses crashes your code.',
    brief:
      'Your invoice-extraction API asks the model to return JSON (vendor, date, line items), and your code parses it. It works in the demo. In production, every so often the model adds a friendly sentence, forgets a bracket or invents a field, and your parser throws. The customer sees a 500 error.',
    traffic: { ...base, rps: 10, easyShare: 0.7, repeatShare: 0, structuredShare: 0.8 },
    goals: [
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'accuracy', op: '>=', value: 0.8 },
      { metric: 'costPer1k', op: '<=', value: 3 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'small' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'Look at what failed in the request inspector. Is the model wrong, or just badly formatted? There\'s a model setting built for exactly this. A validator helps too, but is it enough on its own?',
    lesson:
      'Asking nicely for JSON isn\'t a contract. Models occasionally break format, and at scale "occasionally" means constant crashes. Structured output (JSON mode or schema-constrained decoding) makes the model produce valid output by construction. A validator that checks and retries is the safety net, not the fix.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'small', jsonMode: true } },
      ],
      edges: chain('users', 'llm'),
    },
  },
  {
    id: 'stale-index',
    difficulty: 2,
    skills: ['Data ingestion', 'Index freshness', 'Document parsing'],
    title: '15 · Yesterday\'s answers',
    tagline: 'The price changed on Monday. The bot still quotes the old one.',
    brief:
      'Your retrieval setup is solid (hybrid search, reranking), but the docs it searches change daily: prices, policies, release notes. The index was built once, by hand, from text scraped out of PDFs. Customers get confident answers that were true last month, and anything inside a table seems invisible.',
    traffic: { ...base, kbShare: 0.85, exactTermShare: 0.2, staleShare: 0.3, tableShare: 0.25 },
    goals: [
      { metric: 'hallucination', op: '<=', value: 0.15 },
      { metric: 'accuracy', op: '>=', value: 0.83 },
      { metric: 'costPer1k', op: '<=', value: 12 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 60 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium', refresh: 'manual', parser: 'plain' } },
      { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
      { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
      { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'medium' } },
    ],
    edges: [...chain('users', 'emb', 'vdb', 'rr', 'llm'), ...chain('users', 'kw', 'rr')],
    hint: 'Open the Vector DB settings. Retrieval is only as good as what went into the index: how often is it rebuilt, and how are documents turned into text? (An Output Judge won\'t save you here. Why not?)',
    lesson:
      'Most RAG problems start before retrieval: in ingestion. Content that changes needs a pipeline that re-indexes on a schedule or on every change, or the model will confidently quote old facts that your judge can\'t catch, because the sources agree. And how you parse documents matters: plain text extraction turns tables and multi-column PDFs into word soup.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium', refresh: 'live', parser: 'layout' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
        { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'medium' } },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'rr', 'llm'), ...chain('users', 'kw', 'rr')],
    },
  },
  {
    id: 'big-prompt',
    difficulty: 1,
    skills: ['Prompt caching', 'Cost', 'Latency'],
    title: '16 · The 20-page system prompt',
    tagline: 'Every request re-reads the whole manual.',
    brief:
      'Your compliance assistant sends a 12,000-token system prompt with every request: the full policy manual, tone guide and twenty worked examples. Quality is excellent. The bill is not: almost all of it pays for reading the same text over and over. The small model can\'t even fit it.',
    traffic: { ...base, rps: 6, systemPromptTokens: 12000, repeatShare: 0 },
    goals: [
      { metric: 'costPer1k', op: '<=', value: 15 },
      { metric: 'accuracy', op: '>=', value: 0.85 },
      { metric: 'p50', op: '<=', value: 5000 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'The manual is the same in every request. Is there a way to stop paying full price to process the same tokens every time?',
    lesson:
      'When every request starts with the same long prefix (system prompt, documents, examples), prompt caching lets the provider reuse its work: cached tokens cost roughly a tenth and are read almost instantly. Put the stable content first and the changing content last, so as much as possible can be cached.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium', promptCache: true } },
      ],
      edges: chain('users', 'llm'),
    },
  },
  {
    id: 'nightly-job',
    difficulty: 2,
    skills: ['Batch APIs', 'Async workloads', 'Rate limits'],
    title: '17 · The nightly job ate the day',
    tagline: 'A million tickets to summarise, and live users get 429s.',
    brief:
      'Someone kicked off a job to summarise and tag every support ticket from the last year. It runs through the same real-time API as your live chat. Now 60% of your traffic is a background job nobody is waiting on, it\'s eating your rate limit, and live customers are getting errors.',
    traffic: { ...base, rps: 40, easyShare: 0.5, repeatShare: 0, batchShare: 0.6, systemPromptTokens: 2500 },
    goals: [
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'costPer1k', op: '<=', value: 9 },
      { metric: 'accuracy', op: '>=', value: 0.85 },
      { metric: 'p50', op: '<=', value: 6000 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'Not every request needs an answer in seconds. Where could work that can wait a few hours go instead?',
    lesson:
      'Separate work that someone is waiting on from work that can wait. Providers offer batch APIs at roughly half price with results within hours, and batch jobs don\'t compete with your live traffic for rate limits. Real-time capacity is precious: keep it for real-time users.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'bq', type: 'batch_queue', x: 260, y: 120 },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'bq', 'llm'),
    },
  },
  {
    id: 'fine-tune',
    difficulty: 2,
    skills: ['Fine-tuning', 'RAG vs fine-tuning', 'Cost'],
    title: '18 · Fine-tune it?',
    tagline: 'Your labels, your format, your 40 categories.',
    brief:
      'Your support triage system sorts tickets into your company\'s 40 internal categories, in your exact format, and also answers questions from the help centre. Off-the-shelf models keep inventing categories. The large model does a bit better and costs five times as much. Someone says "just fine-tune it". Someone else says "fine-tuning will teach it our docs too".',
    traffic: { ...base, rps: 8, taskShare: 0.7, kbShare: 0.25, exactTermShare: 0.1, repeatShare: 0 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.82 },
      { metric: 'costPer1k', op: '<=', value: 4 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Try a fine-tuned model in the LLM settings. Which size? And what happens to the help-centre questions if you remove retrieval?',
    lesson:
      'Prompting, RAG and fine-tuning solve different problems. Fine-tuning teaches behaviour: your labels, your format, your tone. A fine-tuned small model often beats a general large one on a narrow task, at a fraction of the price. But it doesn\'t reliably teach facts, and facts change, so knowledge still comes from retrieval. Most real systems use both.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'small', fineTuned: true } },
      ],
      edges: chain('users', 'emb', 'vdb', 'llm'),
    },
  },
  {
    id: 'model-drift',
    difficulty: 2,
    skills: ['Model versions', 'Regressions', 'Evals'],
    title: '19 · Nothing changed. Everything broke.',
    tagline: 'No deploy, no code change, and quality fell off a cliff.',
    brief:
      'Nobody touched the code for two weeks, yet support complaints doubled and a few JSON responses started breaking. Your app calls the provider\'s "latest" model alias, and there\'s nothing measuring answer quality, so all you have is a feeling.',
    traffic: { ...base, kbShare: 0.6, exactTermShare: 0.1, structuredShare: 0.3, driftLatest: true, qualityHidden: true },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.75 },
      { metric: 'errorRate', op: '<=', value: 0.02 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium', version: 'latest', jsonMode: true } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'First make quality visible. Then look at what changed outside your code: which model version are you actually running?',
    lesson:
      'The model is a dependency, and "latest" is an unpinned dependency. Providers update models behind aliases, and prompts tuned for one version can quietly regress on the next. Pin versions, run your evals against a new version before switching, and upgrade on purpose. Evals are what let you notice at all.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium', version: 'pinned', jsonMode: true } },
        { id: 'ev', type: 'eval_harness', x: 700, y: 120 },
      ],
      edges: chain('users', 'emb', 'vdb', 'llm', 'ev'),
    },
  },
  {
    id: 'pii',
    difficulty: 1,
    skills: ['Privacy', 'PII redaction', 'Compliance'],
    title: '20 · Compliance is calling',
    tagline: 'Half your prompts contain someone\'s medical history.',
    brief:
      'Your insurance assistant works well, and every claim question that customers paste in (names, policy numbers, diagnoses) goes straight to a third-party model provider. The compliance team has found out. They want personal data to stop leaving your systems without killing the product.',
    traffic: { ...base, kbShare: 0.6, exactTermShare: 0.1, piiShare: 0.5 },
    goals: [
      { metric: 'piiLeak', op: '<=', value: 0.02 },
      { metric: 'accuracy', op: '>=', value: 0.74 },
      { metric: 'costPer1k', op: '<=', value: 12 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Personal data can be stripped before it leaves, or the model can run somewhere data never leaves. What does each cost you?',
    lesson:
      'Anything in a prompt is data you\'re sending to whoever runs the model. Redact personal details before they leave (swap them for placeholders and put them back in the answer), or keep sensitive traffic on models you host yourself. Detection is never perfect, so combine it with provider agreements, retention settings and data minimisation.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'pii', type: 'pii_redactor', x: 130, y: 120 },
        { id: 'emb', type: 'embedding', x: 260, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 400, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'pii', 'emb', 'vdb', 'llm'),
    },
  },
  {
    id: 'voice',
    difficulty: 2,
    skills: ['Voice', 'Speech-to-text', 'Streaming'],
    title: '21 · The walkie-talkie',
    tagline: 'Talk. Wait seven seconds. Hear a reply.',
    brief:
      'Your new voice assistant answers well, but conversations feel like a walkie-talkie: you finish speaking, then silence for seven seconds, then the whole reply at once. People talk over it or hang up. A natural conversation needs the reply to start in about a second.',
    traffic: { ...base, rps: 3, easyShare: 0.7, repeatShare: 0, voice: true },
    goals: [
      { metric: 'ttftP50', op: '<=', value: 1500 },
      { metric: 'accuracy', op: '>=', value: 0.85 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'stt', type: 'stt', x: 220, y: 120, config: { streaming: false } },
      { id: 'llm', type: 'llm', x: 440, y: 120, config: { size: 'medium' } },
      { id: 'tts', type: 'tts', x: 660, y: 120, config: { streaming: false } },
    ],
    edges: chain('users', 'stt', 'llm', 'tts'),
    hint: 'Open the request inspector and look at where the seconds go. Every stage waits for the previous one to finish completely. Which of them can start early?',
    lesson:
      'Voice is a pipeline (speech-to-text, the model, text-to-speech) with a latency budget of about a second. If each stage waits for the previous one to finish, the delays stack up. Stream every stage: transcribe while the user speaks, stream tokens from the model, and start speaking the first sentence immediately. Images and audio as input work similarly: they become tokens the model has to read, and they cost time and money too.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'stt', type: 'stt', x: 220, y: 120, config: { streaming: true } },
        { id: 'llm', type: 'llm', x: 440, y: 120, config: { size: 'medium', streaming: true } },
        { id: 'tts', type: 'tts', x: 660, y: 120, config: { streaming: true } },
      ],
      edges: chain('users', 'stt', 'llm', 'tts'),
    },
  },
  {
    id: 'abuse',
    difficulty: 1,
    skills: ['Abuse', 'Per-user limits', 'Cost control'],
    title: '22 · One user, half your bill',
    tagline: 'A few scripted accounts are eating everyone\'s capacity.',
    brief:
      'You launched a free tier. Within a week, a handful of accounts started hammering your API from scripts, with huge prompts, hundreds of times a minute. Half your traffic is now them. Real users are getting 429 errors, and your cost per real request has nearly tripled.',
    traffic: { ...base, rps: 40, abuseShare: 0.5, repeatShare: 0 },
    goals: [
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'costPer1k', op: '<=', value: 7 },
      { metric: 'accuracy', op: '>=', value: 0.85 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'Your provider rate-limits you, but nothing rate-limits your users. How many messages a minute does a real person send?',
    lesson:
      'Your provider\'s rate limits protect them, not you. Anything that\'s free, or billed per seat while you pay per token, needs per-user limits on requests, on tokens per day and on spend, so a single script can\'t burn your capacity or your budget. Set them generously for people and tightly for machines.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'lim', type: 'user_limits', x: 260, y: 120, config: { perUserRpm: 60 } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'lim', 'llm'),
    },
  },
];

export const SANDBOX: Scenario = {
  id: 'sandbox',
  difficulty: 0,
  skills: ['Free build', 'Mixed traffic'],
  title: 'Sandbox',
  tagline: 'No goals. Build anything.',
  brief: 'A mixed workload: docs questions, exact-code lookups, tool requests, a few attackers. Build whatever you like and find each wall.',
  traffic: { ...base, rps: 10, kbShare: 0.5, exactTermShare: 0.3, toolShare: 0.2, adversarialShare: 0.05, repeatShare: 0.3 },
  goals: [],
  nodes: [
    { id: 'users', type: 'users', x: 0, y: 120 },
    { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
  ],
  edges: chain('users', 'llm'),
  hint: 'Run it, read the binding pressure, fix that one thing, repeat.',
  lesson: '',
  solution: { nodes: [], edges: [] },
};

export function withDefaults(n: ScenarioNode): ScenarioNode {
  return { ...n, config: { ...COMPONENTS[n.type].defaults, ...(n.config ?? {}) } };
}
