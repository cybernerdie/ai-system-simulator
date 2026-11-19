/** Finding levels by id (built-in or player-made), their URLs, and where a visit starts. */
import { findBuiltIn, levelNumber } from '../engine/catalog';
import { todayKey } from '../engine/modes/daily';
import { SCENARIOS, type Scenario } from '../engine/levels/scenarios';
import { recallLevel } from '../share/customLevel';
import { loadDesign, loadLastScenario } from '../lib/progress';
import { PLAY_ID } from './config';
import { buildFlow, designToFlow, type Flow } from './flow';

const customLevels = new Map<string, Scenario>();

export function registerCustomLevel(s: Scenario) {
  customLevels.set(s.id, s);
}

export function lookup(id: string): Scenario | undefined {
  const builtIn = findBuiltIn(id);
  if (builtIn) return builtIn;
  if (!customLevels.has(id)) {
    const recalled = recallLevel(id);
    if (recalled) customLevels.set(id, recalled);
  }
  return customLevels.get(id);
}

/** Numbered levels and bosses have their own page (/play/<id>); everything else lives at the root. */
export const hasPage = (s: Scenario) => levelNumber(s) !== null || s.kind === 'boss';
export const pathFor = (s: Scenario) => (hasPage(s) ? `/play/${s.id}` : '/');

/** "07 · The docs chatbot" → "The docs chatbot" */
export const displayTitle = (s: Scenario) => s.title.replace(/^(\d+|Boss|Daily #\d+) · /, '');

/** Where a visit starts: the page's own level, else the level you were last on (with your work), else level 1. */
export function startingPoint(): { id: string; restored: boolean; flow: Flow } {
  const fromUrl = PLAY_ID ? lookup(PLAY_ID) : undefined;
  const last = loadLastScenario();
  const remembered = last ? lookup(last) : undefined;
  const resumable = remembered && remembered.kind !== 'incident' && !(remembered.kind === 'daily' && remembered.id !== `daily-${todayKey()}`);
  const s = fromUrl ?? (resumable ? remembered : SCENARIOS[0]);
  const saved = loadDesign(s.id);
  return { id: s.id, restored: !!saved, flow: saved ? designToFlow(saved) : buildFlow(s) };
}

/** How a level is named in analytics: modes and player-made levels are grouped, built-ins by id. */
export const analyticsLevel = (s: Scenario) => (s.kind === 'daily' ? 'daily' : s.kind === 'custom' ? 'custom' : s.id);
