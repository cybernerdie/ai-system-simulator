import { MODEL_SPECS, type ModelSize } from './components';
import type { SimNode } from './types';

/** Where a model runs: provider A, provider B, or your own GPUs. */
export type Host = 'A' | 'B' | 'self';

const OPEN_MODELS = {
  'open-8b': { label: 'Open 8B', streamTps: 120, accEasy: 0.94, accHard: 0.6, hallucinateWhenUnsure: 0.9, injectable: 0.62, context: 32_000 },
  'open-70b': { label: 'Open 70B', streamTps: 38, accEasy: 0.97, accHard: 0.84, hallucinateWhenUnsure: 0.78, injectable: 0.45, context: 128_000 },
} as const;
export type OpenModel = keyof typeof OPEN_MODELS;

const QUANT = {
  fp16: { label: 'FP16 (full precision)', speed: 1, acc: 1 },
  int8: { label: 'INT8 (half the memory)', speed: 1.5, acc: 0.99 },
  int4: { label: 'INT4 (quarter the memory)', speed: 2.1, acc: 0.95 },
} as const;
export type Quant = keyof typeof QUANT;

/** Rental price of one inference GPU, per hour. */
const GPU_HOURLY = 2.4;
/** Prompt tokens a GPU can prefill per second (reading is much faster than writing). */
const PREFILL_TPS = 6000;

export interface ModelProfile {
  /** Sampling temperature: 0 = always the most likely token, 1 = lots of variety. */
  temperature: number;
  host: Host;
  label: string;
  /** For ordering models by capability (router picks cheapest vs strongest). */
  rank: number;
  ttftBase: number;
  prefillMsPerTok: number;
  msPerOutTok: number;
  inPerM: number;
  outPerM: number;
  context: number;
  /** Tokens per minute the provider allows; Infinity for your own GPUs. */
  tpm: number;
  accEasy: number;
  accHard: number;
  hallucinateWhenUnsure: number;
  injectable: number;
  gpu?: { gpus: number; batch: number; perStreamTps: number; capacityTps: number; hourly: number };
  /** Hidden reasoning tokens written before the visible answer. */
  thinkTokens: number;
  /** Chance an answer that must be JSON comes back malformed. */
  invalidRate: number;
  /** Reuses the cached start of the prompt across requests. */
  promptCache: boolean;
  /** Accuracy on your own custom task (labels, format, house style). */
  taskAcc: number;
  fineTuned: boolean;
  /** Following the auto-updating "latest" alias rather than a pinned version. */
  floating: boolean;
}

const TASK_ACC: Record<string, number> = { small: 0.55, medium: 0.7, large: 0.8, 'open-8b': 0.52, 'open-70b': 0.72 };
const TASK_ACC_TUNED: Record<string, number> = { small: 0.94, medium: 0.95, large: 0.96, 'open-8b': 0.93, 'open-70b': 0.95 };

const THINKING = {
  off: { label: 'Off', tokens: 0, hardGap: 0, easyGap: 0 },
  low: { label: 'Low budget (~500 tokens)', tokens: 500, hardGap: 0.5, easyGap: 0.3 },
  high: { label: 'High budget (~2,000 tokens)', tokens: 2000, hardGap: 0.7, easyGap: 0.5 },
} as const;
export type Thinking = keyof typeof THINKING;
const INVALID_JSON: Record<string, number> = { small: 0.14, medium: 0.07, large: 0.035, 'open-8b': 0.15, 'open-70b': 0.06 };

const num = (n: SimNode, k: string, d: number) => (typeof n.config[k] === 'number' ? (n.config[k] as number) : d);
const str = <T extends string>(n: SimNode, k: string, d: T) => (typeof n.config[k] === 'string' ? (n.config[k] as T) : d);

export function isModelNode(n: SimNode) {
  return n.type === 'llm' || n.type === 'gpu_llm';
}

