/**
 * Chapter 7, "Production readiness": the controls a demo never needs and production always does.
 * Who may call you at all, seeing why an answer went wrong, and checking every group of users is served well.
 */
import { base, chain, type Scenario } from './scenarioKit';

export const PROD_LEVELS: Scenario[] = [
  {
    id: 'leaked-key',
    difficulty: 2,
    skills: ['Authentication', 'API keys', 'Cost control'],
    title: '31 · The key was in the app',
    tagline: 'Per-user limits are on. The bill doubled anyway.',
    brief:
      'Your mobile app calls the AI endpoint directly, with the key built into the app. Someone pulled it out, and now scripts all over the world use your endpoint as a free AI. They rotate thousands of accounts and addresses, so your per-user limits barely notice. Nearly half your traffic isn\'t your users.',
    traffic: { ...base, rps: 30, easyShare: 0.6, repeatShare: 0, unauthShare: 0.45 },
    goals: [
      { metric: 'costPer1k', op: '<=', value: 7 },
      { metric: 'errorRate', op: '<=', value: 0.01 },
      { metric: 'accuracy', op: '>=', value: 0.85 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'lim', type: 'user_limits', x: 260, y: 120, config: { perUserRpm: 60 } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'lim', 'llm'),
    hint: 'Per-user limits slow down users you know. What stops callers who should never have been let in at all?',
    lesson:
      'Anything shipped to a user\'s device or browser is public, including keys. Put auth in front of your own endpoint so every call needs valid credentials, keep provider keys on your server, and use per-user limits for the users you do let in. Limits and auth answer different questions: how much, and who.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'auth', type: 'auth', x: 130, y: 120 },
        { id: 'lim', type: 'user_limits', x: 260, y: 120, config: { perUserRpm: 60 } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
      ],
      edges: chain('users', 'auth', 'lim', 'llm'),
    },
  },
  {
    id: 'why-did-it-say',
    difficulty: 2,
    skills: ['Tracing', 'Observability', 'Sampling'],
    title: '32 · Why did it say that?',
    tagline: 'A customer has a screenshot. You have nothing.',
    brief:
      'A customer sent a screenshot of your assistant confidently quoting the wrong refund policy. Engineering wants to know what the model was sent and what retrieval found, but nothing was recorded. Every complaint like this takes two days of guessing. Be able to answer "why" within a few hours, without a huge storage bill.',
    traffic: { ...base, rps: 8, kbShare: 0.7, exactTermShare: 0.2 },
    goals: [
      { metric: 'diagnoseHours', op: '<=', value: 4 },
      { metric: 'accuracy', op: '>=', value: 0.7 },
      { metric: 'costPer1k', op: '<=', value: 11.1 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'You need a record of what happened inside a failed request. Which requests do you actually need to keep, and what has to be in the record to explain a wrong answer?',
    lesson:
      'Wrong answers don\'t throw errors, so you need traces: the prompt, what was retrieved, each model call. Keeping every request is expensive and mostly useless; random samples miss the rare failure you\'re hunting. Keep every failure plus a small sample of the rest, store the text (with personal data redacted first), and you can answer "why did it say that?" in minutes.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 120 },
        { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
        { id: 'tr', type: 'tracing', x: 700, y: 120, config: { sampling: 'errors', capturePrompts: true } },
      ],
      edges: chain('users', 'emb', 'vdb', 'llm', 'tr'),
    },
  },
  {
    id: 'average-looks-fine',
    difficulty: 3,
    skills: ['Fairness', 'Cohort evals', 'Multilingual'],
    title: '33 · The average looks fine',
    tagline: '82% accurate overall. Not for everyone.',
    brief:
      'Your help assistant scores well, and the dashboard is green. But a third of your customers write in Spanish or Portuguese, and they keep escalating to human support. Nobody has checked whether quality is the same for them. Find out, and close the gap.',
    traffic: { ...base, rps: 6, kbShare: 0.75, exactTermShare: 0.1, cohortShare: 0.3, cohortHidden: true },
    goals: [
      { metric: 'fairnessGap', op: '<=', value: 0.06 },
      { metric: 'accuracy', op: '>=', value: 0.72 },
      { metric: 'costPer1k', op: '<=', value: 12 },
    ],
    nodes: [
      { id: 'users', type: 'users', x: 0, y: 120 },
      { id: 'emb', type: 'embedding', x: 170, y: 120 },
      { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
      { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
    ],
    edges: chain('users', 'emb', 'vdb', 'llm'),
    hint: 'First make the gap visible: measure quality per group, not just overall. Then follow a failed Spanish request and see where it goes wrong.',
    lesson:
      'An average hides who is being served badly. Measure quality per group (language, region, device, plan) and set a limit on the gap, not just on the average. Here the cause was English-only embeddings: questions in other languages landed nowhere near the docs that answered them. Multilingual embeddings fixed it for a small extra cost.',
    solution: {
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 120 },
        { id: 'emb', type: 'embedding', x: 170, y: 120, config: { multilingual: true } },
        { id: 'vdb', type: 'vector_db', x: 340, y: 120, config: { topK: 5, chunk: 'medium' } },
        { id: 'llm', type: 'llm', x: 520, y: 120, config: { size: 'medium' } },
        { id: 'fair', type: 'fairness_eval', x: 700, y: 120 },
      ],
      edges: chain('users', 'emb', 'vdb', 'llm', 'fair'),
    },
  },
];
