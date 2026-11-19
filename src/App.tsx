import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type FitViewOptions,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  NodeChangeset,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from '@xyflow/react';
import { BookOpen, Check, CircleQuestionMark, Code, Command as CommandIcon, ExternalLink, GitCompareArrows, Link2, Moon, Music2, Pause, PencilRuler, Play, RotateCcw, Sun, Volume2, VolumeX } from 'lucide-react';
import { COMPONENTS, PALETTE_ORDER } from './engine/components';
import { simulate } from './engine/simulate';
import { PATTERNS, TICK_SECONDS, trafficMultiplier, type Pattern } from './engine/patterns';
import { bindingPressure, goalMet, type Pressure } from './engine/pressures';
import { SANDBOX, SCENARIOS, withDefaults, type Scenario } from './engine/scenarios';
import { BOSSES } from './engine/bosses';
import { findBuiltIn, levelNumber, levelTag, nextAfter, unlockCap } from './engine/catalog';
import { dailyNumber, dailyShareText, dailyStreak, loadDaily, saveDaily, todayKey, type DailyResult } from './engine/daily';
import { INCIDENTS, INCIDENT_SCENARIO, formatDuration, incidentGoals, incidentTick, incidentTraffic, loadIncidentBest, newIncidentRun, saveIncidentBest, type IncidentState } from './engine/incident';
import { ACHIEVEMENTS, addFlag, loadFlags, loadUnlocked, newlyEarned, saveUnlocked, type Progress } from './engine/achievements';
import { QUIZ, loadQuiz, saveQuiz } from './content/quiz';
import { customScenario, readHashLevel, recallLevel, rememberLevel, type CustomLevel } from './ui/customLevel';
import { AchievementToast, AchievementsDialog, ReviewDialog, CommandPalette, CompareDialog, IncidentBanner, IncidentHud, IncidentOverDialog, LevelMakerDialog, ModeCards, type Command } from './ui/Modes';
import { track } from './ui/track';
import type { ComponentType, ConfigValue, Metrics, SimGraph, TrafficProfile } from './engine/types';
import { SimNodeView, ZONE_LABEL, ZONE_OF, ZoneView, type SimFlowNode, type ZoneFlowNode, type ZoneKey } from './ui/SimNodeView';
import type { Shown } from './ui/Requests';
import { FlowEdge, type FlowEdgeType } from './ui/FlowEdge';
import { ScenarioPicker, ScenarioTrigger } from './ui/ScenarioPicker';
import { LearnHub, firstUnreadLesson, type HubView } from './ui/LearnHub';
import { loadStars, loadUnlockAll, saveStars, saveUnlockAll, clearDesign, encodeDesign, introSeen, loadCleared, loadDesign, loadLastScenario, loadRead, markIntroSeen, readHashDesign, saveCleared, saveDesign, saveLastScenario, savedTheme, saveTheme, systemTheme, type SharedDesign, type Theme } from './ui/persist';
import { Tour, type TourStep } from './ui/Tour';
import { autoWire, removeAndHeal, tidyLayout } from './engine/autowire';
import { scoreStars, type StarResult } from './engine/stars';
import { unlockLevels } from './engine/unlocks';
import { reviewDesign, type Review } from './engine/review';
import { COACH, hintLine, nudgeLine, pressureLine, showMeLine, winLine } from './content/guide';
import { Complaints, Confetti, GuideCard, useVoice, VoiceMenu, WelcomeScreen } from './ui/Guide';
import { speak, stopVoice } from './ui/voice';
import { onSfxChange, play, setSfx, sfxOn } from './ui/sfx';
import { drawCard, drawCertificate, improvements, shareText } from './ui/shareCard';
import { LESSONS, TERMS } from './content/learn';
import { Palette, PressureWindow, SidePanel, Telemetry, WinDialog, type Tab } from './ui/Panels';

const TICK_MS = 700;
const SITE = 'https://ai-system-simulator.vercel.app';

/** Embedded in another page (?embed) or opened on a level's own page (/play/<id>). */
const EMBED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed');
const PLAY_ID = typeof window !== 'undefined' ? window.location.pathname.match(/^\/play\/([\w-]+)/)?.[1] ?? null : null;

// levels made by players, once opened, are kept here and in localStorage
const customs = new Map<string, Scenario>();
function lookup(id: string): Scenario | undefined {
  const b = findBuiltIn(id);
  if (b) return b;
  if (!customs.has(id)) {
    const r = recallLevel(id);
    if (r) customs.set(id, r);
  }
  return customs.get(id);
}
/** Numbered levels and bosses get their own URL (/play/<id>), so a refresh or a shared address opens them. */
const hasPage = (s: Scenario) => levelNumber(s) !== null || s.kind === 'boss';
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
const nodeTypes = { sim: SimNodeView, zone: ZoneView };
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

