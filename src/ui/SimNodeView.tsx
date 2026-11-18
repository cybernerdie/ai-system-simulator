import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { COMPONENTS } from '../engine/components';
import type { ComponentType, NodeConfig, NodeStat } from '../engine/types';

export type SimNodeData = {
  kind: ComponentType;
  config: NodeConfig;
  stat?: NodeStat;
  running?: boolean;
};
export type SimFlowNode = Node<SimNodeData, 'sim'>;

function subtitle(kind: ComponentType, config: NodeConfig) {
  switch (kind) {
    case 'llm':
      return `${config.size}${config.streaming ? ' · streaming' : ''}`;
    case 'vector_db':
      return `top-${config.topK} · ${config.chunk} chunks`;
    case 'reranker':
      return `keep ${config.keep}`;
    case 'agent':
      return `max ${config.maxSteps} steps`;
    case 'semantic_cache':
      return `threshold ${Number(config.threshold).toFixed(2)}`;
    case 'input_guard':
      return `strictness ${Number(config.strictness).toFixed(2)}`;
    default:
      return '';
  }
}

export function SimNodeView({ data, selected }: NodeProps<SimFlowNode>) {
  const spec = COMPONENTS[data.kind];
  const status = data.running ? data.stat?.status ?? 'idle' : 'idle';
  const sub = subtitle(data.kind, data.config);
  return (
    <div className={`simnode status-${status}${selected ? ' is-selected' : ''}`} style={{ ['--kind' as string]: spec.color }}>
      {data.kind !== 'users' && <Handle type="target" position={Position.Left} />}
      <div className="simnode-badge">{spec.short}</div>
      <div className="simnode-body">
        <div className="simnode-name">{spec.name}</div>
        {sub && <div className="simnode-sub">{sub}</div>}
        <div className="simnode-stat">
          <span className="dot" />
          {data.running ? data.stat?.label ?? 'idle' : 'idle'}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
