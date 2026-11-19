import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { simulate } from '../../engine/simulate';
import { TICK_SECONDS, trafficMultiplier, type Pattern } from '../../engine/patterns';
import { bindingPressure, goalMet, type Pressure } from '../../engine/pressures';
import { INCIDENT_SCENARIO, incidentGoals, incidentTick, incidentTraffic, newIncidentRun, type IncidentKind, type IncidentState } from '../../engine/modes/incident';
import type { Scenario } from '../../engine/levels/scenarios';
import type { Goal, Metrics, SimGraph, TrafficProfile } from '../../engine/types';
import { HISTORY, HOLD_TICKS, SAMPLES_PER_TICK, TICK_MS } from '../config';
import { smoothMetrics } from '../smoothMetrics';

export interface SimulationEvents {
  /** Another goal turned green. */
  onGoalReached?: () => void;
  /** Every goal has held for HOLD_TICKS in a row. Fires each tick; return true to end the run. */
  onGoalsHeld?: (m: Metrics) => boolean;
  onIncidentStarted?: (kind: IncidentKind) => void;
  onIncidentOver?: (run: IncidentState) => void;
}

interface Options {
  scenario: Scenario;
  graph: SimGraph;
  /** Changes to this (and only this) mean the design changed, so held goals must be earned again. */
  designSig: string;
  traffic: TrafficProfile;
  events: SimulationEvents;
}

const newRun = (s: Scenario) => (s.kind === 'incident' ? newIncidentRun(Math.floor(Math.random() * 1e6)) : null);

/**
 * The live simulation: a fixed-rate tick loop that runs the design against traffic, smooths the
 * numbers, tracks how long the goals have held and, in incident mode, advances the incident run.
 */
export function useSimulation({ scenario, graph, designSig, traffic, events }: Options) {
  const [running, setRunning] = useState(false);
  const [rps, setRps] = useState(scenario.traffic.rps);
  const [pattern, setPattern] = useState<Pattern>('steady');
  const [simTime, setSimTime] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<Metrics[]>([]);
  const [pressure, setPressure] = useState<Pressure | null>(null);
  const [streak, setStreak] = useState(0);
  const [incident, setIncident] = useState<IncidentState | null>(() => (scenario.kind === 'incident' ? newIncidentRun(1) : null));

  // The loop reads the latest values through refs so it doesn't restart on every edit.
  const live = useRef({ graph, traffic, events });
  live.current = { graph, traffic, events };
  const simTimeRef = useRef(0);
  const metricsRef = useRef<Metrics | null>(null);
  const streakRef = useRef(0);
  const incidentRef = useRef(incident);
  const seed = useRef(1);
  const ticks = useRef(0);
  const goalsMet = useRef(0);
  /** The numbers a few ticks into the first run, for the before → after share card. */
  const baselineRef = useRef<Metrics | null>(null);

  const refs = useMemo(() => ({ metrics: metricsRef, streak: streakRef, baseline: baselineRef }), []);

  const goals: Goal[] = useMemo(
    () => (scenario.kind === 'incident' ? incidentGoals((incident?.active ?? []).map((a) => a.kind)) : scenario.goals),
    [scenario, incident],
  );

  /** The traffic a one-off rerun (review, compare) should use: what the player is currently facing. */
  const testTraffic: TrafficProfile = useMemo(
    () => (scenario.kind === 'incident' && incident ? incidentTraffic(incident.active.map((a) => a.kind), incident.count) : { ...traffic, rps }),
    [scenario.kind, incident, traffic, rps],
  );

  useEffect(() => {
    streakRef.current = 0;
    setStreak(0);
  }, [designSig]);

  useEffect(() => {
    goalsMet.current = 0;
    baselineRef.current = null;
  }, [scenario.id]);

  const reset = useCallback((next: Scenario, { run = false } = {}) => {
    const inc = newRun(next);
    incidentRef.current = inc;
    setIncident(inc);
    simTimeRef.current = 0;
    metricsRef.current = null;
    streakRef.current = 0;
    setSimTime(0);
    setMetrics(null);
    setHistory([]);
    setPressure(null);
    setStreak(0);
    setRunning(run);
  }, []);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const { graph: g, traffic: base, events: on } = live.current;
      simTimeRef.current += TICK_SECONDS;
      setSimTime(simTimeRef.current);

      const inc = scenario.kind === 'incident' ? incidentRef.current : null;
      const activeKinds = inc ? inc.active.map((a) => a.kind) : [];
      const shape = inc ? incidentTraffic(activeKinds, inc.count) : base;
      const baseRps = inc ? shape.rps * (rps / INCIDENT_SCENARIO.traffic.rps) : rps;
      const offered = Math.max(0.5, Math.round(baseRps * trafficMultiplier(pattern, simTimeRef.current) * 10) / 10);
      const raw = simulate(g, { ...shape, rps: offered }, { seed: seed.current++, samples: SAMPLES_PER_TICK });

      ticks.current = metricsRef.current ? ticks.current + 1 : 0;
      const m = smoothMetrics(metricsRef.current, raw);
      if (ticks.current === 3 && !baselineRef.current) baselineRef.current = m;
      metricsRef.current = m;
      setMetrics(m);
      setHistory((h) => [...h.slice(-(HISTORY - 1)), m]);

      const gs = inc ? incidentGoals(activeKinds) : scenario.goals;
      setPressure(bindingPressure(m, gs));

      if (inc) {
        const nx = incidentTick(inc, gs.filter((goal) => !goalMet(m, goal)).length, TICK_SECONDS);
        incidentRef.current = nx;
        setIncident(nx);
        if (nx.started) on.onIncidentStarted?.(nx.started);
        if (nx.over) {
          setRunning(false);
          on.onIncidentOver?.(nx);
        }
        return;
      }
      if (!scenario.goals.length) return;

      const metNow = scenario.goals.filter((goal) => goalMet(m, goal)).length;
      if (metNow > goalsMet.current) on.onGoalReached?.();
      goalsMet.current = metNow;
      streakRef.current = metNow === scenario.goals.length ? Math.min(streakRef.current + 1, HOLD_TICKS) : 0;
      setStreak(streakRef.current);
      if (streakRef.current >= HOLD_TICKS && on.onGoalsHeld?.(m)) setRunning(false);
    };
    tick();
    const t = setInterval(tick, TICK_MS);
    return () => clearInterval(t);
  }, [running, rps, scenario, pattern]);

  return {
    running,
    setRunning,
    rps,
    setRps,
    pattern,
    setPattern,
    simTime,
    metrics,
    history,
    pressure,
    streak,
    goals,
    incident,
    testTraffic,
    reset,
    /** Read inside callbacks without re-creating them every tick. */
    refs,
  };
}
