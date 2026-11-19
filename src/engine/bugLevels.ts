/**
 * Chapter 6, "Find the bug": complete, sensible-looking systems with one wrong setting.
 * Nothing needs adding. The skill is reading the symptoms and finding the culprit.
 */
import { base, chain, type Scenario } from './scenarioKit';

export const BUG_LEVELS: Scenario[] = [
  {
    id: 'bug-cache',
    difficulty: 2,
    skills: ['Debugging', 'Semantic cache', 'Similarity threshold'],
    title: '26 · Right answer, wrong question',
    tagline: 'Fast and cheap, and sometimes answering something else.',
    brief:
      'Your docs assistant is quick and costs almost nothing, thanks to a cache. But some customers asking about the Pro plan are getting answers about the Basic plan, and people asking how to cancel are told how to upgrade. Everything is already in place. Something in it is set wrong.',
    traffic: { ...base, rps: 20, kbShare: 0.6, exactTermShare: 0.2, easyShare: 0.7, repeatShare: 0.45 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.78 },
      { metric: 'costPer1k', op: '<=', value: 5 },
      { metric: 'errorRate', op: '<=', value: 0.01 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'sc', type: 'semantic_cache', x: 150, y: 120, config: { threshold: 0.8 } },
      { id: 'emb', type: 'embedding', x: 300, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 450, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 600, y: 120, config: { size: 'small' } },
    ],
    edges: chain('users', 'sc', 'emb', 'vdb', 'llm'),
    hint: 'Open a few failed requests. Where did their answer come from? Then look at how similar two questions must be before they count as the same.',
    lesson:
      'A semantic cache matches questions by meaning, so its threshold decides how similar is similar enough. Set it too loose and "how do I cancel?" gets the cached answer to "how do I upgrade?". Too strict and nothing ever hits. Tune it on real pairs of questions, and keep exact facts like prices and plan names out of loose matches.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'sc', type: 'semantic_cache', x: 150, y: 120, config: { threshold: 0.95 } },
        { id: 'emb', type: 'embedding', x: 300, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 450, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 600, y: 120, config: { size: 'small' } },
      ],
      edges: chain('users', 'sc', 'emb', 'vdb', 'llm'),
    },
  },
  {
    id: 'bug-memory',
    difficulty: 2,
    skills: ['Debugging', 'Conversation memory'],
    title: '27 · The goldfish',
    tagline: '"As I said two minutes ago..."',
    brief:
      'Your coaching chatbot has long conversations with its users, and the bill is under control. The complaint is that it keeps forgetting things: the user\'s goal, the injury they mentioned, the plan you agreed on ten messages back. They have to repeat themselves constantly.',
    traffic: { ...base, rps: 6, easyShare: 0.6, repeatShare: 0.05, chatTurns: 22, recallShare: 0.35 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.85 },
      { metric: 'costPer1k', op: '<=', value: 12 },
      { metric: 'errorRate', op: '<=', value: 0.01 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'mem', type: 'memory', x: 260, y: 120, config: { strategy: 'window', windowTurns: 2 } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'mem', 'llm'),
    hint: 'Look at what the model is actually sent with each message. How much of the conversation does it get to see?',
    lesson:
      'Whatever isn\'t in the prompt doesn\'t exist for the model. A tight window keeps costs flat but drops everything older than a few turns. Rolling summaries keep the gist cheaply, and long-term memory brings back the specific earlier turns a new message needs.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'mem', type: 'memory', x: 260, y: 120, config: { strategy: 'retrieval', windowTurns: 2 } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'mem', 'llm'),
    },
  },
  {
    id: 'bug-guard',
    difficulty: 1,
    skills: ['Debugging', 'Guardrails', 'False positives'],
    title: '28 · Safe and useless',
    tagline: 'No jailbreak has got through. Neither have many customers.',
    brief:
      'After last month\'s jailbreak scare, security turned the protection up. No attack has got through since. But support is flooded: customers asking ordinary questions are being told their message "can\'t be processed", and sign-ups are down.',
    traffic: { ...base, rps: 6, kbShare: 0.6, exactTermShare: 0.2, adversarialShare: 0.1 },
    goals: [
      { metric: 'injection', op: '<=', value: 0.03 },
      { metric: 'accuracy', op: '>=', value: 0.7 },
      { metric: 'hallucination', op: '<=', value: 0.08 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'ig', type: 'input_guard', x: 130, y: 120, config: { strictness: 1 } },
      { id: 'emb', type: 'embedding', x: 260, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 400, y: 120, config: { topK: 6, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'medium' } },
      { id: 'oj', type: 'output_guard', x: 720, y: 120 },
    ],
    edges: chain('users', 'ig', 'emb', 'vdb', 'llm', 'oj'),
    hint: 'Open the requests that were blocked. Were they all attacks?',
    lesson:
      'Every guardrail has two error rates: attacks it lets through and real users it blocks. Turning it all the way up trades one for the other, and blocked customers are a failure too, just a quieter one. Measure both, and layer defences instead of maxing out one.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'ig', type: 'input_guard', x: 130, y: 120, config: { strictness: 0.8 } },
        { id: 'emb', type: 'embedding', x: 260, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 400, y: 120, config: { topK: 6, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 560, y: 120, config: { size: 'medium' } },
        { id: 'oj', type: 'output_guard', x: 720, y: 120 },
      ],
      edges: chain('users', 'ig', 'emb', 'vdb', 'llm', 'oj'),
    },
  },
  {
    id: 'bug-reranker',
    difficulty: 2,
    skills: ['Debugging', 'Reranking', 'Context'],
    title: '29 · It found it, then threw it away',
    tagline: 'Recall looks fine. The answers don\'t.',
    brief:
      'Your search pipeline has everything: vector search, keyword search and a reranker. The logs show the right document is almost always retrieved. Yet the assistant still says "I couldn\'t find that" or guesses, especially on questions that need two pieces of information.',
    traffic: { ...base, kbShare: 0.85, exactTermShare: 0.5 },
    goals: [
      { metric: 'accuracy', op: '>=', value: 0.85 },
      { metric: 'hallucination', op: '<=', value: 0.13 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 60 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
      { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
      { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 1 } },
      { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'medium' } },
    ],
    edges: [...chain('users', 'emb', 'vdb', 'rr', 'llm'), { source: 'users', target: 'kw' }, { source: 'kw', target: 'rr' }],
    hint: 'Follow one failed request step by step. The right chunk is found. How many chunks actually reach the model?',
    lesson:
      'A reranker is a filter: it decides what the model gets to read. Keep too few and you throw away the second fact a question needs, or the right chunk when the reranker\'s top pick is wrong. Keep too many and you\'re back to noise and cost. A handful usually works best.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 60 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 60, config: { topK: 12, chunk: 'medium' } },
        { id: 'kw', type: 'keyword_search', x: 340, y: 200 },
        { id: 'rr', type: 'reranker', x: 520, y: 120, config: { keep: 4 } },
        { id: 'llm', type: 'llm', x: 700, y: 120, config: { size: 'medium' } },
      ],
      edges: [...chain('users', 'emb', 'vdb', 'rr', 'llm'), { source: 'users', target: 'kw' }, { source: 'kw', target: 'rr' }],
    },
  },
  {
    id: 'bug-thinking',
    difficulty: 2,
    skills: ['Debugging', 'Reasoning budget', 'Cost'],
    title: '30 · Overthinking "hello"',
    tagline: 'The bill tripled after someone made it smarter.',
    brief:
      'Your support assistant used to be cheap and snappy. Last sprint someone changed a setting to make it "smarter" on tricky questions. Quality barely moved, but every reply now takes many seconds and the monthly bill has tripled. Most questions are simple.',
    traffic: { ...base, rps: 6, easyShare: 0.75, repeatShare: 0 },
    goals: [
      { metric: 'costPer1k', op: '<=', value: 6 },
      { metric: 'p50', op: '<=', value: 5000 },
      { metric: 'accuracy', op: '>=', value: 0.85 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium', thinking: 'high' } },
    ],
    edges: chain('users', 'llm'),
    hint: 'Look at where the time and tokens go on a simple request. Does "what are your opening hours?" need two thousand tokens of thought?',
    lesson:
      'Reasoning tokens are billed and waited for like any other output. Spending them on every request makes easy questions slow and expensive for no gain. Turn thinking off by default, and use it (or a router) only where the problem needs it.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium', thinking: 'off' } },
      ],
      edges: chain('users', 'llm'),
    },
  },
];
