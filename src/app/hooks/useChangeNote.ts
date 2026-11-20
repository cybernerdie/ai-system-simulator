import { useEffect, useRef, useState } from 'react';
import { describeChange, goalShifts, type Shift } from '../../engine/changes';
import { simulate } from '../../engine/simulate';
import type { Goal, SimGraph, TrafficProfile } from '../../engine/types';

export interface ChangeNote {
  /** Bumps per note, so the card can restart its timer and animation for a new one. */
  id: number;
  what: string;
  shifts: Shift[];
}

/** Long enough that dragging a slider or adding and wiring a part counts as one change. */
const SETTLE_MS = 650;
const SHOW_MS = 7000;
/** Seeded and fixed, so a note compares designs rather than sampling noise. */
const RUN = { seed: 7, samples: 3000 };

/**
 * After each design change, say what changed and how the goals moved. Both designs are simulated
 * directly rather than read off the live numbers: those are smoothed and take seconds to settle, so a
 * note based on them would arrive late and could catch them halfway.
 *
 * `epoch` changes when a level loads or resets, which starts a new baseline without a note.
 */
export function useChangeNote({
  graph,
  sig,
  epoch,
  running,
  traffic,
  goals,
}: {
  graph: SimGraph;
  sig: string;
  epoch: number;
  running: boolean;
  traffic: TrafficProfile;
  goals: Goal[];
}) {
  const [note, setNote] = useState<ChangeNote | null>(null);
  const base = useRef<{ epoch: number; graph: SimGraph; sig: string } | null>(null);
  const live = useRef({ running, traffic, goals });
  live.current = { running, traffic, goals };
  const count = useRef(0);

  useEffect(() => {
    if (!base.current || base.current.epoch !== epoch) {
      base.current = { epoch, graph, sig };
      setNote(null);
      return;
    }
    if (base.current.sig === sig) return;
    const t = setTimeout(() => {
      const before = base.current!.graph;
      base.current = { epoch, graph, sig };
      const { running, traffic, goals } = live.current;
      // paused: the numbers on screen aren't moving, so a note about them would be confusing
      if (!running) return;
      const what = describeChange(before, graph);
      if (!what) return;
      const shifts = goalShifts(simulate(before, traffic, RUN), simulate(graph, traffic, RUN), goals);
      setNote({ id: ++count.current, what, shifts });
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [sig, epoch, graph]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [note]);

  return [note, () => setNote(null)] as const;
}
