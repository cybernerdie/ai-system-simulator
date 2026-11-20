/**
 * Chapter 7, "Production readiness": the controls a demo never needs and production always does.
 * Who may call you at all, seeing why an answer went wrong, and checking every group of users is served well.
 */
import { base, chain, type Scenario } from './kit';

export const PROD_LEVELS: Scenario[] = [
  {
    id: 'leaked-key',
    difficulty: 2,
    skills: ['Authentication', 'API keys', 'Cost control'],
    title: '31 · The key was in the app',
    tagline: 'Per-user limits are on. The bill doubled anyway.',
    brief:
      "Your mobile app calls the AI endpoint directly, with the key built into the app. Someone pulled it out, and now scripts all over the world use your endpoint as a free AI. They rotate thousands of accounts and addresses, so your per-user limits barely notice. Nearly half your traffic isn't your users.",
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
    case: {
      job: 'Stop strangers using your AI endpoint for free and get the bill back down, without touching real users.',
      chat: {
        userLabel: 'Unknown caller',
        user: 'Write me a 2,000-word essay on the history of the Roman Empire.',
        bot: 'The Roman Empire began in 27 BC, when Augustus became the first emperor...',
        lie: 'The Roman Empire began',
        truthLabel: 'Behind the scenes',
        truth:
          "That isn't one of your customers. Your app's key is built into the app, someone pulled it out, and scripts around the world now use your endpoint as a free AI. They rotate thousands of accounts and addresses, so your per-user limits barely notice. Nearly half your traffic isn't your users.",
        fixed: '(rejected: the request has no valid user sign-in)',
      },
      predict: {
        question: 'Per-user limits are on. Why is the bill still double the budget?',
        options: [
          {
            text: 'The per-user limit is too high',
            why: 'Lowering it changes nothing: each script spreads its traffic over thousands of accounts, so none of them comes near any limit.',
          },
          {
            text: "Anyone with the key can call, so nothing checks who's calling",
            right: true,
            why: "A key inside an app isn't a secret: anyone can pull it out. Limits slow down callers you know; you first need to check that each call comes from a signed-in user of yours.",
          },
          {
            text: 'The model is too expensive: switch to the small one',
            why: "The bill drops, but fewer answers are right for your real users, below what you need. And you'd still be paying to serve strangers.",
          },
        ],
      },
      named: {
        term: 'Authentication',
        text: "Authentication checks who is calling before anything else runs, usually with a short-lived token from a signed-in session rather than a key shipped inside the app. Keys belong on your server, never in the app. Rate limits then shape traffic from users you know; they can't stop callers who should never get in.",
      },
    },
    lesson:
      "Anything shipped to a user's device or browser is public, including keys. Put auth in front of your own endpoint so every call needs valid credentials, keep provider keys on your server, and use per-user limits for the users you do let in. Limits and auth answer different questions: how much, and who.",
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
    case: {
      job: 'Be able to explain any wrong answer within a few hours, without a big storage bill.',
      chat: {
        user: 'Can I get a refund on a sale item?',
        bot: 'Yes, sale items can be refunded within 60 days.',
        lie: 'within 60 days',
        truth:
          'Sale items can be exchanged within 14 days but not refunded. The customer sent a screenshot. Engineering wants to see what search found and what the model was sent, but nothing was recorded, so every complaint like this takes two days of guessing.',
        source: 'from your returns policy',
        fixed: "Sale items can't be refunded, but you can exchange them within 14 days.",
      },
      predict: {
        question: "Engineering can't explain the answer. What's missing?",
        options: [
          {
            text: 'A record of every request, in full',
            why: 'It explains everything, but storing every prompt and answer costs more than your budget allows. Most requests went fine and nobody will ever look at them.',
          },
          {
            text: 'A record of what each failed request saw and did',
            right: true,
            why: 'Keep a trace of every failed request, plus a small sample of the rest: the question, what search returned and the exact prompt the model received. Then a wrong answer can be explained in an hour or two.',
          },
          {
            text: 'A record of timings and errors, without the prompts',
            why: "You'd see which steps ran and how long they took, but not what the model read, which is what explains a wrong answer. Diagnosis still takes more than four hours.",
          },
        ],
      },
      named: {
        term: 'Tracing',
        text: "A trace records one request's journey: each step, its timing, what it received and what it returned. Sample cleverly (every error, a little of the rest) to keep storage cheap, and capture prompts and retrieved chunks, because that's what explains a wrong answer.",
      },
    },
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
    tagline: 'Fine on average. Not for everyone.',
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
    case: {
      job: 'Measure quality for each language, then close the gap for Spanish and Portuguese speakers, within budget.',
      chat: {
        user: '\u00bfC\u00f3mo cambio la direcci\u00f3n de entrega de mi pedido?',
        bot: 'Para cancelar tu pedido, ve a Pedidos y elige Cancelar.',
        lie: 'Para cancelar tu pedido',
        truth:
          'They asked how to change their delivery address, and the bot explained how to cancel. A third of your customers write in Spanish or Portuguese, and they keep escalating to human support. The dashboard only shows the overall average, so nobody has checked whether their answers are as good.',
        fixed: 'Ve a Pedidos, elige el pedido y pulsa Cambiar direcci\u00f3n.',
      },
      predict: {
        question: 'Why do Spanish-speaking customers get worse answers?',
        options: [
          {
            text: 'The model is weaker in Spanish: use the large one',
            why: 'The large model narrows nothing: the gap between languages stays the same and the bill is five times higher. The model never sees the right page in the first place.',
          },
          {
            text: 'Search was built for English, so Spanish questions find the wrong pages',
            right: true,
            why: "The embedding model only understands English, so a Spanish question's meaning gets lost and search returns pages that merely look similar. The model then answers from the wrong page, in good Spanish.",
          },
          { text: 'Spanish speakers ask harder questions', why: 'They ask the same kinds of questions. Their answers are worse because of the language the question arrives in.' },
        ],
      },
      named: {
        term: 'Measuring per group',
        text: "An average can hide a group that's doing badly. Measure quality separately for each group, such as language, region or device, so gaps show up. Here the fix sits upstream: a multilingual embedding model, so a question means the same thing to search in any language.",
      },
    },
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
