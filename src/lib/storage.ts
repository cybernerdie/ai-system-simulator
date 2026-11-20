/**
 * The only module that touches localStorage.
 *
 * Every key is listed here and versioned, so a format change bumps a key instead of misreading old data.
 * Storage is best effort: private browsing, a full quota or a blocked origin means nothing persists,
 * and the app carries on.
 */
const KEYS = {
  introSeen: 'aisim.introSeen.v1',
  theme: 'aisim.theme.v1',
  lastScenario: 'aisim.lastScenario.v1',
  designs: 'aisim.designs.v1',
  cleared: 'aisim.cleared.v1',
  stars: 'aisim.stars.v1',
  unlockAll: 'aisim.unlockAll.v1',
  lessonsRead: 'aisim.lessonsRead.v1',
  casesSeen: 'aisim.casesSeen.v1',
  daily: 'aisim.daily.v1',
  incidentBest: 'aisim.incident.v1',
  quiz: 'aisim.quiz.v1',
  achievements: 'aisim.achievements.v1',
  flags: 'aisim.flags.v1',
  customLevels: 'aisim.customLevels.v1',
  certName: 'aisim.certName.v1',
  voice: 'aisim.voice.v1',
  voiceName: 'aisim.voiceName.v1',
  voiceRate: 'aisim.voiceRate.v1',
  sfx: 'aisim.sfx.v1',
  paletteCollapsed: 'aisim.palCollapsed.v1',
  zones: 'aisim.zones.v1',
  analyticsId: 'aisim.anon.v1',
} as const;

export type StorageKey = keyof typeof KEYS;

export function readString(key: StorageKey): string | null {
  try {
    return localStorage.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

export function writeString(key: StorageKey, value: string): void {
  try {
    localStorage.setItem(KEYS[key], value);
  } catch {
    /* best effort */
  }
}

/** Parse stored JSON and hand it to `parse`, which validates it and returns a clean value. */
export function readJson<T>(key: StorageKey, parse: (raw: unknown) => T, fallback: T): T {
  const raw = readString(key);
  if (raw === null) return fallback;
  try {
    return parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function writeJson(key: StorageKey, value: unknown): void {
  writeString(key, JSON.stringify(value));
}

/** Booleans were stored as '1'/'0' or 'on'/'off' over time; both read correctly. */
export function readFlag(key: StorageKey, fallback: boolean): boolean {
  const v = readString(key);
  if (v === '1' || v === 'on') return true;
  if (v === '0' || v === 'off') return false;
  return fallback;
}

export function writeFlag(key: StorageKey, on: boolean): void {
  writeString(key, on ? '1' : '0');
}

/* ---------- validators for stored JSON ---------- */

export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export const stringSet = (v: unknown): Set<string> => new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export const recordOf =
  <T>(valid: (x: unknown) => x is T) =>
  (v: unknown): Record<string, T> =>
    isRecord(v) ? (Object.fromEntries(Object.entries(v).filter(([, x]) => valid(x))) as Record<string, T>) : {};
