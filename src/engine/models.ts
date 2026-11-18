import { MODEL_SPECS, type ModelSize } from './components';
import type { SimNode } from './types';

/** Where a model runs: provider A, provider B, or your own GPUs. */
export type Host = 'A' | 'B' | 'self';

export const OPEN_MODELS = {
  'open-8b': { label: 'Open 8B', streamTps: 120, accEasy: 0.94, accHard: 0.6, hallucinateWhenUnsure: 0.9, injectable: 0.62, context: 32_000 },
  'open-70b': { label: 'Open 70B', streamTps: 38, accEasy: 0.97, accHard: 0.84, hallucinateWhenUnsure: 0.78, injectable: 0.45, context: 128_000 },
} as const;
export type OpenModel = keyof typeof OPEN_MODELS;

export const QUANT = {
  fp16: { label: 'FP16 (full precision)', speed: 1, acc: 1 },
  int8: { label: 'INT8 (half the memory)', speed: 1.5, acc: 0.99 },
  int4: { label: 'INT4 (quarter the memory)', speed: 2.1, acc: 0.95 },
} as const;
export type Quant = keyof typeof QUANT;

/** Rental price of one inference GPU, per hour. */
export const GPU_HOURLY = 2.4;
/** Prompt tokens a GPU can prefill per second (reading is much faster than writing). */
const PREFILL_TPS = 6000;

export interface ModelProfile {
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
}

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
    };
  }
  const size = str<ModelSize>(n, 'size', 'medium');
  const s = MODEL_SPECS[size] ?? MODEL_SPECS.medium;
  return {
    host: str<'A' | 'B'>(n, 'provider', 'A'),
    label: size,
    rank: s.accHard,
    ttftBase: s.ttftBase,
    prefillMsPerTok: s.prefillMsPerTok,
    msPerOutTok: s.msPerOutTok,
    inPerM: s.inPerM,
    outPerM: s.outPerM,
    context: s.context,
    tpm: s.tpm,
    accEasy: s.accEasy,
    accHard: s.accHard,
    hallucinateWhenUnsure: s.hallucinateWhenUnsure,
    injectable: s.injectable,
  };
}

export const hostLabel = (h: Host) => (h === 'self' ? 'your GPUs' : `provider ${h}`);
