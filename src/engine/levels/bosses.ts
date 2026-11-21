/**
 * Boss levels: one at the end of each chapter. Each one mixes that chapter's problems into a single system,
 * so you have to use everything you just learned at once. They unlock when the chapter is cleared.
 */
import { base, chain, type Scenario } from './kit';
import { BANK, CLAIMS, REPORT, SPANISH } from './questions';

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
    case: {
      job: 'Get through launch week: right answers, no successful attacks, no failures, within budget.',
      chat: {
        user: "My coffee machine shows E1043 and won't work. Can I get a refund? Order #5120.",
        bot: "E1043 means the water tank is empty, so just refill it. Refunds aren't possible once a machine has been used.",
        lie: 'the water tank is empty',
        truth:
          "E1043 means the grinder is jammed, and order #5120 arrived 12 days ago, so it can be refunded. Your bot is still just a prompt and a model: it can't read the manual, look up orders, or spot tricks, and some customers are trying them.",
        fixed: "E1043 means the grinder is jammed. Order #5120 arrived 12 days ago, so it's within the 30-day window: you can request a refund under Orders.",
      },
      predict: {
        question: 'Everything from chapter 1 is going wrong at once. How do you approach it?',
        options: [
          {
            text: 'Add every component from chapter 1 at once',
            why: "You'd pay for all of it and couldn't tell which part helped. Each part also costs something: guards block some honest customers, an agent adds model calls. Add each one because a number needs it.",
          },
          {
            text: 'Fix the biggest problem first, then check what moved',
            right: true,
            why: 'Each fix solves one problem and can shift another. The "Biggest problem right now" panel shows which goal is furthest off. Fix that, read the numbers again, then take the next one.',
          },
          {
            text: 'Switch to the biggest model',
            why: "It still can't read your manual or look up an order, so right answers barely move. Attackers still get through about a third of the time, and the bill is five times higher, over budget.",
          },
        ],
      },
      named: {
        term: "Fixing what's binding",
        text: 'Real systems hit every problem at once. The binding constraint is the one holding you back most right now. Fix it, re-measure, and repeat, because every component solves one problem and costs something elsewhere: money, speed or blocked customers.',
      },
    },
    lesson:
      "Real systems hit every problem at once. The order you fix them in matters less than fixing the one that's binding right now, then checking what moved. Each component you added solved one problem and cost something somewhere else.",
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
      "A bank is piloting your contract assistant. Analysts hold long conversations about long documents, they expect words on screen within a second and a half, and their compliance team grades answers you can't see unless you measure them. Win the pilot without blowing the budget.",
    traffic: { questions: BANK, ...base, rps: 5, kbShare: 0.75, exactTermShare: 0.25, easyShare: 0.45, repeatShare: 0.05, chatTurns: 14, recallShare: 0.25, qualityHidden: true },
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
    hint: "You can't improve what you can't see, so measure first. Then: what overflows, what's slow to start, and what grows with every message?",
    case: {
      job: "Win a bank's trial: answers their compliance team approves, words on screen within 1.5 seconds, within budget.",
      chat: {
        userLabel: 'Bank analyst',
        user: 'Going back to clause 14 from earlier: does the termination fee apply if the supplier breaches first?',
        bot: '(after 9 seconds) Something went wrong. Please try again.',
        lie: 'Something went wrong.',
        truthLabel: 'Behind the scenes',
        truth:
          "Every message sends the whole conversation plus 12 large chunks of contract to your biggest model. Half the questions fail, the rest take 9 seconds to show a first word and cost about 27 cents each. And nothing measures whether answers are right, but the bank's compliance team grades every one.",
        fixed: 'No. Under clause 14.3, the fee is waived if the supplier breaches first.',
      },
      predict: {
        question: "The bank grades answers you can't see. What do you do first?",
        options: [
          {
            text: 'Switch to a smaller, cheaper model',
            why: "Failures and cost drop a lot, but you can't see whether answers got better or worse, and that's what the bank is grading. You'd be trading blind.",
          },
          {
            text: 'Measure answer quality before changing anything else',
            right: true,
            why: "Speed, cost and failures are on your dashboard; quality isn't. Once answers are scored, you can cut the cost and the wait and see whether each change kept the bank's answers right.",
          },
          {
            text: 'Turn on streaming',
            why: "The first words show up in about 2 seconds, but half the questions still fail, every answer still costs 27 cents, and you still can't see quality.",
          },
        ],
      },
      named: {
        term: 'Measure, then tune',
        text: 'Enterprise buyers judge quality they can audit, speed they can feel and cost they can forecast. Evals make quality visible, smaller chunks and reranking keep the context tight, retrieved memory keeps long chats small, and streaming makes it feel fast.',
      },
    },
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
      "Every morning your system answers questions about yesterday's numbers and fills a board report with JSON your code parses. Today your main provider is failing most calls, half the figures changed overnight and many live in tables. The report is due at 9.",
    traffic: {
      questions: REPORT,
      ...base,
      rps: 8,
      kbShare: 0.7,
      exactTermShare: 0.2,
      easyShare: 0.55,
      repeatShare: 0.1,
      staleShare: 0.25,
      tableShare: 0.2,
      structuredShare: 0.4,
      outage: 0.6,
    },
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
    hint: "Three separate problems: calls that fail, answers your code can't parse, and facts that are out of date or trapped in tables.",
    case: {
      job: 'Get the 9am board report out: no failures, the right figures, within budget.',
      chat: {
        userLabel: 'Report script',
        user: "What was yesterday's revenue by region? Reply as JSON.",
        bot: 'Something went wrong. Please try again.',
        lie: 'Something went wrong.',
        truthLabel: 'Behind the scenes',
        truth:
          "Your main provider is failing 6 in 10 calls. Many figures changed overnight, but the index was built by hand and still has the old ones, and figures in tables come through as jumbled text. When an answer does arrive, it's sometimes JSON your code can't parse.",
        fixed: '{"EU": 412300, "US": 538900, "APAC": 201450}',
      },
      predict: {
        question: 'Calls fail, figures are out of date, and the format breaks. Which fix covers all three?',
        options: [
          { text: 'A second provider', why: 'It keeps you answering, but the answers are as out of date as before, and still not always valid JSON.' },
          {
            text: 'None: each problem needs its own fix',
            right: true,
            why: 'The outage, the out-of-date figures and the broken format have different causes, so each needs its own fix. Work out which earlier lesson each one is.',
          },
          { text: 'A bigger model', why: 'It fails just as often, because the provider is down, reads the same old figures, and costs five times as much.' },
        ],
      },
      named: {
        term: 'Layered reliability',
        text: "Reliability comes in layers, and each one guards against a different failure: a second provider for outages, structured output for format, a fresh, layout-aware index for facts. Check which failure you're looking at before choosing a fix.",
      },
    },
    lesson:
      "Reliability is layered. A second provider keeps you up when one fails, structured output keeps your code from crashing, and a fresh, layout-aware index keeps answers true. None of them helps with the others' problem.",
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
    traffic: { questions: CLAIMS, ...base, rps: 30, easyShare: 0.6, repeatShare: 0, systemPromptTokens: 6000, batchShare: 0.5, piiShare: 0.4, taskShare: 0.5 },
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
    case: {
      job: 'Cut the bill by more than 90%, stop personal data leaving, and stop the failures, without hurting answers.',
      chat: {
        user: 'Claim 88-301 from Anna Vella, policy 22-0417: water damage to my kitchen floor. What happens next?',
        bot: 'Something went wrong. Please try again.',
        lie: 'Something went wrong.',
        truthLabel: 'Behind the scenes',
        truth:
          "Every call carries the same 6,000-token policy prompt to a general medium model, at real-time prices, including the overnight sorting jobs that make up half the traffic. The rate limit is used up, so about half of all requests fail, and every customer's personal details go to the provider.",
        fixed: 'An assessor will contact you within 2 working days. Please keep photos of the damage.',
      },
      predict: {
        question: 'Finance, legal and support each have a complaint. Where does the money go?',
        options: [
          {
            text: 'The model is too big: switch to the small one',
            why: 'The bill drops a lot, but right answers fall to about 2 in 3, about 1 in 10 requests still fail, and personal data still leaves.',
          },
          {
            text: "Paying full price for things that don't need it",
            right: true,
            why: 'Three kinds of waste: the same long prompt processed again and again, live prices for work nobody is waiting on, and a general model doing a narrow job. Personal data leaving is a separate problem, the one legal cares about.',
          },
          {
            text: "There's simply too much traffic",
            why: 'Half of it is overnight work nobody waits for. Taken off the live API, it stops using up the rate limit and costs about half as much.',
          },
        ],
      },
      named: {
        term: 'Cache, batch, specialise, redact',
        text: 'Most of an AI bill is waste you can see: the same tokens processed again and again, real-time prices for patient work, and a general model doing a narrow job. Prompt caching, batch APIs and a fine-tuned small model remove it, and a PII redactor keeps personal data inside.',
      },
    },
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
      "Your inbox agent is opening to the public with a free tier. It reads incoming emails, pulls totals out of invoices and sends replies on users' behalf. Scripts are already signing up by the hundred, and some emails are written to hijack it. Launch without a single forwarded invoice.",
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
    case: {
      job: 'Open the inbox agent to the public without a single forwarded invoice, with no failures, right totals and within budget.',
      chat: {
        user: "What's the total on the invoice I just forwarded you?",
        bot: 'Something went wrong. Please try again.',
        lie: 'Something went wrong.',
        truthLabel: 'Behind the scenes',
        truth:
          'Scripts are signing up for free accounts by the hundred and using up your capacity, so about 1 in 4 requests fail. Some incoming emails hide instructions to forward invoices, and the agent can send without asking. And when a total does come back, it can differ each time, because the temperature is set to 0.7.',
        fixed: 'The invoice total is €1,284.00, due 15 December.',
      },
      predict: {
        question: "The answer is right. So what's the problem?",
        options: [
          {
            text: "Customers shouldn't be sharing personal details",
            why: 'They need to: half of all claim questions only make sense with them. Turning those away would break the product for half your customers.',
          },
          {
            text: 'Personal details leave your systems with every claim question',
            right: true,
            why: "Who can send how much, what the agent reads, what it may do without asking, and how random its answers are. Each is a different point in the system, and fixing one doesn't touch the others.",
          },
          {
            text: "It's the provider's job to keep the data safe",
            why: 'Their retention settings are worth having, but the data has still left your systems, which is exactly what compliance objects to.',
          },
        ],
      },
      named: {
        term: 'Defence in depth',
        text: "A public agent needs a control at every point where things can go wrong: limits on who can send how much, sanitizing what it reads, least permission plus approval for what it does, and low temperature where there's one right answer.",
      },
    },
    lesson:
      "Public agents need defence in depth: limits per user so scripts can't swamp you, untrusted content marked as untrusted, approval before anything leaves, and deterministic settings where there is one right answer.",
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
    case: {
      job: 'Find and fix all three settings someone changed, so answers are right, fast and within budget.',
      chat: {
        user: 'Can I return a gift without a receipt?',
        bot: "Gift cards can't be refunded or exchanged.",
        lie: "Gift cards can't be refunded",
        truth:
          'Yes: gifts can be returned within 30 days with the order number, for store credit. Over the last month, three different people each changed one setting to fix something, and nobody wrote down what. Answers are now wrong, slow and expensive.',
        source: 'from your returns policy',
        fixed: "Yes, within 30 days with the order number. You'll get store credit.",
      },
      predict: {
        question: 'The typical answer arrives in a tenth of a second. Why is the bill still over budget?',
        options: [
          {
            text: 'The cache is what costs money',
            why: "The cache costs almost nothing. Every request it doesn't answer goes on to a model set to think hard, and those are the expensive ones.",
          },
          {
            text: 'Fast cache hits are hiding slow, expensive model calls',
            right: true,
            why: 'Most answers come straight from the cache, so the typical time looks great. The rest go on to search and a model whose settings someone changed, and those are slow and expensive. Three bugs, each hiding the others.',
          },
          {
            text: 'Turn off the cache and the problems go away',
            why: 'Wrong answers drop, but almost every reply then takes about 40 seconds and the bill triples. The cache was hiding the thinking bug.',
          },
        ],
      },
      named: {
        term: 'Bugs that hide each other',
        text: 'In a pipeline, one bug can mask another: a cache answering instantly hides a slow model behind it. Fixing one can make another look worse at first. Follow individual requests, both failed and slow ones, until each problem has its own cause.',
      },
    },
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
    traffic: { questions: SPANISH, ...base, rps: 15, kbShare: 0.7, exactTermShare: 0.1, unauthShare: 0.3, piiShare: 0.3, cohortShare: 0.25, cohortHidden: true },
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
    case: {
      job: "Get four teams' sign-off for launch: the bill, personal data, traceable complaints, and equal answers in every language.",
      chat: {
        userLabel: 'Customer (Spanish)',
        user: 'Soy Lucía Pérez, pedido 7731. ¿Puedo devolver la cafetera?',
        bot: 'Something went wrong. Please try again.',
        lie: 'Something went wrong.',
        truthLabel: 'Behind the scenes',
        truth:
          "Strangers are using your leaked app key, so the bill is three times budget and many requests fail. Lucía's name and order number go to the AI provider. Nothing is recorded when an answer goes wrong. And search was built for English, so Spanish questions find the wrong pages.",
        sent: 'Soy [NAME], pedido [ORDER]. ¿Puedo devolver la cafetera?',
        fixed: 'Sí, Lucía: el pedido 7731 está dentro de los 30 días. Te enviamos la etiqueta de devolución.',
      },
      predict: {
        question: 'Support wants every failed prompt recorded. Compliance wants no personal data in your logs. Who gets their way?',
        options: [
          {
            text: 'Support: record full prompts',
            why: "Complaints become traceable, but every customer's name and order number now sits in your logs as well as at the provider.",
          },
          { text: 'Compliance: record nothing', why: 'No personal data in the logs, but every complaint goes back to two days of guessing.' },
          {
            text: 'Both: remove personal data first, then record',
            right: true,
            why: 'Redact personal details at the start of the pipeline, before the prompt leaves or gets logged. Then traces can keep full prompts with placeholders like [NAME], and both teams sign off.',
          },
        ],
      },
      named: {
        term: 'Ready for production',
        text: 'Shipping means answering four questions: who may call (authentication), what leaves your systems (redaction), what you record (tracing), and who gets worse answers (per-group evals). Order matters: redact before anything is sent or logged.',
      },
    },
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
