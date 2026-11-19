import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { COMPONENTS } from '../../engine/components';
import { SCENARIOS, type Scenario } from '../../engine/levels/scenarios';
import type { Pressure } from '../../engine/pressures';
import { COACH, hintLine, nudgeLine, pressureLine, showMeLine, winLine } from '../../content/guide';
import { speak } from '../../ui/audio/voice';
import { play } from '../../ui/audio/sfx';
import type { SimFlowNode } from '../../ui/canvas/SimNodeView';
import { HOLD_TICKS } from '../config';

/** Seconds without a design change before each rung of the hint ladder: nudge, hint, show me. */
const HINT_AFTER = [25, 50, 80];
const stageFor = (idle: number) => HINT_AFTER.filter((s) => idle > s).length;
const secondsFor = (stage: number) => (stage > 0 ? HINT_AFTER[stage - 1] : 0);

/** -1 means the player dismissed hints for this attempt. */
export type HintStage = -1 | 0 | 1 | 2 | 3;

interface Options {
  scenario: Scenario;
  nodes: SimFlowNode[];
  designSig: string;
  running: boolean;
  won: boolean;
  streak: number;
  streakRef: MutableRefObject<number>;
  pressure: Pressure | null;
  stars: number;
}

/**
 * Everything that teaches while you play: the coached first level, the hint ladder when you're
 * stuck, the voice naming each new problem, sound cues and the win celebration.
 */
export function useGuide({ scenario, nodes, designSig, running, won, streak, streakRef, pressure, stars }: Options) {
  const [coach, setCoach] = useState<number | null>(null);
  const [stuck, setStuck] = useState<HintStage>(0);
  const [celebrate, setCelebrate] = useState(false);

  // Coached first level: each step waits for the player to do the thing, then moves on.
  useEffect(() => {
    if (coach === null) return;
    const w = COACH[coach].wait;
    const done =
      (w.kind === 'running' && running) ||
      (w.kind === 'has' && nodes.some((n) => n.data.kind === w.type)) ||
      (w.kind === 'won' && (won || streak >= HOLD_TICKS));
    if (done) setCoach(coach + 1 < COACH.length ? coach + 1 : null);
  }, [coach, running, nodes, won, streak]);
  useEffect(() => {
    if (coach === null) return;
    speak(COACH[coach].id, COACH[coach].text);
    if (coach > 0) play('step');
  }, [coach]);
  useEffect(() => {
    if (scenario.id !== SCENARIOS[0].id) setCoach(null);
  }, [scenario.id]);

  // Hint ladder: running, not on track, and nothing changed for a while → help, one step at a time.
  const lastEdit = useRef(Date.now());
  useEffect(() => {
    lastEdit.current = Date.now();
    setStuck(0);
  }, [designSig, scenario.id]);
  const stuckRef = useRef(stuck);
  stuckRef.current = stuck;
  useEffect(() => {
    // pausing doesn't count as being stuck: resume the clock where the current rung left off
    if (running) lastEdit.current = Date.now() - secondsFor(Math.max(0, stuckRef.current)) * 1000;
  }, [running]);
  useEffect(() => {
    if (!running || coach !== null || won || !scenario.goals.length || scenario.kind === 'incident') return;
    const id = window.setInterval(() => {
      if (streakRef.current > 0) return;
      const stage = stageFor((Date.now() - lastEdit.current) / 1000) as HintStage;
      setStuck((s) => (s < 0 || stage <= s ? s : stage));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, coach, won, scenario, streakRef]);

  const missing = useMemo(() => {
    const type = scenario.solution.nodes.map((n) => n.type).find((t) => !nodes.some((n) => n.data.kind === t));
    return type ? COMPONENTS[type] : null;
  }, [scenario, nodes]);

  const said = useRef({ pressure, missing, scenario });
  said.current = { pressure, missing, scenario };
  useEffect(() => {
    const { pressure: p, missing: m, scenario: s } = said.current;
    const line = stuck === 1 && p ? nudgeLine(p.key) : stuck === 2 ? hintLine(s) : stuck === 3 && m ? showMeLine(m.name) : null;
    if (line) speak(line.id, line.text);
  }, [stuck]);

  // The voice names each new problem once it has settled for a moment.
  const spoken = useRef('');
  const heard = useRef('');
  useEffect(() => {
    spoken.current = '';
    heard.current = '';
  }, [scenario.id]);
  useEffect(() => {
    if (!running || coach !== null || !pressure || stuck > 0 || pressure.key === spoken.current) return;
    const key = pressure.key;
    const t = window.setTimeout(() => {
      spoken.current = key;
      const line = pressureLine(key);
      if (line) speak(line.id, line.text);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [pressure, running, coach, stuck]);

  // Sound cues: run and pause, and a chime for each new problem.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) play(running ? 'run' : 'pause');
    mounted.current = true;
  }, [running]);
  useEffect(() => {
    if (!running || !pressure || pressure.key === 'stable' || pressure.key === heard.current) return;
    heard.current = pressure.key;
    play('problem');
  }, [pressure, running]);

  const winStars = useRef(stars);
  winStars.current = stars;
  useEffect(() => {
    if (!won) return;
    play('win');
    for (let i = 0; i < winStars.current; i++) play('star', 0.5 + i * 0.18);
    const line = winLine(said.current.scenario);
    speak(line.id, line.text);
    setCelebrate(true);
    const t = window.setTimeout(() => setCelebrate(false), 2600);
    return () => window.clearTimeout(t);
  }, [won]);

  return { coach, setCoach, stuck, setStuck, missing, celebrate };
}
