import type { ComponentType } from '../../engine/types';
import type { SimFlowNode, ZoneFlowNode } from './SimNodeView';

export type ZoneKey = 'entry' | 'guard' | 'context' | 'model' | 'check' | 'output' | 'observe';

export const ZONE_OF: Partial<Record<ComponentType, ZoneKey>> = {
  auth: 'entry',
  user_limits: 'entry',
  stt: 'entry',
  pii_redactor: 'guard',
  input_guard: 'guard',
  content_sanitizer: 'guard',
  semantic_cache: 'context',
  memory: 'context',
  embedding: 'context',
  vector_db: 'context',
  keyword_search: 'context',
  reranker: 'context',
  router: 'model',
  fallback: 'model',
  batch_queue: 'model',
  agent: 'model',
  agent_team: 'model',
  llm: 'model',
  gpu_llm: 'model',
  validator: 'check',
  output_guard: 'check',
  action_approval: 'check',
  tts: 'output',
  eval_harness: 'observe',
  tracing: 'observe',
  fairness_eval: 'observe',
};

export const ZONE_LABEL: Record<ZoneKey, string> = {
  entry: 'Entry',
  guard: 'Safety, before the model',
  context: 'Retrieval and memory',
  model: 'Model',
  check: 'Safety, after the model',
  output: 'Output',
  observe: 'Measure and observe',
};

const CARD = { width: 230, height: 110 };
const PAD = { x: 16, top: 38, bottom: 16 };

/** Labelled bands drawn behind the components, one per group (entry, safety, retrieval, model...). */
export function zoneNodes(nodes: SimFlowNode[]): ZoneFlowNode[] {
  const boxes = new Map<ZoneKey, { x0: number; y0: number; x1: number; y1: number }>();
  for (const n of nodes) {
    const zone = ZONE_OF[n.data.kind];
    if (!zone) continue;
    const x0 = n.position.x;
    const y0 = n.position.y;
    const x1 = x0 + (n.measured?.width ?? CARD.width);
    const y1 = y0 + (n.measured?.height ?? CARD.height);
    const b = boxes.get(zone);
    boxes.set(zone, b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });
  }
  return [...boxes].map(([zone, b]) => ({
    id: `zone-${zone}`,
    type: 'zone' as const,
    position: { x: b.x0 - PAD.x, y: b.y0 - PAD.top },
    style: { width: b.x1 - b.x0 + PAD.x * 2, height: b.y1 - b.y0 + PAD.top + PAD.bottom },
    data: { zone, label: ZONE_LABEL[zone] },
    selectable: false,
    draggable: false,
    deletable: false,
    focusable: false,
    connectable: false,
    zIndex: -1,
  }));
}

export const isZoneId = (id: string) => id.startsWith('zone-');
