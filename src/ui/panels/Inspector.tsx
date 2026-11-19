import { BookOpen, Trash2 } from 'lucide-react';
import { COMPONENT_TERM, TERM_BY_ID } from '../../content/learn';
import { COMPONENTS, MODEL_SPECS, type ModelSize } from '../../engine/components';
import type { ComponentType, ConfigValue, NodeConfig } from '../../engine/types';
import { WHY } from '../../content/why';
import { KindIcon } from '../canvas/icons';
import { profileOf } from '../../engine/models';
import { Group } from './Group';

export function Inspector({
  id,
  kind,
  config,
  onChange,
  onDelete,
  onLearn,
}: {
  id: string;
  kind: ComponentType;
  config: NodeConfig;
  onChange: (id: string, key: string, v: ConfigValue) => void;
  onDelete: (id: string) => void;
  onLearn: (termId: string) => void;
}) {
  const spec = COMPONENTS[kind];
  const size = config.size as ModelSize | undefined;
  const termId = COMPONENT_TERM[kind];
  return (
    <div className="inspector">
      <div className="inspector-head">
        <KindIcon kind={kind} size="lg" />
        <h2>{spec.name}</h2>
      </div>
      <p className="inspector-blurb">{spec.blurb}</p>
      {termId && (
        <button className="learn-link" onClick={() => onLearn(termId)}>
          <BookOpen size={13} aria-hidden /> {TERM_BY_ID[termId].term}, explained simply
        </button>
      )}
      {spec.fields.length > 0 && (
        <Group title="Settings">
          {spec.fields.map((f) => (
            <label key={f.key} className="field">
              <span className="field-label">
                {f.label}
                {f.kind === 'range' && <output>{String(config[f.key])}</output>}
              </span>
              {f.kind === 'select' && (
                <select value={String(config[f.key])} onChange={(e) => onChange(id, f.key, e.target.value)}>
                  {f.options!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {f.kind === 'range' && (
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={Number(config[f.key])}
                  onChange={(e) => onChange(id, f.key, Number(e.target.value))}
                />
              )}
              {f.kind === 'toggle' && (
                <span className="switch">
                  <input type="checkbox" role="switch" checked={config[f.key] === true} onChange={(e) => onChange(id, f.key, e.target.checked)} />
                  <span className="switch-track" aria-hidden />
                </span>
              )}
              <span className="field-help">{f.help}</span>
            </label>
          ))}
        </Group>
      )}
      {WHY[kind] && (
        <Group title="Why you need it">
          <dl className="why">
            <dt>What it decides</dt>
            <dd>{WHY[kind]!.decides}</dd>
            <dt>Without it</dt>
            <dd>{WHY[kind]!.without}</dd>
            <dt>How you'd notice</dt>
            <dd>{WHY[kind]!.notice}</dd>
          </dl>
        </Group>
      )}
      {kind === 'llm' && size && (
        <Group title="Model card">
          <dl className="spec">
            <dt>Context window</dt>
            <dd>{(MODEL_SPECS[size].context / 1000).toFixed(0)}k tokens</dd>
            <dt>Rate limit</dt>
            <dd>{(MODEL_SPECS[size].tpm / 1_000_000).toFixed(1)}M tokens/min</dd>
            <dt>Input price</dt>
            <dd>${MODEL_SPECS[size].inPerM} / 1M tokens</dd>
            <dt>Output price</dt>
            <dd>${MODEL_SPECS[size].outPerM} / 1M tokens</dd>
          </dl>
        </Group>
      )}
      {kind === 'gpu_llm' &&
        (() => {
          const p = profileOf({ id, type: kind, config });
          const g = p.gpu!;
          return (
            <Group title="Capacity card">
              <dl className="spec">
                <dt>Total throughput</dt>
                <dd>{Math.round(g.capacityTps).toLocaleString()} tokens/s</dd>
                <dt>Speed per request</dt>
                <dd>{Math.round(g.perStreamTps)} tokens/s</dd>
                <dt>Time to write a typical answer</dt>
                <dd>{(220 / g.perStreamTps).toFixed(1)}s</dd>
                <dt>GPU bill</dt>
                <dd>${g.hourly.toFixed(2)} / hour</dd>
              </dl>
            </Group>
          );
        })()}
      {kind !== 'users' && (
        <button className="btn btn-ghost btn-danger btn-block" onClick={() => onDelete(id)}>
          <Trash2 size={14} aria-hidden /> Remove {spec.name}
        </button>
      )}
    </div>
  );
}
