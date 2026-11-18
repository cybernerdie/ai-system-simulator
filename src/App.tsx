import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from '@xyflow/react';
import { COMPONENTS } from './engine/components';
import { simulate } from './engine/simulate';
import { bindingPressure, goalMet, type Pressure } from './engine/pressures';
import { SANDBOX, SCENARIOS, withDefaults, type Scenario } from './engine/scenarios';
import type { ComponentType, ConfigValue, Metrics, SimGraph } from './engine/types';
import { SimNodeView, type SimFlowNode } from './ui/SimNodeView';
import { Inspector, IntroDialog, MetricsBar, Palette, PressureCard, ScenarioBrief, WinDialog } from './ui/Panels';

const ALL = [...SCENARIOS, SANDBOX];
const TICK_MS = 700;
const HOLD_TICKS = 5;
const nodeTypes = { sim: SimNodeView };

function buildFlow(s: Scenario): { nodes: SimFlowNode[]; edges: Edge[] } {
  return {
    nodes: s.nodes.map(withDefaults).map((n) => ({
      id: n.id,
      type: 'sim',
      position: { x: n.x, y: n.y },
      deletable: n.type !== 'users',
      data: { kind: n.type, config: n.config! },
    })),
    edges: s.edges.map((e) => edgeOf(e.source, e.target)),
  };
}

function edgeOf(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } };
}

/** Exponential smoothing so the numbers settle instead of flickering. */
function smooth(prev: Metrics | null, next: Metrics, a = 0.35): Metrics {
  if (!prev) return next;
  const mix = (p: number, n: number) => p + (n - p) * a;
  return {
    ...next,
    accuracy: mix(prev.accuracy, next.accuracy),
    hallucination: mix(prev.hallucination, next.hallucination),
    injection: mix(prev.injection, next.injection),
    errorRate: mix(prev.errorRate, next.errorRate),
    costPer1k: mix(prev.costPer1k, next.costPer1k),
    p50: mix(prev.p50, next.p50),
    p99: mix(prev.p99, next.p99),
    ttftP50: mix(prev.ttftP50, next.ttftP50),
    recall: next.recall == null || prev.recall == null ? next.recall : mix(prev.recall, next.recall),
  };
}

