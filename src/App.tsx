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
import { BookOpen, Check, CircleQuestionMark, Code, Link2, Moon, Pause, Play, RotateCcw, Sun } from 'lucide-react';
import { COMPONENTS } from './engine/components';
import { simulate } from './engine/simulate';
import { PATTERNS, TICK_SECONDS, trafficMultiplier, type Pattern } from './engine/patterns';
import { bindingPressure, goalMet, type Pressure } from './engine/pressures';
import { SANDBOX, SCENARIOS, withDefaults, type Scenario } from './engine/scenarios';
import type { ComponentType, ConfigValue, Metrics, SimGraph, TrafficProfile } from './engine/types';
import { SimNodeView, type SimFlowNode } from './ui/SimNodeView';
import type { Shown } from './ui/Requests';
import { FlowEdge, type FlowEdgeType } from './ui/FlowEdge';
import { ScenarioPicker, ScenarioTrigger } from './ui/ScenarioPicker';
import { LearnHub, firstUnreadLesson, type HubView } from './ui/LearnHub';
import { encodeDesign, introSeen, loadCleared, markIntroSeen, readHashDesign, saveCleared, savedTheme, saveTheme, systemTheme, type Theme } from './ui/persist';
import { Tour, type TourStep } from './ui/Tour';
import { LESSONS, TERMS } from './content/learn';
import { IntroDialog, Palette, PressureWindow, SidePanel, Telemetry, WinDialog, type Tab } from './ui/Panels';

