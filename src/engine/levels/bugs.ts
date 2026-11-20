/**
 * Chapter 6, "Find the bug": complete, sensible-looking systems with one wrong setting.
 * Nothing needs adding. The skill is reading the symptoms and finding the culprit.
 */
import { base, chain, type Scenario } from './kit';
import { COACHING } from './questions';

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
    case: {
      job: "Find the setting that's wrong and fix it, keeping the bot cheap and reliable.",
      chat: {
        user: 'How do I cancel my Pro plan?',
        bot: 'To upgrade to Pro, go to Settings, then Plan, and choose Pro.',
        lie: 'To upgrade to Pro',
        truth:
          'Go to Settings, then Plan, then Cancel. The model never saw this question: the answer came from the cache, which decided it was the same as an earlier "How do I upgrade to Pro?".',
        source: 'from the help centre',
        fixed: 'Go to Settings, then Plan, then Cancel. You keep Pro until the end of the month.',
      },
      predict: {
        question: 'Why did a question about cancelling get an answer about upgrading?',
        options: [
          {
            text: 'The small model is too weak',
            why: 'The model never saw this question. A medium model behind the same cache gets barely more right and costs almost 20 times as much.',
          },
          {
            text: "The cache treats questions as the same when they're only similar",
            right: true,
            why: 'A semantic cache compares meanings, and its threshold sets how close two questions must be. Set too loose, "cancel Pro" and "upgrade to Pro" count as the same question, so one gets the other\'s stored answer.',
          },
          {
            text: 'The cancellation docs are wrong',
            why: "They're right, but they were never read. The answer was served straight from the cache, before search or the model ran.",
          },
        ],
      },
      named: {
        term: 'Cache similarity threshold',
        text: 'A semantic cache reuses an answer when a new question is similar enough to an old one. Set the threshold too low and different questions share answers; too high and it rarely hits. Small words like "cancel" and "upgrade" can flip the meaning, so the threshold usually has to be high: 0.9 or above.',
      },
    },
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
      "Your coaching chatbot has long conversations with its users, and the bill is under control. The complaint is that it keeps forgetting things: the user's goal, the injury they mentioned, the plan you agreed on ten messages back. They have to repeat themselves constantly.",
    traffic: { questions: COACHING, ...base, rps: 6, easyShare: 0.6, repeatShare: 0.05, chatTurns: 22, recallShare: 0.35 },
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
    case: {
      job: "Find the setting that's wrong and fix it, so the bot remembers what matters without the bill growing.",
      chat: {
        userLabel: 'User',
        user: 'OK, so what should my run be today?',
        bot: 'How about a 10 km tempo run to build some speed?',
        lie: 'a 10 km tempo run',
        truth:
          'Ten messages ago they said their knee is still sore, and you agreed on easy 3 km runs this week. The bot only gets the last 2 messages of the conversation with each new one, so all of that is gone.',
        fixed: 'An easy 3 km, like we planned, to keep the pressure off your knee.',
      },
      predict: {
        question: 'Why did the bot forget the plan you agreed?',
        options: [
          {
            text: 'The model has a bad memory: use the large one',
            why: "Models don't remember anything between messages; they only see what they're sent. A large model gets the same 2 messages, barely does better, and costs five times as much.",
          },
          {
            text: "It's only sent the last two messages each time",
            right: true,
            why: 'The memory window is set to 2, so anything said earlier never reaches the model. Cheap, but the plan, the goal and the sore knee all fall out of view.',
          },
          {
            text: 'Send the whole conversation every time',
            why: 'It remembers more, but every message carries thousands of tokens: the bill is double the budget, and the longest chats start failing.',
          },
        ],
      },
      named: {
        term: 'Memory window',
        text: 'A sliding window keeps the last few messages and drops the rest: cheap, but it forgets anything older. A window of 2 is very short. Retrieving the earlier messages that matter for each new one keeps important facts in view at a small cost.',
      },
    },
    lesson:
      "Whatever isn't in the prompt doesn't exist for the model. A tight window keeps costs flat but drops everything older than a few turns. Rolling summaries keep the gist cheaply, and long-term memory brings back the specific earlier turns a new message needs.",
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
    case: {
      job: "Find the setting that's wrong and fix it: let customers through while still stopping attacks.",
      chat: {
        user: 'Hi, how do I reset my password?',
        bot: "Sorry, your message can't be processed.",
        lie: "can't be processed",
        truth:
          "An ordinary question, blocked. After last month's jailbreak scare, security turned the Input Guardrail up to maximum strictness. No attack has got through since, and neither have many customers.",
        source: 'from the help centre',
        fixed: "Go to Sign in, choose Forgot password, and we'll email you a reset link.",
      },
      predict: {
        question: 'No attacks are getting through. Why is that a problem?',
        options: [
          {
            text: "It isn't: customers just need to rephrase",
            why: "They're asking ordinary questions in ordinary words. They don't know what tripped the guard, so most give up, and right answers fall to about 6 in 10.",
          },
          {
            text: 'The guard is so strict it blocks honest messages too',
            right: true,
            why: 'Every guard trades blocked attacks for blocked customers. At maximum strictness it flags anything slightly unusual, and many real questions look slightly unusual.',
          },
          { text: 'Turn the guard off: the output judge is enough', why: 'Without it, about 1 in 4 attacks get through. You need it on, just not at maximum.' },
        ],
      },
      named: {
        term: 'Guard strictness',
        text: "A guard's strictness trades false negatives (attacks it misses) against false positives (honest messages it blocks). Maximum strictness looks safe on the attack chart and quietly loses customers. Tune it so attacks stay under your limit without blocking real users, and let the output judge catch what slips through.",
      },
    },
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
    tagline: "Recall looks fine. The answers don't.",
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
    case: {
      job: "Find the setting that's wrong and fix it, so questions that need two facts get both.",
      chat: {
        user: 'Does the CM-7 come with a milk frother, and is it dishwasher safe?',
        bot: "I couldn't find that information. Please check the manual.",
        lie: "I couldn't find that information.",
        truth: "Yes, a frother is included, and it's dishwasher safe on the top rack. Search found both pages, then the reranker passed only the single best chunk to the model.",
        source: 'from the CM-7 manual',
        fixed: "Yes, the CM-7 includes a milk frother, and it's dishwasher safe on the top rack.",
      },
      predict: {
        question: "Search found both pages. Why does the bot say it couldn't find them?",
        options: [
          { text: 'Search needs to bring back more results', why: 'It already finds the right pages. Bringing back 30 changes nothing, because only one reaches the model.' },
          {
            text: 'The reranker only lets one chunk through',
            right: true,
            why: 'The reranker is set to keep 1. A question that needs two facts can never get both, so the model guesses or gives up.',
          },
          {
            text: 'The model is too small to combine two facts',
            why: 'It only ever sees one fact. A large model given the same single chunk barely does better, at about five times the cost.',
          },
        ],
      },
      named: {
        term: 'Reranker "keep"',
        text: "A reranker reads everything search found and passes only the best few chunks to the model. Keep too many and the answer drowns in noise; keep too few and questions that need more than one fact can't be answered. Around 3 to 5 chunks is a common place to start.",
      },
    },
    lesson:
      "A reranker is a filter: it decides what the model gets to read. Keep too few and you throw away the second fact a question needs, or the right chunk when the reranker's top pick is wrong. Keep too many and you're back to noise and cost. A handful usually works best.",
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
    tagline: 'The bill went up sevenfold after someone made it smarter.',
    brief:
      'Your support assistant used to be cheap and snappy. Last sprint someone changed a setting to make it "smarter" on tricky questions. Quality barely moved, but every reply now takes many seconds and the monthly bill is seven times what it was. Most questions are simple.',
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
    case: {
      job: "Find the setting that's wrong and fix it, bringing back fast, cheap answers without losing quality.",
      chat: {
        user: 'What are your opening hours?',
        bot: "(after 40 seconds) We're open 9am to 6pm, Monday to Saturday.",
        lie: '(after 40 seconds)',
        truthLabel: 'Behind the scenes',
        truth:
          'The answer is right, 40 seconds late. Last sprint someone set thinking to high for every question. Now the model writes thousands of hidden reasoning tokens before answering, even "what are your opening hours?", and you pay for every one. The bill is seven times what it was.',
        fixed: "We're open 9am to 6pm, Monday to Saturday.",
      },
      predict: {
        question: 'Why does a simple question take 40 seconds?',
        options: [
          { text: 'The model is too big: switch to the small one', why: "It's cheaper, but still thinks hard about everything, so replies still take about 18 seconds." },
          {
            text: 'Turning thinking down to low will fix it',
            why: 'Better, but every reply still takes about 13 seconds and costs twice your budget. Three in four of these questions are simple and need no thinking at all.',
          },
          {
            text: 'It thinks hard about every question, even simple ones',
            right: true,
            why: 'Thinking is written before the first visible word and billed like any output. Most of your questions are simple; turned off, answers are still right more than 9 times in 10.',
          },
        ],
      },
      named: {
        term: 'When not to think',
        text: "Reasoning helps on genuinely hard questions, and costs time and tokens on every question it's used for. Leave it off by default, and turn it on only where questions are hard, for example behind a router.",
      },
    },
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
