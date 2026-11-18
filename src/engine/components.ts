import type { ComponentType, NodeConfig } from './types';

export interface ConfigField {
  key: string;
  label: string;
  kind: 'select' | 'range' | 'toggle';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  help: string;
}

export interface ComponentSpec {
  type: ComponentType;
  name: string;
  short: string;
  group: 'Input' | 'Retrieval' | 'Memory' | 'Generation' | 'Efficiency' | 'Safety' | 'Quality';
  color: string;
  blurb: string;
  defaults: NodeConfig;
  fields: ConfigField[];
}

export const MODEL_SPECS = {
  small: {
    label: 'Small (fast, cheap)',
    ttftBase: 120,
    prefillMsPerTok: 0.02,
    msPerOutTok: 8,
    inPerM: 0.15,
    outPerM: 0.6,
    context: 8_000,
    tpm: 10_000_000,
    accEasy: 0.95,
    accHard: 0.58,
    hallucinateWhenUnsure: 0.9,
    injectable: 0.6,
  },
  medium: {
    label: 'Medium (balanced)',
    ttftBase: 250,
    prefillMsPerTok: 0.05,
    msPerOutTok: 18,
    inPerM: 3,
    outPerM: 15,
    context: 32_000,
    tpm: 5_000_000,
    accEasy: 0.97,
    accHard: 0.82,
    hallucinateWhenUnsure: 0.8,
    injectable: 0.45,
  },
  large: {
    label: 'Large (smart, slow, pricey)',
    ttftBase: 500,
    prefillMsPerTok: 0.1,
    msPerOutTok: 32,
    inPerM: 15,
    outPerM: 75,
    context: 128_000,
    tpm: 2_500_000,
    accEasy: 0.99,
    accHard: 0.93,
    hallucinateWhenUnsure: 0.65,
    injectable: 0.3,
  },
} as const;

export type ModelSize = keyof typeof MODEL_SPECS;
export const MODEL_RANK: Record<ModelSize, number> = { small: 0, medium: 1, large: 2 };

export const CHUNK_SPECS = {
  small: { tokens: 150, cap: 0.93, completeness: 0.82 },
  medium: { tokens: 400, cap: 0.9, completeness: 1 },
  large: { tokens: 1000, cap: 0.74, completeness: 1 },
} as const;
export type ChunkSize = keyof typeof CHUNK_SPECS;

const modelOptions = (Object.keys(MODEL_SPECS) as ModelSize[]).map((k) => ({
  value: k,
  label: MODEL_SPECS[k].label,
}));

