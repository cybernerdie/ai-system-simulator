/**
 * Everything the player's browser remembers: progress, work in progress, mode results and preferences.
 * Built on lib/storage; the engine never touches storage itself.
 */
import { decodeDesign, encodeDesign, type SharedDesign } from '../share/designLink';
import { bestDailyResult, type DailyResult } from '../engine/modes/daily';
import { betterRun, type IncidentBest } from '../engine/modes/incident';
import { isRecord, readFlag, readJson, readString, recordOf, stringSet, writeFlag, writeJson, writeString } from './storage';

/* ---------- preferences ---------- */

export type Theme = 'light' | 'dark';

/** The theme the player picked, or null to follow the system setting. */
export function savedTheme(): Theme | null {
  const v = readString('theme');
  return v === 'light' || v === 'dark' ? v : null;
}
export const saveTheme = (t: Theme) => writeString('theme', t);

export const introSeen = () => readFlag('introSeen', false);
export const markIntroSeen = () => writeFlag('introSeen', true);

export const loadUnlockAll = () => readFlag('unlockAll', false);
export const saveUnlockAll = (on: boolean) => writeFlag('unlockAll', on);

export const loadCertName = () => readString('certName') ?? '';
export const saveCertName = (name: string) => writeString('certName', name);

/* ---------- progress ---------- */

export const loadCleared = () => readJson('cleared', stringSet, new Set<string>());
export const saveCleared = (s: Set<string>) => writeJson('cleared', [...s]);

const isStarCount = (n: unknown): n is number => typeof n === 'number' && n >= 1 && n <= 3;
export const loadStars = () => readJson('stars', recordOf(isStarCount), {});
export const saveStars = (s: Record<string, number>) => writeJson('stars', s);

export const loadRead = () => readJson('lessonsRead', stringSet, new Set<string>());
export const saveRead = (s: Set<string>) => writeJson('lessonsRead', [...s]);

/* ---------- work in progress, per level ---------- */

export const loadLastScenario = () => readString('lastScenario');
export const saveLastScenario = (id: string) => writeString('lastScenario', id);

const readDesigns = () =>
  readJson(
    'designs',
    recordOf((v): v is string => typeof v === 'string'),
    {},
  );

/** The design you last left in this level, if you changed it. */
export function loadDesign(scenarioId: string): SharedDesign | null {
  const raw = readDesigns()[scenarioId];
  const d = raw ? decodeDesign(raw) : null;
  return d && d.scenarioId === scenarioId ? d : null;
}
export function saveDesign(d: SharedDesign) {
  writeJson('designs', { ...readDesigns(), [d.scenarioId]: encodeDesign(d) });
}
export function clearDesign(scenarioId: string) {
  const all = readDesigns();
  if (!(scenarioId in all)) return;
  delete all[scenarioId];
  writeJson('designs', all);
}

/* ---------- modes ---------- */

const isDailyResult = (v: unknown): v is DailyResult => isRecord(v) && typeof v.stars === 'number' && typeof v.cost === 'number' && typeof v.parts === 'number';
export const loadDaily = () => readJson('daily', recordOf(isDailyResult), {});
/** Keeps the better of the stored and new result for that day; returns every day's result. */
export function saveDaily(day: string, r: DailyResult): Record<string, DailyResult> {
  const all = loadDaily();
  all[day] = bestDailyResult(all[day], r);
  writeJson('daily', all);
  return all;
}

const isRun = (v: unknown): v is IncidentBest => isRecord(v) && typeof v.seconds === 'number' && typeof v.incidents === 'number';
export const loadIncidentBest = () => readJson<IncidentBest | null>('incidentBest', (v) => (isRun(v) ? v : null), null);
export function saveIncidentBest(run: IncidentBest): IncidentBest {
  const best = betterRun(loadIncidentBest(), run);
  writeJson('incidentBest', best);
  return best;
}

/** Quiz answers: only the first answer to each question counts. */
export const loadQuiz = () =>
  readJson(
    'quiz',
    recordOf((v): v is boolean => typeof v === 'boolean'),
    {},
  );
export function saveQuiz(id: string, correct: boolean): Record<string, boolean> {
  const all = loadQuiz();
  if (!(id in all)) all[id] = correct;
  writeJson('quiz', all);
  return all;
}

/** Achievement id → when it was earned. */
export const loadUnlocked = () =>
  readJson(
    'achievements',
    recordOf((v): v is number => typeof v === 'number'),
    {},
  );
export const saveUnlocked = (u: Record<string, number>) => writeJson('achievements', u);

/** One-off facts about how you played (cleared a level at half budget, compared designs...). */
export const loadFlags = () => readJson('flags', stringSet, new Set<string>());
export function addFlag(flag: string): Set<string> {
  const s = loadFlags();
  s.add(flag);
  writeJson('flags', [...s]);
  return s;
}

/** Levels made by players, kept by id so a reload can reopen them. */
const readLevels = () =>
  readJson(
    'customLevels',
    recordOf((v): v is string => typeof v === 'string'),
    {},
  );
export const rememberLevel = (id: string, code: string) => writeJson('customLevels', { ...readLevels(), [id]: code });
export const recallLevelCode = (id: string): string | null => readLevels()[id] ?? null;
