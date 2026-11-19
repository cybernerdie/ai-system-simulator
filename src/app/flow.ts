/** Mapping between designs (what the engine and links understand) and React Flow nodes and edges. */
import { MarkerType } from '@xyflow/react';
import { withDefaults, type Scenario } from '../engine/levels/scenarios';
import type { SimGraph } from '../engine/types';
import type { SharedDesign } from '../lib/designLink';
import type { SimFlowNode } from '../ui/canvas/SimNodeView';
import type { FlowEdgeType } from '../ui/canvas/FlowEdge';

export interface Flow {
  nodes: SimFlowNode[];
  edges: FlowEdgeType[];
}

const COLUMN = 270;

export function edgeOf(source: string, target: string): FlowEdgeType {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'flow',
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#a1a1aa' },
  };
}

/** Turn source→target pairs back into edges, keeping the existing edge objects where they survive. */
export function reuseEdges(pairs: { source: string; target: string }[], existing: FlowEdgeType[]): FlowEdgeType[] {
  return pairs.map((p) => existing.find((e) => e.source === p.source && e.target === p.target) ?? edgeOf(p.source, p.target));
}

/** A level's starting design. Levels are authored on a loose grid, so columns are snapped to stop cards overlapping. */
export function buildFlow(s: Scenario): Flow {
  const cols = [...new Set(s.nodes.map((n) => n.x))].sort((a, b) => a - b);
  return {
    nodes: s.nodes.map(withDefaults).map((n) => ({
      id: n.id,
      type: 'sim',
      position: { x: cols.indexOf(n.x) * COLUMN, y: n.y * 1.1 },
      deletable: n.type !== 'users',
      data: { kind: n.type, config: n.config! },
    })),
    edges: s.edges.map((e) => edgeOf(e.source, e.target)),
  };
}

export function designToFlow(d: SharedDesign): Flow {
  return {
    nodes: d.nodes.map((n) => ({
      id: n.id,
      type: 'sim' as const,
      position: { x: n.x, y: n.y },
      deletable: n.type !== 'users',
      data: { kind: n.type, config: n.config },
    })),
    edges: d.edges.map((e) => edgeOf(e.source, e.target)),
  };
}

export function packDesign(scenarioId: string, nodes: SimFlowNode[], edges: FlowEdgeType[]): SharedDesign {
  return {
    scenarioId,
    nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, x: n.position.x, y: n.position.y, config: n.data.config })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
  };
}

export function flowGraph(nodes: SimFlowNode[], edges: FlowEdgeType[]): SimGraph {
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, config: n.data.config })),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
  };
}

export function designGraph(d: SharedDesign): SimGraph {
  return {
    nodes: d.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config })),
    edges: d.edges.map((e) => ({ source: e.source, target: e.target })),
  };
}

/** What the design *is*, ignoring where cards sit: changes to this restart the goal countdown and the hint timer. */
export function designSignature(graph: SimGraph): string {
  return JSON.stringify([graph.nodes.map((n) => [n.type, n.config]), graph.edges.map((e) => [e.source, e.target])]);
}
