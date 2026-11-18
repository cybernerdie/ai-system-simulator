import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { COMPONENTS } from '../engine/components';
import type { ComponentType, NodeConfig, NodeStat } from '../engine/types';
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
        ...(config.thinking && config.thinking !== 'off' ? [`thinking: ${config.thinking}`] : []),
        ...(config.provider === 'B' ? ['provider B'] : []),
        ...(config.streaming ? ['streaming'] : []),
        ...(config.jsonMode ? ['JSON mode'] : []),
        ...(config.promptCache ? ['cached prompt'] : []),
      ];
    case 'gpu_llm':
      return [String(config.model).replace('open-', '').toUpperCase(), `${config.gpus} GPU${Number(config.gpus) > 1 ? 's' : ''}`, `batch ${config.batch}`, String(config.quant).toUpperCase()];
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
      return [`≤ ${config.maxSteps} steps`];
    case 'semantic_cache':
      return [`≥ ${Number(config.threshold).toFixed(2)} sim`];
    case 'memory':
      return [
        { full: 'full history', window: `last ${config.windowTurns} turns`, summary: 'rolling summary', retrieval: 'long-term memory' }[String(config.strategy)] ?? '',
      ];
    case 'input_guard':
      return [`strict ${Number(config.strictness).toFixed(2)}`];
    default:
      return [];
  }
}

export function SimNodeView({ data, selected }: NodeProps<SimFlowNode>) {
  const spec = COMPONENTS[data.kind];
  const status = data.running ? data.stat?.status ?? 'idle' : 'idle';
  const tags = chips(data.kind, data.config);
  return (
    <div className={`simnode status-${status}${selected ? ' is-selected' : ''}`}>
      {data.kind !== 'users' && <Handle type="target" position={Position.Left} />}
      <div className="simnode-head">
        <KindIcon kind={data.kind} />
        <span className="simnode-name">{spec.name}</span>
      </div>
      {tags.length > 0 && (
        <div className="simnode-chips">
          {tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="simnode-stat">
        <span className="dot" />
        <span>{data.running ? data.stat?.label ?? 'idle' : 'idle'}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
