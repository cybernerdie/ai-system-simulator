import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Controls, MarkerType, NodeChangeset, ReactFlow, addEdge, useEdgesState, useNodesState, useReactFlow, type Connection } from '@xyflow/react';
import { COMPONENTS } from '../engine/components';
import { SANDBOX, SCENARIOS } from '../engine/levels/scenarios';
import { displayTitle } from '../engine/levels/kit';
import { BOSSES } from '../engine/levels/bosses';
import { findBuiltIn, levelNumber, levelTag, nextAfter } from '../engine/catalog';
import { dailyNumber, dailyShareText, dailyStreak, todayKey } from '../engine/modes/daily';
import { INCIDENTS, INCIDENT_SCENARIO, formatDuration, type IncidentState } from '../engine/modes/incident';
import { ACHIEVEMENTS, type Progress } from '../engine/modes/achievements';
import { autoWire, removeAndHeal, tidyLayout } from '../engine/autowire';
import { scoreStars, type StarResult } from '../engine/stars';
import { paletteLocks } from '../engine/unlocks';
import type { Review } from '../engine/review';
import type { ComponentType, ConfigValue, Metrics, TrafficProfile } from '../engine/types';
import { COACH } from '../content/guide';
import { LESSONS, firstUnreadLesson } from '../content/learn';
import { QUIZ } from '../content/quiz';
import { tourSteps } from '../ui/guide/tourSteps';
import { track } from '../lib/analytics';
import { copyWithFallback, downloadBlob, shareOrCopy } from '../lib/clipboard';
import {
  addFlag,
  caseSeen,
  clearDesign,
  introSeen,
  loadCleared,
  loadDaily,
  loadDesign,
  loadFlags,
  loadIncidentBest,
  loadQuiz,
  loadRead,
  loadStars,
  loadUnlockAll,
  markCaseSeen,
  markIntroSeen,
  rememberLevel,
  saveCleared,
  saveDaily,
  saveDesign,
  saveIncidentBest,
  saveLastScenario,
  saveQuiz,
  saveStars,
  saveUnlockAll,
} from '../lib/progress';
import { customScenario, readHashLevel, type CustomLevel } from '../share/customLevel';
import { encodeDesign, readHashDesign, type SharedDesign } from '../lib/designLink';
import { FlowEdge, type FlowEdgeType } from '../ui/canvas/FlowEdge';
import { SimNodeView, ZoneView, type SimFlowNode } from '../ui/canvas/SimNodeView';
import { isZoneId, zoneNodes } from '../ui/canvas/zones';
import { AchievementToast } from '../ui/dialogs/AchievementToast';
import type { HubView } from '../ui/dialogs/LearnHub';
import { ModeCards } from '../ui/dialogs/ModeCards';
import { ScenarioPicker } from '../ui/dialogs/ScenarioPicker';
import { WinDialog } from '../ui/dialogs/WinDialog';
import { Complaints } from '../ui/guide/Complaints';
import { Confetti } from '../ui/guide/Confetti';
import { GuideCard } from '../ui/guide/GuideCard';
import { useVoice } from '../ui/audio/useVoice';
import { speak, stopVoice } from '../ui/audio/voice';
import { onSfxChange, play, setSfx, sfxOn } from '../ui/audio/sfx';
import { IncidentBanner, IncidentHud } from '../ui/panels/IncidentHud';
import { Palette } from '../ui/panels/Palette';
import { PressureWindow } from '../ui/panels/PressureWindow';
import type { Shown } from '../ui/panels/Requests';
import { SidePanel, type Tab } from '../ui/panels/SidePanel';
import { Telemetry } from '../ui/panels/Telemetry';
import { Toast } from '../ui/Toast';
import { CaseIntro } from '../ui/case/CaseIntro';
import { TopBar } from '../ui/TopBar';
import { AchievementsDialog, CommandPalette, CompareDialog, IncidentOverDialog, LearnHub, LevelMakerDialog, ReviewDialog, Tour, VoiceMenu, WelcomeScreen } from '../ui/lazy';
import { buildCommands } from './commands';
import { EMBED, HOLD_TICKS, PHONE_QUERY, PLAY_ID, SITE } from './config';
import { buildFlow, requestPath, designGraph, designSignature, designToFlow, edgeOf, flowGraph, packDesign, reuseEdges } from './flow';
import { analyticsLevel, lookup, pathFor, registerCustomLevel, startingPoint } from './levels';
import { useAchievements } from './hooks/useAchievements';
import { useAutoClear } from './hooks/useAutoClear';
import { fitOptions, useCanvasFit } from './hooks/useCanvasFit';
import { useGuide } from './hooks/useGuide';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useShortcuts } from './hooks/useShortcuts';
import { useSimulation } from './hooks/useSimulation';
import { useStoredFlag } from './hooks/useStoredFlag';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';