const ALL = [...SCENARIOS, SANDBOX];
const TICK_MS = 700;
const HOLD_TICKS = 5;
const HISTORY = 40;
const DESKTOP_FIT = { padding: { top: '190px', bottom: '150px', left: '48px', right: '48px' }, maxZoom: 1.05 } as const;
const MOBILE_FIT = { padding: 0.12, maxZoom: 1 } as const;
// On phones the overlays sit outside the canvas, so no space needs reserving
const fitOptions = () => (window.innerWidth <= 900 ? MOBILE_FIT : DESKTOP_FIT);
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
      <path d="M9 11 L12 7.5 M9 11 L12.5 15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
  const [pattern, setPattern] = useState<Pattern>('steady');
  const [simTime, setSimTime] = useState(0);
  const simTimeRef = useRef(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<Metrics[]>([]);
  const [pressure, setPressure] = useState<Pressure | null>(null);
  const [streak, setStreak] = useState(0);
  const [won, setWon] = useState(false);
  const [cleared, setCleared] = useState<Set<string>>(() => loadCleared());
  const [intro, setIntro] = useState<number | null>(() => (introSeen() || readHashDesign() ? null : 0));
  const [touring, setTouring] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [hub, setHub] = useState<HubView | null>(null);
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  // Follow the OS setting until the user picks a theme themselves
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => {
      if (!savedTheme()) setTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const toggleTheme = () =>
    setTheme((t) => {
      const n = t === 'dark' ? 'light' : 'dark';
      saveTheme(n);
      return n;
    });
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);
  const [tab, setTabRaw] = useState<Tab>('mission');
  const [picked, setPicked] = useState<Shown | null>(null);
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
  const [mixOverride, setMixOverride] = useState<Partial<TrafficProfile> | null>(null);
  const traffic: TrafficProfile = useMemo(
    () => ({ ...scenario.traffic, ...(scenario.id === SANDBOX.id ? mixOverride ?? {} : {}) }),
    [scenario, mixOverride],
  );
  const trafficRef = useRef(traffic);
  trafficRef.current = traffic;
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
      simTimeRef.current = 0;
      setSimTime(0);
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
      requestAnimationFrame(() => flow.fitView({ ...fitOptions(), duration: 250 }));
    },
    [flow, setEdges, setNodes, setTab],
  );

  useEffect(() => {
    saveCleared(cleared);
  }, [cleared]);

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
      simTimeRef.current += TICK_SECONDS;
      setSimTime(simTimeRef.current);
      const effRps = Math.max(0.5, Math.round(rps * trafficMultiplier(pattern, simTimeRef.current) * 10) / 10);
      const raw = simulate(graphRef.current, { ...trafficRef.current, rps: effRps }, { seed: seed.current++, samples: 1500 });
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
  }, [running, rps, scenario, cleared, pattern]);

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
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: theme === 'dark' ? '#71717a' : '#a1a1aa' },
          className: traced ? (onTrace ? 'is-traced' : 'is-dimmed') : undefined,
          data: {
            live: (running && active.has(e.source) && active.has(e.target) && !traced) || onTrace,
            rate: metrics?.nodeStats[e.target]?.rps ?? 0,
          },
        };
      }),
    [edges, running, active, metrics, traced, theme],
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
        setTimeout(() => flow.fitView({ ...fitOptions(), duration: 300 }), 30);
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
      if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag) && intro === null && !touring && !won && !picker && !hub) {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intro, touring, won, picker, hub]);

  const tourSteps: TourStep[] = useMemo(
    () => [
      {
        target: '.scenario-trigger',
        title: 'Pick a scenario',
        body: `Each scenario is a broken AI system with a real-world story behind it. Open this to browse all ${SCENARIOS.length}, search them, or jump into the sandbox to build anything.`,
      },
      {
        target: '.side',
        title: 'Your mission',
        body: 'The brief tells the story. The goals are what you have to hit, like accuracy of at least 80% or cost under a set amount per 1,000 requests. Stuck? There\'s a hint at the bottom.',
        onEnter: () => setTab('mission'),
      },
      {
        target: '.react-flow__node',
        title: 'The system you\'re fixing',
        body: 'Requests flow left to right, from your users to the model. Click a component to tune its settings, drag from a node\'s right dot to connect it to the next one, and press Delete to remove it.',
      },
      {
        target: '.palette',
        title: 'Components',
        body: 'Everything you can add: retrieval, memory, agents, self-hosted models, caches, guardrails, evals and more. Click one or drag it onto the canvas. Each one fixes some problems and causes others.',
      },
      {
        target: '.btn-run',
        title: 'Run it',
        body: 'This sends traffic through your design. We\'ve started it for you. Press Space any time to pause or resume.',
        onEnter: () => setRunning(true),
      },
      {
        target: '.traffic',
        title: 'Traffic',
        body: 'How many requests per second hit your system, and their shape: steady, sudden spikes, a daily wave or a slow ramp. Turn it up to find the next wall.',
      },
      {
        target: '.pressure-window',
        title: 'The binding pressure',
        body: 'The most important panel. It names the one limit hurting your system right now, explains why in plain words, and suggests what to try. Fix it, and the next pressure shows up.',
      },
      {
        target: '.telemetry',
        title: 'Live numbers',
        body: 'Quality (accuracy, hallucination, recall, injection) and load (errors, latency, cost), updating as traffic flows. Red means a goal isn\'t met yet. Hold every goal for a few seconds to clear the scenario.',
      },
      {
        target: '.side',
        title: 'Follow single requests',
        body: 'The Requests tab shows individual requests: each step they went through, how long it took, and why some failed. Click one to light up its path on the canvas.',
        onEnter: () => setTab('requests'),
      },
      {
        target: '[data-tour="learn"]',
        title: 'Learn as you go',
        body: `${LESSONS.length} short lessons that start from zero and build up to agents and inference, plus a plain-English glossary of ${TERMS.length} terms. Every component links to its glossary entry.`,
        onEnter: () => setTab('mission'),
      },
      {
        target: '[data-tour="reset"], [data-tour="share"], [data-tour="help"]',
        title: 'Share, reset, replay',
        body: 'Share copies a link to your exact design. Reset puts the scenario back to how it started. The ? button replays this tour. Your progress is saved in this browser.',
      },
    ],
    [setTab],
  );

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
        <div className="traffic">
          <label className="traffic-rate">
            <span>Traffic</span>
            <input type="range" min={1} max={150} value={rps} onChange={(e) => setRps(Number(e.target.value))} aria-label="Base requests per second" />
            <output>{metrics && pattern !== 'steady' ? `${metrics.offered}` : rps} req/s</output>
          </label>
          <span className="traffic-sep" aria-hidden />
          <label className="traffic-pattern" title={PATTERNS[pattern].help}>
            <span className="sr-only">Traffic pattern</span>
            <select value={pattern} onChange={(e) => setPattern(e.target.value as Pattern)}>
              {(Object.keys(PATTERNS) as Pattern[]).map((p) => (
                <option key={p} value={p}>
                  {PATTERNS[p].label}
                </option>
              ))}
            </select>
          </label>
          {pattern !== 'steady' && <span className="sim-clock">t={simTime}s</span>}
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-tools">
        <button className="btn btn-ghost btn-icon" data-tour="reset" onClick={() => loadScenario(scenario.id)} title="Reset scenario">
          <RotateCcw size={15} aria-hidden />
          <span>Reset</span>
        </button>
        <button className="btn btn-ghost btn-icon" data-tour="share" onClick={share} title="Copy a link to this design">
          <Link2 size={15} aria-hidden />
          <span>Share</span>
        </button>
        <button className="btn btn-ghost btn-icon" data-tour="learn" onClick={() => setHub({ tab: 'lessons', lessonId: firstUnreadLesson() })} title="Lessons and glossary">
          <BookOpen size={15} aria-hidden />
          <span>Learn</span>
        </button>
        <button
          className="btn btn-ghost theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
        </button>
        <button className="btn btn-ghost theme-toggle" data-tour="help" onClick={() => setTouring(true)} title="Take the tour" aria-label="Take the tour">
          <CircleQuestionMark size={15} aria-hidden />
        </button>
        <a className="btn btn-ghost btn-icon" href="https://github.com/cybernerdie/ai-system-simulator" target="_blank" rel="noreferrer" title="Source code on GitHub">
          <Code size={15} aria-hidden />
          <span className="sr-only">Source code on GitHub</span>
        </a>
        </div>
        <span className="topbar-divider" aria-hidden />
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
            // React Flow re-reports the selection whenever node data updates; only react to real changes
            if (id === selectedRef.current) return;
            selectedRef.current = id;
            setSelectedId(id);
            if (id) setTab('component');
            else if (tab === 'component') setTab('mission');
          }}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={fitOptions()}
          proOptions={{ hideAttribution: true }}
          connectionLineStyle={{ stroke: 'var(--ink)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color={theme === 'dark' ? '#2a2a2e' : '#d4d4d8'} />
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
        onLearn={(termId) => setHub({ tab: 'glossary', termId })}
        traffic={traffic}
        onMix={(patch) => setMixOverride((o) => ({ ...(o ?? {}), ...patch }))}
        onResetMix={() => setMixOverride(null)}
      />

      {intro !== null && (
        <IntroDialog
          step={intro}
          setStep={setIntro}
          onClose={() => {
            setIntro(null);
            markIntroSeen();
          }}
          onTour={() => {
            setIntro(null);
            markIntroSeen();
            setTouring(true);
          }}
        />
      )}
      {touring && (
        <Tour
          steps={tourSteps}
          onClose={() => {
            setTouring(false);
            setTab(selectedRef.current ? 'component' : 'mission');
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
      {hub && (
        <LearnHub
          view={hub}
          setView={setHub}
          onClose={() => setHub(null)}
          onReplayIntro={() => {
            setHub(null);
            setIntro(0);
          }}
          onTryScenario={(id) => {
            setHub(null);
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
