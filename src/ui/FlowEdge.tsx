import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';

export type FlowEdgeData = { live?: boolean; rate?: number };
export type FlowEdgeType = Edge<FlowEdgeData, 'flow'>;

/** Bezier edge; while traffic flows, small packets travel along it. */
export function FlowEdge(props: EdgeProps<FlowEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd } = props;
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 });
  const live = !!data?.live;
  const dur = Math.max(0.9, 2.4 - Math.log10(1 + (data?.rate ?? 1)) * 0.8);
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={`flow-edge${live ? ' is-live' : ''}${selected ? ' is-selected' : ''}`} />
      {live &&
        [0, 1, 2].map((i) => (
          <circle key={i} r={2.3} className="flow-packet">
            <animateMotion dur={`${dur}s`} begin={`${(i * dur) / 3}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
    </>
  );
}
