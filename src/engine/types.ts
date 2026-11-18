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
  | 'eval_harness';

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
}

export type Outcome =
  | 'correct'
  | 'hallucinated'
  | 'declined'
  | 'blocked'
  | 'injected'
  | 'rate_limited'
  | 'overflow';

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
  | 'forgot_context';

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
  kind: 'knowledge' | 'exact' | 'tool' | 'attack' | 'general' | 'memory';
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
  /** A handful of individual requests from this tick, failures first. */
  samples: RequestSample[];
}

export type GoalMetric =
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