function packDesign(scenarioId: string, ns: SimFlowNode[], es: FlowEdgeType[]): SharedDesign {
  return {
    scenarioId,
    nodes: ns.map((n) => ({ id: n.id, type: n.data.kind, x: n.position.x, y: n.position.y, config: n.data.config })),
    edges: es.map((e) => ({ source: e.source, target: e.target })),
  };
}
const designGraph = (d: SharedDesign): SimGraph => ({
  nodes: d.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config })),
  edges: d.edges.map((e) => ({ source: e.source, target: e.target })),
});

/** Where to start: the scenario you were last on, with your work restored. */
function startingPoint(): { id: string; restored: boolean; flow: ReturnType<typeof buildFlow> } {
  const fromUrl = PLAY_ID ? lookup(PLAY_ID) : undefined;
  const last = loadLastScenario();
  const remembered = last ? lookup(last) : undefined;
  // a stale daily from an earlier day isn't today's challenge; start from the levels instead
  const s = fromUrl ?? (remembered && !(remembered.kind === 'daily' && remembered.id !== `daily-${todayKey()}`) && remembered.kind !== 'incident' ? remembered : SCENARIOS[0]);
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
  const scenario = lookup(scenarioId) ?? SCENARIOS[0];
  const isIncident = scenario.kind === 'incident';
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
  const [intro, setIntro] = useState<number | null>(() => (introSeen() || readHashDesign() || readHashLevel() || PLAY_ID || EMBED ? null : 0));
  const [touring, setTouring] = useState(false);
  // coached first level: index into COACH, or null when not coaching
  const [coach, setCoach] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [voice] = useVoice();
  const [voiceMenu, setVoiceMenu] = useState<DOMRect | null>(null);
  // the component list can collapse to a narrow rail of icons
  const [palCollapsed, setPalCollapsed] = useState(() => {
    if (EMBED) return true;
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

  /* ---------- daily, incident mode, quiz, achievements, compare, level maker, commands ---------- */
  const [daily, setDaily] = useState<Record<string, DailyResult>>(() => loadDaily());
  const dayStreak = useMemo(() => dailyStreak(daily), [daily]);
  const [incident, setIncident] = useState<IncidentState | null>(() => (isIncident ? newIncidentRun(1) : null));
  const incidentRef = useRef<IncidentState | null>(incident);
  const [incidentBest, setIncidentBest] = useState(() => loadIncidentBest());
  const [incidentOver, setIncidentOver] = useState<IncidentState | null>(null);
  const [banner, setBanner] = useState<{ title: string; text: string } | null>(null);
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 4800);
    return () => window.clearTimeout(t);
  }, [banner]);
  const [quiz, setQuiz] = useState(() => loadQuiz());
  const [quizPick, setQuizPick] = useState<number | null>(null);
  const [flags, setFlags] = useState(() => loadFlags());
  const [unlocked, setUnlocked] = useState(() => loadUnlocked());
  const [achQueue, setAchQueue] = useState<string[]>([]);
  const [achOpen, setAchOpen] = useState(false);
  const [readCount, setReadCount] = useState(() => loadRead().size);
  const [pin, setPin] = useState<SharedDesign | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [makerOpen, setMakerOpen] = useState(false);
  const [cmdk, setCmdk] = useState(false);
  const [review, setReview] = useState<Review | null | 'loading'>(null);
  const goals = useMemo(() => (isIncident ? incidentGoals((incident?.active ?? []).map((a) => a.kind)) : scenario.goals), [isIncident, incident, scenario]);

  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const [picker, setPicker] = useState(false);
  const [hub, setHub] = useState<HubView | null>(null);
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme());
  useEffect(() => {
    // switch in one frame: pause every transition while the colours flip, so nothing lags or gets stuck halfway
    const root = document.documentElement;
    root.classList.add('theme-switching');
    root.dataset.theme = theme;
    void root.offsetHeight;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    return () => cancelAnimationFrame(id);
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
      const s = lookup(id) ?? SCENARIOS[0];
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
      setQuizPick(null);
      setIncidentOver(null);
      setBanner(null);
      const run = s.kind === 'incident' ? newIncidentRun(Math.floor(Math.random() * 1e6)) : null;
      incidentRef.current = run;
      setIncident(run);
      // keep the address in step: numbered levels and bosses have their own page
      const path = hasPage(s) ? `/play/${s.id}` : '/';
      if (window.location.pathname !== path || window.location.hash) window.history.replaceState(null, '', `${path}${window.location.search}`);
      track('level_start', { level: s.kind === 'daily' ? 'daily' : s.kind === 'custom' ? 'custom' : s.id });
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
      const target = lookup(d.scenarioId) ? d.scenarioId : SANDBOX.id;
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
    } else if (/^#l=/.test(window.location.hash)) {
      const h = readHashLevel();
      if (!h) {
        window.history.replaceState(null, '', window.location.pathname);
        showToast('That level link is broken or incomplete, so it couldn\'t be opened.');
        return;
      }
      const sc = customScenario(h.code, h.level);
      customs.set(sc.id, sc);
      rememberLevel(sc.id, h.code);
      loadScenario(sc.id, { fresh: true });
      showToast('Playing a level someone made and shared. Press Space to run it.');
      track('custom_opened');
    } else if (start.restored && !PLAY_ID) {
      showToast('Picked up where you left off.', { label: 'Start over', run: () => loadScenario(start.id, { fresh: true }) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep your work: remember the scenario you're on and your design in each one
  useEffect(() => {
    if (!EMBED) saveLastScenario(scenarioId);
  }, [scenarioId]);
  // the tab title follows the level
  const baseTitle = useRef(document.title);
  useEffect(() => {
    document.title = hasPage(scenario) || scenario.kind ? `${scenario.title.replace(/^(\d+|Boss|Daily #\d+) · /, '')} · AISim` : baseTitle.current;
  }, [scenario]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const s = lookup(scenarioId) ?? SCENARIOS[0];
      const mine = packDesign(scenarioId, nodes, edges);
      const b = buildFlow(s);
      // don't store anything until the design actually differs from the scenario's starting point
      if (encodeDesign(mine) === encodeDesign(packDesign(scenarioId, b.nodes, b.edges))) clearDesign(scenarioId);
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
    const code = encodeDesign(packDesign(scenario.id, nodes, edges));
    const url = `${window.location.origin}/#d=${code}`;
    track('share', { kind: 'design' });
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
      // incident mode: traffic and goals come from the incidents currently active
      const inc = scenario.kind === 'incident' ? incidentRef.current : null;
      const activeKinds = inc ? inc.active.map((a) => a.kind) : [];
      const baseT = inc ? incidentTraffic(activeKinds, inc.count) : trafficRef.current;
      const baseRps = inc ? baseT.rps * (rps / INCIDENT_SCENARIO.traffic.rps) : rps;
      const effRps = Math.max(0.5, Math.round(baseRps * trafficMultiplier(pattern, simTimeRef.current) * 10) / 10);
      const raw = simulate(graphRef.current, { ...baseT, rps: effRps }, { seed: seed.current++, samples: 1500 });
      ticksRef.current = metricsRef.current ? ticksRef.current + 1 : 0;
      const m = smooth(metricsRef.current, raw);
      if (ticksRef.current === 3 && !baselineRef.current) baselineRef.current = m;
      metricsRef.current = m;
      setMetrics(m);
      setHistory((h) => [...h.slice(-(HISTORY - 1)), m]);
      const gs = inc ? incidentGoals(activeKinds) : scenario.goals;
      setPressure(bindingPressure(m, gs));
      if (inc) {
        const nx = incidentTick(inc, gs.filter((g) => !goalMet(m, g)).length, TICK_SECONDS);
        incidentRef.current = nx;
        setIncident(nx);
        if (nx.started) {
          const d = INCIDENTS[nx.started];
          setBanner({ title: d.title, text: d.text });
          speak(`incident-${d.kind}`, d.text);
          play('problem');
        }
        if (nx.over) {
          setRunning(false);
          setIncidentOver(nx);
          setIncidentBest(saveIncidentBest({ seconds: Math.round(nx.t), incidents: nx.count }));
          speak('incident-over', `Your system went down after ${formatDuration(nx.t).replace('m', ' minutes').replace('s', ' seconds')}.`);
          track('incident_over', { seconds: Math.round(nx.t), incidents: nx.count });
        }
        return;
      }
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
            setQuizPick(null);
            if (m.costPer1k <= r.par.cost * 0.5) setFlags(addFlag('half-budget'));
            if (parts < r.par.parts) setFlags(addFlag('under-par'));
            if (scenario.kind === 'daily') setDaily(saveDaily(scenario.id.slice(6), { stars: r.stars, cost: m.costPer1k, parts }));
            track('level_won', { level: scenario.kind === 'daily' ? 'daily' : scenario.kind === 'custom' ? 'custom' : scenario.id, stars: r.stars });
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
    if (!running || coach !== null || won || !scenario.goals.length || scenario.kind === 'incident') return;
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

  const copyText = useCallback(
    async (text: string, done: string) => {
      try {
        if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
          await navigator.share({ text });
          return;
        }
        await navigator.clipboard.writeText(text);
        showToast(done);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') showToast('Couldn\'t copy on this device.');
      }
    },
    [showToast],
  );
  const shareResult = useCallback(async () => {
    const after = metricsRef.current;
    if (!after) return;
    const n = result?.stars ?? 1;
    const site = `${SITE}/`;
    track('share', { kind: scenario.kind ?? 'level' });
    if (scenario.kind === 'daily') {
      const key = scenario.id.slice(6);
      const r = daily[key] ?? { stars: n, cost: after.costPer1k, parts: nodesRef.current.length - 1 };
      await copyText(`${dailyShareText(key, r, dayStreak)}\n${site}`, 'Result copied, ready to paste.');
      return;
    }
    const num = levelNumber(scenario);
    const label = num ? `Level ${num}` : scenario.kind === 'boss' ? 'Boss level' : 'Level';
    const imps = improvements(scenario, baselineRef.current, after);
    const text = shareText(scenario, label, n, imps);
    try {
      const blob = await drawCard({ s: scenario, label, stars: n, imps, site });
      const file = new File([blob], `aisim-${scenario.id}.png`, { type: 'image/png' });
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
  }, [scenario, result, showToast, daily, dayStreak, copyText]);
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
    const cap = unlockCap(scenario);
    if (unlockAll || cap === null) return null;
    const firstLevel = unlockLevels();
    // open: everything introduced up to this level, plus anything already on the canvas
    const locks = new Map<ComponentType, number>();
    firstLevel.forEach((lvl, t) => {
      if (lvl > cap && !nodes.some((n) => n.data.kind === t)) locks.set(t, lvl);
    });
    const startHere = new Set(scenario.nodes.map((n) => n.type));
    const isLevel = levelNumber(scenario) !== null;
    const fresh = new Set([...firstLevel].filter(([t, lvl]) => isLevel && lvl === cap && !startHere.has(t)).map(([t]) => t));
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
  // the path a picked request took: Users first, then each component once, in order
  const traced = useMemo(() => {
    if (!picked) return null;
    const users = nodes.find((n) => n.data.kind === 'users')?.id;
    const ids = [users, ...picked.steps.map((s) => s.nodeId)].filter(Boolean) as string[];
    return ids.filter((id, i) => ids.indexOf(id) === i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  // labelled bands behind the components, grouped by what they do (entry, safety, retrieval, model...)
  const [showZones, setShowZones] = useState(() => {
    try {
      return localStorage.getItem('aisim.zones.v1') !== '0';
    } catch {
      return true;
    }
  });
  const toggleZones = useCallback(() => {
    setShowZones((v) => {
      try {
        localStorage.setItem('aisim.zones.v1', v ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !v;
    });
  }, []);
  const zones: ZoneFlowNode[] = useMemo(() => {
    if (!showZones) return [];
    const boxes = new Map<ZoneKey, { x0: number; y0: number; x1: number; y1: number }>();
    for (const n of nodes) {
      const z = ZONE_OF[n.data.kind];
      if (!z) continue;
      const w = n.measured?.width ?? 230;
      const h = n.measured?.height ?? 110;
      const b = boxes.get(z);
      const x0 = n.position.x, y0 = n.position.y, x1 = x0 + w, y1 = y0 + h;
      boxes.set(z, b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });
    }
    return [...boxes].map(([zone, b]) => ({
      id: `zone-${zone}`,
      type: 'zone' as const,
      position: { x: b.x0 - 16, y: b.y0 - 38 },
      style: { width: b.x1 - b.x0 + 32, height: b.y1 - b.y0 + 54 },
      data: { zone, label: ZONE_LABEL[zone] },
      selectable: false,
      draggable: false,
      deletable: false,
      focusable: false,
      connectable: false,
      zIndex: -1,
    }));
  }, [nodes, showZones]);
  const viewNodes = useMemo(
    () =>
      [
        ...zones,
        ...nodes.map((n) => ({
          ...n,
          className: traced ? (traced.includes(n.id) ? 'is-traced' : 'is-dimmed') : undefined,
          data: { ...n.data, running, stat: metrics?.nodeStats[n.id] },
        })),
      ] as unknown as SimFlowNode[],
    [zones, nodes, metrics, running, traced],
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
            live: running && active.has(e.source) && active.has(e.target) && !traced,
            rate: metrics?.nodeStats[e.target]?.rps ?? 0,
            trace: onTrace && traced ? { index: traced.indexOf(e.source), count: Math.max(1, traced.length - 1) } : undefined,
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
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || (e.target as HTMLElement).isContentEditable;
      const modal = intro !== null || touring || won || picker || hub || cmdk || compareOpen || makerOpen || achOpen || !!incidentOver || !!review;
      if (e.code === 'Space' && !typing && tag !== 'BUTTON' && !modal) {
        e.preventDefault();
        setRunning((r) => !r);
      }
      // the command palette: '/' or Ctrl/Cmd+K
      if (((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) && !modal && !EMBED) {
        e.preventDefault();
        setCmdk(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intro, touring, won, picker, hub, cmdk, compareOpen, makerOpen, achOpen, incidentOver, review]);

  /* ---------- achievements ---------- */
  const progress: Progress = useMemo(
    () => ({ cleared, stars, quiz, daily, dailyStreak: dayStreak, incident: incidentBest, lessonsRead: readCount, flags }),
    [cleared, stars, quiz, daily, dayStreak, incidentBest, readCount, flags],
  );
  const firstAch = useRef(true);
  useEffect(() => {
    const fresh = newlyEarned(progress, unlocked);
    const first = firstAch.current;
    firstAch.current = false;
    if (!fresh.length) return;
    const next = { ...unlocked };
    fresh.forEach((a) => (next[a.id] = Date.now()));
    saveUnlocked(next);
    setUnlocked(next);
    // earned before achievements existed: record them quietly
    if (first) return;
    setAchQueue((q) => [...q, ...fresh.map((a) => a.title)]);
    fresh.forEach((a) => track('achievement', { id: a.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);
  useEffect(() => {
    if (!achQueue.length) return;
    play('star', 0.2);
    const t = window.setTimeout(() => setAchQueue((q) => q.slice(1)), 3400);
    return () => window.clearTimeout(t);
  }, [achQueue]);

  const answerQuiz = useCallback(
    (i: number) => {
      const q = QUIZ[scenario.id];
      if (!q) return;
      setQuizPick(i);
      setQuiz(saveQuiz(scenario.id, i === q.answer));
      play(i === q.answer ? 'goal' : 'pause');
      track('quiz', { level: scenario.id, correct: i === q.answer });
    },
    [scenario.id],
  );

  /* ---------- design review ---------- */
  const openReview = useCallback(() => {
    setReview('loading');
    setRunning(false);
    track('review', { level: scenario.kind ?? scenario.id });
    // let the dialog paint first: the review reruns the design once per component
    window.setTimeout(() => {
      const inc = incidentRef.current;
      const t = scenario.kind === 'incident' && inc ? incidentTraffic(inc.active.map((a) => a.kind), inc.count) : { ...trafficRef.current, rps };
      setReview(reviewDesign(scenario, graphRef.current, t, goals));
    }, 60);
  }, [scenario, rps, goals]);
  const focusNode = useCallback(
    (id: string) => {
      setReview(null);
      setWon(false);
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
      setSelectedId(id);
      setTab('component');
      setSheetOpen(true);
      const n = nodesRef.current.find((x) => x.id === id);
      if (n) flow.setCenter(n.position.x + 110, n.position.y + 40, { zoom: 1, duration: 400 });
    },
    [flow, setNodes, setTab],
  );

  /* ---------- compare, level maker, certificate, embed ---------- */
  const pinHere = pin && pin.scenarioId === scenario.id ? pin : null;
  const compare = useCallback(() => {
    if (!pinHere) {
      setPin(packDesign(scenario.id, nodesRef.current, edgesRef.current));
      showToast('Pinned this design. Change it, then press Compare again to see both side by side.');
      return;
    }
    setCompareOpen(true);
    setFlags(addFlag('compared'));
    track('compare');
  }, [pinHere, scenario.id, showToast]);
  const publishLevel = useCallback(
    async (code: string, level: CustomLevel) => {
      const sc = customScenario(code, level);
      customs.set(sc.id, sc);
      rememberLevel(sc.id, code);
      setFlags(addFlag('made-level'));
      track('level_made');
      const url = `${SITE}/#l=${code}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Level link copied. Anyone who opens it plays your level.');
      } catch {
        window.prompt('Copy this link to share your level:', url);
      }
    },
    [showToast],
  );
  const downloadCertificate = useCallback(
    async (name: string) => {
      const total = [...SCENARIOS, ...BOSSES].reduce((a, x) => a + (stars[x.id] ?? 0), 0);
      try {
        const blob = await drawCertificate({ name, levels: SCENARIOS.length, stars: total, maxStars: (SCENARIOS.length + BOSSES.length) * 3, bosses: BOSSES.filter((b) => cleared.has(b.id)).length, date: new Date(), site: SITE });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'aisim-certificate.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        track('certificate');
      } catch {
        showToast('Couldn\'t draw the certificate on this device.');
      }
    },
    [stars, cleared, showToast],
  );
  const copyEmbed = useCallback(
    async (id: string) => {
      const sc = lookup(id);
      const html = `<iframe src="${SITE}/play/${id}?embed=1" title="AISim: ${(sc?.title ?? '').replace(/^\d+ · /, '').replace(/"/g, '&quot;')}" width="100%" height="720" style="border:0;border-radius:12px" loading="lazy"></iframe>`;
      try {
        await navigator.clipboard.writeText(html);
        showToast('Embed code copied. Paste it into any page or blog that allows iframes.');
      } catch {
        window.prompt('Copy this embed code:', html);
      }
      track('embed_copied', { level: id });
    },
    [showToast],
  );
  // build today's daily while the browser is idle, so opening it is instant
  useEffect(() => {
    const t = window.setTimeout(() => {
      const warm = () => void findBuiltIn(`daily-${todayKey()}`);
      if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 4000 });
      else warm();
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (EMBED) track('embed_view', { level: scenarioId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // first run of each level visit, for the funnel
  const ranHere = useRef('');
  useEffect(() => {
    if (running && ranHere.current !== scenario.id) {
      ranHere.current = scenario.id;
      track('level_run', { level: scenario.kind ? scenario.kind : scenario.id });
    }
  }, [running, scenario]);
  const goIncidentAgain = useCallback(() => {
    const st = newIncidentRun(Math.floor(Math.random() * 1e6));
    incidentRef.current = st;
    setIncident(st);
    setIncidentOver(null);
    simTimeRef.current = 0;
    setSimTime(0);
    setMetrics(null);
    setHistory([]);
    metricsRef.current = null;
    setRunning(true);
  }, []);

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
        target: '.react-flow__node-sim',
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

  const commands: Command[] = useMemo(() => {
    const add: Command[] = PALETTE_ORDER.filter((t) => t !== 'users').map((t) => {
      const lvl = unlock?.locks.get(t);
      return { id: `add-${t}`, group: 'Add', label: COMPONENTS[t].name, disabled: lvl ? `Unlocks in level ${lvl}` : false, run: () => addNode(t) };
    });
    return [
      { id: 'run', group: 'Run', label: running ? 'Pause the simulation' : 'Run the simulation', keys: 'Space', run: () => setRunning((r) => !r) },
      // what you can add right now first, locked ones after
      ...add.filter((c) => !c.disabled),
      ...add.filter((c) => c.disabled),
      { id: 'review', group: 'Design', label: 'Review my design', run: openReview },
      { id: 'compare', group: 'Design', label: pinHere ? 'Compare with the pinned design' : 'Pin this design to compare later', run: compare },
      { id: 'share', group: 'Design', label: 'Copy a link to this design', run: share },
      ...(scenario.id === SANDBOX.id ? [{ id: 'maker', group: 'Design', label: 'Make a level from this sandbox', run: () => setMakerOpen(true) }] : []),
      { id: 'reset', group: 'Design', label: 'Reset this level', run: resetScenario },
      { id: 'levels', group: 'Go to', label: 'All levels', run: () => setPicker(true) },
      { id: 'daily', group: 'Go to', label: `Daily challenge #${dailyNumber(todayKey())}`, run: () => loadScenario(`daily-${todayKey()}`) },
      { id: 'incident', group: 'Go to', label: 'Incident mode', run: () => loadScenario(INCIDENT_SCENARIO.id) },
      { id: 'sandbox', group: 'Go to', label: 'Sandbox', run: () => loadScenario(SANDBOX.id) },
      { id: 'learn', group: 'Go to', label: 'Lessons and glossary', run: () => setHub({ tab: 'lessons', lessonId: firstUnreadLesson() }) },
      { id: 'ach', group: 'Go to', label: 'Achievements', run: () => setAchOpen(true) },
      { id: 'zones', group: 'Settings', label: showZones ? 'Hide the zone labels on the canvas' : 'Show zone labels on the canvas', run: toggleZones },
      { id: 'theme', group: 'Settings', label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', run: toggleTheme },
      { id: 'sfx', group: 'Settings', label: sfx ? 'Turn sound effects off' : 'Turn sound effects on', run: () => setSfx(!sfx) },
      { id: 'tour', group: 'Help', label: 'Take the tour', run: () => setTouring(true) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlock, running, pinHere, scenario.id, theme, sfx, compare, share, resetScenario, loadScenario, addNode, openReview, showZones, toggleZones]);

  const selected = nodes.find((n) => n.id === selectedId);
  const next = nextAfter(scenario, new Set([...cleared, scenario.id]));
  const num = levelNumber(scenario);
  const winKicker = num ? `Level ${num} cleared` : scenario.kind === 'boss' ? 'Boss beaten' : scenario.kind === 'daily' ? `Daily #${dailyNumber(scenario.id.slice(6))} solved` : 'Level cleared';
  const nextLabel = EMBED ? 'Keep playing on AISim' : next ? (next.kind === 'boss' ? 'Face the boss' : 'Next level') : scenario.kind === 'daily' || scenario.kind === 'custom' ? 'Back to the levels' : 'Open the sandbox';
  const goNext = () => {
    if (EMBED) {
      window.open(`${SITE}${next && hasPage(next) ? `/play/${next.id}` : '/'}`, '_blank', 'noopener');
      setWon(false);
      return;
    }
    if (next) loadScenario(next.id);
    else if (scenario.kind === 'daily' || scenario.kind === 'custom') {
      setWon(false);
      setPicker(true);
    } else loadScenario(SANDBOX.id);
  };
  const totalStarsAll = [...SCENARIOS, ...BOSSES].reduce((a, x) => a + (stars[x.id] ?? 0), 0);

  return (
    <div className={`app${palCollapsed ? ' pal-collapsed' : ''}${EMBED ? ' is-embed' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <span>AISim</span>
        </div>
        <span className="topbar-divider" aria-hidden />
        {EMBED ? (
          <span className="scenario-trigger is-static">
            <span className="scenario-trigger-num">{levelTag(scenario)}</span>
            <span className="scenario-trigger-title">{scenario.title.replace(/^(\d+|Boss|Daily #\d+) · /, '')}</span>
          </span>
        ) : (
          <ScenarioTrigger scenario={scenario} tag={levelTag(scenario)} onOpen={() => setPicker(true)} />
        )}
        {!EMBED && <div className="traffic">
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
        </div>}
        <div className="topbar-spacer" />
        {EMBED ? (
          <div className="topbar-tools">
            <a className="btn btn-ghost btn-icon" href={`${SITE}${hasPage(scenario) ? `/play/${scenario.id}` : '/'}`} target="_blank" rel="noreferrer" title="Open the full game in a new tab">
              <ExternalLink size={15} aria-hidden />
              <span>Open AISim</span>
            </a>
          </div>
        ) : (
        <div className="topbar-tools">
        {scenario.id === SANDBOX.id && (
          <button className="btn btn-ghost btn-icon" onClick={() => setMakerOpen(true)} title="Turn this sandbox into a level others can play">
            <PencilRuler size={15} aria-hidden />
            <span>Make a level</span>
          </button>
        )}
        <button className="btn btn-ghost btn-icon" data-tour="reset" onClick={resetScenario} title="Reset scenario">
          <RotateCcw size={15} aria-hidden />
          <span>Reset</span>
        </button>
        <button className="btn btn-ghost btn-icon" data-tour="share" onClick={share} title="Copy a link to this design">
          <Link2 size={15} aria-hidden />
          <span>Share</span>
        </button>
        <button className={`btn btn-ghost btn-icon${pinHere ? ' is-pinned' : ''}`} data-tour="compare" onClick={compare} title={pinHere ? 'Compare the pinned design with this one' : 'Pin this design, then change it and compare'}>
          <GitCompareArrows size={15} aria-hidden />
          <span>{pinHere ? 'Compare' : 'Pin'}</span>
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
        <button className="btn btn-ghost theme-toggle only-keys" onClick={() => setCmdk(true)} title="Commands and shortcuts ( / )" aria-label="Commands and shortcuts">
          <CommandIcon size={15} aria-hidden />
        </button>
        <button className="btn btn-ghost theme-toggle" data-tour="help" onClick={() => setTouring(true)} title="Take the tour" aria-label="Take the tour">
          <CircleQuestionMark size={15} aria-hidden />
        </button>
        <a className="btn btn-ghost btn-icon" href="https://github.com/cybernerdie/ai-system-simulator" target="_blank" rel="noreferrer" title="Source code on GitHub">
          <Code size={15} aria-hidden />
          <span className="sr-only">Source code on GitHub</span>
        </a>
        </div>
        )}
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
          onNodesChange={(changes) => {
            // zones are drawn from the design, not part of it: their size reports must not feed back into it
            const real = changes.toArray().filter((c) => !('id' in c) || !c.id.startsWith('zone-'));
            if (real.length) onNodesChange(new NodeChangeset<SimFlowNode>(real));
          }}
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
        <PressureWindow p={pressure} running={running} hasRun={!!metrics} hud={isIncident && incident ? <IncidentHud s={incident} /> : undefined} />
        <Telemetry m={metrics} history={history} goals={goals} />
        {banner && <IncidentBanner title={banner.title} text={banner.text} />}
        <Complaints samples={metrics?.samples} running={running && !celebrate} />
      </main>

      {isPhone && sheetOpen && selected && <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} aria-hidden />}
      <SidePanel
        sheet={isPhone ? { open: sheetOpen && !!selected, onClose: () => setSheetOpen(false) } : undefined}
        key={scenario.id}
        scenario={isIncident ? { ...scenario, goals } : scenario}
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
        onReview={EMBED ? undefined : openReview}
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
      {coach === null && stuck > 0 && running && !won && !isIncident && (
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
          bosses={BOSSES}
          onEmbed={copyEmbed}
          modes={
            <ModeCards
              dailyNumber={dailyNumber(todayKey())}
              dailyDone={daily[todayKey()]?.stars ?? null}
              streak={dayStreak}
              incidentBest={incidentBest}
              achievements={[Object.keys(unlocked).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)).length, ACHIEVEMENTS.length]}
              onDaily={() => {
                setPicker(false);
                loadScenario(`daily-${todayKey()}`);
              }}
              onIncident={() => {
                setPicker(false);
                loadScenario(INCIDENT_SCENARIO.id);
              }}
              onAchievements={() => {
                setPicker(false);
                setAchOpen(true);
              }}
            />
          }
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
          onClose={() => {
            setHub(null);
            setReadCount(loadRead().size);
          }}
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
          kicker={winKicker}
          result={result}
          best={stars[scenario.id] ?? 0}
          nextLabel={nextLabel}
          quiz={QUIZ[scenario.id]}
          quizPick={quizPick}
          onQuiz={answerQuiz}
          shareLabel={scenario.kind === 'daily' ? 'Share your score' : 'Share result'}
          lesson={LESSONS.find((l) => l.scenarioId === scenario.id)}
          onLesson={(id) => {
            setWon(false);
            setHub({ tab: 'lessons', lessonId: id });
          }}
          onStay={() => setWon(false)}
          onShare={shareResult}
          onReview={openReview}
          onNext={goNext}
        />
      )}
      {incidentOver && (
        <IncidentOverDialog
          seconds={incidentOver.t}
          incidents={incidentOver.count}
          best={incidentBest}
          onRetry={goIncidentAgain}
          onShare={() => copyText(`I kept an AI system alive for ${formatDuration(incidentOver.t)} through ${incidentOver.count} incidents in AISim's incident mode. ${SITE}/`, 'Result copied, ready to paste.')}
          onLevels={() => {
            setIncidentOver(null);
            setPicker(true);
          }}
        />
      )}
      {compareOpen && pinHere && (
        <CompareDialog
          pinned={{ graph: designGraph(pinHere), parts: pinHere.nodes.filter((n) => n.type !== 'users').length }}
          current={{ graph, parts: nodes.filter((n) => n.data.kind !== 'users').length }}
          traffic={isIncident && incident ? incidentTraffic(incident.active.map((a) => a.kind), incident.count) : { ...traffic, rps }}
          goals={goals}
          onRestore={() => {
            const f = designToFlow(pinHere);
            setNodes(f.nodes);
            setEdges(f.edges);
            setCompareOpen(false);
            showToast('Back to the pinned design.');
          }}
          onPinCurrent={() => {
            setPin(packDesign(scenario.id, nodes, edges));
            setCompareOpen(false);
            showToast('Pinned the current design.');
          }}
          onClear={() => {
            setPin(null);
            setCompareOpen(false);
          }}
          onClose={() => setCompareOpen(false)}
        />
      )}
      {makerOpen && (
        <LevelMakerDialog
          traffic={{ ...traffic, rps }}
          solution={packDesign(SANDBOX.id, nodes, edges)}
          pinned={pin && pin.scenarioId === SANDBOX.id ? pin : null}
          onPublish={publishLevel}
          onClose={() => setMakerOpen(false)}
        />
      )}
      {achOpen && (
        <AchievementsDialog
          progress={progress}
          unlocked={unlocked}
          levelsTotal={SCENARIOS.length}
          levelsCleared={SCENARIOS.filter((x) => cleared.has(x.id)).length}
          totalStars={totalStarsAll}
          onCertificate={downloadCertificate}
          onClose={() => setAchOpen(false)}
        />
      )}
      {review && <ReviewDialog review={review === 'loading' ? null : review} onFocusNode={focusNode} onClose={() => setReview(null)} />}
      {cmdk && <CommandPalette commands={commands} onClose={() => setCmdk(false)} />}
      {achQueue[0] && <AchievementToast key={achQueue[0]} title={achQueue[0]} />}
    </div>
  );
}
