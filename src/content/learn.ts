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
/* Glossary: complex terms in simple words                             */
/* ------------------------------------------------------------------ */

export type TermCategory = 'Models' | 'Retrieval' | 'Production' | 'Agents' | 'Safety' | 'Quality';

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
  { id: 'inference', term: 'Inference', category: 'Models', simple: 'Running a trained model to get an answer. Every request you make is an inference call.', analogy: 'Training is going to school; inference is doing the job.', related: ['llm', 'latency'] },
  { id: 'context-window', term: 'Context window', category: 'Models', simple: 'The maximum number of tokens a model can read in one request, including the prompt and its answer.', analogy: 'The size of the desk: only so many pages fit on it at once.', why: 'Go over it and the request fails or gets cut off.', related: ['token', 'lost-in-the-middle'], lesson: 'tokens' },
  { id: 'input-output-tokens', term: 'Input vs output tokens', category: 'Models', simple: 'Input tokens are what you send; output tokens are what the model writes. Output is usually several times more expensive.', why: 'Long answers cost more than long prompts, token for token.', related: ['token', 'cost-per-request'], lesson: 'tokens' },
  { id: 'training-data', term: 'Training data', category: 'Models', simple: 'The text a model learned from before it was released. It doesn\'t include your private documents.', related: ['knowledge-cutoff', 'hallucination'], lesson: 'hallucination' },
  { id: 'knowledge-cutoff', term: 'Knowledge cutoff', category: 'Models', simple: 'The date the model\'s training data stops. It knows nothing that happened after, unless you give it the information.', analogy: 'Someone who\'s been on a remote island since that date.', related: ['training-data', 'rag'] },
  { id: 'temperature', term: 'Temperature', category: 'Models', simple: 'A setting that controls how random the model\'s word choices are. Low is focused and repeatable; high is varied and creative.', analogy: 'Low temperature is a careful accountant; high is a jazz improviser.', related: ['llm'] },
  { id: 'fine-tuning', term: 'Fine-tuning', category: 'Models', simple: 'Training an existing model further on your own examples so it picks up a style or task. It\'s good for teaching behaviour, not for adding facts that change often.', analogy: 'Sending an employee on a course, versus handing them the manual (RAG).', related: ['rag', 'training-data'] },

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
  { id: 'agent-loop', term: 'Agent loop', category: 'Agents', simple: 'The think → act → observe cycle an agent repeats. Each cycle is another model call.', why: 'Cost and latency grow with every step.', related: ['step-budget'], lesson: 'agents' },
  { id: 'step-budget', term: 'Step budget', aka: 'Max steps', category: 'Agents', simple: 'The most loop cycles an agent may run before it must stop.', why: 'Stops stuck agents from burning money, but too low and real tasks fail.', related: ['agent-loop'], lesson: 'agents' },
  { id: 'mcp', term: 'MCP', aka: 'Model Context Protocol', category: 'Agents', simple: 'An open standard for connecting models to tools and data sources, so one integration works across many AI apps.', analogy: 'USB-C for AI tools.', related: ['tool-calling'] },

  // Safety
  { id: 'prompt-injection', term: 'Prompt injection', category: 'Safety', simple: 'Text crafted to override your instructions, either typed by a user or hidden in a document or web page the model reads.', analogy: 'A note slipped into the pile saying "the boss says ignore all previous rules".', related: ['jailbreak', 'guardrail'], lesson: 'safety' },
  { id: 'jailbreak', term: 'Jailbreak', category: 'Safety', simple: 'A prompt designed to get a model to break its safety rules or ignore its role.', related: ['prompt-injection'], lesson: 'safety' },
  { id: 'guardrail', term: 'Guardrail', category: 'Safety', simple: 'Any automatic check placed before or after the model to block unsafe inputs or outputs.', related: ['llm-as-judge', 'false-positive'], lesson: 'safety' },
  { id: 'llm-as-judge', term: 'LLM-as-judge', category: 'Safety', simple: 'Using a second model to grade the first model\'s answer: is it supported by the sources, is it safe, is it on topic?', why: 'Catches problems, but must wait for the full answer, so it adds time and breaks streaming.', related: ['guardrail', 'eval'], lesson: 'safety' },
  { id: 'false-positive', term: 'False positive', category: 'Safety', simple: 'When a check flags something harmless, like a guardrail blocking a real customer\'s normal question.', why: 'The hidden cost of strict safety settings.', related: ['guardrail'], lesson: 'safety' },

  // Quality
  { id: 'hallucination', term: 'Hallucination', category: 'Quality', simple: 'A confident, fluent answer that is wrong or made up.', analogy: 'Confident directions to a street that doesn\'t exist.', why: 'Usually caused by missing information, not a lack of intelligence.', related: ['grounding', 'rag'], lesson: 'hallucination' },
  { id: 'lost-in-the-middle', term: 'Lost in the middle', category: 'Quality', simple: 'Models pay less attention to information buried in the middle of a long prompt than to what\'s at the start or end.', why: 'Stuffing in more chunks can make answers worse, not better.', related: ['context-window', 'reranker'], lesson: 'tokens' },
  { id: 'eval', term: 'Eval', aka: 'Evaluation', category: 'Quality', simple: 'A repeatable test set of questions with known good answers, used to score your system every time you change it.', analogy: 'Unit tests, but for answer quality.', why: 'Without evals, every change is a guess.', related: ['observability', 'llm-as-judge'], lesson: 'binding-pressure' },
  { id: 'binding-pressure', term: 'Binding pressure', category: 'Quality', simple: 'The single limit hurting your system the most right now. Fixing anything else barely helps.', analogy: 'The weakest link in a chain.', related: ['eval', 'observability'], lesson: 'binding-pressure' },
];

export const TERM_BY_ID = Object.fromEntries(TERMS.map((t) => [t.id, t])) as Record<string, Term>;
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
};
