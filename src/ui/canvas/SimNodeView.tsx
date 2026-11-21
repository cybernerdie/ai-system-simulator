import { useContext } from 'react';
import { PortraitContext } from './portrait';
import { Handle, Position, useViewportStore, type Node, type NodeProps } from '@xyflow/react';
import { COMPONENTS } from '../../engine/components';
import type { ComponentType, NodeConfig, NodeStat } from '../../engine/types';
import type { ZoneKey } from './zones';
import { KindIcon } from './icons';

export type SimNodeData = {
  kind: ComponentType;
  config: NodeConfig;
  stat?: NodeStat;
  running?: boolean;
};
export type SimFlowNode = Node<SimNodeData, 'sim'>;

function chips(kind: ComponentType, config: NodeConfig): string[] {
  switch (kind) {
    case 'llm':
      return [
        String(config.size),
        `temp ${Number(config.temperature ?? 0.7).toFixed(1)}`,
        ...(config.thinking && config.thinking !== 'off' ? [`thinking: ${config.thinking}`] : []),
        ...(config.provider === 'B' ? ['provider B'] : []),
        ...(config.streaming ? ['streaming'] : []),
        ...(config.jsonMode ? ['JSON mode'] : []),
        ...(config.promptCache ? ['cached prompt'] : []),
        ...(config.fineTuned ? ['fine-tuned'] : []),
        ...(config.version === 'latest' ? ['latest (unpinned)'] : []),
      ];
    case 'gpu_llm':
      return [
        String(config.model).replace('open-', '').toUpperCase(),
        `${config.gpus} GPU${Number(config.gpus) > 1 ? 's' : ''}`,
        `batch ${config.batch}`,
        String(config.quant).toUpperCase(),
      ];
    case 'agent_team':
      return [`${config.workers} worker${Number(config.workers) > 1 ? 's' : ''}`, ...(config.reviewer ? ['reviewer'] : []), `≤ ${config.maxRounds} rounds`];
    case 'fallback':
      return [`${config.retries} retr${Number(config.retries) === 1 ? 'y' : 'ies'}`, config.failover ? 'failover on' : 'no failover'];
    case 'vector_db':
      return [
        `top-${config.topK}`,
        `${config.chunk} chunks`,
        ...(config.refresh && config.refresh !== 'weekly' ? [`${{ manual: 'manual', daily: 'nightly', live: 'live' }[String(config.refresh)] ?? config.refresh} re-index`] : []),
        ...(config.parser === 'layout' ? ['layout-aware'] : []),
      ];
    case 'reranker':
      return [`keep ${config.keep}`];
    case 'agent':
      return [`≤ ${config.maxSteps} steps`, { read: 'read only', write: 'can change records', send: 'can send' }[String(config.permissions ?? 'send')] ?? ''];
    case 'semantic_cache':
      return [`≥ ${Number(config.threshold).toFixed(2)} sim`];
    case 'memory':
      return [{ full: 'full history', window: `last ${config.windowTurns} turns`, summary: 'rolling summary', retrieval: 'long-term memory' }[String(config.strategy)] ?? ''];
    case 'eval_harness':
      return [
        config.testSet === 'easy' ? '50 launch examples' : 'real traffic',
        { calibrated: 'judge checked by humans', llm: 'LLM judge only', exact: 'exact match' }[String(config.judge ?? 'calibrated')] ?? '',
      ];
    case 'stt':
    case 'tts':
      return [config.streaming ? 'streaming' : 'waits for the whole thing'];
    case 'user_limits':
      return [`${config.perUserRpm} req/min per user`];
    case 'tracing':
      return [
        { '1': '1% sampled', '10': '10% sampled', errors: 'failures + 5%', all: 'every request' }[String(config.sampling)] ?? '',
        config.capturePrompts ? 'with prompts' : 'timings only',
      ];
    case 'embedding':
      return config.multilingual ? ['multilingual'] : [];
    case 'input_guard':
      return [`strict ${Number(config.strictness).toFixed(2)}`];
    case 'batch_queue':
      // drawn in the path, so say plainly that live requests don't wait in it
      return ['only work that can wait', 'live chats pass straight through'];
    default:
      return [];
  }
}

/** Below this zoom, card text would be too small to read. */
const FAR_ZOOM = 0.85;

/** How much to enlarge text at the current zoom: 1 when it's readable as is, up to 2.6 when zoomed far out. */
const useFar = () => useViewportStore((st) => Math.round(Math.min(2.6, Math.max(1, FAR_ZOOM / st.transform[2])) * 10) / 10);

export function SimNodeView({ data, selected }: NodeProps<SimFlowNode>) {
  const portrait = useContext(PortraitContext);
  const spec = COMPONENTS[data.kind];
  const status = data.running ? (data.stat?.status ?? 'idle') : 'idle';
  const tags = chips(data.kind, data.config);
  // zoomed far out (a busy design fitted to the screen), names and status grow so they stay readable
  // and the detail chips step aside; rounded so panning doesn't re-render every node every frame
  const far = useFar();
  return (
    <div className={`simnode status-${status}${selected ? ' is-selected' : ''}${far > 1 ? ' is-far' : ''}`} style={far > 1 ? ({ '--far': far } as React.CSSProperties) : undefined}>
      {data.kind !== 'users' && <Handle type="target" position={portrait ? Position.Top : Position.Left} />}
      <div className="simnode-head">
        <KindIcon kind={data.kind} />
        <span className="simnode-name">{spec.name}</span>
      </div>
      {tags.length > 0 && far === 1 && (
        <div className="simnode-chips">
          {tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="simnode-stat">
        <span className="dot" />
        <span>{data.running ? (data.stat?.label ?? 'idle') : 'idle'}</span>
      </div>
      <Handle type="source" position={portrait ? Position.Bottom : Position.Right} />
    </div>
  );
}

export type ZoneFlowNode = Node<{ zone: ZoneKey; label: string }, 'zone'>;

export function ZoneView({ data }: NodeProps<ZoneFlowNode>) {
  const far = useFar();
  return (
    <div className={`zone zone-${data.zone}${far > 1 ? ' is-far' : ''}`} style={far > 1 ? ({ '--far': far } as React.CSSProperties) : undefined} aria-hidden>
      <span className="zone-label">{data.label}</span>
    </div>
  );
}
