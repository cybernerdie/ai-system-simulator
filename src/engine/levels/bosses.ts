/**
 * Boss levels: one at the end of each chapter. Each one mixes that chapter's problems into a single system,
 * so you have to use everything you just learned at once. They unlock when the chapter is cleared.
 */
import { base, chain, type Scenario } from './kit';

const boss = (s: Omit<Scenario, 'kind'>): Scenario => ({ ...s, kind: 'boss' });

export const BOSSES: Scenario[] = [
  boss({
    id: 'boss-launch',
    chapter: 0,
    difficulty: 3,
    skills: ['RAG', 'Hybrid search', 'Caching', 'Agents', 'Guardrails'],
    title: 'Boss · Launch week',
    tagline: 'Docs, codes, refunds and attackers, at twenty requests a second.',
    brief:
      'Launch week. Thousands of new customers ask about your docs, paste error codes, want refunds processed, and a few try to jailbreak the bot for screenshots. Your system is still just a prompt and a model. Everything from chapter 1, all at once.',
    traffic: { ...base, rps: 20, kbShare: 0.5, exactTermShare: 0.35, toolShare: 0.25, adversarialShare: 0.08, easyShare: 0.65, repeatShare: 0.35 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.74 },
      { metric: 'injection', op: '<=', value: 0.03 },
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'costPer1k', op: '<=', value: 18 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'Take it one pressure at a time. Knowledge first, then exact codes, then tools, then attackers, then the bill.',
    lesson:
      'Real systems hit every problem at once. The order you fix them in matters less than fixing the one that\'s binding right now, then checking what moved. Each component you added solved one problem and cost something somewhere else.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'ig', type: 'input_guard', x: 100, y: 120, config: { strictness: 0.8 } },
        { id: 'sc', type: 'semantic_cache', x: 200, y: 120, config: { threshold: 0.9 } },
        { id: 'emb', type: 'embedding', x: 300, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 400, y: 60, config: { topK: 12, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 400, y: 200 },
        { id: 'rr', type: 'reranker', x: 500, y: 120, config: { keep: 4 } },
        { id: 'ag', type: 'agent', x: 600, y: 120, config: { maxSteps: 6 } },
        { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'medium' } },
        { id: 'oj', type: 'output_guard', x: 800, y: 120 },
      ],
      edges: [...chain('users', 'ig', 'sc', 'emb', 'vdb', 'rr', 'ag', 'llm', 'oj'), { source: 'sc', target: 'kw' }, { source: 'kw', target: 'rr' }],
    },
  }),
  boss({
    id: 'boss-pilot',
    chapter: 1,
    difficulty: 3,
    skills: ['Chunking', 'Streaming', 'Memory', 'Evals'],
    title: 'Boss · The enterprise pilot',
    tagline: 'A bank is trialling you. They read every transcript.',
    brief:
      'A bank is piloting your contract assistant. Analysts hold long conversations about long documents, they expect words on screen within a second and a half, and their compliance team grades answers you can\'t see unless you measure them. Win the pilot without blowing the budget.',
    traffic: { ...base, rps: 5, kbShare: 0.75, exactTermShare: 0.25, easyShare: 0.45, repeatShare: 0.05, chatTurns: 14, recallShare: 0.25, qualityHidden: true },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.78 },
      { metric: 'ttftP50', op: '<=', value: 1500 },
      { metric: 'costPer1k', op: '<=', value: 16 },
      { metric: 'errorRate', op: '<=', value: 0.01 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 12, chunk: 'large' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'large' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'You can\'t improve what you can\'t see, so measure first. Then: what overflows, what\'s slow to start, and what grows with every message?',
    lesson:
      'Enterprise buyers judge on quality they can audit, speed they can feel and cost they can forecast. Evals make quality visible, smaller chunks and reranking keep context tight, streaming makes it feel fast, and memory keeps long conversations affordable.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'mem', type: 'memory', x: 100, y: 120, config: { strategy: 'retrieval' } },
        { id: 'emb', type: 'embedding', x: 200, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 480, y: 120, config: { keep: 4 } },
        { id: 'llm', type: 'llm', x: 620, y: 120, config: { size: 'medium', streaming: true } },
        { id: 'ev', type: 'eval_harness', x: 760, y: 120 },
      ],
      edges: [...chain('users', 'mem', 'emb', 'vdb', 'rr', 'llm', 'ev'), { source: 'mem', target: 'kw' }, { source: 'kw', target: 'rr' }],
    },
  }),
  boss({
    id: 'boss-outage',
    chapter: 2,
    difficulty: 3,
    skills: ['Failover', 'Structured output', 'Fresh indexes'],
    title: 'Boss · The 9am board report',
    tagline: 'The provider is down, the data changed overnight, and the output feeds a spreadsheet.',
    brief:
      'Every morning your system answers questions about yesterday\'s numbers and fills a board report with JSON your code parses. Today your main provider is failing most calls, half the figures changed overnight and many live in tables. The report is due at 9.',
    traffic: { ...base, rps: 8, kbShare: 0.7, exactTermShare: 0.2, easyShare: 0.55, repeatShare: 0.1, staleShare: 0.25, tableShare: 0.2, structuredShare: 0.4, providerErrors: { A: 0.6 } },
    goals: [
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'accuracy', op: '>=', value: 0.78 },
      { metric: 'costPer1k', op: '<=', value: 15 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 12, chunk: 'medium', refresh: 'manual', parser: 'plain' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium', provider: 'A' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Three separate problems: calls that fail, answers your code can\'t parse, and facts that are out of date or trapped in tables.',
    lesson:
      'Reliability is layered. A second provider keeps you up when one fails, structured output keeps your code from crashing, and a fresh, layout-aware index keeps answers true. None of them helps with the others\' problem.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium', refresh: 'live', parser: 'layout' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 420, y: 120, config: { keep: 4 } },
        { id: 'fb', type: 'fallback', x: 500, y: 120, config: { retries: 1, failover: true } },
        { id: 'llm', type: 'llm', x: 600, y: 60, config: { size: 'medium', provider: 'A', jsonMode: true } },
        { id: 'llmb', type: 'llm', x: 600, y: 200, config: { size: 'medium', provider: 'B', jsonMode: true } },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'rr', 'fb', 'llm'), { source: 'fb', target: 'llmb' }, { source: 'users', target: 'kw' }, { source: 'kw', target: 'rr' }],
    },
  }),
  boss({
    id: 'boss-scale',
    chapter: 3,
    difficulty: 3,
    skills: ['Prompt caching', 'Batch jobs', 'Fine-tuning', 'Privacy'],
    title: 'Boss · Finance wants a word',
    tagline: 'The bill is huge, legal is nervous, and the night jobs are eating the day.',
    brief:
      'Your claims platform works, and it costs a fortune. Every call carries a long policy prompt, half the traffic is overnight classification nobody waits for, customers paste medical details, and the house labelling style is something the base model keeps getting wrong. Finance, legal and support all want it fixed this quarter.',
    traffic: { ...base, rps: 30, easyShare: 0.6, repeatShare: 0, systemPromptTokens: 6000, batchShare: 0.5, piiShare: 0.4, taskShare: 0.5 },
    goals: [
      { metric: 'costPer1k', op: '<=', value: 1.5 },
      { metric: 'piiLeak', op: '<=', value: 0.02 },
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'accuracy', op: '>=', value: 0.8 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'Where does each dollar go? The same long prompt every call, real-time prices for work nobody waits on, and a big model doing a narrow job.',
    lesson:
      'Most of an AI bill is waste you can see: the same tokens resent, urgent prices for patient work, and a general model for a narrow task. Cache it, batch it, specialise it, and strip personal data before any of it leaves.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'pii', type: 'pii_redactor', x: 170, y: 120 },
        { id: 'bq', type: 'batch_queue', x: 340, y: 120 },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'small', fineTuned: true, promptCache: true } },
      ],
      edges: chain('users', 'pii', 'bq', 'llm'),
    },
  }),
  boss({
    id: 'boss-agent',
    chapter: 4,
    difficulty: 3,
    skills: ['Indirect injection', 'Abuse limits', 'Temperature'],
    title: 'Boss · The agent goes public',
    tagline: 'Free signups, an inbox full of strangers, and one right answer per invoice.',
    brief:
      'Your inbox agent is opening to the public with a free tier. It reads incoming emails, pulls totals out of invoices and sends replies on users\' behalf. Scripts are already signing up by the hundred, and some emails are written to hijack it. Launch without a single forwarded invoice.',
    traffic: { ...base, rps: 12, toolShare: 0.7, easyShare: 0.6, repeatShare: 0, sendShare: 0.3, poisonShare: 0.06, abuseShare: 0.3, extractShare: 0.3 },
    goals: [
      { metric: 'harmfulActions', op: '<=', value: 0.002 },
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'accuracy', op: '>=', value: 0.78 },
      { metric: 'costPer1k', op: '<=', value: 45 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'agent', type: 'agent', x: 260, y: 120, config: { permissions: 'send' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'agent', 'llm'),
    hint: 'Who is sending traffic, what is the agent reading, what is it allowed to do without asking, and how random should an invoice total be?',
    lesson:
      'Public agents need defence in depth: limits per user so scripts can\'t swamp you, untrusted content marked as untrusted, approval before anything leaves, and deterministic settings where there is one right answer.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'lim', type: 'user_limits', x: 100, y: 120, config: { perUserRpm: 60 } },
        { id: 'san', type: 'content_sanitizer', x: 200, y: 120 },
        { id: 'agent', type: 'agent', x: 320, y: 120, config: { permissions: 'send' } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium', temperature: 0.1 } },
        { id: 'ap', type: 'action_approval', x: 700, y: 120 },
      ],
      edges: chain('users', 'lim', 'san', 'agent', 'llm', 'ap'),
    },
  }),
  boss({
    id: 'boss-bugs',
    chapter: 5,
    difficulty: 3,
    skills: ['Debugging', 'Caching', 'Reranking', 'Reasoning budget'],
    title: 'Boss · Three bugs, one system',
    tagline: 'Someone "optimised" it three times. Nobody wrote down what they changed.',
    brief:
      'Your knowledge assistant has every component it needs. Over the last month, three different people each tweaked one setting to fix something. Now answers are wrong, slow and expensive, and nobody remembers what they changed. Find all three.',
    traffic: { ...base, rps: 10, kbShare: 0.8, exactTermShare: 0.4, easyShare: 0.7, repeatShare: 0.4 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.8 },
      { metric: 'p50', op: '<=', value: 5000 },
      { metric: 'costPer1k', op: '<=', value: 9 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'sc', type: 'semantic_cache', x: 120, y: 120, config: { threshold: 0.8 } },
      { id: 'emb', type: 'embedding', x: 240, y: 60 },
      { id: 'vdb', type: 'vector_db', x: 360, y: 60, config: { topK: 12, chunk: 'medium' } },
      { id: 'kw', type: 'keyword_search', x: 360, y: 200 },
      { id: 'rr', type: 'reranker', x: 480, y: 120, config: { keep: 1 } },
      { id: 'llm', type: 'llm', x: 620, y: 120, config: { size: 'medium', thinking: 'high' } },
    ],
    edges: [...chain('users', 'sc', 'emb', 'vdb', 'rr', 'llm'), { source: 'sc', target: 'kw' }, { source: 'kw', target: 'rr' }],
    hint: 'Fixing one bug can make another look worse. Follow a few failed requests and a few slow ones; they fail for different reasons.',
    lesson:
      'Debugging a pipeline means isolating one cause at a time. Read individual requests, not just averages: wrong answers, slow answers and expensive answers usually come from different places. Change one thing, watch what moves, then the next.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'sc', type: 'semantic_cache', x: 120, y: 120, config: { threshold: 0.95 } },
        { id: 'emb', type: 'embedding', x: 240, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 360, y: 60, config: { topK: 12, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 360, y: 200 },
        { id: 'rr', type: 'reranker', x: 480, y: 120, config: { keep: 4 } },
        { id: 'llm', type: 'llm', x: 620, y: 120, config: { size: 'medium', thinking: 'off' } },
      ],
      edges: [...chain('users', 'sc', 'emb', 'vdb', 'rr', 'llm'), { source: 'sc', target: 'kw' }, { source: 'kw', target: 'rr' }],
    },
  }),
  boss({
    id: 'boss-ship',
    chapter: 6,
    difficulty: 3,
    skills: ['Authentication', 'Tracing', 'Privacy', 'Fairness'],
    title: 'Boss · Launch review',
    tagline: 'Security, compliance and the support lead all have to sign off.',
    brief:
      'Your assistant is going from beta to general availability, and three teams must sign off. Security found the app key is being abused. Compliance wants personal data kept out of third-party systems, including your logs. Support wants every complaint traceable within hours, and the Spanish-speaking customers served as well as everyone else.',
    traffic: { ...base, rps: 15, kbShare: 0.7, exactTermShare: 0.1, unauthShare: 0.3, piiShare: 0.3, cohortShare: 0.25, cohortHidden: true },
    goals: [
      { metric: 'costPer1k', op: '<=', value: 12 },
      { metric: 'piiLeak', op: '<=', value: 0.02 },
      { metric: 'diagnoseHours', op: '<=', value: 4 },
      { metric: 'fairnessGap', op: '<=', value: 0.07 },
      { metric: 'accuracy', op: '>=', value: 0.7 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'Four sign-offs, four separate problems: who is calling, what leaves your systems, what you record, and who gets worse answers.',
    lesson:
      'Production readiness is mostly controls around the model: auth at the door, personal data redacted before it leaves (for the model and for your logs), traces of every failure, and quality measured per group. None of them makes a demo better. All of them decide whether you can run it for real.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'auth', type: 'auth', x: 100, y: 120 },
        { id: 'pii', type: 'pii_redactor', x: 200, y: 120 },
        { id: 'emb', type: 'embedding', x: 300, y: 120, config: { multilingual: true } },
        { id: 'vdb', type: 'vector_db', x: 400, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
        { id: 'fair', type: 'fairness_eval', x: 640, y: 120 },
        { id: 'tr', type: 'tracing', x: 760, y: 120, config: { sampling: 'errors', capturePrompts: true } },
      ],
      edges: chain('users', 'auth', 'pii', 'emb', 'vdb', 'llm', 'fair', 'tr'),
    },
  }),
];
