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
  | 'content_sanitizer'
  | 'action_approval'
  | 'stt'
  | 'tts'
  | 'user_limits'
  | 'auth'
  | 'tracing'
  | 'fairness_eval';

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
  /**
   * What this level's requests say, by kind, when it isn't the store most levels are set in (a legal
   * team, a bank, a homework helper). Only the wording: the mix of kinds comes from the shares below.
   */
  questions?: Partial<Record<RequestSample['kind'], string[]>>;
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
  /**
   * An outage on whichever provider the design calls first, at this failure rate. You can't know in advance
   * which provider will go down, so moving everything to another one isn't resilience; a backup is.
   */
  outage?: number;
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
  /** Share of requests that pull exact values out of a document (invoice totals, dates, IDs). Needs one right answer, every time. */
  extractShare?: number;
  /** Share of requests that are open-ended writing (descriptions, ideas), where variety matters. */
  creativeShare?: number;
  /** Share of requests whose content (a retrieved doc, an email, a tool result) hides instructions planted by an attacker. */
  poisonShare?: number;
  /** Share of tool requests that end in sending something outside (an email, a message, a payment). */
  sendShare?: number;
  /** Share of traffic from callers with no valid credentials (a leaked key, scrapers rotating accounts). */
  unauthShare?: number;
  /** Share of real users in a group the system serves worse (here: people writing in another language). */
  cohortShare?: number;
  /** The gap between groups is invisible unless something measures it per group. */
  cohortHidden?: boolean;
}

export type Outcome = 'correct' | 'hallucinated' | 'declined' | 'blocked' | 'injected' | 'rate_limited' | 'overflow' | 'failed' | 'unhelpful';

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
  | 'voice_pipeline'
  | 'sampling_noise'
  | 'too_repetitive'
  | 'indirect_injection'
  | 'no_permission'
  | 'language_gap';

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
  kind: 'knowledge' | 'exact' | 'tool' | 'attack' | 'general' | 'memory' | 'research' | 'extract' | 'creative';
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
  /** Share of real requests where hidden instructions made the system take a harmful action (send, change, leak). */
  harmfulActions: number;
  /** Requests whose content carried hidden instructions that the model followed (any impact). */
  indirectFollowed: number;
  /** What your Eval Harness reports (equals the real value when the evals are trustworthy). */
  measuredAccuracy: number;
  measuredHallucination: number;
  /** How far the evals' accuracy is from reality, in absolute terms (0 without an Eval Harness). */
  evalGap: number;
  /** Present when an Eval Harness is in the design. */
  evalSetup: { testSet: 'representative' | 'easy'; judge: 'calibrated' | 'llm' | 'exact' } | null;
  /** Abusive accounts are running unchecked. */
  abuseUnchecked: boolean;
  /** How long it takes to find the cause of a reported bad answer (hours). Without traces you're guessing. */
  diagnoseHours: number;
  /** Accuracy for most users minus accuracy for the underserved group (0 = equal). */
  fairnessGap: number;
  /** False when nothing measures quality per group. */
  fairnessVisible: boolean;
  /** Callers without credentials are reaching the model. */
  unauthUnchecked: boolean;
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
  'diagnoseHours' | 'fairnessGap' | 'piiLeak' | 'evalGap' | 'harmfulActions' | 'accuracy' | 'hallucination' | 'injection' | 'errorRate' | 'costPer1k' | 'p50' | 'ttftP50';

export interface Goal {
  metric: GoalMetric;
  op: '>=' | '<=';
  value: number;
}