export function profileOf(n: SimNode): ModelProfile {
  if (n.type === 'gpu_llm') {
    const model = OPEN_MODELS[str<OpenModel>(n, 'model', 'open-70b')] ?? OPEN_MODELS['open-70b'];
    const q = QUANT[str<Quant>(n, 'quant', 'fp16')] ?? QUANT.fp16;
    const gpus = Math.max(1, Math.round(num(n, 'gpus', 4)));
    const batch = Math.max(1, Math.round(num(n, 'batch', 8)));
    // Batching shares each GPU between requests: more total throughput, slower per request.
    const perStreamTps = (model.streamTps * q.speed) / (1 + 0.015 * (batch - 1));
    const capacityTps = perStreamTps * batch * gpus;
    return {
      host: 'self',
      label: `${model.label} ${str<Quant>(n, 'quant', 'fp16').toUpperCase()}`,
      rank: model.accHard * q.acc,
      ttftBase: 120,
      prefillMsPerTok: 1000 / (PREFILL_TPS * q.speed),
      msPerOutTok: 1000 / perStreamTps,
      inPerM: 0,
      outPerM: 0,
      context: model.context,
      tpm: Infinity,
      accEasy: model.accEasy * q.acc,
      accHard: model.accHard * q.acc,
      hallucinateWhenUnsure: model.hallucinateWhenUnsure,
      injectable: model.injectable,
      gpu: { gpus, batch, perStreamTps, capacityTps, hourly: GPU_HOURLY * gpus },
      thinkTokens: 0,
      invalidRate: n.config.jsonMode === true ? 0.004 : (INVALID_JSON[str(n, 'model', 'open-70b')] ?? 0.08),
      promptCache: true, // self-hosted servers reuse cached prefixes automatically
      fineTuned: n.config.fineTuned === true,
      taskAcc: (n.config.fineTuned === true ? TASK_ACC_TUNED : TASK_ACC)[str(n, 'model', 'open-70b')] ?? 0.7,
      floating: false, // you control the weights: nothing changes unless you change it
      temperature: num(n, 'temperature', 0.7),
    };
  }
  const size = str<ModelSize>(n, 'size', 'medium');
  const s = MODEL_SPECS[size] ?? MODEL_SPECS.medium;
  const th = THINKING[str<Thinking>(n, 'thinking', 'off')] ?? THINKING.off;
  const accHard = s.accHard + (1 - s.accHard) * th.hardGap;
  const accEasy = s.accEasy + (1 - s.accEasy) * th.easyGap;
  return {
    host: str<'A' | 'B'>(n, 'provider', 'A'),
    label: `${size}${n.config.fineTuned === true ? ' (fine-tuned)' : ''}${th.tokens ? ' + thinking' : ''}`,
    rank: accHard,
    thinkTokens: th.tokens,
    invalidRate: n.config.jsonMode === true ? 0.004 : (INVALID_JSON[size] ?? 0.08),
    promptCache: n.config.promptCache === true,
    fineTuned: n.config.fineTuned === true,
    taskAcc: (n.config.fineTuned === true ? TASK_ACC_TUNED : TASK_ACC)[size] ?? 0.7,
    floating: str<string>(n, 'version', 'pinned') === 'latest',
    temperature: num(n, 'temperature', 0.7),
    ttftBase: s.ttftBase,
    prefillMsPerTok: s.prefillMsPerTok,
    msPerOutTok: s.msPerOutTok,
    inPerM: s.inPerM * (n.config.fineTuned === true ? 1.5 : 1),
    outPerM: s.outPerM * (n.config.fineTuned === true ? 1.5 : 1),
    context: s.context,
    tpm: s.tpm,
    accEasy,
    accHard,
    hallucinateWhenUnsure: s.hallucinateWhenUnsure,
    injectable: s.injectable * (th.tokens ? 0.8 : 1),
  };
}

export const hostLabel = (h: Host) => (h === 'self' ? 'your GPUs' : `provider ${h}`);

/** Higher temperature makes malformed JSON more likely; 1.0 at the 0.7 default. */
export const tempJsonFactor = (t: number) => 0.4 + (t * 6) / 7;
/** Chance an exact-value extraction comes out different (wrong) because of sampling. */
export const samplingNoise = (t: number, size?: string) => Math.pow(Math.max(0, t), 1.5) * 0.35 * (size === 'large' ? 0.85 : 1);
/** Chance open-ended writing comes out flat and repetitive because the temperature is too low. */
export const repetition = (t: number) => Math.max(0, 0.3 - t) * 1.5;
