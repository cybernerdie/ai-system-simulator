import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type FitViewOptions,
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
import { BookOpen, Check, CircleQuestionMark, Code, Link2, Moon, Music2, Pause, Play, RotateCcw, Sun, Volume2, VolumeX } from 'lucide-react';
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
import { loadStars, loadUnlockAll, saveStars, saveUnlockAll, clearDesign, encodeDesign, introSeen, loadCleared, loadDesign, loadLastScenario, markIntroSeen, readHashDesign, saveCleared, saveDesign, saveLastScenario, savedTheme, saveTheme, systemTheme, type SharedDesign, type Theme } from './ui/persist';
import { Tour, type TourStep } from './ui/Tour';
import { autoWire, removeAndHeal, tidyLayout } from './engine/autowire';
import { scoreStars, type StarResult } from './engine/stars';
import { COACH, hintLine, nudgeLine, pressureLine, showMeLine, winLine } from './content/guide';
import { Complaints, Confetti, GuideCard, useVoice, VoiceMenu, WelcomeScreen } from './ui/Guide';
import { speak, stopVoice } from './ui/voice';
import { onSfxChange, play, setSfx, sfxOn } from './ui/sfx';
import { drawCard, improvements, shareText } from './ui/shareCard';
import { LESSONS, TERMS } from './content/learn';
import { Palette, PressureWindow, SidePanel, Telemetry, WinDialog, type Tab } from './ui/Panels';

const ALL = [...SCENARIOS, SANDBOX];
const TICK_MS = 700;
const HOLD_TICKS = 5;
const HISTORY = 40;
const MOBILE_FIT = { padding: 0.12, maxZoom: 1 } as const;
/** Fit the diagram into the canvas space that the floating pressure window and metrics dock leave free. */
function fitOptions(): FitViewOptions {
  // On phones the overlays sit outside the canvas, so no space needs reserving
  if (window.innerWidth <= 900) return MOBILE_FIT;
  const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
  const top = document.querySelector('.pressure-window')?.getBoundingClientRect();
  const bottom = document.querySelector('.telemetry')?.getBoundingClientRect();
  const padTop = canvas && top ? Math.max(top.bottom - canvas.top + 24, 120) : 190;
  const padBottom = canvas && bottom ? Math.max(canvas.bottom - bottom.top + 24, 100) : 150;
  const px = (n: number) => `${Math.round(n)}px` as `${number}px`;
  return { padding: { top: px(padTop), bottom: px(padBottom), left: px(48), right: px(48) }, maxZoom: 1.05, minZoom: 0.35 };
}
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

