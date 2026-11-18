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
