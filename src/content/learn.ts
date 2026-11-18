import type { ComponentType } from '../engine/types';

/* ------------------------------------------------------------------ */
/* Lessons: short, plain-language explainers tied to scenarios         */
/* ------------------------------------------------------------------ */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'analogy'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'takeaway'; text: string };

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  blocks: Block[];
  terms: string[]; // glossary ids
  scenarioId?: string;
  components?: ComponentType[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'temperature',
    title: 'Temperature and sampling',
    summary: 'Why the same question can get a different answer, and when you want that.',
    minutes: 4,
    scenarioId: 'temperature',
    components: ['llm'],
    terms: ['temperature', 'top-p', 'sampling', 'determinism'],
    blocks: [
      { kind: 'p', text: 'A model doesn\'t pick "the" next word. For every token it produces a list of possible next tokens with probabilities, for example "Paris" 92%, "the" 3%, "a" 1%, and then picks one. How it picks is called sampling.' },
      { kind: 'list', items: [
        'Temperature 0: always take the most likely token. The same input gives (almost) the same output.',
        'Temperature around 0.7: usually the likely token, sometimes a less likely one. Natural, varied writing.',
        'Temperature 1 and above: rare tokens get picked more often. More creative, more surprising, more mistakes.',
        'Top-p does a similar job a different way: only pick from the smallest set of tokens that together cover, say, 90% of the probability.',
      ] },
      { kind: 'p', text: 'The rule of thumb: match the temperature to the task. Extraction, classification, routing, JSON and anything with one right answer want 0–0.2. Writing, brainstorming and naming want 0.5–0.9. Too low on creative work makes everything sound the same; too high on precise work gives different totals for the same invoice.' },
      { kind: 'p', text: 'Even at 0, outputs aren\'t perfectly repeatable on most hosted APIs (tiny numerical differences and batching can flip a near-tie). If you need the exact same result, cache it or store it.' },
      { kind: 'analogy', text: 'Low temperature is an accountant reading the number off the page. High temperature is a jazz musician improvising. Both are skills. Don\'t hire the jazz musician to do your books.' },
      { kind: 'takeaway', text: 'Temperature trades consistency for variety. Pick per task, not per app.' },
    ],
  },
  {
    id: 'trustworthy-evals',
    title: 'Building evals you can trust',
    summary: 'A green dashboard is only as honest as its test set and its judge.',
    minutes: 5,
    scenarioId: 'eval-trust',
    components: ['eval_harness'],
    terms: ['golden-dataset', 'llm-as-judge', 'judge-bias', 'offline-online-evals', 'regression-suite'],
    blocks: [
      { kind: 'p', text: 'Having evals isn\'t the same as having good evals. The two places they go wrong are what you test and who decides an answer is right.' },
      { kind: 'list', items: [
        'The test set. The 50 examples written at launch are usually easy, clean and stale. Real users ask harder, messier and newer things. Sample real traffic into your test set and refresh it regularly. Include the failures that support tickets reveal.',
        'Exact match. Cheap and objective for things like IDs and labels, but it marks a correct answer wrong just because it\'s worded differently.',
        'LLM-as-judge. Scales to thousands of answers, but has biases: it tends to prefer longer and more confident answers, and can miss fluent, plausible mistakes. Check it against human ratings on a sample, so you know how often it\'s wrong.',
        'Human review. The most accurate and the most expensive. Use it to calibrate the automatic judges, not to grade everything.',
      ] },
      { kind: 'p', text: 'Run evals in two places. Offline, before shipping: every prompt, model or retrieval change runs the regression suite, like unit tests. Online, after shipping: a judge scores a sample of live traffic so you notice drift. When the two disagree, or when evals disagree with user complaints, trust the complaints and fix the evals.' },
      { kind: 'analogy', text: 'A student who only ever sits the same practice exam will ace it. That tells you about the practice exam, not about the student.' },
      { kind: 'takeaway', text: 'Test on real traffic, check your judge against humans, then believe the numbers.' },
    ],
  },
  {
    id: 'how-models-are-made',
    title: 'How models are made',
    summary: 'Read the internet, learn to follow instructions, learn what people prefer.',
    minutes: 5,
    components: ['llm'],
    terms: ['pretraining', 'parameters', 'instruction-tuning', 'rlhf', 'distillation', 'training-data'],
    blocks: [
      { kind: 'p', text: 'A modern language model is built in stages. You don\'t need to train one to build with them, but knowing the stages explains a lot about how they behave.' },
      { kind: 'list', items: [
        'Pretraining. The model reads an enormous amount of text and learns one skill: predict the next token. Along the way it picks up grammar, facts, reasoning patterns and code. The result knows a lot but isn\'t yet a helpful assistant.',
        'Instruction tuning. It\'s then trained on many examples of instructions paired with good responses, so it learns to answer questions and follow requests rather than just continue text.',
        'Preference training (RLHF and similar). People (or other models) compare pairs of answers and say which is better. The model is nudged towards the preferred style: helpful, honest, safe.',
        'Distillation. A big model\'s outputs are used to train a smaller, cheaper one, which is how many fast "small" models get surprisingly good.',
      ] },
      { kind: 'analogy', text: 'Pretraining is years of reading everything in the library. Instruction tuning is job training. Preference training is feedback from a manager on which drafts work better.' },
      { kind: 'p', text: 'This explains several everyday behaviours: models know a lot of public facts but nothing after their training date or inside your company; they\'re eager to give an answer (a habit from training); and their size, measured in parameters, roughly tracks how much they can learn.' },
      { kind: 'takeaway', text: 'Training gives general skill. Your system supplies the specific knowledge.' },
    ],
  },
  {
    id: 'fine-tuning-vs-rag',
    title: 'Prompting, RAG or fine-tuning?',
    summary: 'Three ways to customise a model, for three different problems.',
    minutes: 5,
    scenarioId: 'fine-tune',
    components: ['vector_db', 'llm'],
    terms: ['few-shot', 'rag', 'fine-tuning'],
    blocks: [
      { kind: 'p', text: 'When a model doesn\'t do what you need, there are three levers. They\'re often confused, and they fix different things.' },
      { kind: 'list', items: [
        'Prompting (instructions, plus a few examples, known as few-shot). Fastest to try, no training. Great for getting started; limited by how much you can fit, and by paying for those tokens on every call.',
        'RAG (retrieval). For knowledge: facts, documents, anything that changes. The model reads the right pages at question time, so updating knowledge just means updating the index.',
        'Fine-tuning. For behaviour: your labels, format, tone, or a narrow task done thousands of times. Training is a one-off cost, and a fine-tuned small model can beat a much larger general one at that task.',
      ] },
      { kind: 'p', text: 'The classic mistake is fine-tuning to "teach the model our docs". It learns the style of your docs and a fuzzy version of their facts, then confidently mixes them up, and it\'s out of date the moment the docs change. Facts go in retrieval; behaviour goes in fine-tuning.' },
      { kind: 'analogy', text: 'Prompting is giving instructions to a temp. RAG is handing them the right folder. Fine-tuning is training a new hire until your way of working becomes habit.' },
      { kind: 'takeaway', text: 'Start with prompting, add RAG for knowledge, fine-tune for behaviour.' },
    ],
  },
  {
    id: 'model-updates',
    title: 'When the model changes under you',
    summary: 'Your model is a dependency. Pin it.',
    minutes: 3,
    scenarioId: 'model-drift',
    components: ['llm', 'eval_harness'],
    terms: ['model-version', 'regression', 'eval'],
    blocks: [
      { kind: 'p', text: 'Providers improve their models constantly, and many offer a "latest" alias that always points at the newest version. Convenient, until a new version handles your carefully tuned prompt differently: more verbose, a different refusal style, slightly different JSON.' },
      { kind: 'list', items: [
        'Pin a specific, dated model version in production.',
        'When a new version comes out, run your evals on it first, compare the numbers, then switch on purpose.',
        'Watch provider deprecation dates: pinned versions eventually retire, so upgrading is a scheduled job, not a surprise.',
      ] },
      { kind: 'analogy', text: 'You wouldn\'t let a library auto-update in production without running your tests. A model is a dependency too, just a fuzzier one.' },
      { kind: 'takeaway', text: 'Pin versions, upgrade deliberately, let evals decide.' },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and personal data',
    summary: 'Anything in a prompt leaves with the prompt.',
    minutes: 4,
    scenarioId: 'pii',
    components: ['pii_redactor', 'llm', 'gpu_llm'],
    terms: ['pii', 'redaction', 'data-retention', 'data-residency'],
    blocks: [
      { kind: 'p', text: 'Every prompt you send to an API is data you\'re handing to another company: the user\'s message, the retrieved documents, the chat history. If those contain names, emails, health or financial details, you\'re moving personal data, with all the rules that come with it.' },
      { kind: 'list', items: [
        'Redact before sending: detect personal details, swap them for placeholders ("[NAME_1]"), and put the real values back into the answer afterwards. The model rarely needs the actual name to help.',
        'Minimise: don\'t retrieve or include personal data the task doesn\'t need.',
        'Check retention and training settings with your provider, and where the data is processed (residency).',
        'For the most sensitive workloads, self-host so the data never leaves your infrastructure.',
      ] },
      { kind: 'analogy', text: 'Blacking out names on a document before you send it to an outside consultant.' },
      { kind: 'takeaway', text: 'Send the model what it needs, not everything you have.' },
    ],
  },
  {
    id: 'abuse-controls',
    title: 'Protecting your capacity from abuse',
    summary: 'Your provider limits you. You need to limit your users.',
    minutes: 3,
    scenarioId: 'abuse',
    components: ['user_limits', 'llm'],
    terms: ['per-user-limits', 'quota', 'rate-limit'],
    blocks: [
      { kind: 'p', text: 'Every AI request costs you money, unlike most web requests. That makes free tiers and flat-price plans a target: one script can send thousands of long prompts and burn a month\'s budget in a day, and use up the rate limit your real users need.' },
      { kind: 'list', items: [
        'Per-user rate limits: requests per minute that no human would hit.',
        'Quotas: tokens or spend per user per day or month.',
        'Size limits: cap input length, since huge prompts are the expensive part.',
        'Watch for outliers: a tiny share of accounts often drives a large share of cost.',
      ] },
      { kind: 'analogy', text: 'An all-you-can-eat buffet still has a rule against filling suitcases.' },
      { kind: 'takeaway', text: 'Generous for people, strict for scripts.' },
    ],
  },
  {
    id: 'voice-multimodal',
    title: 'Voice, images and audio',
    summary: 'Other kinds of input become tokens too, and voice adds a latency budget.',
    minutes: 4,
    scenarioId: 'voice',
    components: ['stt', 'llm', 'tts'],
    terms: ['multimodal', 'speech-to-text', 'text-to-speech', 'voice-latency'],
    blocks: [
      { kind: 'p', text: 'Multimodal models can read images, audio and documents as well as text. Under the hood, an image or an audio clip is turned into tokens the model processes like words. A single image can cost as much as a page of text, so images aren\'t free just because they\'re one file.' },
      { kind: 'p', text: 'Voice assistants usually chain three parts: speech-to-text (STT) turns audio into text, the language model answers, and text-to-speech (TTS) speaks the reply. Some newer models handle audio directly, end to end.' },
      { kind: 'list', items: [
        'Conversation has a latency budget: people expect a reply to start within about a second, or it feels broken.',
        'If each stage waits for the previous one to finish, delays stack: transcribe everything, then generate everything, then synthesise everything.',
        'Stream every stage: transcribe while the user speaks, stream tokens, and start speaking the first sentence immediately.',
        'Smaller, faster models often beat bigger ones in voice, because a quick good answer beats a slow perfect one.',
      ] },
      { kind: 'analogy', text: 'A good phone call versus a walkie-talkie. Both carry the same words; only one feels like a conversation.' },
      { kind: 'takeaway', text: 'In voice, the time to first sound matters more than anything.' },
    ],
  },
  {
    id: 'reasoning',
    title: 'Reasoning models: paying to think',
    summary: 'More thinking buys accuracy on hard problems, at a price.',
    minutes: 4,
    scenarioId: 'think-harder',
    components: ['router', 'llm'],
    terms: ['reasoning-model', 'thinking-budget', 'test-time-compute', 'chain-of-thought'],
    blocks: [
      { kind: 'p', text: 'Reasoning models (or "thinking" modes) work through a problem step by step before giving their answer. Those steps are written as hidden tokens: you don\'t see them, but you pay for them, and they\'re written before the first visible word appears.' },
      { kind: 'list', items: [
        'On hard, multi-step problems (maths, logic, planning, tricky code) thinking gives a big jump in accuracy.',
        'On easy questions it adds little: you pay and wait for thinking you didn\'t need.',
        'Most providers let you set a thinking budget. Gains flatten out: a modest budget often gets most of the benefit.',
      ] },
      { kind: 'analogy', text: 'Asking someone to show their working. On a hard maths problem it catches mistakes. On "what\'s 2 + 2?" it\'s just slower.' },
      { kind: 'p', text: 'This is a new axis next to model size. Sometimes a mid-sized model that thinks beats a big model that doesn\'t, for less money. Combine it with routing so only the hard questions get the thinking.' },
      { kind: 'takeaway', text: 'Spend thinking where questions are hard, not everywhere.' },
    ],
  },
  {
    id: 'structured',
    title: 'Structured outputs: answers your code can trust',
    summary: 'If code reads the answer, the format must be guaranteed.',
    minutes: 3,
    scenarioId: 'broke-parser',
    components: ['llm', 'validator'],
    terms: ['structured-output', 'json-schema', 'constrained-decoding', 'output-validation'],
    blocks: [
      { kind: 'p', text: 'Lots of AI features don\'t show text to a person. They hand data to code: extract fields from an invoice, classify a ticket, fill a form. That code expects an exact format, usually JSON matching a schema.' },
      { kind: 'p', text: 'Asking nicely ("respond only in JSON") works most of the time. At scale, "most of the time" means a steady stream of crashes: a missing bracket, a chatty first sentence, an invented field.' },
      { kind: 'list', items: [
        'Structured output (JSON mode, schema-constrained decoding): the model can only produce tokens that keep the output valid against your schema.',
        'Validation: check every response against the schema before use, and retry once with the error message if it fails.',
        'Use both: the first prevents almost all problems, the second catches the rest.',
      ] },
      { kind: 'analogy', text: 'A paper form with boxes versus a blank page that says "please write your details neatly".' },
      { kind: 'takeaway', text: 'Don\'t parse hope. Constrain the output, then validate it.' },
    ],
  },
  {
    id: 'freshness',
    title: 'Ingestion: what goes into the index',
    summary: 'Stale or scrambled documents make even perfect retrieval wrong.',
    minutes: 4,
    scenarioId: 'stale-index',
    components: ['vector_db', 'keyword_search'],
    terms: ['ingestion-pipeline', 're-indexing', 'document-parsing', 'data-freshness'],
    blocks: [
      { kind: 'p', text: 'Before retrieval can find anything, documents have to be ingested: loaded, converted to text, split into chunks, embedded and stored. Most RAG problems that look like "bad retrieval" are really ingestion problems.' },
      { kind: 'list', items: [
        'Freshness. If prices change on Monday and the index is rebuilt monthly, the bot quotes old prices with total confidence. Even an output judge won\'t catch it, because the retrieved source says the same thing.',
        'Parsing. Plain text extraction flattens tables and multi-column PDFs into word soup, so the answer is in the index but no search will ever match it. Layout-aware parsers keep tables and structure.',
        'Deletions matter too: removed documents must leave the index, or retired policies keep being quoted.',
      ] },
      { kind: 'analogy', text: 'A library is only as good as its catalogue. If new books never get catalogued, and some get catalogued with their pages shuffled, the best librarian in the world can\'t help you.' },
      { kind: 'p', text: 'Treat ingestion as a real pipeline: re-index on a schedule or on every change, use the right parser per document type, and track how old each document\'s index entry is.' },
      { kind: 'takeaway', text: 'Fresh, well-parsed data beats a cleverer retriever.' },
    ],
  },
  {
    id: 'caching',
    title: 'Prompt caching: stop paying to re-read',
    summary: 'Reuse the part of the prompt that never changes.',
    minutes: 3,
    scenarioId: 'big-prompt',
    components: ['llm'],
    terms: ['prompt-caching', 'kv-cache', 'cache-hit'],
    blocks: [
      { kind: 'p', text: 'Many apps send the same long prefix with every request: a big system prompt, a policy manual, few-shot examples, or the earlier part of a conversation. The model processes it from scratch each time, and you pay for it each time.' },
      { kind: 'p', text: 'Prompt caching keeps the model\'s processed version of that prefix (its KV cache) around for a few minutes. When the next request starts with exactly the same tokens, it\'s a cache hit: those tokens cost a fraction of the normal price and are read almost instantly.' },
      { kind: 'list', items: [
        'Put stable content first (system prompt, documents, examples) and changing content last (the user\'s question).',
        'Any change early in the prompt (even a timestamp) breaks the cache for everything after it.',
        'Different from a semantic cache: prompt caching still runs the model; a semantic cache skips it entirely for repeated questions.',
      ] },
      { kind: 'analogy', text: 'Keeping the reference book open on your desk, instead of fetching it from the shelf and finding your page every time.' },
      { kind: 'takeaway', text: 'Same prefix, every time? Cache it.' },
    ],
  },
  {
    id: 'batch',
    title: 'Batch and async: not everything is urgent',
    summary: 'Work nobody is waiting on shouldn\'t compete with work somebody is.',
    minutes: 3,
    scenarioId: 'nightly-job',
    components: ['batch_queue', 'llm'],
    terms: ['batch-api', 'async-job', 'rate-limit'],
    blocks: [
      { kind: 'p', text: 'Plenty of AI work has no one waiting on it: summarising last year\'s tickets, tagging a product catalogue, generating embeddings, nightly reports. Running it through the real-time API means paying full price and using up the rate limit your live users need.' },
      { kind: 'list', items: [
        'Batch APIs take a big file of requests and return results within hours, typically at about half the price.',
        'Batch traffic usually has its own limits, so it doesn\'t crowd out live users.',
        'Design for it: queue background work, process results asynchronously, and tell users "we\'ll email you when it\'s ready" where that\'s fine.',
      ] },
      { kind: 'analogy', text: 'Sending a parcel by standard post instead of same-day courier. If it doesn\'t need to arrive today, why pay for today?' },
      { kind: 'takeaway', text: 'Split real-time work from work that can wait.' },
    ],
  },
  {
    id: 'multi-agent',
    title: 'When one agent isn\'t enough',
    summary: 'Split big jobs across a team of focused agents.',
    minutes: 5,
    scenarioId: 'research-team',
    components: ['agent_team', 'llm'],
    terms: ['multi-agent', 'orchestrator', 'worker-agent', 'handoff', 'context-isolation'],
    blocks: [
      { kind: 'p', text: 'A single agent handling a big task ("compare these five vendors") does everything in one long loop. Every search result piles into the same prompt, so it gets slower with every step, and the early details get buried.' },
      { kind: 'p', text: 'A multi-agent system splits the work. The common patterns:' },
      { kind: 'list', items: [
        'Orchestrator and workers. One agent plans and hands sub-tasks to workers that run in parallel, then combines their results. Best for research and anything that splits cleanly.',
        'Hand-offs between specialists. A triage agent passes the conversation to a billing agent or a technical agent, each with its own instructions and tools.',
        'Reviewer (critic). A second agent checks the first one\'s work and sends it back if something\'s wrong.',
      ] },
      { kind: 'analogy', text: 'One person researching five companies alone versus a lead who gives each company to a different analyst, then writes the summary from their notes. The team finishes sooner and nobody has to hold everything in their head.' },
      { kind: 'p', text: 'The key benefit is context isolation: each worker sees only its own slice of the problem, so its prompt stays small and focused. That\'s where both the speed and the quality gains come from.' },
      { kind: 'takeaway', text: 'Use multiple agents when a task splits into independent parts, not by default.' },
    ],
  },
  {
    id: 'multi-agent-pitfalls',
    title: 'Making agent teams work',
    summary: 'More agents, more calls, more ways to fail.',
    minutes: 5,
    scenarioId: 'research-team',
    components: ['agent_team'],
    terms: ['handoff', 'agent-loop', 'critic-agent', 'human-in-the-loop', 'tool-permissions'],
    blocks: [
      { kind: 'p', text: 'Agent teams are powerful and easy to overdo. The costs grow faster than the agent count suggests.' },
      { kind: 'list', items: [
        'Cost multiplies. A planner, four workers making five calls each, and a combiner is over 20 model calls for one question.',
        'Hand-offs lose detail. Each agent passes a summary on, and summaries drop things. More agents means more cracks.',
        'Agents loop. Two agents can bounce a task back and forth ("can you clarify?") until something stops them. Without a cap on rounds, a loop silently burns your budget.',
        'Debugging gets harder: the mistake might be in any agent, or in the gaps between them.',
      ] },
      { kind: 'p', text: 'What works in practice: keep teams small (about one worker per real sub-task), give each agent a narrow job and only the tools it needs, add a reviewer to catch what the hand-offs dropped, cap the rounds, and log every hand-off so you can trace failures.' },
      { kind: 'p', text: 'For risky actions (sending money, deleting data, emailing customers), add a human-in-the-loop step: the agent proposes, a person approves.' },
      { kind: 'analogy', text: 'Adding people to a late project can make it later. Each new person adds meetings and hand-offs. Agents are the same.' },
      { kind: 'takeaway', text: 'Small teams, narrow jobs, a reviewer, and a hard stop.' },
    ],
  },
  {
    id: 'how-inference-works',
    title: 'What happens when you call a model',
    summary: 'Reading your prompt is fast. Writing the answer is slow.',
    minutes: 4,
    scenarioId: 'feels-slow',
    components: ['llm'],
    terms: ['inference', 'prefill', 'decode', 'kv-cache', 'max-output-tokens', 'temperature'],
    blocks: [
      { kind: 'p', text: 'Every model call runs in two phases. First the model reads your whole prompt at once (prefill). GPUs are built for this kind of parallel work, so even a long prompt is read quickly. Then it writes the answer one token at a time (decode). Each new token depends on the one before it, so this part can\'t be parallelised.' },
      { kind: 'list', items: [
        'This is why output length drives latency. A 2,000-token prompt with a 50-token answer is quick; a 50-token prompt with a 2,000-token answer is slow.',
        'It\'s also why output tokens cost several times more than input tokens.',
        'Capping the maximum output length is one of the cheapest speed and cost wins there is.',
        'While writing, the model keeps a working memory of everything it has read so far (the KV cache), so it doesn\'t re-read the prompt for every new word. Prompt caching reuses that work across requests.',
      ] },
      { kind: 'analogy', text: 'Reading a page takes a glance; writing a page takes a while. A model is the same: it skims your prompt in one go, then writes its reply word by word.' },
      { kind: 'p', text: 'Temperature controls how each next token is picked: low means the most likely word almost every time (consistent), high means more variety (creative, but less reliable).' },
      { kind: 'takeaway', text: 'Speed is mostly about how much the model writes, not how much it reads.' },
    ],
  },
  {
    id: 'serving',
    title: 'Serving models on GPUs',
    summary: 'Batching and quantization decide how much one GPU can do.',
    minutes: 5,
    scenarioId: 'self-host',
    components: ['gpu_llm'],
    terms: ['gpu', 'batching', 'continuous-batching', 'quantization', 'throughput', 'speculative-decoding'],
    blocks: [
      { kind: 'p', text: 'A GPU writing tokens for a single request is mostly waiting: the bottleneck is moving the model\'s weights through memory, not the maths. Batching fixes that. The GPU works on many requests at once, reusing each pass through the weights for all of them.' },
      { kind: 'list', items: [
        'Bigger batches mean much more total throughput (tokens per second across all requests).',
        'But each individual request gets a smaller slice, so it\'s written more slowly. Throughput and per-request latency pull against each other.',
        'Modern servers use continuous batching: new requests join the batch the moment a slot frees up, instead of waiting for the whole batch to finish.',
      ] },
      { kind: 'p', text: 'Quantization stores the model\'s numbers with fewer bits (16 → 8 → 4). The model gets smaller and faster, more fits per GPU, and quality drops slightly: barely at 8-bit, noticeably at 4-bit.' },
      { kind: 'analogy', text: 'A bus versus a taxi. One taxi per passenger is fast for each rider but wasteful. A full bus moves far more people per hour, but each stop takes longer. Quantization is fitting more seats into the same bus by making them narrower.' },
      { kind: 'p', text: 'There are more tricks, like speculative decoding, where a small model drafts several tokens and the big model checks them in one pass. They all chase the same goal: more useful tokens per GPU-second.' },
      { kind: 'takeaway', text: 'An idle GPU slot is wasted money; an overfull one is wasted time.' },
    ],
  },
  {
    id: 'self-host-vs-api',
    title: 'API or your own GPUs?',
    summary: 'Pay per token, or pay per hour whether you use it or not.',
    minutes: 4,
    scenarioId: 'self-host',
    components: ['llm', 'gpu_llm'],
    terms: ['self-hosting', 'open-weights', 'gpu-utilization', 'rate-limit'],
    blocks: [
      { kind: 'p', text: 'An API charges per token. You pay nothing when nobody is using it, and someone else handles the hardware, scaling and upgrades. Self-hosting an open-weights model charges per GPU-hour: you pay the same at 3am as at peak.' },
      { kind: 'list', items: [
        'At high, steady traffic, self-hosting can be many times cheaper per request, because busy GPUs spread their hourly cost over lots of requests.',
        'At low or spiky traffic it\'s often more expensive: you pay for idle GPUs, or under-provision and fall over at peak.',
        'Self-hosting also means you own capacity planning, on-call, model upgrades and GPU shortages. That\'s real engineering cost.',
        'Reasons to self-host beyond price: data never leaves your infrastructure, no provider rate limits, and full control over the model.',
      ] },
      { kind: 'analogy', text: 'Taxis versus owning a car. If you drive all day every day, owning is cheaper. If you drive twice a month, the car mostly sits in the garage costing you money.' },
      { kind: 'p', text: 'Many teams mix both: self-host a strong open model for the steady bulk of traffic, and use an API for spikes, the hardest requests, or as a fallback.' },
      { kind: 'takeaway', text: 'Self-hosting pays off when your GPUs stay busy.' },
    ],
  },
  {
    id: 'reliability',
    title: 'When the provider goes down',
    summary: 'Retries handle blips. Outages need somewhere else to go.',
    minutes: 4,
    scenarioId: 'provider-down',
    components: ['fallback', 'llm', 'gpu_llm'],
    terms: ['failover', 'retry', 'exponential-backoff', 'retry-storm', 'circuit-breaker', 'timeout'],
    blocks: [
      { kind: 'p', text: 'Model providers have outages and slowdowns like any other service. If your product calls one provider for every request, their bad day is your bad day.' },
      { kind: 'list', items: [
        'Timeouts: never wait forever. Give up on a call after a sensible limit so one slow request doesn\'t hold everything up.',
        'Retries with exponential backoff: try again after a short wait, doubling the wait each time. Great for brief blips.',
        'Retry storms: during a real outage, everyone retrying multiplies the load on a provider that is already struggling, and makes it worse.',
        'Failover: send the request to a different provider or your own model when the first keeps failing.',
        'Circuit breaker: after enough failures, stop calling the broken provider for a while and go straight to the fallback.',
      ] },
      { kind: 'analogy', text: 'If the shop is closed, knocking louder doesn\'t help, and neither does the whole street knocking. You go to the other shop.' },
      { kind: 'p', text: 'The backup doesn\'t need to be as good as the primary. A slightly weaker model that answers is better than a perfect one that returns errors. That\'s graceful degradation.' },
      { kind: 'takeaway', text: 'Have a plan B before you need it, and cap your retries.' },
    ],
  },
  {
    id: 'evals',
    title: 'Evals: you can\'t fix what you can\'t see',
    summary: 'Measure answer quality before and after every change.',
    minutes: 4,
    scenarioId: 'flying-blind',
    components: ['llm', 'eval_harness'],
    terms: ['eval', 'golden-dataset', 'llm-as-judge', 'regression', 'observability'],
    blocks: [
      { kind: 'p', text: 'Your dashboard shows speed, cost and errors for free. It does not show whether answers are right. A change that halves your bill can quietly double your wrong answers, and nothing turns red.' },
      { kind: 'p', text: 'Evals fix that. There are two kinds, and you want both.' },
      { kind: 'list', items: [
        'Offline evals: a fixed test set of real questions with known good answers (a golden dataset). Run it before shipping any change, like unit tests for quality.',
        'Online evals: a judge model scores a small sample of live answers against their sources, so you notice when real traffic drifts away from your test set.',
        'Track the same few numbers every time: accuracy, hallucination rate, retrieval recall. Compare against the last version.',
      ] },
      { kind: 'analogy', text: 'A restaurant that only tracks how fast plates leave the kitchen. Service has never been quicker. Nobody has tasted the food.' },
      { kind: 'p', text: 'Evals also make debugging honest. Instead of tweaking prompts until something "feels better", you change one thing, rerun, and see the number move, or not.' },
      { kind: 'takeaway', text: 'Make quality measurable first. Then optimise.' },
    ],
  },
  {
    id: 'prompts',
    title: 'Prompts: the only thing a model sees',
    summary: 'If it isn\'t in the prompt, the model doesn\'t know it.',
    minutes: 3,
    components: ['users', 'llm'],
    terms: ['prompt', 'system-prompt', 'stateless', 'token'],
    blocks: [
      { kind: 'p', text: 'A model can\'t see your database, your website or yesterday\'s chat. For each request it sees exactly one thing: the text you send, called the prompt. Its answer comes from that prompt plus what it learned in training.' },
      { kind: 'list', items: [
        'System prompt: the role and rules ("You are a support assistant. Only answer from the sources.").',
        'Context: documents you looked up, results from tools.',
        'History: earlier messages in the conversation.',
        'The user\'s message itself.',
      ] },
      { kind: 'analogy', text: 'Phoning an expert who forgets everything the moment you hang up. On every call you have to read out who you are, what you discussed before, and the documents they need.' },
      { kind: 'p', text: 'This one idea explains most of AI engineering. RAG works because you paste the right documents in. Chatbots "forget" when old messages aren\'t resent. Costs grow because everything you paste in is paid for.' },
      { kind: 'takeaway', text: 'Building an AI app is mostly deciding what goes into the prompt.' },
    ],
  },
  {
    id: 'stateless',
    title: 'Why chatbots forget, and why remembering gets expensive',
    summary: 'Models remember nothing between messages. Apps fake it by resending the chat.',
    minutes: 4,
    scenarioId: 'endless-chat',
    components: ['users', 'memory', 'llm'],
    terms: ['stateless', 'chat-history', 'context-window', 'lost-in-the-middle'],
    blocks: [
      { kind: 'p', text: 'Chatting with an AI app feels like talking to something that remembers you. It doesn\'t. Models are stateless: every message is a brand-new request. The app creates the feeling of memory by resending the conversation so far along with each new message.' },
      { kind: 'p', text: 'The simplest version, resending everything, works perfectly on day one. Then conversations get long.' },
      { kind: 'list', items: [
        'Cost grows every turn. Message 40 pays again for the 39 before it, so a conversation\'s total cost grows much faster than its length.',
        'Your rate limit fills up with old messages instead of new users.',
        'Answers get worse. The one detail that matters is buried among hundreds of lines (lost in the middle).',
        'Eventually the conversation no longer fits in the context window, and requests fail.',
      ] },
      { kind: 'analogy', text: 'Reading someone the full transcript of every conversation you\'ve ever had before saying anything new. Very thorough. By month two it takes all day.' },
      { kind: 'takeaway', text: 'Memory isn\'t free: every remembered word is paid for again on every turn.' },
    ],
  },
  {
    id: 'memory-strategies',
    title: 'Memory that scales',
    summary: 'Remember facts, not transcripts.',
    minutes: 5,
    scenarioId: 'endless-chat',
    components: ['memory', 'embedding', 'llm'],
    terms: ['conversation-memory', 'sliding-window', 'conversation-summary', 'long-term-memory', 'prompt-caching'],
    blocks: [
      { kind: 'p', text: 'The goal isn\'t to remember everything. It\'s to have the right facts in the prompt for this particular message. There are four common strategies, from simplest to smartest.' },
      { kind: 'list', items: [
        'Full history. Resend every turn. Most accurate for short chats, but cost, latency and failures grow with every message.',
        'Sliding window. Keep only the last N turns. Cheap and predictable, but anything older simply vanishes, so "what was my budget again?" fails.',
        'Rolling summary. Replace older turns with a short running summary and keep the last few word for word. Keeps the gist, but summaries tend to drop specifics like numbers and names.',
        'Long-term memory. Store every turn (or the facts pulled out of it) as embeddings, and for each new message retrieve only the few that are relevant. It\'s RAG, applied to the conversation itself.',
      ] },
      { kind: 'analogy', text: 'A good doctor doesn\'t reread your whole file at every appointment. They glance at the summary, and pull up the one old test result that matters today.' },
      { kind: 'p', text: 'Production systems usually combine them: a short window so the conversation flows, a summary for the big picture, and retrieval for specific facts. Prompt caching helps too: providers can reuse the unchanging start of a prompt (system prompt, long documents) at a discount.' },
      { kind: 'takeaway', text: 'Keep prompts small and the important facts in view.' },
    ],
  },
  {
    id: 'pipeline',
    title: 'What an AI app really is',
    summary: 'The model is one box. The product is the pipeline around it.',
    minutes: 3,
    components: ['users', 'embedding', 'vector_db', 'llm'],
    terms: ['llm', 'prompt', 'token', 'inference'],
    blocks: [
      { kind: 'p', text: 'When people say "we built an AI app", they usually mean a pipeline: a request comes in, gets checked, maybe finds some documents, gets sent to a model, and the answer may be checked again before the user sees it.' },
      { kind: 'p', text: 'The large language model (LLM) is the part that writes. Everything else decides what the model sees, which model runs, and whether the answer is safe to ship.' },
      { kind: 'analogy', text: 'The model is a brilliant new hire on day one. Smart, fluent, but knows nothing about your company. The pipeline is the onboarding: the docs you hand them, the manager who checks their work, the rule about which tasks go to the senior person.' },
      { kind: 'list', items: ['Most quality problems are fixed by changing what the model sees, not the model itself.', 'Most cost and speed problems are fixed by changing which model runs, and how often.', 'Most safety problems are fixed with checks before and after the model.'] },
      { kind: 'takeaway', text: 'Design the pipeline, not just the prompt.' },
    ],
  },
  {
    id: 'hallucination',
    title: 'Why models make things up',
    summary: 'A model always produces an answer, whether it knows or not.',
    minutes: 3,
    scenarioId: 'docs-bot',
    terms: ['hallucination', 'grounding', 'training-data', 'knowledge-cutoff'],
    blocks: [
      { kind: 'p', text: 'An LLM writes by predicting the next most likely words. It was trained on a huge amount of public text, so it is very good at sounding right. But "sounding right" and "being right" are different things.' },
      { kind: 'p', text: 'If you ask about something it never saw (your product, your policies, last week\'s changes), it doesn\'t stop. It produces the most plausible-sounding answer. That confident, wrong answer is a hallucination.' },
      { kind: 'analogy', text: 'Ask a confident friend for directions in a city they\'ve never visited. They won\'t say "I don\'t know". They\'ll describe a route that sounds perfectly reasonable.' },
      { kind: 'p', text: 'A bigger model hallucinates a bit less on general knowledge, but it still can\'t know your private data. The reliable fix is to give it the facts at question time.' },
      { kind: 'takeaway', text: 'Hallucination is usually a missing-information problem, not a model-size problem.' },
    ],
  },
  {
    id: 'rag',
    title: 'RAG: letting the model look things up',
    summary: 'Find the right documents first, then ask the model to answer from them.',
    minutes: 4,
    scenarioId: 'docs-bot',
    components: ['embedding', 'vector_db', 'llm'],
    terms: ['rag', 'embedding', 'vector-db', 'chunk', 'grounding'],
    blocks: [
      { kind: 'p', text: 'Retrieval-augmented generation (RAG) adds a search step before the model. Your documents are split into small pieces (chunks) and indexed. When a question arrives, you find the most relevant chunks and paste them into the prompt with an instruction like "answer using only these sources".' },
      { kind: 'list', items: ['Embedding model: turns text into a list of numbers that captures its meaning.', 'Vector database: finds the chunks whose numbers are closest to the question\'s numbers.', 'LLM: reads those chunks and writes the answer.'] },
      { kind: 'analogy', text: 'An open-book exam. The student (the model) is still the one writing, but now they\'re allowed to look up the relevant pages before answering.' },
      { kind: 'p', text: 'RAG only works if the search finds the right page. If retrieval brings back the wrong chunks, the model will happily answer from the wrong page. That\'s the next wall.' },
      { kind: 'takeaway', text: 'RAG turns "does the model know?" into "did we find it?", which is a problem you can measure and fix.' },
    ],
  },
  {
    id: 'retrieval',
    title: 'Getting retrieval right',
    summary: 'Chunk size, top-K, hybrid search and reranking.',
    minutes: 5,
    scenarioId: 'wrong-chunks',
    components: ['vector_db', 'keyword_search', 'reranker'],
    terms: ['recall', 'top-k', 'chunk', 'hybrid-search', 'bm25', 'reranker'],
    blocks: [
      { kind: 'p', text: 'Retrieval has one job: put the chunk that contains the answer in front of the model. The share of questions where that happens is called recall. Four levers control it.' },
      { kind: 'list', items: [
        'Chunk size. Small chunks are precise but can split an answer in half. Huge chunks keep context but blur the meaning and eat your token budget.',
        'Top-K. How many chunks you fetch. More chunks means a better chance of catching the right one, but more noise and more cost.',
        'Hybrid search. Embeddings understand meaning but blur exact strings like "E1043" vs "E1034". Keyword search (BM25) nails exact terms. Using both covers both kinds of question.',
        'Reranking. Fetch wide (say 12 chunks), then a reranker scores each one against the question and keeps only the best 3–4.',
      ] },
      { kind: 'analogy', text: 'A librarian (vector search) is great at "books about grief", terrible at "the one with ISBN 978-0-14". The catalogue (keyword search) is the opposite. A good library uses both, and an expert (the reranker) picks the best few off the cart.' },
      { kind: 'takeaway', text: 'When RAG gives wrong answers, look at retrieval before you touch the model.' },
    ],
  },
  {
    id: 'tokens',
    title: 'Tokens, context windows and cost',
    summary: 'Everything you send the model is metered.',
    minutes: 4,
    scenarioId: 'long-docs',
    components: ['llm', 'reranker'],
    terms: ['token', 'context-window', 'lost-in-the-middle', 'input-output-tokens'],
    blocks: [
      { kind: 'p', text: 'Models read and write in tokens, roughly ¾ of a word each. You pay for every token you send in (the prompt, the retrieved chunks, the conversation so far) and every token the model writes back. Output tokens usually cost several times more than input tokens.' },
      { kind: 'p', text: 'Each model also has a context window: the most tokens it can take in at once. Go over it and the request fails or gets cut off.' },
      { kind: 'analogy', text: 'The context window is a desk. You can only spread so many pages on it. And even when everything fits, a desk buried in paper makes it harder to find the one page that matters ("lost in the middle").' },
      { kind: 'list', items: ['Fewer, better chunks beat more chunks: cheaper, faster and often more accurate.', 'A bigger context window is a fallback, not a strategy. It costs more per request.', 'Agents and long chats grow the prompt every turn. Watch it.'] },
      { kind: 'takeaway', text: 'Treat the context window as a budget, not a bucket.' },
    ],
  },
  {
    id: 'scale',
    title: 'Scaling: rate limits, caching and routing',
    summary: 'At scale, tokens through your biggest model are the bottleneck.',
    minutes: 4,
    scenarioId: 'launch-day',
    components: ['semantic_cache', 'router', 'llm'],
    terms: ['rate-limit', 'tpm', 'semantic-cache', 'model-routing', 'cost-per-request'],
    blocks: [
      { kind: 'p', text: 'Model providers cap how many tokens per minute (TPM) you can send to each model. Go over it and you get HTTP 429 errors, no matter how much you\'re willing to pay. The biggest models have the tightest limits and the highest prices.' },
      { kind: 'list', items: [
        'Semantic cache. Many questions are near-repeats. If a new question means the same as one already answered, return the stored answer and skip the model entirely.',
        'Model routing. Most requests are easy. Send them to a small model that is ~100× cheaper and much faster, and keep the large model for the hard ones.',
        'Trim the prompt. Every token you don\'t send is a token you don\'t pay for and doesn\'t count against your limit.',
      ] },
      { kind: 'analogy', text: 'A hospital doesn\'t send every patient to the top surgeon. Triage sends the sprained ankles to a nurse, and the receptionist answers "where\'s the car park?" without paging anyone.' },
      { kind: 'takeaway', text: 'Don\'t make your strongest model do your easiest work.' },
    ],
  },
  {
    id: 'agents',
    title: 'Agents and tools',
    summary: 'Letting the model act, not just talk, and keeping it on a leash.',
    minutes: 4,
    scenarioId: 'support-agent',
    components: ['agent', 'llm'],
    terms: ['agent', 'tool-calling', 'agent-loop', 'step-budget'],
    blocks: [
      { kind: 'p', text: 'A plain model can only produce text. If a user asks "where is my order?", the honest answer needs a lookup. Without a tool, the model will invent a plausible status.' },
      { kind: 'p', text: 'An agent runs the model in a loop: think, call a tool (look up the order, issue a refund), read the result, decide what to do next, and repeat until done. Each turn of the loop is another model call, with a longer prompt each time.' },
      { kind: 'analogy', text: 'An intern with a phone and a company card. Far more useful than one who can only write memos, but you set a spending limit, because sometimes they\'ll keep calling the same wrong number all afternoon.' },
      { kind: 'list', items: ['Agents multiply cost and latency: a 5-step task is roughly 5 model calls.', 'Some runs get stuck repeating themselves. A step cap stops them failing slowly and expensively.', 'Set the cap just above what real tasks need.'] },
      { kind: 'takeaway', text: 'A step budget is a cost control, not just a safety net.' },
    ],
  },
  {
    id: 'safety',
    title: 'Prompt injection and guardrails',
    summary: 'Users can try to rewrite your instructions. Layer your defenses.',
    minutes: 4,
    scenarioId: 'jailbreak',
    components: ['input_guard', 'output_guard'],
    terms: ['prompt-injection', 'jailbreak', 'guardrail', 'llm-as-judge', 'false-positive', 'system-prompt'],
    blocks: [
      { kind: 'p', text: 'To a model, your instructions and the user\'s message are both just text in the same prompt. A prompt injection is a message written to override your instructions: "ignore previous instructions and…". Models resist this better than they used to, but not reliably.' },
      { kind: 'list', items: [
        'Input guardrail: a fast classifier that screens messages before they reach the model.',
        'Output judge: a second model that checks the answer before it ships. It catches attacks that slipped through, and many hallucinations too.',
        'Every check has false positives: real users who get blocked. Stricter isn\'t automatically better.',
      ] },
      { kind: 'analogy', text: 'Airport security has a scanner at the door and a check at the gate. Neither is perfect, so you use both, and you tune them so the queue still moves.' },
      { kind: 'takeaway', text: 'Safety is layered, and every layer costs something.' },
    ],
  },
  {
    id: 'latency',
    title: 'Latency and streaming',
    summary: 'Users judge speed by when the first words appear.',
    minutes: 3,
    scenarioId: 'feels-slow',
    components: ['llm', 'output_guard'],
    terms: ['latency', 'ttft', 'streaming', 'p50-p99'],
    blocks: [
      { kind: 'p', text: 'A model writes one token at a time. A full answer from a large model can take several seconds. If you wait for the whole thing before showing anything, users stare at a spinner.' },
      { kind: 'p', text: 'Streaming sends tokens to the user as they\'re written. Total time barely changes, but time to first token (TTFT) drops from seconds to well under one, and it feels fast.' },
      { kind: 'analogy', text: 'A waiter who brings bread while the kitchen cooks. The meal takes as long as before. The wait feels much shorter.' },
      { kind: 'p', text: 'The catch: anything that must read the complete answer first, like an output judge, silently cancels streaming. You then need to protect quality earlier in the pipeline.' },
      { kind: 'takeaway', text: 'Measure time to first token, not just total time.' },
    ],
  },
  {
    id: 'binding-pressure',
    title: 'Binding pressure: how to debug any AI system',
    summary: 'Find the one limit that hurts most. Fix only that. Repeat.',
    minutes: 2,
    terms: ['binding-pressure', 'eval', 'observability'],
    blocks: [
      { kind: 'p', text: 'Real systems have many weaknesses at once, but at any moment one of them hurts more than all the others. Fixing anything else barely moves the numbers.' },
      { kind: 'list', items: ['Look at the metrics against your goals.', 'Look at the individual requests that failed and ask why.', 'Name the single limit behind most of those failures.', 'Fix that one thing, then measure again. The binding pressure will move.'] },
      { kind: 'analogy', text: 'A chain is only as strong as its weakest link. Polishing the strong links does nothing.' },
      { kind: 'takeaway', text: 'This loop (measure, name the pressure, fix, re-measure) is the actual skill. The simulator exists to train it.' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Modules: the learning journey, simple → complex                     */
/* ------------------------------------------------------------------ */

export interface Module {
  id: string;
  title: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  blurb: string;
  lessons: string[];
}

export const MODULES: Module[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    level: 'Beginner',
    blurb: 'What a model is, what it sees, and why it makes things up.',
    lessons: ['pipeline', 'how-models-are-made', 'prompts', 'tokens', 'temperature', 'hallucination'],
  },
  {
    id: 'knowledge',
    title: 'Giving models knowledge',
    level: 'Beginner',
    blurb: 'Let the model look things up, and make sure it finds the right page.',
    lessons: ['rag', 'retrieval', 'freshness'],
  },
  {
    id: 'memory',
    title: 'Memory and conversations',
    level: 'Intermediate',
    blurb: 'Why chatbots forget, and how to remember without going broke.',
    lessons: ['stateless', 'memory-strategies'],
  },
  {
    id: 'reliable',
    title: 'Getting reliable answers',
    level: 'Intermediate',
    blurb: 'Make models think harder when it matters, return output your code can trust, and know when to fine-tune.',
    lessons: ['reasoning', 'structured', 'fine-tuning-vs-rag'],
  },
  {
    id: 'production',
    title: 'Running in production',
    level: 'Intermediate',
    blurb: 'Rate limits, cost and speed once real users arrive.',
    lessons: ['scale', 'latency', 'abuse-controls'],
  },
  {
    id: 'beyond-text',
    title: 'Beyond text: voice and images',
    level: 'Intermediate',
    blurb: 'Multimodal input, and building voice assistants that feel like a conversation.',
    lessons: ['voice-multimodal'],
  },
  {
    id: 'inference',
    title: 'Inference: how models actually run',
    level: 'Intermediate',
    blurb: 'Prefill and decode, prompt caching, GPUs and batching, self-hosting, batch APIs, and staying up when providers fail.',
    lessons: ['how-inference-works', 'caching', 'serving', 'self-host-vs-api', 'batch', 'reliability'],
  },
  {
    id: 'agents',
    title: 'Agents and multi-agent systems',
    level: 'Advanced',
    blurb: 'Letting models take actions, splitting work across agent teams, and keeping them on a leash.',
    lessons: ['agents', 'multi-agent', 'multi-agent-pitfalls'],
  },
  {
    id: 'safety',
    title: 'Safety',
    level: 'Advanced',
    blurb: 'Attacks on your prompt, the layers that stop them, and keeping personal data safe.',
    lessons: ['safety', 'privacy'],
  },
  {
    id: 'engineering',
    title: 'Thinking like an AI engineer',
    level: 'Advanced',
    blurb: 'Measuring quality, and the debugging loop that ties it all together.',
    lessons: ['evals', 'trustworthy-evals', 'model-updates', 'binding-pressure'],
  },
];

/* ------------------------------------------------------------------ */
/* Glossary: complex terms in simple words                             */
/* ------------------------------------------------------------------ */

export type TermCategory = 'Models' | 'Retrieval' | 'Memory' | 'Inference' | 'Production' | 'Agents' | 'Safety' | 'Quality' | 'Voice';

export interface Term {
  id: string;
  term: string;
  aka?: string;
  category: TermCategory;
  simple: string;
  analogy?: string;
  why?: string;
  related?: string[];
  lesson?: string;
}

export const TERMS: Term[] = [
  // Models
  { id: 'llm', term: 'LLM', aka: 'Large language model', category: 'Models', simple: 'A program trained on huge amounts of text that writes by predicting the next most likely word, over and over.', analogy: 'Autocomplete on your phone, scaled up until it can write essays and code.', why: 'It\'s the part of the system that writes the answer. Everything else decides what it sees.', related: ['token', 'prompt', 'inference'], lesson: 'pipeline' },
  { id: 'token', term: 'Token', category: 'Models', simple: 'The unit models read and write in. Roughly ¾ of an English word; "unbelievable" might be 3 tokens.', analogy: 'Like syllables for a machine.', why: 'Pricing, speed and limits are all measured in tokens.', related: ['context-window', 'input-output-tokens', 'tpm'], lesson: 'tokens' },
  { id: 'prompt', term: 'Prompt', category: 'Models', simple: 'Everything you send the model in one request: instructions, retrieved documents, conversation history and the user\'s message.', analogy: 'The briefing pack you hand someone before they start a task.', related: ['system-prompt', 'context-window'], lesson: 'pipeline' },
  { id: 'system-prompt', term: 'System prompt', category: 'Models', simple: 'The hidden instructions at the top of the prompt that set the model\'s role and rules ("You are a support assistant. Only answer from the sources.").', analogy: 'The job description pinned above the desk.', why: 'Attackers try to override or reveal it.', related: ['prompt', 'prompt-injection'] },
  { id: 'inference', term: 'Inference', category: 'Inference', simple: 'Running a trained model to get an answer. Every request you make is an inference call.', analogy: 'Training is going to school; inference is doing the job.', related: ['llm', 'latency', 'prefill', 'decode'], lesson: 'how-inference-works' },
  { id: 'context-window', term: 'Context window', category: 'Models', simple: 'The maximum number of tokens a model can read in one request, including the prompt and its answer.', analogy: 'The size of the desk: only so many pages fit on it at once.', why: 'Go over it and the request fails or gets cut off.', related: ['token', 'lost-in-the-middle'], lesson: 'tokens' },
  { id: 'input-output-tokens', term: 'Input vs output tokens', category: 'Models', simple: 'Input tokens are what you send; output tokens are what the model writes. Output is usually several times more expensive.', why: 'Long answers cost more than long prompts, token for token.', related: ['token', 'cost-per-request'], lesson: 'tokens' },
  { id: 'training-data', term: 'Training data', category: 'Models', simple: 'The text a model learned from before it was released. It doesn\'t include your private documents.', related: ['knowledge-cutoff', 'pretraining', 'hallucination'], lesson: 'how-models-are-made' },
  { id: 'knowledge-cutoff', term: 'Knowledge cutoff', category: 'Models', simple: 'The date the model\'s training data stops. It knows nothing that happened after, unless you give it the information.', analogy: 'Someone who\'s been on a remote island since that date.', related: ['training-data', 'rag'] },
  { id: 'temperature', term: 'Temperature', category: 'Models', simple: 'A setting that controls how random the model\'s word choices are. Low (0–0.2) is focused and repeatable; high (0.7–1) is varied and creative.', analogy: 'Low temperature is a careful accountant; high is a jazz improviser.', why: 'Too high on extraction gives different answers to the same question; too low on writing makes everything sound the same.', related: ['top-p', 'sampling', 'determinism'], lesson: 'temperature' },
  { id: 'fine-tuning', term: 'Fine-tuning', category: 'Models', simple: 'Training an existing model further on your own examples so it picks up a style or task. It\'s good for teaching behaviour, not for adding facts that change often.', analogy: 'Sending an employee on a course, versus handing them the manual (RAG).', why: 'A fine-tuned small model can beat a large general one on a narrow task, cheaply.', related: ['rag', 'few-shot', 'training-data'], lesson: 'fine-tuning-vs-rag' },

  // Retrieval
  { id: 'rag', term: 'RAG', aka: 'Retrieval-augmented generation', category: 'Retrieval', simple: 'Search your documents for relevant pieces first, paste them into the prompt, then ask the model to answer from them.', analogy: 'An open-book exam instead of a closed-book one.', why: 'The standard way to make a model answer correctly about your own data.', related: ['embedding', 'vector-db', 'grounding'], lesson: 'rag' },
  { id: 'embedding', term: 'Embedding', category: 'Retrieval', simple: 'A list of numbers that represents the meaning of a piece of text. Texts that mean similar things get similar numbers.', analogy: 'Coordinates on a map of meaning: "car" and "vehicle" are neighbours; "car" and "banana" are far apart.', related: ['vector-db', 'semantic-search'], lesson: 'rag' },
  { id: 'vector-db', term: 'Vector database', category: 'Retrieval', simple: 'A database built to find the stored embeddings closest to a new one, quickly, across millions of items.', analogy: 'A librarian who finds books by what they\'re about, not their exact title.', related: ['embedding', 'top-k'], lesson: 'rag' },
  { id: 'semantic-search', term: 'Semantic search', category: 'Retrieval', simple: 'Searching by meaning instead of exact words, so "reset my password" finds a page titled "Recovering account access".', related: ['embedding', 'bm25', 'hybrid-search'] },
  { id: 'chunk', term: 'Chunk', category: 'Retrieval', simple: 'A small piece of a larger document, created so search can return just the relevant part instead of a whole 90-page PDF.', analogy: 'Cutting a book into index cards.', why: 'Too small splits answers apart; too big blurs meaning and wastes tokens.', related: ['top-k', 'rag'], lesson: 'retrieval' },
  { id: 'top-k', term: 'Top-K', category: 'Retrieval', simple: 'How many of the best-matching chunks you retrieve for each question (K = 3, 5, 10…).', why: 'Higher K catches more answers but adds cost and noise.', related: ['chunk', 'recall', 'reranker'], lesson: 'retrieval' },
  { id: 'bm25', term: 'BM25', aka: 'Keyword search', category: 'Retrieval', simple: 'A classic ranking method that scores documents by how well their exact words match the query.', analogy: 'Ctrl+F with good judgement.', why: 'Great for codes, names and IDs that embeddings blur.', related: ['hybrid-search', 'semantic-search'], lesson: 'retrieval' },
  { id: 'hybrid-search', term: 'Hybrid search', category: 'Retrieval', simple: 'Running keyword search and semantic search together and combining the results.', why: 'Covers both "what does E1043 mean" and "my device keeps restarting".', related: ['bm25', 'semantic-search'], lesson: 'retrieval' },
  { id: 'reranker', term: 'Reranker', category: 'Retrieval', simple: 'A model that reads each retrieved chunk alongside the question and re-scores how relevant it really is, so you can keep only the best few.', analogy: 'A first search pulls 12 books off the shelf; an expert skims them and hands you the best 4.', related: ['top-k', 'recall'], lesson: 'retrieval' },
  { id: 'recall', term: 'Recall (retrieval)', category: 'Retrieval', simple: 'The share of questions where retrieval actually found the chunk containing the answer.', why: 'If recall is 70%, up to 30% of answers are built on the wrong pages.', related: ['top-k', 'reranker'], lesson: 'retrieval' },
  { id: 'grounding', term: 'Grounding', category: 'Retrieval', simple: 'Making the model base its answer on specific sources you provided, rather than on memory.', related: ['rag', 'hallucination'], lesson: 'rag' },

  // Memory
  { id: 'stateless', term: 'Stateless', category: 'Memory', simple: 'A model keeps nothing between requests. Every call starts from a blank slate; anything it should "remember" has to be in the prompt again.', analogy: 'An expert who forgets every phone call the moment it ends.', why: 'It\'s why chat apps resend history, and why long chats get expensive.', related: ['chat-history', 'conversation-memory', 'prompt'], lesson: 'stateless' },
  { id: 'chat-history', term: 'Chat history', category: 'Memory', simple: 'The earlier messages of a conversation, resent with each new message so the model knows what was said.', why: 'It grows every turn, and you pay for all of it every turn.', related: ['stateless', 'sliding-window'], lesson: 'stateless' },
  { id: 'conversation-memory', term: 'Conversation memory', category: 'Memory', simple: 'The strategy that decides which parts of a conversation go back into the prompt: everything, the latest turns, a summary, or retrieved facts.', analogy: 'Deciding which notes to bring to a meeting.', related: ['sliding-window', 'conversation-summary', 'long-term-memory'], lesson: 'memory-strategies' },
  { id: 'sliding-window', term: 'Sliding window', category: 'Memory', simple: 'Keeping only the last N turns of a conversation in the prompt and dropping everything older.', analogy: 'A whiteboard you keep erasing from the top to make room.', why: 'Cheap and predictable, but forgets anything older than the window.', related: ['conversation-summary', 'chat-history'], lesson: 'memory-strategies' },
  { id: 'conversation-summary', term: 'Rolling summary', category: 'Memory', simple: 'Regularly compressing older turns into a short summary that travels with the conversation, while the latest turns stay word for word.', analogy: 'Meeting minutes instead of the full recording.', why: 'Keeps the gist in few tokens, but specific details like numbers and names can get lost.', related: ['sliding-window', 'long-term-memory'], lesson: 'memory-strategies' },
  { id: 'long-term-memory', term: 'Long-term memory', aka: 'Memory retrieval', category: 'Memory', simple: 'Storing past turns, or facts pulled out of them, in a searchable store, and fetching only the ones relevant to the current message.', analogy: 'An assistant\'s notebook: they don\'t read it all out, they flip to the page they need.', why: 'Keeps prompts small while still remembering details from long ago.', related: ['rag', 'embedding', 'conversation-memory'], lesson: 'memory-strategies' },
  { id: 'prompt-caching', term: 'Prompt caching', category: 'Inference', simple: 'Providers can store the unchanging beginning of a prompt (system prompt, long documents) and reuse it across requests for less money and time.', analogy: 'Keeping the reference book open on your desk instead of fetching it from the shelf every time.', why: 'Cuts cost for apps that resend the same big prefix. Different from a semantic cache, which skips the model entirely.', related: ['token', 'semantic-cache', 'kv-cache', 'cache-hit'], lesson: 'caching' },

  { id: 'reasoning-model', term: 'Reasoning model', aka: 'Thinking mode', category: 'Models', simple: 'A model (or mode) that writes out hidden step-by-step reasoning before giving its final answer.', analogy: 'Showing your working on a maths exam.', why: 'Much better on hard problems; slower and pricier because the thinking tokens are paid for.', related: ['thinking-budget', 'test-time-compute', 'chain-of-thought'], lesson: 'reasoning' },
  { id: 'thinking-budget', term: 'Thinking budget', category: 'Models', simple: 'A cap on how many tokens a reasoning model may spend thinking before it answers.', why: 'The main dial between accuracy and cost/latency for reasoning models; gains flatten out at higher budgets.', related: ['reasoning-model', 'test-time-compute'], lesson: 'reasoning' },
  { id: 'test-time-compute', term: 'Test-time compute', category: 'Models', simple: 'Spending more computation while answering (thinking longer, trying several answers) instead of training a bigger model.', why: 'A newer way to buy accuracy: pay per question for extra effort, only when you need it.', related: ['reasoning-model', 'thinking-budget'], lesson: 'reasoning' },
  { id: 'chain-of-thought', term: 'Chain of thought', category: 'Models', simple: 'Having a model reason step by step before answering, either by prompting it to or because it\'s trained to.', analogy: 'Talking yourself through a problem out loud.', related: ['reasoning-model'], lesson: 'reasoning' },
  { id: 'structured-output', term: 'Structured output', aka: 'JSON mode', category: 'Quality', simple: 'Making the model return data in an exact format, usually JSON matching a schema, so code can use it directly.', why: 'Without it, a small share of answers break format, which at scale means constant parser crashes.', related: ['json-schema', 'constrained-decoding', 'output-validation'], lesson: 'structured' },
  { id: 'json-schema', term: 'JSON schema', category: 'Quality', simple: 'A precise description of the shape your data must have: which fields, which types, which are required.', analogy: 'The blank form with labelled boxes.', related: ['structured-output', 'output-validation'], lesson: 'structured' },
  { id: 'constrained-decoding', term: 'Constrained decoding', category: 'Quality', simple: 'While the model writes, only allowing tokens that keep the output valid against a schema or grammar.', why: 'Guarantees the format by construction, instead of hoping and checking afterwards.', related: ['structured-output'], lesson: 'structured' },
  { id: 'output-validation', term: 'Output validation', category: 'Quality', simple: 'Checking a model\'s answer against the expected format (and sometimes business rules) before your code uses it, and retrying or failing gracefully if it\'s wrong.', related: ['structured-output', 'json-schema'], lesson: 'structured' },
  { id: 'ingestion-pipeline', term: 'Ingestion pipeline', category: 'Retrieval', simple: 'The process that gets documents into your index: load, convert to text, split into chunks, embed, store, and keep it updated.', why: 'Many "retrieval" problems are really ingestion problems.', related: ['re-indexing', 'document-parsing', 'chunk'], lesson: 'freshness' },
  { id: 're-indexing', term: 'Re-indexing', category: 'Retrieval', simple: 'Updating the index when documents change, are added, or are deleted, on a schedule or as soon as they change.', why: 'Determines how out of date your answers can be.', related: ['data-freshness', 'ingestion-pipeline'], lesson: 'freshness' },
  { id: 'document-parsing', term: 'Document parsing', category: 'Retrieval', simple: 'Turning files (PDFs, slides, spreadsheets, web pages) into clean text, ideally keeping tables, headings and layout intact.', analogy: 'Transcribing a document by hand: sloppy transcription loses the table rows.', related: ['ingestion-pipeline', 'chunk'], lesson: 'freshness' },
  { id: 'data-freshness', term: 'Data freshness', aka: 'Stale index', category: 'Retrieval', simple: 'How up to date your index is compared with the real documents. A stale index returns old versions.', why: 'Stale answers are confident and well-sourced, so judges and users rarely catch them.', related: ['re-indexing'], lesson: 'freshness' },
  { id: 'cache-hit', term: 'Cache hit', category: 'Inference', simple: 'When the data you need is already in a cache, so it can be reused instead of recomputed.', why: 'Hit rate is what decides how much any cache actually saves.', related: ['prompt-caching', 'semantic-cache'], lesson: 'caching' },
  { id: 'batch-api', term: 'Batch API', category: 'Inference', simple: 'A way to send many requests at once and collect the results later (usually within 24 hours), typically at about half the price.', why: 'Cheap, and it keeps background work from eating your real-time rate limit.', related: ['async-job', 'rate-limit'], lesson: 'batch' },
  { id: 'async-job', term: 'Async job', aka: 'Background job', category: 'Production', simple: 'Work that runs in the background without anyone waiting on a screen for it, like nightly reports or bulk tagging.', analogy: 'Leaving the dishwasher running overnight.', related: ['batch-api'], lesson: 'batch' },

  { id: 'pretraining', term: 'Pretraining', category: 'Models', simple: 'The first and biggest training stage: the model reads a huge amount of text and learns to predict the next token.', why: 'Where general knowledge and skills come from, and why the model knows nothing after its cutoff or inside your company.', related: ['instruction-tuning', 'training-data', 'parameters'], lesson: 'how-models-are-made' },
  { id: 'parameters', term: 'Parameters', aka: 'Weights', category: 'Models', simple: 'The billions of numbers inside a model that training adjusts. "70B" means about 70 billion of them.', analogy: 'The strength of every connection in a giant web.', why: 'More parameters can hold more knowledge and skill, but need more memory and compute to run.', related: ['pretraining', 'quantization'], lesson: 'how-models-are-made' },
  { id: 'instruction-tuning', term: 'Instruction tuning', category: 'Models', simple: 'Training a pretrained model on many examples of instructions with good responses, so it learns to follow requests instead of just continuing text.', related: ['pretraining', 'rlhf'], lesson: 'how-models-are-made' },
  { id: 'rlhf', term: 'RLHF', aka: 'Preference training', category: 'Models', simple: 'Reinforcement learning from human feedback: people compare pairs of answers, and the model is nudged towards the ones they preferred.', analogy: 'A manager reading two drafts and saying "more like this one".', related: ['instruction-tuning'], lesson: 'how-models-are-made' },
  { id: 'distillation', term: 'Distillation', category: 'Models', simple: 'Training a smaller model to imitate a bigger one\'s outputs, so it\'s cheaper and faster while keeping much of the skill.', analogy: 'An apprentice learning by copying a master\'s work.', related: ['parameters', 'fine-tuning'], lesson: 'how-models-are-made' },
  { id: 'few-shot', term: 'Few-shot prompting', category: 'Models', simple: 'Including a handful of worked examples in the prompt to show the model what you want.', why: 'Quick and training-free, but the examples are paid for on every request.', related: ['prompt', 'fine-tuning'], lesson: 'fine-tuning-vs-rag' },
  { id: 'model-version', term: 'Model version', aka: 'Pinning', category: 'Quality', simple: 'The specific, dated release of a model you call. Aliases like "latest" move to new versions automatically; a pinned version doesn\'t.', why: 'New versions can change behaviour; pinning makes upgrades deliberate.', related: ['regression', 'eval'], lesson: 'model-updates' },
  { id: 'pii', term: 'PII', aka: 'Personal data', category: 'Safety', simple: 'Personally identifiable information: anything that identifies a person, like names, emails, phone numbers, IDs, or health and financial details.', why: 'Sending it to third parties brings legal duties (GDPR, HIPAA and others).', related: ['redaction', 'data-retention'], lesson: 'privacy' },
  { id: 'redaction', term: 'Redaction', category: 'Safety', simple: 'Finding personal or sensitive details and replacing them with placeholders before the text is sent anywhere.', analogy: 'Blacking out names before sharing a document.', related: ['pii'], lesson: 'privacy' },
  { id: 'data-retention', term: 'Data retention', category: 'Safety', simple: 'How long a provider keeps your prompts and responses, and whether they may use them for training.', why: 'Often configurable; check it before sending anything sensitive.', related: ['pii', 'data-residency'], lesson: 'privacy' },
  { id: 'data-residency', term: 'Data residency', category: 'Safety', simple: 'Which country or region your data is stored and processed in.', why: 'Some regulations and customers require data to stay in a specific region, such as the EU.', related: ['data-retention'], lesson: 'privacy' },
  { id: 'per-user-limits', term: 'Per-user limits', category: 'Production', simple: 'Caps on how much a single account can use: requests per minute, tokens or spend per day.', why: 'Stops one script from burning your budget and your provider rate limit.', related: ['quota', 'rate-limit'], lesson: 'abuse-controls' },
  { id: 'quota', term: 'Quota', category: 'Production', simple: 'A usage allowance over a period, like 100,000 tokens per user per day.', related: ['per-user-limits'], lesson: 'abuse-controls' },
  { id: 'multimodal', term: 'Multimodal', category: 'Voice', simple: 'Able to take in (or produce) more than text: images, audio, video, documents.', why: 'Images and audio become tokens too, and can be surprisingly expensive.', related: ['token', 'speech-to-text'], lesson: 'voice-multimodal' },
  { id: 'speech-to-text', term: 'Speech-to-text', aka: 'STT / transcription', category: 'Voice', simple: 'Turning spoken audio into text. Streaming versions transcribe while the person is still talking.', related: ['text-to-speech', 'voice-latency'], lesson: 'voice-multimodal' },
  { id: 'text-to-speech', term: 'Text-to-speech', aka: 'TTS', category: 'Voice', simple: 'Turning text into spoken audio. Streaming versions start speaking before the full text exists.', related: ['speech-to-text', 'voice-latency'], lesson: 'voice-multimodal' },
  { id: 'voice-latency', term: 'Voice latency', aka: 'Time to first audio', category: 'Voice', simple: 'How long after the user stops talking until they hear the reply begin. About a second feels natural; several seconds feels broken.', related: ['streaming', 'ttft'], lesson: 'voice-multimodal' },

  { id: 'sampling', term: 'Sampling', category: 'Models', simple: 'How the model picks each next token from its list of probable options. Temperature and top-p are the sampling settings.', related: ['temperature', 'top-p'], lesson: 'temperature' },
  { id: 'top-p', term: 'Top-p', aka: 'Nucleus sampling', category: 'Models', simple: 'Only pick the next token from the smallest group of likely options that together add up to p (say 90%) of the probability. Cuts off the weird long tail.', why: 'An alternative or companion to temperature; usually tune one, not both.', related: ['temperature', 'sampling'], lesson: 'temperature' },
  { id: 'determinism', term: 'Determinism', category: 'Models', simple: 'Getting exactly the same output for the same input. Temperature 0 gets close, but hosted models aren\'t perfectly deterministic.', why: 'If you need the identical answer again, store or cache it rather than regenerating.', related: ['temperature'], lesson: 'temperature' },
  { id: 'judge-bias', term: 'Judge bias', category: 'Quality', simple: 'The systematic mistakes an LLM judge makes: favouring longer, more confident or more familiar-sounding answers, and missing fluent errors.', why: 'An uncalibrated judge can make a bad system look great.', related: ['llm-as-judge', 'eval'], lesson: 'trustworthy-evals' },
  { id: 'offline-online-evals', term: 'Offline vs online evals', category: 'Quality', simple: 'Offline evals run a fixed test set before you ship. Online evals score a sample of live traffic after you ship.', why: 'Offline catches regressions; online catches drift away from what you tested.', related: ['eval', 'regression-suite'], lesson: 'trustworthy-evals' },
  { id: 'regression-suite', term: 'Regression suite', category: 'Quality', simple: 'The set of evals that runs automatically on every prompt, model or retrieval change, and blocks the change if quality drops.', analogy: 'Continuous integration tests, for answer quality.', related: ['regression', 'golden-dataset'], lesson: 'trustworthy-evals' },

  // Inference
  { id: 'prefill', term: 'Prefill', category: 'Inference', simple: 'The first phase of a model call: reading the whole prompt at once. GPUs do this in parallel, so it\'s fast.', analogy: 'Skimming a page in one glance.', why: 'Long prompts add surprisingly little latency compared with long answers.', related: ['decode', 'kv-cache'], lesson: 'how-inference-works' },
  { id: 'decode', term: 'Decode', category: 'Inference', simple: 'The second phase: writing the answer one token at a time, each depending on the last. It can\'t be parallelised, so it\'s the slow part.', analogy: 'Writing a page by hand, word by word.', why: 'Output length, not prompt length, mostly decides how long a call takes.', related: ['prefill', 'max-output-tokens'], lesson: 'how-inference-works' },
  { id: 'kv-cache', term: 'KV cache', category: 'Inference', simple: 'The model\'s working memory of everything it has read so far in a request, so it doesn\'t re-read the whole prompt for every new word.', analogy: 'Notes in the margin so you don\'t reread the chapter before each sentence.', why: 'It\'s what makes prompt caching possible, and it takes up GPU memory.', related: ['prompt-caching', 'prefill'], lesson: 'how-inference-works' },
  { id: 'max-output-tokens', term: 'Max output tokens', category: 'Inference', simple: 'A cap on how long the model\'s answer can be.', why: 'One of the cheapest ways to cut latency and cost, since writing is the slow, expensive part.', related: ['decode', 'input-output-tokens'], lesson: 'how-inference-works' },
  { id: 'gpu', term: 'GPU', category: 'Inference', simple: 'The chip that runs AI models: thousands of small cores doing maths in parallel, plus fast memory that holds the model.', why: 'GPU memory decides which models fit; GPU speed decides how fast they write.', related: ['batching', 'quantization', 'self-hosting'], lesson: 'serving' },
  { id: 'batching', term: 'Batching', category: 'Inference', simple: 'Running many requests through the model at the same time on one GPU.', analogy: 'A bus instead of a taxi per passenger.', why: 'Multiplies total throughput, but each request is written a bit more slowly.', related: ['continuous-batching', 'throughput'], lesson: 'serving' },
  { id: 'continuous-batching', term: 'Continuous batching', category: 'Inference', simple: 'Letting new requests join a running batch as soon as a slot frees up, instead of waiting for the whole batch to finish.', analogy: 'A bus that picks up passengers at every stop rather than waiting at the depot until it\'s full.', related: ['batching', 'throughput'], lesson: 'serving' },
  { id: 'quantization', term: 'Quantization', category: 'Inference', simple: 'Storing a model\'s numbers with fewer bits (16 → 8 → 4) so it\'s smaller and faster.', analogy: 'Saving a photo as a smaller JPEG: much lighter, mostly looks the same, artefacts if you push it too far.', why: 'More speed and capacity per GPU for a small quality cost; 4-bit can noticeably hurt accuracy.', related: ['gpu', 'open-weights'], lesson: 'serving' },
  { id: 'throughput', term: 'Throughput', category: 'Inference', simple: 'How much work a system completes per second, for example total tokens written across all requests.', why: 'Different from latency: you can raise throughput while making each request slower.', related: ['batching', 'latency'], lesson: 'serving' },
  { id: 'speculative-decoding', term: 'Speculative decoding', category: 'Inference', simple: 'A small, fast model drafts several tokens ahead, and the big model checks them all in one pass, keeping the ones it agrees with.', analogy: 'An assistant drafts the email; the expert just approves or fixes it.', why: 'Speeds up writing without changing the big model\'s answers.', related: ['decode'], lesson: 'serving' },
  { id: 'open-weights', term: 'Open-weights model', category: 'Inference', simple: 'A model whose trained weights are published, so you can download it and run it on your own hardware.', why: 'Makes self-hosting possible: full control, data stays with you.', related: ['self-hosting', 'quantization'], lesson: 'self-host-vs-api' },
  { id: 'self-hosting', term: 'Self-hosting', category: 'Inference', simple: 'Running a model on GPUs you rent or own, instead of calling a provider\'s API.', analogy: 'Owning a car instead of taking taxis.', why: 'Cheaper at high, steady traffic; more expensive when GPUs sit idle, and you own the operations.', related: ['gpu-utilization', 'open-weights', 'gpu'], lesson: 'self-host-vs-api' },
  { id: 'gpu-utilization', term: 'GPU utilization', category: 'Inference', simple: 'How busy your GPUs are compared with what they could handle.', why: 'Low means paying for idle hardware; near 100% means queues and timeouts. Aim for busy but not full.', related: ['self-hosting', 'throughput'], lesson: 'self-host-vs-api' },
  { id: 'timeout', term: 'Timeout', category: 'Inference', simple: 'The longest you\'ll wait for a call before giving up on it.', why: 'Without one, a single stuck call can hold up a user, or your whole system.', related: ['retry', 'circuit-breaker'], lesson: 'reliability' },
  { id: 'retry', term: 'Retry', category: 'Inference', simple: 'Trying a failed call again, usually after a short wait.', why: 'Fixes brief blips; makes real outages worse if overused.', related: ['exponential-backoff', 'retry-storm'], lesson: 'reliability' },
  { id: 'exponential-backoff', term: 'Exponential backoff', category: 'Inference', simple: 'Waiting longer before each retry (say 0.25s, 0.5s, 1s, 2s), usually with a little randomness so clients don\'t retry in sync.', analogy: 'Giving a busy friend more time between each call instead of ringing non-stop.', related: ['retry', 'retry-storm'], lesson: 'reliability' },
  { id: 'retry-storm', term: 'Retry storm', category: 'Inference', simple: 'When a struggling service gets hammered by everyone\'s retries at once, pushing it from slow to completely down.', why: 'The reason retries need caps, backoff and circuit breakers.', related: ['retry', 'circuit-breaker'], lesson: 'reliability' },
  { id: 'failover', term: 'Failover', category: 'Inference', simple: 'Automatically switching to a backup (another provider or your own model) when the primary keeps failing.', analogy: 'A hospital\'s backup generator kicking in during a power cut.', related: ['circuit-breaker', 'retry'], lesson: 'reliability' },
  { id: 'circuit-breaker', term: 'Circuit breaker', category: 'Inference', simple: 'After enough failures, stop calling a broken service for a while and go straight to the fallback, then test it again later.', analogy: 'The breaker in your fuse box that trips so a fault doesn\'t burn the house down.', related: ['failover', 'retry-storm'], lesson: 'reliability' },

  // Production
  { id: 'latency', term: 'Latency', category: 'Production', simple: 'How long a request takes from the user asking to the user getting an answer.', related: ['ttft', 'p50-p99'], lesson: 'latency' },
  { id: 'ttft', term: 'Time to first token', aka: 'TTFT', category: 'Production', simple: 'How long until the first word of the answer appears on screen.', why: 'This is what users actually feel as "speed".', related: ['streaming', 'latency'], lesson: 'latency' },
  { id: 'streaming', term: 'Streaming', category: 'Production', simple: 'Showing the answer word by word as the model writes it, instead of waiting for the whole thing.', analogy: 'Bread arriving while the main course cooks.', related: ['ttft'], lesson: 'latency' },
  { id: 'p50-p99', term: 'p50 / p99', aka: 'Percentiles', category: 'Production', simple: 'p50 is the typical request (half are faster). p99 is the slow tail: 1 in 100 requests is slower than this.', why: 'Averages hide the users having a terrible time.', related: ['latency'] },
  { id: 'rate-limit', term: 'Rate limit', category: 'Production', simple: 'A cap the provider puts on how much you can use a model per minute. Exceed it and requests are rejected with HTTP 429.', related: ['tpm'], lesson: 'scale' },
  { id: 'tpm', term: 'TPM', aka: 'Tokens per minute', category: 'Production', simple: 'The most common kind of rate limit: the total tokens you can send to a model each minute.', why: 'Long prompts hit it fast, even at low request counts.', related: ['rate-limit', 'token'], lesson: 'scale' },
  { id: 'semantic-cache', term: 'Semantic cache', category: 'Production', simple: 'Storing answers and reusing them when a new question means the same thing as an old one, even if worded differently.', analogy: 'An FAQ that recognises the question however it\'s phrased.', why: 'A hit skips the model entirely: near-zero cost and instant.', related: ['model-routing'], lesson: 'scale' },
  { id: 'model-routing', term: 'Model routing', category: 'Production', simple: 'Sending each request to the cheapest model that can handle it, keeping expensive models for hard requests.', analogy: 'Hospital triage.', related: ['semantic-cache', 'cost-per-request'], lesson: 'scale' },
  { id: 'cost-per-request', term: 'Cost per request', category: 'Production', simple: 'What one user question costs you end to end: all the tokens through every model call, plus search and checks.', related: ['input-output-tokens', 'model-routing'] },
  { id: 'observability', term: 'Observability', category: 'Production', simple: 'Recording what happened inside each request (prompts, retrieved chunks, model calls, timings, cost) so you can see why something went wrong.', analogy: 'A flight recorder for every request.', related: ['eval'] },

  // Agents
  { id: 'agent', term: 'Agent', category: 'Agents', simple: 'A model running in a loop that can decide to use tools, look at the results, and keep going until a task is done.', analogy: 'An assistant who can make calls and click buttons, not just write memos.', related: ['tool-calling', 'agent-loop'], lesson: 'agents' },
  { id: 'tool-calling', term: 'Tool calling', aka: 'Function calling', category: 'Agents', simple: 'The model outputs a structured request like "lookup_order(48213)"; your code runs it and hands back the result.', related: ['agent', 'mcp'], lesson: 'agents' },
  { id: 'agent-loop', term: 'Agent loop', category: 'Agents', simple: 'The think → act → observe cycle an agent repeats. Each cycle is another model call. In teams, "looping" also means agents bouncing work back and forth.', why: 'Cost and latency grow with every step, so loops need a hard cap.', related: ['step-budget', 'multi-agent'], lesson: 'agents' },
  { id: 'step-budget', term: 'Step budget', aka: 'Max steps', category: 'Agents', simple: 'The most loop cycles an agent may run before it must stop.', why: 'Stops stuck agents from burning money, but too low and real tasks fail.', related: ['agent-loop'], lesson: 'agents' },
  { id: 'mcp', term: 'MCP', aka: 'Model Context Protocol', category: 'Agents', simple: 'An open standard for connecting models to tools and data sources, so one integration works across many AI apps.', analogy: 'USB-C for AI tools.', related: ['tool-calling'] },

  { id: 'multi-agent', term: 'Multi-agent system', category: 'Agents', simple: 'Several AI agents, each with its own instructions, tools and context, working together on one task.', analogy: 'A team of specialists instead of one generalist.', why: 'Faster and more focused on big tasks, but more calls, more hand-offs and more ways to fail.', related: ['orchestrator', 'worker-agent', 'handoff'], lesson: 'multi-agent' },
  { id: 'orchestrator', term: 'Orchestrator', aka: 'Planner / supervisor agent', category: 'Agents', simple: 'The agent that breaks a task into parts, hands them out to other agents, and combines what comes back.', analogy: 'A project lead with a team of analysts.', related: ['worker-agent', 'multi-agent'], lesson: 'multi-agent' },
  { id: 'worker-agent', term: 'Worker agent', aka: 'Sub-agent', category: 'Agents', simple: 'An agent given one narrow piece of a bigger task, often running in parallel with others.', why: 'Its prompt holds only its slice of the problem, so it stays small and focused.', related: ['orchestrator', 'context-isolation'], lesson: 'multi-agent' },
  { id: 'handoff', term: 'Hand-off', category: 'Agents', simple: 'Passing work, and a summary of it, from one agent to another.', analogy: 'A shift change at a hospital: the next nurse only knows what was written in the handover notes.', why: 'Every hand-off can drop details; fewer, cleaner hand-offs mean fewer gaps.', related: ['multi-agent', 'critic-agent'], lesson: 'multi-agent-pitfalls' },
  { id: 'context-isolation', term: 'Context isolation', category: 'Agents', simple: 'Giving each agent only the information its own part of the task needs, instead of everything.', why: 'Smaller prompts are faster, cheaper and less likely to bury the important detail.', related: ['worker-agent', 'lost-in-the-middle'], lesson: 'multi-agent' },
  { id: 'critic-agent', term: 'Reviewer agent', aka: 'Critic', category: 'Agents', simple: 'An agent whose only job is to check another agent\'s output and send it back if something is wrong.', analogy: 'An editor reading the draft before it\'s published.', related: ['llm-as-judge', 'handoff'], lesson: 'multi-agent-pitfalls' },
  { id: 'human-in-the-loop', term: 'Human in the loop', category: 'Agents', simple: 'Requiring a person to approve an agent\'s proposed action before it happens, usually for risky or irreversible steps.', analogy: 'The intern drafts the refund; the manager clicks approve.', related: ['tool-permissions', 'agent'], lesson: 'multi-agent-pitfalls' },
  { id: 'tool-permissions', term: 'Tool permissions', category: 'Agents', simple: 'Limiting which tools each agent can use, and what those tools are allowed to do.', why: 'An agent that can only read can\'t accidentally delete; a narrow toolset is also easier for the model to use well.', related: ['human-in-the-loop', 'tool-calling'], lesson: 'multi-agent-pitfalls' },

  // Safety
  { id: 'prompt-injection', term: 'Prompt injection', category: 'Safety', simple: 'Text crafted to override your instructions, either typed by a user or hidden in a document or web page the model reads.', analogy: 'A note slipped into the pile saying "the boss says ignore all previous rules".', related: ['jailbreak', 'guardrail'], lesson: 'safety' },
  { id: 'jailbreak', term: 'Jailbreak', category: 'Safety', simple: 'A prompt designed to get a model to break its safety rules or ignore its role.', related: ['prompt-injection'], lesson: 'safety' },
  { id: 'guardrail', term: 'Guardrail', category: 'Safety', simple: 'Any automatic check placed before or after the model to block unsafe inputs or outputs.', related: ['llm-as-judge', 'false-positive'], lesson: 'safety' },
  { id: 'llm-as-judge', term: 'LLM-as-judge', category: 'Safety', simple: 'Using a second model to grade the first model\'s answer: is it supported by the sources, is it safe, is it on topic?', why: 'Catches problems, but must wait for the full answer, so it adds time and breaks streaming.', related: ['guardrail', 'eval'], lesson: 'safety' },
  { id: 'false-positive', term: 'False positive', category: 'Safety', simple: 'When a check flags something harmless, like a guardrail blocking a real customer\'s normal question.', why: 'The hidden cost of strict safety settings.', related: ['guardrail'], lesson: 'safety' },

  // Quality
  { id: 'hallucination', term: 'Hallucination', category: 'Quality', simple: 'A confident, fluent answer that is wrong or made up.', analogy: 'Confident directions to a street that doesn\'t exist.', why: 'Usually caused by missing information, not a lack of intelligence.', related: ['grounding', 'rag'], lesson: 'hallucination' },
  { id: 'lost-in-the-middle', term: 'Lost in the middle', category: 'Quality', simple: 'Models pay less attention to information buried in the middle of a long prompt than to what\'s at the start or end.', why: 'Stuffing in more chunks can make answers worse, not better.', related: ['context-window', 'reranker'], lesson: 'tokens' },
  { id: 'eval', term: 'Eval', aka: 'Evaluation', category: 'Quality', simple: 'A repeatable way to score answer quality: run a test set with known good answers, and have a judge score a sample of live traffic.', analogy: 'Unit tests, but for answer quality.', why: 'Without evals, every change is a guess.', related: ['golden-dataset', 'llm-as-judge', 'regression'], lesson: 'evals' },
  { id: 'golden-dataset', term: 'Golden dataset', aka: 'Test set', category: 'Quality', simple: 'A fixed collection of real questions with answers you\'ve checked are correct, used to score every version of your system.', analogy: 'The answer key for a practice exam you give every new version.', why: 'Lets you compare versions on the same questions, so improvements are real.', related: ['eval', 'regression'], lesson: 'evals' },
  { id: 'regression', term: 'Regression', category: 'Quality', simple: 'When a change makes something that used to work worse, often without anyone noticing at first.', why: 'Cost and speed optimisations are the classic source of silent quality regressions.', related: ['eval', 'golden-dataset'], lesson: 'evals' },
  { id: 'binding-pressure', term: 'Binding pressure', category: 'Quality', simple: 'The single limit hurting your system the most right now. Fixing anything else barely helps.', analogy: 'The weakest link in a chain.', related: ['eval', 'observability'], lesson: 'binding-pressure' },
];

export const TERM_BY_ID = Object.fromEntries(TERMS.map((t) => [t.id, t])) as Record<string, Term>;
export const LESSON_ORDER: string[] = MODULES.flatMap((m) => m.lessons);
export const MODULE_OF: Record<string, Module> = Object.fromEntries(MODULES.flatMap((m) => m.lessons.map((l) => [l, m])));
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l])) as Record<string, Lesson>;

/** The glossary entry that best explains each component, used for "Learn more" links. */
export const COMPONENT_TERM: Partial<Record<ComponentType, string>> = {
  input_guard: 'guardrail',
  semantic_cache: 'semantic-cache',
  router: 'model-routing',
  embedding: 'embedding',
  vector_db: 'vector-db',
  keyword_search: 'bm25',
  reranker: 'reranker',
  agent: 'agent',
  llm: 'llm',
  output_guard: 'llm-as-judge',
  memory: 'conversation-memory',
  eval_harness: 'eval',
  gpu_llm: 'self-hosting',
  fallback: 'failover',
  agent_team: 'multi-agent',
  validator: 'output-validation',
  batch_queue: 'batch-api',
  pii_redactor: 'redaction',
  stt: 'speech-to-text',
  tts: 'text-to-speech',
  user_limits: 'per-user-limits',
};