function designToFlow(d: SharedDesign) {
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

/** Where to start: the scenario you were last on, with your work restored. */
function startingPoint(): { id: string; restored: boolean; flow: ReturnType<typeof buildFlow> } {
  const last = loadLastScenario();
  const s = ALL.find((x) => x.id === last) ?? SCENARIOS[0];
  const saved = loadDesign(s.id);
  return { id: s.id, restored: !!saved, flow: saved ? designToFlow(saved) : buildFlow(s) };
}

/** How long you've been stuck, in seconds, for a given hint stage. */
const stuckSeconds = (stage: number) => [0, 25, 50, 80][Math.max(0, stage)] ?? 0;

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
  const start = useMemo(() => startingPoint(), []);
  const [scenarioId, setScenarioId] = useState(start.id);
  const scenario = ALL.find((s) => s.id === scenarioId)!;
  const initial = start.flow;
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
  const [stars, setStars] = useState<Record<string, number>>(() => loadStars());
  const [unlockAll, setUnlockAll] = useState(() => loadUnlockAll());
  const [result, setResult] = useState<StarResult | null>(null);
  // stars already celebrated this session per level, so improving a level celebrates again
  const awarded = useRef(new Map<string, number>());
  const [intro, setIntro] = useState<number | null>(() => (introSeen() || readHashDesign() ? null : 0));
  const [touring, setTouring] = useState(false);
  // coached first level: index into COACH, or null when not coaching
  const [coach, setCoach] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [voice] = useVoice();
  const [voiceMenu, setVoiceMenu] = useState<DOMRect | null>(null);
  // the component list can collapse to a narrow rail of icons
  const [palCollapsed, setPalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('aisim.palCollapsed.v1') === '1';
    } catch {
      return false;
    }
  });
  const togglePal = useCallback(() => {
    setPalCollapsed((v) => {
      try {
        localStorage.setItem('aisim.palCollapsed.v1', v ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !v;
    });
    // the canvas width changes; let the diagram refit once the column has animated
    setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
  }, []);
  const [sfx, setSfxState] = useState(sfxOn());
  useEffect(() => onSfxChange(setSfxState), []);
  const goalsMetRef = useRef(0);
  // the numbers from the first run of a level, for the before → after share card
  const baselineRef = useRef<Metrics | null>(null);
  const ticksRef = useRef(0);

  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
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
  const showToast = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setToast({ text, action });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 6000 : 2600);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);
  const [tab, setTabRaw] = useState<Tab>('mission');
  // Phones: component settings open as a bottom sheet over the canvas instead of far down the page
  const [isPhone, setIsPhone] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picked, setPicked] = useState<Shown | null>(null);
  const setTab = useCallback((t: Tab) => {
    setTabRaw(t);
    if (t !== 'requests') setPicked(null);
  }, []);
  const seed = useRef(1);
  const metricsRef = useRef<Metrics | null>(null);
  const streakRef = useRef(0);
  const flow = useReactFlow();
  // Refit the diagram when the overlays change size, unless the user has panned or zoomed themselves
  const userMoved = useRef(false);
  useEffect(() => {
    let last = '';
    let t = 0;
    const check = () => {
      const a = document.querySelector('.pressure-window')?.getBoundingClientRect().height ?? 0;
      const b = document.querySelector('.telemetry')?.getBoundingClientRect().height ?? 0;
      const rf = document.querySelector('.react-flow')?.getBoundingClientRect();
      const key = `${Math.round(a)}:${Math.round(b)}:${Math.round(rf?.width ?? 0)}x${Math.round(rf?.height ?? 0)}:${window.innerWidth}`;
      if (key === last) return;
      last = key;
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (!userMoved.current) flow.fitView({ ...fitOptions(), duration: 200 });
      }, 120);
    };
    const ro = new ResizeObserver(check);
    const watch = () => {
      ro.disconnect();
      document.querySelectorAll('.pressure-window, .telemetry, .canvas, .react-flow').forEach((el) => ro.observe(el));
    };
    watch();
    // the overlays re-mount when they switch between empty and live states
    const mo = new MutationObserver(watch);
    const canvas = document.querySelector('.canvas');
    if (canvas) mo.observe(canvas, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.clearTimeout(t);
    };
  }, [flow]);

  const graph: SimGraph = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ id: n.id, type: n.data.kind, config: n.data.config })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    }),
    [nodes, edges],
  );
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
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
    (id: string, opts: { fresh?: boolean } = {}) => {
      const s = ALL.find((x) => x.id === id)!;
      if (opts.fresh) clearDesign(id);
      const saved = opts.fresh ? null : loadDesign(id);
      const f = saved ? designToFlow(saved) : buildFlow(s);
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
      userMoved.current = false;
      requestAnimationFrame(() => flow.fitView({ ...fitOptions(), duration: 250 }));
    },
    [flow, setEdges, setNodes, setTab],
  );

  useEffect(() => {
    saveCleared(cleared);
  }, [cleared]);

  // Open a shared design from the URL, once
  useEffect(() => {
    if (/^#d=/.test(window.location.hash)) {
      const d = readHashDesign();
      if (!d) {
        window.history.replaceState(null, '', window.location.pathname);
        showToast('That share link is broken or incomplete, so it couldn\'t be opened.');
        return;
      }
      const target = ALL.some((x) => x.id === d.scenarioId) ? d.scenarioId : SANDBOX.id;
      const mine = loadDesign(target);
      loadScenario(target);
      const f = designToFlow({ ...d, scenarioId: target });
      setNodes(f.nodes);
      setEdges(f.edges);
      showToast(
        'Loaded a shared design. Press Space to run it.',
        mine
          ? {
              label: 'Back to my design',
              run: () => {
                const m = designToFlow(mine);
                setNodes(m.nodes);
                setEdges(m.edges);
              },
            }
          : undefined,
      );
    } else if (start.restored) {
      showToast('Picked up where you left off.', { label: 'Start over', run: () => loadScenario(start.id, { fresh: true }) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep your work: remember the scenario you're on and your design in each one
  useEffect(() => {
    saveLastScenario(scenarioId);
  }, [scenarioId]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const s = ALL.find((x) => x.id === scenarioId)!;
      const pack = (ns: SimFlowNode[], es: FlowEdgeType[]): SharedDesign => ({
        scenarioId,
        nodes: ns.map((n) => ({ id: n.id, type: n.data.kind, x: n.position.x, y: n.position.y, config: n.data.config })),
        edges: es.map((e) => ({ source: e.source, target: e.target })),
      });
      const mine = pack(nodes, edges);
      const b = buildFlow(s);
      // don't store anything until the design actually differs from the scenario's starting point
      if (encodeDesign(mine) === encodeDesign(pack(b.nodes, b.edges))) clearDesign(scenarioId);
      else saveDesign(mine);
    }, 400);
    return () => window.clearTimeout(t);
  }, [nodes, edges, scenarioId]);

  const resetScenario = useCallback(() => {
    const id = scenario.id;
    const before = { nodes: nodesRef.current, edges: edgesRef.current };
    loadScenario(id, { fresh: true });
    showToast('Scenario reset.', {
      label: 'Undo',
      run: () => {
        setNodes(before.nodes);
        setEdges(before.edges);
      },
    });
  }, [scenario.id, loadScenario, showToast, setNodes, setEdges]);

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
      ticksRef.current = metricsRef.current ? ticksRef.current + 1 : 0;
      const m = smooth(metricsRef.current, raw);
      if (ticksRef.current === 3 && !baselineRef.current) baselineRef.current = m;
      metricsRef.current = m;
      setMetrics(m);
      setHistory((h) => [...h.slice(-(HISTORY - 1)), m]);
      setPressure(bindingPressure(m, scenario.goals));
      if (scenario.goals.length) {
        const ok = scenario.goals.every((g) => goalMet(m, g));
        const metNow = scenario.goals.filter((g) => goalMet(m, g)).length;
        if (metNow > goalsMetRef.current && metricsRef.current) play('goal');
        goalsMetRef.current = metNow;
        streakRef.current = ok ? Math.min(streakRef.current + 1, HOLD_TICKS) : 0;
        setStreak(streakRef.current);
        if (streakRef.current >= HOLD_TICKS && scenario.id !== SANDBOX.id) {
          const parts = nodesRef.current.filter((n) => n.data.kind !== 'users').length;
          const r = scoreStars(scenario, m, parts);
          const before = awarded.current.get(scenario.id) ?? 0;
          if (!cleared.has(scenario.id) || r.stars > before) {
            awarded.current.set(scenario.id, r.stars);
            setResult({ ...r, improved: before > 0 });
            setWon(true);
            setRunning(false);
            setCleared((c) => new Set(c).add(scenario.id));
            setStars((st) => {
              if ((st[scenario.id] ?? 0) >= r.stars) return st;
              const nextStars = { ...st, [scenario.id]: r.stars };
              saveStars(nextStars);
              return nextStars;
            });
          }
        }
      }
    };
    tick();
    const t = setInterval(tick, TICK_MS);
    return () => clearInterval(t);
  }, [running, rps, scenario, cleared, pattern]);

  /* ---------- guide: coaching, hints, voice, celebration ---------- */

  // Coached first level: each step waits for the player to do the thing, then moves on
  useEffect(() => {
    if (coach === null) return;
    const w = COACH[coach].wait;
    const done =
      w.kind === 'running'
        ? running
        : w.kind === 'has'
          ? nodes.some((n) => n.data.kind === w.type)
          : w.kind === 'won'
            ? won || streak >= HOLD_TICKS
            : false;
    if (done) setCoach(coach + 1 < COACH.length ? coach + 1 : null);
  }, [coach, running, nodes, won, streak]);
  useEffect(() => {
    if (coach !== null) speak(COACH[coach].id, COACH[coach].text);
  }, [coach]);
  useEffect(() => {
    if (scenario.id !== SCENARIOS[0].id) setCoach(null);
  }, [scenario.id]);

  // Hint ladder: if you're stuck (running, not winning, nothing changed for a while), help step by step
  const designSig = useMemo(
    () => JSON.stringify([nodes.map((n) => [n.data.kind, n.data.config]), edges.map((e) => [e.source, e.target])]),
    [nodes, edges],
  );
  const lastEdit = useRef(Date.now());
  const [stuck, setStuck] = useState(0);
  useEffect(() => {
    lastEdit.current = Date.now();
    setStuck(0);
  }, [designSig, scenario.id]);
  useEffect(() => {
    if (running) lastEdit.current = Date.now() - stuckSeconds(stuck) * 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  useEffect(() => {
    if (!running || coach !== null || won || !scenario.goals.length) return;
    const id = window.setInterval(() => {
      if (streakRef.current > 0) return; // on track
      const idle = (Date.now() - lastEdit.current) / 1000;
      const stage = idle > 80 ? 3 : idle > 50 ? 2 : idle > 25 ? 1 : 0;
      setStuck((s) => (s < 0 ? s : stage > s ? stage : s));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, coach, won, scenario]);
  const missing = useMemo(() => {
    const t = scenario.solution.nodes.map((n) => n.type).find((type) => !nodes.some((n) => n.data.kind === type));
    return t ? COMPONENTS[t] : null;
  }, [scenario, nodes]);
  useEffect(() => {
    if (stuck === 1 && pressure) {
      const l = nudgeLine(pressure.key);
      if (l) speak(l.id, l.text);
    } else if (stuck === 2) {
      const l = hintLine(scenario);
      speak(l.id, l.text);
    } else if (stuck === 3 && missing) {
      const l = showMeLine(missing.name);
      speak(l.id, l.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stuck]);

  // The voice names each new problem as it appears (after it settles for a moment)
  const spokenPressure = useRef('');
  useEffect(() => {
    spokenPressure.current = '';
  }, [scenario.id]);
  useEffect(() => {
    if (!running || coach !== null || !pressure || stuck > 0) return;
    const k = pressure.key;
    if (k === spokenPressure.current) return;
    const t = window.setTimeout(() => {
      const l = pressureLine(k);
      spokenPressure.current = k;
      if (l) speak(l.id, l.text);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [pressure, running, coach, stuck]);

  // Sounds for running, new problems and coaching steps
  const firstRunSound = useRef(true);
  useEffect(() => {
    if (firstRunSound.current) {
      firstRunSound.current = false;
      return;
    }
    play(running ? 'run' : 'pause');
  }, [running]);
  const lastProblem = useRef('');
  useEffect(() => {
    if (!running || !pressure || pressure.key === 'stable' || pressure.key === lastProblem.current) return;
    lastProblem.current = pressure.key;
    play('problem');
  }, [pressure, running]);
  useEffect(() => {
    lastProblem.current = '';
    goalsMetRef.current = 0;
    baselineRef.current = null;
  }, [scenario.id]);

  const shareResult = useCallback(async () => {
    const after = metricsRef.current;
    if (!after) return;
    const level = SCENARIOS.findIndex((x) => x.id === scenario.id) + 1;
    const n = result?.stars ?? 1;
    const imps = improvements(scenario, baselineRef.current, after);
    const site = 'https://ai-system-simulator.vercel.app/';
    const text = shareText(scenario, level, n, imps);
    try {
      const blob = await drawCard({ s: scenario, level, stars: n, imps, site });
      const file = new File([blob], `aisim-level-${level}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: site });
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      try {
        await navigator.clipboard.writeText(`${text} ${site}`);
        showToast('Card downloaded. Post text copied, ready to paste.');
      } catch {
        showToast('Card downloaded.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast('Couldn\'t create the card on this device.');
    }
  }, [scenario, result, showToast]);
  useEffect(() => {
    if (coach !== null && coach > 0) play('step');
  }, [coach]);

  // Level cleared: celebrate
  useEffect(() => {
    if (!won) return;
    play('win');
    for (let i = 0; i < (result?.stars ?? 1); i++) play('star', 0.5 + i * 0.18);
    const l = winLine(scenario);
    speak(l.id, l.text);
    setCelebrate(true);
    const t = window.setTimeout(() => setCelebrate(false), 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  // Every component is listed; ones you haven't reached are locked until you clear the level that introduces them.
  // Sandbox and "Unlock every level" open everything.
  const unlock = useMemo(() => {
    const idx = SCENARIOS.findIndex((x) => x.id === scenario.id);
    if (unlockAll || idx < 0) return null;
    const firstLevel = new Map<ComponentType, number>();
    SCENARIOS.forEach((x, i) =>
      [...x.nodes, ...x.solution.nodes].forEach((n) => {
        if (!firstLevel.has(n.type)) firstLevel.set(n.type, i + 1);
      }),
    );
    // open: everything introduced up to this level, plus anything already on the canvas
    const locks = new Map<ComponentType, number>();
    firstLevel.forEach((lvl, t) => {
      if (lvl > idx + 1 && !nodes.some((n) => n.data.kind === t)) locks.set(t, lvl);
    });
    const startHere = new Set(scenario.nodes.map((n) => n.type));
    const fresh = new Set([...firstLevel].filter(([t, lvl]) => lvl === idx + 1 && !startHere.has(t)).map(([t]) => t));
    return { locks, fresh };
  }, [scenario, unlockAll, nodes]);

  const startPlaying = useCallback(() => {
    setIntro(null);
    markIntroSeen();
    loadScenario(SCENARIOS[0].id, { fresh: true });
    setCoach(0);
  }, [loadScenario]);

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
      const ns = nodesRef.current;
      const es = edgesRef.current;
      // connect it where it belongs in the pipeline, so nobody has to drag wires to see an effect
      const wired = autoWire(
        ns.map((n) => ({ id: n.id, type: n.data.kind })),
        es.map((e) => ({ source: e.source, target: e.target })),
        { id, type },
      );
      // phones: don't pop the settings sheet over everything; just add it and say so
      const phone = window.matchMedia('(max-width: 900px)').matches;
      const fresh: SimFlowNode = { id, type: 'sim', position: position ?? { x: 0, y: 0 }, selected: !phone, data: { kind: type, config: { ...COMPONENTS[type].defaults } } };
      let next = [...ns.map((n) => ({ ...n, selected: false })), fresh];
      if (!position) {
        // tapped from the palette: tidy the whole diagram into columns along the flow
        const at = tidyLayout(
          next.map((n) => ({ id: n.id, type: n.data.kind })),
          wired,
        );
        next = next.map((n) => (at.has(n.id) ? { ...n, position: at.get(n.id)! } : n));
        userMoved.current = false;
        setTimeout(() => flow.fitView({ ...fitOptions(), duration: 300 }), 30);
      }
      play('add');
      setNodes(next);
      setEdges(wired.map((e) => es.find((x) => x.source === e.source && x.target === e.target) ?? edgeOf(e.source, e.target)));
      if (phone) {
        showToast(`Added ${COMPONENTS[type].name}. Tap it to change its settings.`);
      } else {
        setSelectedId(id);
        setTab('component');
      }
    },
    [flow, setNodes, setEdges, setTab, showToast],
  );

  const updateConfig = useCallback(
    (id: string, key: string, v: ConfigValue) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: v } } } : n))),
    [setNodes],
  );
  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      // reconnect its neighbours so deleting the middle of a pipeline doesn't cut it in two
      setEdges((es) => removeAndHeal(es.map((e) => ({ source: e.source, target: e.target })), id).map((e) => es.find((x) => x.source === e.source && x.target === e.target) ?? edgeOf(e.source, e.target)));
      setSelectedId(null);
      setTab('mission');
    },
    [setEdges, setNodes, setTab],
  );

  // After a mouse click, don't leave focus on the button: otherwise Space presses it again
  // (adding another component, flipping the theme) instead of running the simulation.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return; // keyboard activation: keep focus where it is
      const b = (e.target as HTMLElement).closest?.('.palette-item, .topbar button, .topbar a');
      if (b instanceof HTMLElement) b.blur();
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

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
    <div className={`app${palCollapsed ? ' pal-collapsed' : ''}`}>
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
        <button className="btn btn-ghost btn-icon" data-tour="reset" onClick={resetScenario} title="Reset scenario">
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
        <button
          className={`btn btn-ghost theme-toggle${sfx ? '' : ' is-off'}`}
          onClick={() => setSfx(!sfx)}
          title={sfx ? 'Turn sound effects off' : 'Turn sound effects on'}
          aria-label={sfx ? 'Turn sound effects off' : 'Turn sound effects on'}
          aria-pressed={sfx}
        >
          <Music2 size={15} aria-hidden />
        </button>
        <button
          className={`btn btn-ghost theme-toggle${voice ? '' : ' is-off'}`}
          onClick={(e) => setVoiceMenu(voiceMenu ? null : e.currentTarget.getBoundingClientRect())}
          title="Voice guide: on/off, choose a voice, speed"
          aria-label="Voice guide settings"
          aria-expanded={!!voiceMenu}
        >
          {voice ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
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

      <Palette
        onAdd={(t) => addNode(t)}
        locks={unlock?.locks}
        fresh={unlock?.fresh}
        onLocked={(t, lvl) => showToast(`${COMPONENTS[t].name} unlocks in level ${lvl}. Clear the levels before it to use it.`)}
        collapsed={palCollapsed}
        onToggleCollapsed={togglePal}
      />

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
          onNodesDelete={(deleted) => {
            // keyboard delete: React Flow drops the attached edges; put the pipeline back together
            let es = edgesRef.current.map((e) => ({ source: e.source, target: e.target }));
            for (const d of deleted) es = removeAndHeal(es, d.id);
            const gone = new Set(deleted.map((d) => d.id));
            setEdges((cur) => {
              const keep = cur.filter((e) => !gone.has(e.source) && !gone.has(e.target));
              for (const e of es) if (!keep.some((x) => x.source === e.source && x.target === e.target)) keep.push(edgeOf(e.source, e.target));
              return keep;
            });
          }}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={({ nodes: sel }) => {
            const id = sel[0]?.id ?? null;
            // React Flow re-reports the selection whenever node data updates; only react to real changes
            if (id === selectedRef.current) return;
            selectedRef.current = id;
            setSelectedId(id);
            setSheetOpen(!!id);
            if (id) setTab('component');
            else if (tab === 'component') setTab('mission');
          }}
          deleteKeyCode={['Backspace', 'Delete']}
          // Phones: one-finger swipes scroll the page instead of getting trapped in the canvas.
          // Pinch still zooms, and the fit button re-centres the diagram.
          panOnDrag={!isPhone}
          preventScrolling={!isPhone}
          nodesDraggable={!isPhone}
          fitView
          fitViewOptions={fitOptions()}
          onMoveStart={(e) => {
            // e is null for programmatic moves (fitView); only real drags/zooms count
            if (e) userMoved.current = true;
          }}
          proOptions={{ hideAttribution: true }}
          connectionLineStyle={{ stroke: 'var(--ink)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color={theme === 'dark' ? '#2a2a2e' : '#d4d4d8'} />
          {isPhone ? (
            <Controls showInteractive={false} showZoom={false} position="top-right" fitViewOptions={fitOptions()} />
          ) : (
            <Controls showInteractive={false} position="bottom-right" orientation="horizontal" />
          )}
        </ReactFlow>
        <PressureWindow p={pressure} running={running} hasRun={!!metrics} />
        <Telemetry m={metrics} history={history} goals={scenario.goals} />
        <Complaints samples={metrics?.samples} running={running && !celebrate} />
      </main>

      {isPhone && sheetOpen && selected && <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} aria-hidden />}
      <SidePanel
        sheet={isPhone ? { open: sheetOpen && !!selected, onClose: () => setSheetOpen(false) } : undefined}
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
        <WelcomeScreen
          onPlay={startPlaying}
          onBrowse={() => {
            setIntro(null);
            markIntroSeen();
            setPicker(true);
          }}
          onFree={() => {
            setIntro(null);
            markIntroSeen();
            loadScenario(SANDBOX.id);
          }}
          onClose={() => {
            setIntro(null);
            markIntroSeen();
          }}
        />
      )}
      {coach !== null && (
        <GuideCard
          key={COACH[coach].id}
          target={COACH[coach].target}
          kicker={`Level 1 · step ${coach + 1} of ${COACH.length}`}
          title={COACH[coach].title}
          text={COACH[coach].text}
          actions={COACH[coach].wait.kind === 'next' ? [{ label: 'Got it', primary: true, onClick: () => setCoach(coach + 1) }] : undefined}
          onClose={() => {
            setCoach(null);
            stopVoice();
          }}
          closeLabel="Skip the tutorial"
        />
      )}
      {coach === null && stuck > 0 && running && !won && (
        <GuideCard
          key={`stuck-${stuck}`}
          target={stuck === 1 ? '.pressure-window' : stuck === 3 && missing ? `[data-palette="${missing.type}"]` : undefined}
          kicker={stuck === 1 ? 'Stuck?' : stuck === 2 ? 'Hint' : 'Show me'}
          text={
            stuck === 1
              ? `The panel at the top names the one problem hurting you most right now: ${pressure ? pressure.title.toLowerCase() : 'see the top panel'}. Its suggestion is a good place to start.`
              : stuck === 2
                ? scenario.hint
                : missing
                  ? `Try adding ${missing.name}. It's glowing in the components list.`
                  : 'You have all the right components. Open each one and look at its settings.'
          }
          actions={stuck < 3 ? [{ label: stuck === 1 ? 'Give me a hint' : 'Show me', onClick: () => setStuck(stuck + 1) }] : undefined}
          onClose={() => {
            setStuck(-1);
            stopVoice();
          }}
          closeLabel="Hide hints"
        />
      )}
      {celebrate && <Confetti />}
      {voiceMenu && <VoiceMenu anchor={voiceMenu} onClose={() => setVoiceMenu(null)} />}
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
          stars={stars}
          unlockAll={unlockAll}
          onUnlockAll={(on) => {
            setUnlockAll(on);
            saveUnlockAll(on);
          }}
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
          {toast.text}
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
      {won && (
        <WinDialog
          s={scenario}
          index={SCENARIOS.findIndex((x) => x.id === scenario.id)}
          result={result}
          best={stars[scenario.id] ?? 0}
          next={next}
          lesson={LESSONS.find((l) => l.scenarioId === scenario.id)}
          onLesson={(id) => {
            setWon(false);
            setHub({ tab: 'lessons', lessonId: id });
          }}
          onStay={() => setWon(false)}
          onShare={shareResult}
          onNext={() => loadScenario(next ? next.id : SANDBOX.id)}
        />
      )}
    </div>
  );
}