export default function App() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = ALL.find((s) => s.id === scenarioId)!;
  const initial = useMemo(() => buildFlow(SCENARIOS[0]), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<SimFlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [running, setRunning] = useState(false);
  const [rps, setRps] = useState(scenario.traffic.rps);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pressure, setPressure] = useState<Pressure | null>(null);
  const [streak, setStreak] = useState(0);
  const [won, setWon] = useState(false);
  const [cleared, setCleared] = useState<Set<string>>(() => new Set());
  const [showHint, setShowHint] = useState(false);
  const [intro, setIntro] = useState<number | null>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const seed = useRef(1);
  const metricsRef = useRef<Metrics | null>(null);
  const streakRef = useRef(0);
  const flow = useReactFlow();

  const graph: SimGraph = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, config: n.data.config })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    }),
    [nodes, edges],
  );
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const graphRef = useRef(graph);
  graphRef.current = graph;

  const loadScenario = useCallback(
    (id: string) => {
      const s = ALL.find((x) => x.id === id)!;
      const f = buildFlow(s);
      setScenarioId(id);
      setNodes(f.nodes);
      setEdges(f.edges);
      setRps(s.traffic.rps);
      setRunning(false);
      setMetrics(null);
      metricsRef.current = null;
      setPressure(null);
      setStreak(0);
      setWon(false);
      setShowHint(false);
      setSelectedId(null);
      requestAnimationFrame(() => flow.fitView({ padding: 0.35, maxZoom: 1.1 }));
    },
    [flow, setEdges, setNodes],
  );

  // Simulation loop
  const graphKey = JSON.stringify(graph);
  useEffect(() => {
    // design changed: goals must be re-earned
    streakRef.current = 0;
    setStreak(0);
  }, [graphKey]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const raw = simulate(graphRef.current, { ...scenario.traffic, rps }, { seed: seed.current++, samples: 1500 });
      const m = smooth(metricsRef.current, raw);
      metricsRef.current = m;
      setMetrics(m);
      setPressure(bindingPressure(m, scenario.goals));
      if (scenario.goals.length) {
        const ok = scenario.goals.every((g) => goalMet(m, g));
        streakRef.current = ok ? Math.min(streakRef.current + 1, HOLD_TICKS) : 0;
        setStreak(streakRef.current);
        if (streakRef.current >= HOLD_TICKS && !cleared.has(scenario.id)) {
          setWon(true);
          setRunning(false);
          setCleared((c) => new Set(c).add(scenario.id));
        }
      }
    };
    tick();
    const t = setInterval(tick, TICK_MS);
    return () => clearInterval(t);
  }, [running, rps, scenario, cleared]);

  // Push live stats into nodes, light up active edges
  const active = useMemo(() => new Set(metrics?.activeNodeIds ?? []), [metrics]);
  const viewNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, running, stat: metrics?.nodeStats[n.id] } })),
    [nodes, metrics, running],
  );
  const viewEdges = useMemo(
    () =>
      edges.map((e) => {
        const live = running && active.has(e.source) && active.has(e.target);
        return { ...e, animated: live, className: live ? 'live' : undefined };
      }),
    [edges, running, active],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      setEdges((es) => (es.some((e) => e.source === c.source && e.target === c.target) ? es : addEdge(edgeOf(c.source!, c.target!), es)));
    },
    [setEdges],
  );

  const addNode = useCallback(
    (type: ComponentType, position?: { x: number; y: number }) => {
      const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
      let pos = position;
      if (!pos) {
        // drop it into a free slot in a row below the current diagram, then keep it in view
        const ns = nodesRef.current;
        const minX = Math.min(0, ...ns.map((n) => n.position.x));
        const maxY = Math.max(0, ...ns.map((n) => n.position.y));
        const taken = (p: { x: number; y: number }) =>
          ns.some((n) => Math.abs(n.position.x - p.x) < 180 && Math.abs(n.position.y - p.y) < 100);
        pos = { x: minX + 190, y: maxY + 150 };
        while (taken(pos)) pos = { x: pos.x + 200, y: pos.y };
        setTimeout(() => flow.fitView({ padding: 0.3, maxZoom: 1.1, duration: 300 }), 30);
      }
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        { id, type: 'sim', position: pos!, selected: true, data: { kind: type, config: { ...COMPONENTS[type].defaults } } },
      ]);
      setSelectedId(id);
    },
    [flow, setNodes],
  );

  const updateConfig = useCallback(
    (id: string, key: string, v: ConfigValue) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: v } } } : n))),
    [setNodes],
  );
  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId(null);
    },
    [setEdges, setNodes],
  );

  // Space toggles run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag) && intro === null && !won) {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intro, won]);

  const selected = nodes.find((n) => n.id === selectedId);
  const idx = SCENARIOS.findIndex((s) => s.id === scenario.id);
  const next = idx >= 0 ? SCENARIOS[idx + 1] : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          AISim
        </div>
        <label className="scenario-select">
          <span className="sr-only">Scenario</span>
          <select value={scenario.id} onChange={(e) => loadScenario(e.target.value)}>
            {ALL.map((s) => (
              <option key={s.id} value={s.id}>
                {cleared.has(s.id) ? '✓ ' : ''}
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <button className={`run ${running ? 'is-running' : ''}`} onClick={() => setRunning((r) => !r)}>
          {running ? 'Pause' : 'Run'}
        </button>
        <label className="traffic">
          <span>Traffic</span>
          <input type="range" min={1} max={150} value={rps} onChange={(e) => setRps(Number(e.target.value))} />
          <output>{rps} req/s</output>
        </label>
        <div className="topbar-spacer" />
        <button className="link" onClick={() => loadScenario(scenario.id)}>
          Reset scenario
        </button>
        <button className="link" onClick={() => setIntro(0)}>
          How it works
        </button>
        <a className="link" href="https://github.com/cybernerdie/ai-system-simulator" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>

      <Palette onAdd={(t) => addNode(t)} />

      <main
        className="canvas"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const t = e.dataTransfer.getData('application/aisim') as ComponentType;
          if (t && COMPONENTS[t]) addNode(t, flow.screenToFlowPosition({ x: e.clientX - 80, y: e.clientY - 30 }));
        }}
      >
        <ReactFlow
          nodes={viewNodes}
          edges={viewEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={({ nodes: sel }) => setSelectedId(sel[0]?.id ?? null)}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={{ padding: 0.35, maxZoom: 1.1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#b9c2cf" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </main>

      <aside className="side">
        <ScenarioBrief s={scenario} m={metrics} streak={streak} needed={HOLD_TICKS} showHint={showHint} onHint={() => setShowHint(true)} />
        <PressureCard p={pressure} running={running || !!metrics} warnings={metrics?.warnings ?? []} />
        {selected && (
          <Inspector id={selected.id} kind={selected.data.kind} config={selected.data.config} onChange={updateConfig} onDelete={deleteNode} />
        )}
      </aside>

      <MetricsBar m={metrics} goals={scenario.goals} />

      {intro !== null && <IntroDialog step={intro} setStep={setIntro} onClose={() => setIntro(null)} />}
      {won && (
        <WinDialog
          s={scenario}
          next={next}
          onStay={() => setWon(false)}
          onNext={() => loadScenario(next ? next.id : SANDBOX.id)}
        />
      )}
    </div>
  );
}
