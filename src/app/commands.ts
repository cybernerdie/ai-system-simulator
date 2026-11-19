import { COMPONENTS, PALETTE_ORDER } from '../engine/components';
import { dailyNumber, todayKey } from '../engine/modes/daily';
import type { ComponentType } from '../engine/types';
import type { Command } from '../ui/dialogs/CommandPalette';

interface CommandState {
  running: boolean;
  pinned: boolean;
  inSandbox: boolean;
  showZones: boolean;
  theme: 'light' | 'dark';
  sfx: boolean;
  locks?: Map<ComponentType, number>;
}

interface CommandActions {
  toggleRun: () => void;
  add: (t: ComponentType) => void;
  review: () => void;
  compare: () => void;
  share: () => void;
  makeLevel: () => void;
  reset: () => void;
  levels: () => void;
  daily: () => void;
  incident: () => void;
  sandbox: () => void;
  learn: () => void;
  achievements: () => void;
  toggleZones: () => void;
  toggleTheme: () => void;
  toggleSfx: () => void;
  tour: () => void;
}

/** Everything the command palette offers, grouped. Components you can add now come before locked ones. */
export function buildCommands(st: CommandState, act: CommandActions): Command[] {
  const add: Command[] = PALETTE_ORDER.filter((t) => t !== 'users').map((t) => {
    const lvl = st.locks?.get(t);
    return { id: `add-${t}`, group: 'Add', label: COMPONENTS[t].name, disabled: lvl ? `Unlocks in level ${lvl}` : false, run: () => act.add(t) };
  });
  return [
    { id: 'run', group: 'Run', label: st.running ? 'Pause the simulation' : 'Run the simulation', keys: 'Space', run: act.toggleRun },
    ...add.filter((c) => !c.disabled),
    ...add.filter((c) => c.disabled),
    { id: 'review', group: 'Design', label: 'Review my design', run: act.review },
    { id: 'compare', group: 'Design', label: st.pinned ? 'Compare with the pinned design' : 'Pin this design to compare later', run: act.compare },
    { id: 'share', group: 'Design', label: 'Copy a link to this design', run: act.share },
    ...(st.inSandbox ? [{ id: 'maker', group: 'Design', label: 'Make a level from this sandbox', run: act.makeLevel }] : []),
    { id: 'reset', group: 'Design', label: 'Reset this level', run: act.reset },
    { id: 'levels', group: 'Go to', label: 'All levels', run: act.levels },
    { id: 'daily', group: 'Go to', label: `Daily challenge #${dailyNumber(todayKey())}`, run: act.daily },
    { id: 'incident', group: 'Go to', label: 'Incident mode', run: act.incident },
    { id: 'sandbox', group: 'Go to', label: 'Sandbox', run: act.sandbox },
    { id: 'learn', group: 'Go to', label: 'Lessons and glossary', run: act.learn },
    { id: 'ach', group: 'Go to', label: 'Achievements', run: act.achievements },
    { id: 'zones', group: 'Settings', label: st.showZones ? 'Hide the zone labels on the canvas' : 'Show zone labels on the canvas', run: act.toggleZones },
    { id: 'theme', group: 'Settings', label: st.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', run: act.toggleTheme },
    { id: 'sfx', group: 'Settings', label: st.sfx ? 'Turn sound effects off' : 'Turn sound effects on', run: act.toggleSfx },
    { id: 'tour', group: 'Help', label: 'Take the tour', run: act.tour },
  ];
}