const nodeTypes = { sim: SimNodeView, zone: ZoneView };
const edgeTypes = { flow: FlowEdge };
const partsOf = (nodes: SimFlowNode[]) => nodes.filter((n) => n.data.kind !== 'users').length;
const totalStars = (stars: Record<string, number>) => [...SCENARIOS, ...BOSSES].reduce((a, x) => a + (stars[x.id] ?? 0), 0);

export default function App() {
  const start = useMemo(startingPoint, []);
  const [scenarioId, setScenarioId] = useState(start.id);
  const scenario = lookup(scenarioId) ?? SCENARIOS[0];
  const isIncident = scenario.kind === 'incident';
  const inSandbox = scenario.id === SANDBOX.id;

  const [nodes, setNodes, onNodesChange] = useNodesState<SimFlowNode>(start.flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(start.flow.edges);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const graph = useMemo(() => flowGraph(nodes, edges), [nodes, edges]);
  const designSig = useMemo(() => designSignature(graph), [graph]);

  const [mixOverride, setMixOverride] = useState<Partial<TrafficProfile> | null>(null);
  const traffic: TrafficProfile = useMemo(() => ({ ...scenario.traffic, ...(inSandbox ? mixOverride : null) }), [scenario, inSandbox, mixOverride]);

  // saved progress
  const [cleared, setCleared] = useState(loadCleared);
  const clearedRef = useRef(cleared);
  clearedRef.current = cleared;
  const [stars, setStars] = useState(loadStars);
  const [unlockAll, setUnlockAll] = useState(loadUnlockAll);
  const [daily, setDaily] = useState(loadDaily);
  const dayStreak = useMemo(() => dailyStreak(daily), [daily]);
  const [incidentBest, setIncidentBest] = useState(loadIncidentBest);
  const [quiz, setQuiz] = useState(loadQuiz);
  const [flags, setFlags] = useState(loadFlags);
  const [readCount, setReadCount] = useState(() => loadRead().size);

  // the outcome of the current attempt
  const [won, setWon] = useState(false);
  const [result, setResult] = useState<StarResult | null>(null);
  const [quizPick, setQuizPick] = useState<number | null>(null);
  const [incidentOver, setIncidentOver] = useState<IncidentState | null>(null);
  /** Stars already celebrated this session per level, so improving a level celebrates again. */
  const awarded = useRef(new Map<string, number>());

  // preferences
  const [theme, toggleTheme] = useTheme();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [palCollapsed, togglePalette] = useStoredFlag('paletteCollapsed', false, EMBED || undefined);
  const [showZones, toggleZones] = useStoredFlag('zones', true);
  const [sfx, setSfxState] = useState(sfxOn);
  useEffect(() => onSfxChange(setSfxState), []);
  const [voice] = useVoice();

  // overlays
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const [banner, setBanner] = useAutoClear<{ title: string; text: string }>(4800);
  const [intro, setIntro] = useState<number | null>(() => (introSeen() || readHashDesign() || readHashLevel() || PLAY_ID || EMBED ? null : 0));
  const [touring, setTouring] = useState(false);
  const [picker, setPicker] = useState(false);
  const [hub, setHub] = useState<HubView | null>(null);
  const [voiceMenu, setVoiceMenu] = useState<DOMRect | null>(null);
  const [achOpen, setAchOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [makerOpen, setMakerOpen] = useState(false);
  const [cmdk, setCmdk] = useState(false);
  const [review, setReview] = useState<Review | null | 'loading'>(null);
  /** The level's case file: opens with a level the player hasn't cleared, and from the Mission tab. */
  const [caseOpen, setCaseOpen] = useState(() => {
    const s = lookup(start.id);
    return !!s?.case && !EMBED && introSeen() && !caseSeen(s.id) && !loadCleared().has(s.id);
  });
  /** The coached first level starts once its case has been read. */
  const coachAfterCase = useRef(false);
  const [pin, setPin] = useState<SharedDesign | null>(null);
  const pinHere = pin?.scenarioId === scenario.id ? pin : null;

  // selection and the side panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const [tab, setTabRaw] = useState<Tab>('mission');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picked, setPicked] = useState<Shown | null>(null);
  const setTab = useCallback((t: Tab) => {
    setTabRaw(t);
    if (t !== 'requests') setPicked(null);
  }, []);

  const flow = useReactFlow();
  const canvas = useCanvasFit(flow);

  const onGoalsHeld = (m: Metrics): boolean => {
    if (inSandbox) return false;
    const parts = partsOf(nodesRef.current);
    const r = scoreStars(scenario, m, parts);
    const before = awarded.current.get(scenario.id) ?? 0;
    if (cleared.has(scenario.id) && r.stars <= before) return false;
    awarded.current.set(scenario.id, r.stars);
    if (m.costPer1k <= r.par.cost * 0.5) setFlags(addFlag('half-budget'));
    if (parts < r.par.parts) setFlags(addFlag('under-par'));
    if (scenario.kind === 'daily') setDaily(saveDaily(scenario.id.slice(6), { stars: r.stars, cost: m.costPer1k, parts }));
    track('level_won', { level: analyticsLevel(scenario), stars: r.stars });
    setQuizPick(null);
    setResult({ ...r, improved: before > 0 });
    setWon(true);
    setCleared((c) => new Set(c).add(scenario.id));
    setStars((st) => {
      if ((st[scenario.id] ?? 0) >= r.stars) return st;
      const next = { ...st, [scenario.id]: r.stars };
      saveStars(next);
      return next;
    });
    return true;
  };

  const sim = useSimulation({
    scenario,
    graph,
    designSig,
    traffic,
    events: {
      onGoalReached: () => play('goal'),
      onGoalsHeld,
      onIncidentStarted: (kind) => {
        const d = INCIDENTS[kind];
        setBanner({ title: d.title, text: d.text });
        speak(`incident-${d.kind}`, d.text);
        play('problem');
      },
      onIncidentOver: (run) => {
        setIncidentOver(run);
        setIncidentBest(saveIncidentBest({ seconds: Math.round(run.t), incidents: run.count }));
        speak('incident-over', `Your system went down after ${formatDuration(run.t).replace('m', ' minutes').replace('s', ' seconds')}.`);
        track('incident_over', { seconds: Math.round(run.t), incidents: run.count });
      },
    },
  });
  const { running, setRunning, metrics, pressure, streak, goals, incident, reset: resetSim, setRps } = sim;
  const toggleRun = useCallback(() => setRunning((r) => !r), [setRunning]);

  const guide = useGuide({ scenario, nodes, designSig, running, won, streak, streakRef: sim.refs.streak, pressure, stars: result?.stars ?? 1 });
  const { coach, setCoach, stuck, setStuck, missing } = guide;

  const progress: Progress = useMemo(
    () => ({ cleared, stars, quiz, daily, dailyStreak: dayStreak, incident: incidentBest, lessonsRead: readCount, flags }),
    [cleared, stars, quiz, daily, dayStreak, incidentBest, readCount, flags],
  );
  const achievements = useAchievements(progress);

  const loadScenario = useCallback(
    (id: string, { fresh = false, showCase = true } = {}) => {
      const s = lookup(id) ?? SCENARIOS[0];
      setCaseOpen(showCase && !!s.case && !EMBED && !clearedRef.current.has(s.id));
      if (fresh) clearDesign(s.id);
      const saved = fresh ? null : loadDesign(s.id);
      const f = saved ? designToFlow(saved) : buildFlow(s);
      setScenarioId(s.id);
      setNodes(f.nodes);
      setEdges(f.edges);
      setRps(s.traffic.rps);
      resetSim(s);
      setWon(false);
      setQuizPick(null);
      setIncidentOver(null);
      setBanner(null);
      setSelectedId(null);
      setTab('mission');
      const path = pathFor(s);
      if (window.location.pathname !== path || window.location.hash) window.history.replaceState(null, '', `${path}${window.location.search}`);
      track('level_start', { level: analyticsLevel(s) });
      canvas.fit();
    },
    [setNodes, setEdges, setRps, resetSim, setBanner, setTab, canvas],
  );

  const showFlow = useCallback(
    (d: SharedDesign) => {
      const f = designToFlow(d);
      setNodes(f.nodes);
      setEdges(f.edges);
    },
    [setNodes, setEdges],
  );

  // Open a shared design or level from the URL, once.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#d=')) {
      const d = readHashDesign();
      if (!d) {
        window.history.replaceState(null, '', window.location.pathname);
        showToast("That share link is broken or incomplete, so it couldn't be opened.");
        return;
      }
      const target = lookup(d.scenarioId) ? d.scenarioId : SANDBOX.id;
      const mine = loadDesign(target);
      loadScenario(target);
      showFlow({ ...d, scenarioId: target });
      showToast('Loaded a shared design. Press Space to run it.', mine ? { label: 'Back to my design', run: () => showFlow(mine) } : undefined);
    } else if (hash.startsWith('#l=')) {
      const h = readHashLevel();
      if (!h) {
        window.history.replaceState(null, '', window.location.pathname);
        showToast("That level link is broken or incomplete, so it couldn't be opened.");
        return;
      }
      const sc = customScenario(h.code, h.level);
      registerCustomLevel(sc);
      rememberLevel(sc.id, h.code);
      loadScenario(sc.id, { fresh: true });
      showToast('Playing a level someone made and shared. Press Space to run it.');
      track('custom_opened');
    } else if (start.restored && !PLAY_ID) {
      showToast('Picked up where you left off.', { label: 'Start over', run: () => loadScenario(start.id, { fresh: true }) });
    }
    if (EMBED) track('embed_view', { level: start.id });
    // build today's daily while the browser is idle, so opening it is instant
    const warm = window.setTimeout(() => {
      const build = () => void findBuiltIn(`daily-${todayKey()}`);
      if ('requestIdleCallback' in window) window.requestIdleCallback(build, { timeout: 4000 });
      else build();
    }, 1200);
    return () => window.clearTimeout(warm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => saveCleared(cleared), [cleared]);
  useEffect(() => {
    if (!EMBED) saveLastScenario(scenarioId);
  }, [scenarioId]);

  const baseTitle = useRef(document.title);
  useEffect(() => {
    document.title = scenario.kind || levelNumber(scenario) !== null ? `${displayTitle(scenario)} · AISim` : baseTitle.current;
  }, [scenario]);

  // Keep the design for each level, but only once it differs from where the level starts.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const s = lookup(scenarioId) ?? SCENARIOS[0];
      const mine = packDesign(scenarioId, nodes, edges);
      const initial = buildFlow(s);
      if (encodeDesign(mine) === encodeDesign(packDesign(scenarioId, initial.nodes, initial.edges))) clearDesign(scenarioId);
      else saveDesign(mine);
    }, 400);
    return () => window.clearTimeout(t);
  }, [nodes, edges, scenarioId]);

  // first run of each level visit, for the funnel
  const ranHere = useRef('');
  useEffect(() => {
    if (running && ranHere.current !== scenario.id) {
      ranHere.current = scenario.id;
      track('level_run', { level: scenario.kind ?? scenario.id });
    }
  }, [running, scenario]);

  const resetScenario = useCallback(() => {
    const before = { nodes: nodesRef.current, edges: edgesRef.current };
    loadScenario(scenario.id, { fresh: true, showCase: false });
    showToast('Scenario reset.', {
      label: 'Undo',
      run: () => {
        setNodes(before.nodes);
        setEdges(before.edges);
      },
    });
  }, [scenario.id, loadScenario, showToast, setNodes, setEdges]);

  const closeIntro = useCallback(() => {
    setIntro(null);
    markIntroSeen();
  }, []);
  const startPlaying = useCallback(() => {
    closeIntro();
    loadScenario(SCENARIOS[0].id, { fresh: true });
    if (SCENARIOS[0].case) coachAfterCase.current = true;
    else setCoach(0);
  }, [closeIntro, loadScenario, setCoach]);

  const closeCase = useCallback(() => {
    setCaseOpen(false);
    markCaseSeen(scenario.id);
    if (coachAfterCase.current) {
      coachAfterCase.current = false;
      setCoach(0);
    }
  }, [scenario.id, setCoach]);

  const restartIncident = useCallback(() => {
    setIncidentOver(null);
    resetSim(scenario, { run: true });
  }, [resetSim, scenario]);

  const next = nextAfter(scenario, new Set([...cleared, scenario.id]));
  const goNext = () => {
    if (EMBED) {
      window.open(`${SITE}${next ? pathFor(next) : '/'}`, '_blank', 'noopener');
      setWon(false);
    } else if (next) loadScenario(next.id);
    else if (scenario.kind === 'daily' || scenario.kind === 'custom') {
      setWon(false);
      setPicker(true);
    } else loadScenario(SANDBOX.id);
  };

  const copyText = useCallback(
    async (text: string, done: string) => {
      try {
        if ((await shareOrCopy(text)) === 'copied') showToast(done);
      } catch {
        showToast("Couldn't copy on this device.");
      }
    },
    [showToast],
  );

  const share = useCallback(async () => {
    const url = `${window.location.origin}/#d=${encodeDesign(packDesign(scenario.id, nodesRef.current, edgesRef.current))}`;
    track('share', { kind: 'design' });
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied. Anyone with it can open this design.');
    } catch {
      showToast('Link is ready in the address bar.');
    }
  }, [scenario.id, showToast]);

  const shareResult = useCallback(async () => {
    const after = sim.refs.metrics.current;
    if (!after) return;
    const earned = result?.stars ?? 1;
    const site = `${SITE}/`;
    track('share', { kind: scenario.kind ?? 'level' });
    if (scenario.kind === 'daily') {
      const key = scenario.id.slice(6);
      const r = daily[key] ?? { stars: earned, cost: after.costPer1k, parts: partsOf(nodesRef.current) };
      await copyText(`${dailyShareText(key, r, dayStreak)}\n${site}`, 'Result copied, ready to paste.');
      return;
    }
    const num = levelNumber(scenario);
    const label = num ? `Level ${num}` : scenario.kind === 'boss' ? 'Boss level' : 'Level';
    const { drawCard, improvements, shareText } = await import('../share/shareCard');
    const imps = improvements(scenario, sim.refs.baseline.current, after);
    const text = shareText(scenario, label, earned, imps);
    try {
      const blob = await drawCard({ s: scenario, label, stars: earned, imps, site });
      const file = new File([blob], `aisim-${scenario.id}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: site });
        return;
      }
      downloadBlob(blob, file.name);
      try {
        await navigator.clipboard.writeText(`${text} ${site}`);
        showToast('Card downloaded. Post text copied, ready to paste.');
      } catch {
        showToast('Card downloaded.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast("Couldn't create the card on this device.");
    }
  }, [scenario, result, daily, dayStreak, copyText, showToast, sim.refs]);

  const publishLevel = useCallback(
    async (code: string, level: CustomLevel) => {
      const sc = customScenario(code, level);
      registerCustomLevel(sc);
      rememberLevel(sc.id, code);
      setFlags(addFlag('made-level'));
      track('level_made');
      if (await copyWithFallback(`${SITE}/#l=${code}`, 'Copy this link to share your level:')) showToast('Level link copied. Anyone who opens it plays your level.');
    },
    [showToast],
  );

  const copyEmbed = useCallback(
    async (id: string) => {
      const title = displayTitle(lookup(id) ?? SANDBOX).replace(/"/g, '&quot;');
      const html = `<iframe src="${SITE}/play/${id}?embed=1" title="AISim: ${title}" width="100%" height="720" style="border:0;border-radius:12px" loading="lazy"></iframe>`;
      if (await copyWithFallback(html, 'Copy this embed code:')) showToast('Embed code copied. Paste it into any page or blog that allows iframes.');
      track('embed_copied', { level: id });
    },
    [showToast],
  );

  const downloadCertificate = useCallback(
    async (name: string) => {
      try {
        const { drawCertificate } = await import('../share/shareCard');
        const blob = await drawCertificate({
          name,
          levels: SCENARIOS.length,
          stars: totalStars(stars),
          maxStars: (SCENARIOS.length + BOSSES.length) * 3,
          bosses: BOSSES.filter((b) => cleared.has(b.id)).length,
          date: new Date(),
          site: SITE,
        });
        downloadBlob(blob, 'aisim-certificate.png');
        track('certificate');
      } catch {
        showToast("Couldn't draw the certificate on this device.");
      }
    },
    [stars, cleared, showToast],
  );

  const onConnect = useCallback(
    ({ source, target }: Connection) => {
      if (!source || !target || source === target) return;
      setEdges((es) => (es.some((e) => e.source === source && e.target === target) ? es : addEdge(edgeOf(source, target), es)));
    },
    [setEdges],
  );

  const addNode = useCallback(
    (type: ComponentType, position?: { x: number; y: number }) => {
      const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
      const es = edgesRef.current;
      // wire it in where it belongs in the pipeline, so nobody has to drag wires to see an effect
      const wired = autoWire(
        nodesRef.current.map((n) => ({ id: n.id, type: n.data.kind })),
        es.map((e) => ({ source: e.source, target: e.target })),
        { id, type },
      );
      // phones: don't cover the canvas with the settings sheet; just add it and say so
      const phone = window.matchMedia(PHONE_QUERY).matches;
      const added: SimFlowNode = { id, type: 'sim', position: position ?? { x: 0, y: 0 }, selected: !phone, data: { kind: type, config: { ...COMPONENTS[type].defaults } } };
      let next = [...nodesRef.current.map((n) => ({ ...n, selected: false })), added];
      if (!position) {
        // tapped from the palette rather than dropped: tidy the diagram into columns along the flow
        const at = tidyLayout(
          next.map((n) => ({ id: n.id, type: n.data.kind })),
          wired,
        );
        next = next.map((n) => (at.has(n.id) ? { ...n, position: at.get(n.id)! } : n));
        canvas.fit(300);
      }
      play('add');
      setNodes(next);
      setEdges(reuseEdges(wired, es));
      if (phone) {
        showToast(`Added ${COMPONENTS[type].name}. Tap it to change its settings.`);
      } else {
        setSelectedId(id);
        setTab('component');
      }
    },
    [canvas, setNodes, setEdges, setTab, showToast],
  );

  const updateConfig = useCallback(
    (id: string, key: string, v: ConfigValue) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: v } } } : n))),
    [setNodes],
  );

  /** Remove components and reconnect their neighbours, so deleting the middle of a pipeline doesn't cut it in two. */
  const healAfterDelete = useCallback(
    (ids: string[]) => {
      setEdges((es) => {
        let pairs = es.map((e) => ({ source: e.source, target: e.target }));
        for (const id of ids) pairs = removeAndHeal(pairs, id);
        return reuseEdges(pairs, es);
      });
    },
    [setEdges],
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      healAfterDelete([id]);
      setSelectedId(null);
      setTab('mission');
    },
    [setNodes, healAfterDelete, setTab],
  );

  const focusNode = useCallback(
    (id: string) => {
      setReview(null);
      setWon(false);
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
      setSelectedId(id);
      setTab('component');
      setSheetOpen(true);
      const n = nodesRef.current.find((x) => x.id === id);
      if (n) void flow.setCenter(n.position.x + 110, n.position.y + 40, { zoom: 1, duration: 400 });
    },
    [flow, setNodes, setTab],
  );

  const openReview = useCallback(() => {
    setReview('loading');
    setRunning(false);
    track('review', { level: scenario.kind ?? scenario.id });
    // let the dialog paint first: the review reruns the design once per component
    window.setTimeout(async () => {
      const { reviewDesign } = await import('../engine/review');
      const done = reviewDesign(scenario, graph, sim.testTraffic, goals);
      // closed while it was working: don't reopen it
      setReview((r) => (r === 'loading' ? done : r));
    }, 60);
  }, [scenario, graph, sim.testTraffic, goals, setRunning]);

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

  const answerQuiz = useCallback(
    (i: number) => {
      const q = QUIZ[scenario.id];
      if (!q) return;
      const correct = i === q.answer;
      setQuizPick(i);
      setQuiz(saveQuiz(scenario.id, correct));
      play(correct ? 'goal' : 'pause');
      track('quiz', { level: scenario.id, correct });
    },
    [scenario.id],
  );

  const unlock = useMemo(() => paletteLocks(scenario, new Set(nodes.map((n) => n.data.kind)), unlockAll), [scenario, nodes, unlockAll]);

  /** The path a picked request took: Users first, then each component once, in order. */
  const traced = useMemo(() => {
    if (!picked) return null;
    const users = nodesRef.current.find((n) => n.data.kind === 'users')?.id;
    const ids = [users, ...picked.steps.map((s) => s.nodeId)].filter((x): x is string => !!x);
    return ids.filter((id, i) => ids.indexOf(id) === i);
  }, [picked]);

  const zones = useMemo(() => (showZones ? zoneNodes(nodes) : []), [nodes, showZones]);
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

  const active = useMemo(() => new Set(metrics?.activeNodeIds ?? []), [metrics]);
  const arrow = useMemo(() => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color: theme === 'dark' ? '#71717a' : '#a1a1aa' }), [theme]);
  const viewEdges = useMemo(
    () =>
      edges.map((e) => {
        const onTrace = !!traced?.some((id, i) => id === e.source && traced.slice(i + 1).includes(e.target));
        return {
          ...e,
          markerEnd: arrow,
          className: traced ? (onTrace ? 'is-traced' : 'is-dimmed') : undefined,
          data: {
            live: running && !traced && active.has(e.source) && active.has(e.target),
            rate: metrics?.nodeStats[e.target]?.rps ?? 0,
            trace: onTrace && traced ? { index: traced.indexOf(e.source), count: Math.max(1, traced.length - 1) } : undefined,
          },
        };
      }),
    [edges, running, active, metrics, traced, arrow],
  );

  const anyDialog = caseOpen || intro !== null || touring || won || picker || !!hub || cmdk || compareOpen || makerOpen || achOpen || !!incidentOver || !!review;
  useShortcuts({ blocked: anyDialog, onToggleRun: toggleRun, onCommands: EMBED ? undefined : () => setCmdk(true) });

  const tour = useMemo(() => tourSteps({ setTab, run: () => setRunning(true) }), [setTab, setRunning]);
  const openLearn = () => setHub({ tab: 'lessons', lessonId: firstUnreadLesson(loadRead()) });
  const toggleSfx = () => setSfx(!sfx);

  const togglePal = () => {
    togglePalette();
    // the canvas changes width as the column animates; refit once it settles
    setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
  };

  const selected = nodes.find((n) => n.id === selectedId);
  const num = levelNumber(scenario);
  const winKicker = num
    ? `Level ${num} cleared`
    : scenario.kind === 'boss'
      ? 'Boss beaten'
      : scenario.kind === 'daily'
        ? `Daily #${dailyNumber(scenario.id.slice(6))} solved`
        : 'Level cleared';
  const nextLabel = EMBED
    ? 'Keep playing on AISim'
    : next
      ? next.kind === 'boss'
        ? 'Face the boss'
        : 'Next level'
      : scenario.kind === 'daily' || scenario.kind === 'custom'
        ? 'Back to the levels'
        : 'Open the sandbox';

  return (
    <div className={`app${palCollapsed ? ' pal-collapsed' : ''}${EMBED ? ' is-embed' : ''}`}>
      <TopBar
        scenario={scenario}
        tag={levelTag(scenario)}
        title={displayTitle(scenario)}
        embedLink={EMBED ? `${SITE}${pathFor(scenario)}` : undefined}
        traffic={{
          rps: sim.rps,
          setRps,
          pattern: sim.pattern,
          setPattern: sim.setPattern,
          offered: metrics && sim.pattern !== 'steady' ? metrics.offered : null,
          simTime: sim.simTime,
        }}
        running={running}
        pinned={!!pinHere}
        theme={theme}
        sfx={sfx}
        voice={voice}
        voiceMenuOpen={!!voiceMenu}
        actions={{
          openLevels: () => setPicker(true),
          reset: resetScenario,
          share,
          compare,
          learn: openLearn,
          toggleTheme,
          toggleSfx,
          toggleVoiceMenu: (anchor) => setVoiceMenu(voiceMenu ? null : anchor),
          commands: () => setCmdk(true),
          tour: () => setTouring(true),
          toggleRun,
          makeLevel: inSandbox ? () => setMakerOpen(true) : undefined,
        }}
      />

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
            const real = changes.toArray().filter((c) => !('id' in c) || !isZoneId(c.id));
            if (real.length) onNodesChange(new NodeChangeset<SimFlowNode>(real));
          }}
          onNodesDelete={(deleted) => healAfterDelete(deleted.map((d) => d.id))}
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
          // phones: one-finger swipes scroll the page; pinch still zooms and the fit button recentres
          panOnDrag={!isPhone}
          preventScrolling={!isPhone}
          nodesDraggable={!isPhone}
          fitView
          fitViewOptions={fitOptions()}
          onMoveStart={(e) => {
            // e is null for programmatic moves like fitView; only the player's own pans and zooms count
            if (e) canvas.markMoved();
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
        <Telemetry m={metrics} history={sim.history} goals={goals} focus={scenario.difficulty === 1} />
        {banner && <IncidentBanner title={banner.title} text={banner.text} />}
        <Complaints samples={metrics?.samples} running={running && !guide.celebrate} />
      </main>

      {isPhone && sheetOpen && selected && <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} aria-hidden />}
      <SidePanel
        key={scenario.id}
        sheet={isPhone ? { open: sheetOpen && !!selected, onClose: () => setSheetOpen(false) } : undefined}
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
        onMix={(patch) => setMixOverride((o) => ({ ...o, ...patch }))}
        onResetMix={() => setMixOverride(null)}
        onReview={EMBED ? undefined : openReview}
        onShowCase={() => setCaseOpen(true)}
      />

      <Suspense fallback={null}>
        {intro !== null && (
          <WelcomeScreen
            onPlay={startPlaying}
            onBrowse={() => {
              closeIntro();
              setPicker(true);
            }}
            onFree={() => {
              closeIntro();
              loadScenario(SANDBOX.id);
            }}
            onClose={closeIntro}
          />
        )}
        {caseOpen && scenario.case && <CaseIntro s={{ ...scenario, case: scenario.case }} kicker={num ? `Level ${num}` : 'Level'} onStart={closeCase} />}
        {coach !== null && !caseOpen && (
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
            actions={stuck < 3 ? [{ label: stuck === 1 ? 'Give me a hint' : 'Show me', onClick: () => setStuck(stuck === 1 ? 2 : 3) }] : undefined}
            onClose={() => {
              setStuck(-1);
              stopVoice();
            }}
            closeLabel="Hide hints"
          />
        )}
        {guide.celebrate && <Confetti />}
        {voiceMenu && <VoiceMenu anchor={voiceMenu} onClose={() => setVoiceMenu(null)} />}
        {touring && (
          <Tour
            steps={tour}
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
                achievements={[Object.keys(achievements.unlocked).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)).length, ACHIEVEMENTS.length]}
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
        {toast && <Toast toast={toast} onDismiss={dismissToast} />}
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
            path={requestPath(graph).map((k) => (k === 'users' ? 'Customer' : COMPONENTS[k].name))}
          />
        )}
        {incidentOver && (
          <IncidentOverDialog
            seconds={incidentOver.t}
            incidents={incidentOver.count}
            best={incidentBest}
            onRetry={restartIncident}
            onShare={() =>
              copyText(
                `I kept an AI system alive for ${formatDuration(incidentOver.t)} through ${incidentOver.count} incidents in AISim's incident mode. ${SITE}/`,
                'Result copied, ready to paste.',
              )
            }
            onLevels={() => {
              setIncidentOver(null);
              setPicker(true);
            }}
          />
        )}
        {compareOpen && pinHere && (
          <CompareDialog
            pinned={{ graph: designGraph(pinHere), parts: pinHere.nodes.filter((n) => n.type !== 'users').length }}
            current={{ graph, parts: partsOf(nodes) }}
            traffic={sim.testTraffic}
            goals={goals}
            onRestore={() => {
              showFlow(pinHere);
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
            traffic={{ ...traffic, rps: sim.rps }}
            solution={packDesign(SANDBOX.id, nodes, edges)}
            pinned={pin?.scenarioId === SANDBOX.id ? pin : null}
            onPublish={publishLevel}
            onClose={() => setMakerOpen(false)}
          />
        )}
        {achOpen && (
          <AchievementsDialog
            progress={progress}
            unlocked={achievements.unlocked}
            levelsTotal={SCENARIOS.length}
            levelsCleared={SCENARIOS.filter((x) => cleared.has(x.id)).length}
            totalStars={totalStars(stars)}
            onCertificate={downloadCertificate}
            onClose={() => setAchOpen(false)}
          />
        )}
        {review && <ReviewDialog review={review === 'loading' ? null : review} onFocusNode={focusNode} onClose={() => setReview(null)} />}
        {cmdk && (
          <CommandPalette
            commands={buildCommands(
              { running, pinned: !!pinHere, inSandbox, showZones, theme, sfx, locks: unlock?.locks },
              {
                toggleRun,
                add: (t) => addNode(t),
                review: openReview,
                compare,
                share,
                makeLevel: () => setMakerOpen(true),
                reset: resetScenario,
                levels: () => setPicker(true),
                daily: () => loadScenario(`daily-${todayKey()}`),
                incident: () => loadScenario(INCIDENT_SCENARIO.id),
                sandbox: () => loadScenario(SANDBOX.id),
                learn: openLearn,
                achievements: () => setAchOpen(true),
                toggleZones,
                toggleTheme,
                toggleSfx,
                tour: () => setTouring(true),
              },
            )}
            onClose={() => setCmdk(false)}
          />
        )}
      </Suspense>
      {achievements.showing && <AchievementToast key={achievements.showing} title={achievements.showing} />}
    </div>
  );
}