export const COMPONENTS: Record<ComponentType, ComponentSpec> = {
  users: {
    type: 'users',
    name: 'Users',
    short: 'USR',
    group: 'Input',
    color: '#71717a',
    blurb: 'Where traffic comes from. The mix of questions is set by the scenario; volume by the traffic slider.',
    defaults: {},
    fields: [],
  },
  input_guard: {
    type: 'input_guard',
    name: 'Input Guardrail',
    short: 'IG',
    group: 'Safety',
    color: '#f43f5e',
    blurb: 'Classifier that screens prompts for injection / jailbreak attempts before they reach the model.',
    defaults: { strictness: 0.7 },
    fields: [
      {
        key: 'strictness',
        label: 'Strictness',
        kind: 'range',
        min: 0.3,
        max: 1,
        step: 0.05,
        help: 'Higher catches more attacks but blocks more legitimate users (false positives).',
      },
    ],
  },
  semantic_cache: {
    type: 'semantic_cache',
    name: 'Semantic Cache',
    short: 'SC',
    group: 'Efficiency',
    color: '#10b981',
    blurb: 'Returns a stored answer when a new question is close enough to one already answered. Skips the LLM entirely on a hit.',
    defaults: { threshold: 0.9 },
    fields: [
      {
        key: 'threshold',
        label: 'Similarity threshold',
        kind: 'range',
        min: 0.8,
        max: 0.99,
        step: 0.01,
        help: 'Lower = more hits, but different questions start getting the wrong cached answer.',
      },
    ],
  },
  router: {
    type: 'router',
    name: 'Model Router',
    short: 'RT',
    group: 'Efficiency',
    color: '#f59e0b',
    blurb: 'Classifies difficulty and sends easy requests to the cheapest connected model, hard ones to the strongest. Needs 2+ model sizes downstream.',
    defaults: {},
    fields: [],
  },
  embedding: {
    type: 'embedding',
    name: 'Embedding Model',
    short: 'EMB',
    group: 'Retrieval',
    color: '#8b5cf6',
    blurb: 'Turns the question into a vector so a vector DB can find semantically similar chunks.',
    defaults: {},
    fields: [],
  },
  vector_db: {
    type: 'vector_db',
    name: 'Vector DB',
    short: 'VDB',
    group: 'Retrieval',
    color: '#6366f1',
    blurb: 'Finds the chunks of your documents closest in meaning to the question. Great at paraphrases, weak at exact codes and names.',
    defaults: { topK: 5, chunk: 'medium' },
    fields: [
      {
        key: 'topK',
        label: 'Top-K chunks',
        kind: 'range',
        min: 1,
        max: 20,
        step: 1,
        help: 'More chunks = higher recall, but more tokens, more cost and more noise for the model.',
      },
      {
        key: 'chunk',
        label: 'Chunk size',
        kind: 'select',
        options: [
          { value: 'small', label: 'Small (~150 tok)' },
          { value: 'medium', label: 'Medium (~400 tok)' },
          { value: 'large', label: 'Large (~1000 tok)' },
        ],
        help: 'Small chunks are precise but split answers apart. Large chunks dilute the embedding and blow up the context.',
      },
    ],
  },
  keyword_search: {
    type: 'keyword_search',
    name: 'Keyword Search (BM25)',
    short: 'KW',
    group: 'Retrieval',
    color: '#3b82f6',
    blurb: 'Classic term matching. Nails exact identifiers (SKU-4471, error E1043) that embeddings blur. Combine with a vector DB for hybrid search.',
    defaults: {},
    fields: [],
  },
  reranker: {
    type: 'reranker',
    name: 'Reranker',
    short: 'RR',
    group: 'Retrieval',
    color: '#d946ef',
    blurb: 'Cross-encoder that rescores retrieved chunks and passes only the best few to the model. Lets you retrieve wide without drowning the LLM.',
    defaults: { keep: 4 },
    fields: [
      {
        key: 'keep',
        label: 'Chunks kept',
        kind: 'range',
        min: 1,
        max: 10,
        step: 1,
        help: 'How many top chunks survive reranking and go into the prompt.',
      },
    ],
  },
  agent: {
    type: 'agent',
    name: 'Agent Loop + Tools',
    short: 'AG',
    group: 'Generation',
    color: '#f97316',
    blurb: 'Lets the model call tools (order lookup, refunds, search) in a loop. Each step is another LLM call.',
    defaults: { maxSteps: 20 },
    fields: [
      {
        key: 'maxSteps',
        label: 'Max steps',
        kind: 'range',
        min: 1,
        max: 30,
        step: 1,
        help: 'Cap on think→act cycles. Too low and real tasks fail; too high and stuck agents burn money.',
      },
    ],
  },
  llm: {
    type: 'llm',
    name: 'LLM',
    short: 'LLM',
    group: 'Generation',
    color: '#0ea5e9',
    blurb: 'The model that writes the answer. Bigger is smarter and safer, but slower, pricier and more rate-limited.',
    defaults: { size: 'medium', streaming: false },
    fields: [
      {
        key: 'size',
        label: 'Model size',
        kind: 'select',
        options: modelOptions,
        help: 'Changes accuracy, latency, cost, context window and tokens-per-minute limit.',
      },
      {
        key: 'streaming',
        label: 'Stream tokens',
        kind: 'toggle',
        help: 'Users see the first token immediately instead of waiting for the full answer.',
      },
    ],
  },
  memory: {
    type: 'memory',
    name: 'Conversation Memory',
    short: 'MEM',
    group: 'Memory',
    color: '#14b8a6',
    blurb: 'Decides how much of the conversation so far gets sent with each message. Models are stateless: without this, apps resend the entire chat every turn.',
    defaults: { strategy: 'full', windowTurns: 6 },
    fields: [
      {
        key: 'strategy',
        label: 'Strategy',
        kind: 'select',
        options: [
          { value: 'full', label: 'Full history (resend everything)' },
          { value: 'window', label: 'Sliding window (last N turns)' },
          { value: 'summary', label: 'Rolling summary + last 2 turns' },
          { value: 'retrieval', label: 'Long-term memory (retrieve relevant turns)' },
        ],
        help: 'Full is accurate but grows every turn. Window is cheap but forgets. Summary keeps the gist. Retrieval stores every turn and fetches only what this message needs.',
      },
      {
        key: 'windowTurns',
        label: 'Window size (turns)',
        kind: 'range',
        min: 2,
        max: 30,
        step: 1,
        help: 'Sliding window only: how many recent turns to keep word for word.',
      },
    ],
  },
  eval_harness: {
    type: 'eval_harness',
    name: 'Eval Harness',
    short: 'EV',
    group: 'Quality',
    color: '#65a30d',
    blurb: 'Scores a sample of real answers against known-good answers and the sources (offline test sets plus an LLM judge). It doesn\'t change any answer. It lets you see whether they\'re right.',
    defaults: { sampleRate: 0.05 },
    fields: [
      {
        key: 'sampleRate',
        label: 'Share of traffic judged',
        kind: 'range',
        min: 0.01,
        max: 0.2,
        step: 0.01,
        help: 'Judging more traffic gives a clearer picture but costs more (each judgement is a large-model call).',
      },
    ],
  },
  output_guard: {
    type: 'output_guard',
    name: 'Output Judge',
    short: 'OJ',
    group: 'Safety',
    color: '#ec4899',
    blurb: 'A small model checks the answer against the sources before it ships. Turns many hallucinations into "I don\'t know" — but must wait for the full answer.',
    defaults: {},
    fields: [],
  },
};

export const PALETTE_ORDER: ComponentType[] = [
  'input_guard',
  'semantic_cache',
  'router',
  'memory',
  'embedding',
  'vector_db',
  'keyword_search',
  'reranker',
  'agent',
  'llm',
  'output_guard',
  'eval_harness',
];
