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
} from '@xyflow/react';
import { Check, CircleQuestionMark, Code, Link2, Pause, Play, RotateCcw } from 'lucide-react';
import { COMPONENTS } from './engine/components';
import { simulate } from './engine/simulate';
import { bindingPressure, goalMet, type Pressure } from './engine/pressures';
import { SANDBOX, SCENARIOS, withDefaults, type Scenario } from './engine/scenarios';
import type { ComponentType, ConfigValue, Metrics, RequestSample, SimGraph } from './engine/types';
import { SimNodeView, type SimFlowNode } from './ui/SimNodeView';
import { FlowEdge, type FlowEdgeType } from './ui/FlowEdge';
import { ScenarioPicker, ScenarioTrigger } from './ui/ScenarioPicker';
import { encodeDesign, introSeen, loadCleared, markIntroSeen, readHashDesign, saveCleared } from './ui/persist';
import { IntroDialog, Palette, PressureWindow, SidePanel, Telemetry, WinDialog, type Tab } from './ui/Panels';

const ALL = [...SCENARIOS, SANDBOX];
const TICK_MS = 700;
const HOLD_TICKS = 5;
const HISTORY = 40;
const FIT = { padding: { top: '190px', bottom: '150px', left: '48px', right: '48px' }, maxZoom: 1.05 } as const;
const nodeTypes = { sim: SimNodeView };
const edgeTypes = { flow: FlowEdge };

function edgeOf(source: string, target: string): FlowEdgeType {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'flow',
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#a1a1aa' },
  };
}

