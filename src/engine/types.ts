export type ComponentType =
  | 'users'
  | 'input_guard'
  | 'semantic_cache'
  | 'router'
  | 'embedding'
  | 'vector_db'
  | 'keyword_search'
  | 'reranker'
  | 'agent'
  | 'llm'
  | 'output_guard'
  | 'memory'
  | 'eval_harness'
  | 'gpu_llm'
  | 'fallback'
  | 'agent_team'
  | 'validator'
  | 'batch_queue'
  | 'pii_redactor'
  | 'stt'
  | 'tts'
  | 'user_limits';

export type ConfigValue = number | string | boolean;
export type NodeConfig = Record<string, ConfigValue>;

export interface SimNode {
  id: string;
  type: ComponentType;
  config: NodeConfig;
}

export interface SimEdge {
  source: string;
  target: string;
}

export interface SimGraph {
  nodes: SimNode[];
  edges: SimEdge[];
}

/** Shape of the traffic hitting the system. All shares are 0..1. */
export interface TrafficProfile {
  rps: number;
  /** Questions whose answer lives in your private knowledge base. */
  kbShare: number;
  /** Of the KB questions, how many hinge on exact terms (SKUs, error codes, names). */
  exactTermShare: number;
  /** Requests that need an action/tool (look up an order, issue a refund). */
  toolShare: number;
  /** Prompt-injection / jailbreak attempts. */
  adversarialShare: number;
  /** Easy requests a small model handles fine. */
  easyShare: number;
  /** Near-duplicate questions someone already asked. */
  repeatShare: number;
  /** Chat apps: average number of earlier turns in the conversation (0/undefined = single-shot). */
  chatTurns?: number;
  /** Chat apps: share of messages that depend on something said earlier in the conversation. */
  recallShare?: number;
  /** Real life: answer quality is invisible unless you run evals. */
  qualityHidden?: boolean;
  /** Share of calls each model provider fails (outages, 5xx). */
  providerErrors?: Partial<Record<'A' | 'B', number>>;
  /** Multi-part research tasks that need several lookups (3–6 sub-questions each). */
  complexShare?: number;
  /** Requests whose answer must be valid JSON for your code to use it. */
  structuredShare?: number;
  /** Docs questions about content that changed recently. */
  staleShare?: number;
  /** Docs questions whose answer sits in a table or complex PDF layout. */
  tableShare?: number;
  /** Size of the fixed system prompt sent with every request (default 450). */
  systemPromptTokens?: number;
  /** Background jobs (summarise, tag, extract) that nobody is waiting on. */
  batchShare?: number;
  /** Requests for your own custom task (your labels, your format, your house style). */
  taskShare?: number;
  /** The provider has silently updated the model behind the "latest" alias. */
  driftLatest?: boolean;
  /** Requests that contain personal data (names, emails, health or card details). */
  piiShare?: number;
  /** A voice app: users speak and expect to hear the answer. */
  voice?: boolean;
  /** Share of traffic coming from a handful of abusive / scripted accounts. */
  abuseShare?: number;
}

export type Outcome =
  | 'correct'
  | 'hallucinated'
  | 'declined'
  | 'blocked'
  | 'injected'
  | 'rate_limited'
  | 'overflow'
  | 'failed';

export type Cause =
  | 'no_knowledge'
  | 'retrieval_miss'
  | 'context_noise'
  | 'weak_reasoning'
  | 'no_tools'
  | 'agent_limit'
  | 'agent_loop'
  | 'rate_limit'
  | 'context_overflow'
  | 'injection'
  | 'cache_false_hit'
  | 'guard_false_positive'
  | 'forgot_context'
  | 'provider_down'
  | 'gpu_saturated'
  | 'handoff_loss'
  | 'invalid_output'
  | 'stale_index'
  | 'parse_miss'
  | 'task_unknown'
  | 'model_drift'
  | 'voice_pipeline';

export type StepTone = 'ok' | 'bad' | 'warn' | 'neutral';

export interface TraceStep {
  nodeId?: string;
  kind: ComponentType;
  text: string;
  ms?: number;
  tone?: StepTone;
}

export interface RequestSample {
  id: number;
  question: string;
  kind: 'knowledge' | 'exact' | 'tool' | 'attack' | 'general' | 'memory' | 'research';
  outcome: Outcome;
  cause?: Cause;
  latency: number;
  cost: number;
  steps: TraceStep[];
}

export type NodeStatus = 'idle' | 'ok' | 'warn' | 'hot';

export interface NodeStat {
  rps: number;
  status: NodeStatus;
  label: string;
}

export interface Metrics {
  offered: number;
  served: number;
  /** 429s + context overflows, as a share of offered. */
  errorRate: number;
  /** Correct answers among legit (non-adversarial) requests that got a response. */
  accuracy: number;
  /** Confidently wrong answers among legit answered requests. */
  hallucination: number;
  /** Successful injections among adversarial requests. */
  injection: number;
  /** Retrieval recall for KB questions (null if no KB traffic). */
  recall: number | null;
  p50: number;
  p99: number;
  /** Time to first visible token, p50 (ms). */
  ttftP50: number;
  costPer1k: number;
  outcomes: Record<Outcome, number>;
  causes: Partial<Record<Cause, number>>;
  costByNode: Record<string, number>;
  nodeStats: Record<string, NodeStat>;
  warnings: string[];
  activeNodeIds: string[];
  /** Average conversation-history tokens sent per model call. */
  avgHistoryTokens: number;
  /** False when quality can't be observed (no evals in a scenario that hides quality). */
  qualityVisible: boolean;
  /** Highest utilisation across self-hosted GPU pools (null if none). */
  gpuUtil: number | null;
  /** True when multi-part research runs through a single agent (no team). */
  singleAgentResearch: boolean;
  /** True when multi-part research runs through an Agent Team. */
  teamResearch: boolean;
  /** Background jobs are running through the real-time API. */
  offlineInRealtime: boolean;
  /** A big fixed system prompt is being paid for in full on every call. */
  bigUncachedPrompt: boolean;
  /** Share of requests with personal data that reached a third-party model unredacted. */
  piiLeak: number;
  /** Abusive accounts are running unchecked. */
  abuseUnchecked: boolean;
  /** No path from Users to any model: nothing can be answered. */
  noModel: boolean;
  /** Real (non-attack, non-abuse) user requests that got an answer. Quality is unmeasurable when this is 0. */
  answered: number;
  /** A voice app: first-token time is time to first audio. */
  voice: boolean;
  /** A handful of individual requests from this tick, failures first. */
  samples: RequestSample[];
}

export type GoalMetric =
  | 'piiLeak'
  | 'accuracy'
  | 'hallucination'
  | 'injection'
  | 'errorRate'
  | 'costPer1k'
  | 'p50'
  | 'ttftP50';

export interface Goal {
  metric: GoalMetric;
  op: '>=' | '<=';
  value: number;
}
