import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';

export type FlowEdgeData = { live?: boolean; rate?: number; /** this edge is hop `index` of `count` on a request you're following */ trace?: { index: number; count: number } };
export type FlowEdgeType = Edge<FlowEdgeData, 'flow'>;

/** Bezier edge; while traffic flows, small packets travel along it. */
export function FlowEdge(props: EdgeProps<FlowEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd } = props;
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  const live = !!data?.live;
  const dur = Math.max(0.9, 2.4 - Math.log10(1 + (data?.rate ?? 1)) * 0.8);
  const tr = data?.trace;
  // following one request: a single dot crosses each hop in turn, then the trip repeats
  const HOP = 0.75;
  const total = tr ? tr.count * HOP + 0.8 : 0;
  const a = tr ? (tr.index * HOP) / total : 0;
  const b = tr ? ((tr.index + 1) * HOP) / total : 0;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={`flow-edge${live ? ' is-live' : ''}${selected ? ' is-selected' : ''}`} />
      {live &&
        [0, 1, 2].map((i) => (
          <circle key={i} r={2.3} className="flow-packet">
            <animateMotion dur={`${dur}s`} begin={`${(i * dur) / 3}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
      {tr && (
        <circle r={5} className="trace-dot" opacity={0}>
          <animateMotion dur={`${total}s`} repeatCount="indefinite" path={path} keyPoints="0;0;1;1" keyTimes={`0;${a.toFixed(4)};${b.toFixed(4)};1`} calcMode="linear" />
          <animate attributeName="opacity" dur={`${total}s`} repeatCount="indefinite" values="0;1;0" keyTimes={`0;${a.toFixed(4)};${b.toFixed(4)}`} calcMode="discrete" />
        </circle>
      )}
    </>
  );
}