function buildFlow(s: Scenario): { nodes: SimFlowNode[]; edges: FlowEdgeType[] } {
  // scenarios are authored on a loose grid; snap columns so cards never overlap
  const cols = [...new Set(s.nodes.map((n) => n.x))].sort((a, b) => a - b);
  return {
    nodes: s.nodes.map(withDefaults).map((n) => ({
      id: n.id,
      type: 'sim',
      position: { x: cols.indexOf(n.x) * 270, y: n.y * 1.1 },
      deletable: n.type !== 'users',
      data: { kind: n.type, config: n.config! },
    })),
    edges: s.edges.map((e) => edgeOf(e.source, e.target)),
  };
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

function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="1" y="7" width="8" height="8" rx="2.5" fill="#6366f1" />
      <circle cx="16" cy="5.5" r="4" fill="#0ea5e9" />
      <rect x="12" y="12" width="9" height="9" rx="2.5" fill="#f97316" />
      <path d="M9 11 L12 7.5 M9 11 L12.5 15.5" stroke="#18181b" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = ALL.find((s) => s.id === scenarioId)!;
  const initial = useMemo(() => buildFlow(SCENARIOS[0]), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<SimFlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(initial.edges);
  const [running, setRunning] = useState(false);
  const [rps, setRps] = useState(scenario.traffic.rps);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<Metrics[]>([]);
  const [pressure, setPressure] = useState<Pressure | null>(null);
  const [streak, setStreak] = useState(0);
  const [won, setWon] = useState(false);
  const [cleared, setCleared] = useState<Set<string>>(() => loadCleared());
  const [intro, setIntro] = useState<number | null>(() => (introSeen() || readHashDesign() ? null : 0));
  const [toast, setToast] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTabRaw] = useState<Tab>('mission');
  const [picked, setPicked] = useState<RequestSample | null>(null);
  const setTab = useCallback((t: Tab) => {
    setTabRaw(t);
    if (t !== 'requests') setPicked(null);
  }, []);
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
      setHistory([]);
      metricsRef.current = null;
      setPressure(null);
      setStreak(0);
      setWon(false);
      setSelectedId(null);
      setTab('mission');
      setPicked(null);
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
      requestAnimationFrame(() => flow.fitView({ ...FIT, duration: 250 }));
    },
    [flow, setEdges, setNodes, setTab],
  );

  useEffect(() => saveCleared(cleared), [cleared]);

  // Open a shared design from the URL, once
  useEffect(() => {
    const d = readHashDesign();
    if (!d) return;
    loadScenario(ALL.some((x) => x.id === d.scenarioId) ? d.scenarioId : SANDBOX.id);
    setNodes(
      d.nodes.map((n) => ({
        id: n.id,
        type: 'sim',
        position: { x: n.x, y: n.y },
        deletable: n.type !== 'users',
        data: { kind: n.type, config: n.config },
      })),
    );
    setEdges(d.edges.map((e) => edgeOf(e.source, e.target)));
    showToast('Loaded a shared design. Press Space to run it.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = useCallback(async () => {
    const code = encodeDesign({
      scenarioId: scenario.id,
      nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, x: n.position.x, y: n.position.y, config: n.data.config })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    });
    const url = `${window.location.origin}${window.location.pathname}#d=${code}`;
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied. Anyone with it can open this design.');
    } catch {
      showToast('Link is ready in the address bar.');
    }
  }, [scenario.id, nodes, edges, showToast]);

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
      setHistory((h) => [...h.slice(-(HISTORY - 1)), m]);
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
  const traced = useMemo(() => (picked ? picked.steps.map((s) => s.nodeId).filter(Boolean) as string[] : null), [picked]);
  const viewNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        className: traced ? (traced.includes(n.id) ? 'is-traced' : 'is-dimmed') : undefined,
        data: { ...n.data, running, stat: metrics?.nodeStats[n.id] },
      })),
    [nodes, metrics, running, traced],
  );
  const viewEdges = useMemo(
    () =>
      edges.map((e) => {
        const onTrace = traced ? traced.some((id, i) => id === e.source && traced.slice(i + 1).includes(e.target)) : false;
        return {
          ...e,
          className: traced ? (onTrace ? 'is-traced' : 'is-dimmed') : undefined,
          data: {
            live: (running && active.has(e.source) && active.has(e.target) && !traced) || onTrace,
            rate: metrics?.nodeStats[e.target]?.rps ?? 0,
          },
        };
      }),
    [edges, running, active, metrics, traced],
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
          ns.some((n) => Math.abs(n.position.x - p.x) < 210 && Math.abs(n.position.y - p.y) < 110);
        pos = { x: minX + 220, y: maxY + 160 };
        while (taken(pos)) pos = { x: pos.x + 230, y: pos.y };
        setTimeout(() => flow.fitView({ ...FIT, duration: 300 }), 30);
      }
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        { id, type: 'sim', position: pos!, selected: true, data: { kind: type, config: { ...COMPONENTS[type].defaults } } },
      ]);
      setSelectedId(id);
      setTab('component');
    },
    [flow, setNodes, setTab],
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
      setTab('mission');
    },
    [setEdges, setNodes, setTab],
  );

  // Space toggles run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag) && intro === null && !won && !picker) {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intro, won, picker]);

  const selected = nodes.find((n) => n.id === selectedId);
  const idx = SCENARIOS.findIndex((s) => s.id === scenario.id);
  const next = idx >= 0 ? SCENARIOS[idx + 1] : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <span>AISim</span>
        </div>
        <span className="topbar-divider" aria-hidden />
        <ScenarioTrigger scenario={scenario} index={SCENARIOS.findIndex((x) => x.id === scenario.id)} onOpen={() => setPicker(true)} />
        <label className="traffic">
          <span>Traffic</span>
          <input type="range" min={1} max={150} value={rps} onChange={(e) => setRps(Number(e.target.value))} />
          <output>{rps} req/s</output>
        </label>
        <div className="topbar-spacer" />
        <button className="btn btn-ghost btn-icon" onClick={() => loadScenario(scenario.id)} title="Reset scenario">
          <RotateCcw size={15} aria-hidden />
          <span>Reset</span>
        </button>
        <button className="btn btn-ghost btn-icon" onClick={share} title="Copy a link to this design">
          <Link2 size={15} aria-hidden />
          <span>Share</span>
        </button>
        <button className="btn btn-ghost btn-icon" onClick={() => setIntro(0)} title="How it works">
          <CircleQuestionMark size={15} aria-hidden />
          <span>How it works</span>
        </button>
        <a className="btn btn-ghost btn-icon" href="https://github.com/cybernerdie/ai-system-simulator" target="_blank" rel="noreferrer" title="Source on GitHub">
          <Code size={15} aria-hidden />
          <span className="sr-only">GitHub</span>
        </a>
        <button className={`btn btn-primary btn-run${running ? ' is-running' : ''}`} onClick={() => setRunning((r) => !r)}>
          {running ? <Pause size={14} fill="currentColor" aria-hidden /> : <Play size={14} fill="currentColor" aria-hidden />}
          {running ? 'Pause' : 'Run'}
          <kbd>Space</kbd>
        </button>
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
          if (t && COMPONENTS[t]) addNode(t, flow.screenToFlowPosition({ x: e.clientX - 100, y: e.clientY - 36 }));
        }}
      >
        <ReactFlow
          nodes={viewNodes}
          edges={viewEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={({ nodes: sel }) => {
            const id = sel[0]?.id ?? null;
            setSelectedId(id);
            if (id) setTab('component');
            else if (tab === 'component') setTab('mission');
          }}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={FIT}
          proOptions={{ hideAttribution: true }}
          connectionLineStyle={{ stroke: '#18181b', strokeWidth: 1.5, strokeDasharray: '4 4' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#d4d4d8" />
          <Controls showInteractive={false} position="bottom-right" orientation="horizontal" />
        </ReactFlow>
        <PressureWindow p={pressure} running={running} hasRun={!!metrics} />
        <Telemetry m={metrics} history={history} goals={scenario.goals} />
      </main>

      <SidePanel
        key={scenario.id}
        scenario={scenario}
        m={metrics}
        streak={streak}
        needed={HOLD_TICKS}
        warnings={metrics?.warnings ?? []}
        selected={selected ? { id: selected.id, kind: selected.data.kind, config: selected.data.config } : undefined}
        onChange={updateConfig}
        onDelete={deleteNode}
        tab={tab}
        setTab={setTab}
        running={running}
        picked={picked}
        onPick={setPicked}
      />

      {intro !== null && (
        <IntroDialog
          step={intro}
          setStep={setIntro}
          onClose={() => {
            setIntro(null);
            markIntroSeen();
          }}
        />
      )}
      {picker && (
        <ScenarioPicker
          scenarios={SCENARIOS}
          sandbox={SANDBOX}
          currentId={scenario.id}
          cleared={cleared}
          onClose={() => setPicker(false)}
          onPick={(id) => {
            setPicker(false);
            loadScenario(id);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={14} strokeWidth={2.5} aria-hidden />
          {toast}
        </div>
      )}
      {won && <WinDialog s={scenario} next={next} onStay={() => setWon(false)} onNext={() => loadScenario(next ? next.id : SANDBOX.id)} />}
    </div>
  );
}
