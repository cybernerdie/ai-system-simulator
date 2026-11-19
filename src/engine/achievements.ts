/**
 * Achievements: small goals beyond clearing levels. Most are checked against saved progress;
 * a few depend on how a single win went (cheap, lean), and are recorded as flags when that happens.
 */
import { SCENARIOS } from './scenarios';
import { BOSSES } from './bosses';
import type { DailyResult } from './daily';
import type { IncidentBest } from './incident';

export interface Progress {
  cleared: Set<string>;
  stars: Record<string, number>;
  quiz: Record<string, boolean>;
  daily: Record<string, DailyResult>;
  dailyStreak: number;
  incident: IncidentBest | null;
  lessonsRead: number;
  flags: Set<string>;
}

export interface Achievement {
  id: string;
  title: string;
  text: string;
  done: (p: Progress) => boolean;
  /** For progress bars: [have, need] */
  count?: (p: Progress) => [number, number];
}

const bugIds = SCENARIOS.filter((s) => s.id.startsWith('bug-')).map((s) => s.id);
const totalStars = (p: Progress) => SCENARIOS.reduce((a, s) => a + (p.stars[s.id] ?? 0), 0);
const quizRight = (p: Progress) => Object.values(p.quiz).filter(Boolean).length;
const bossesBeaten = (p: Progress) => BOSSES.filter((b) => p.cleared.has(b.id)).length;
const levelsCleared = (p: Progress) => SCENARIOS.filter((s) => p.cleared.has(s.id)).length;
const counter = (have: number, need: number): [number, number] => [Math.min(have, need), need];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-fix', title: 'First fix', text: 'Clear your first level.', done: (p) => levelsCleared(p) >= 1 },
  { id: 'three-stars', title: 'Perfectionist', text: 'Earn three stars on a level.', done: (p) => Object.values(p.stars).some((n) => n >= 3) },
  { id: 'penny', title: 'Penny pincher', text: 'Clear a level at half its budget or less.', done: (p) => p.flags.has('half-budget') },
  { id: 'lean', title: 'Less is more', text: 'Clear a level with fewer components than the reference design.', done: (p) => p.flags.has('under-par') },
  { id: 'boss', title: 'Boss fight', text: 'Beat a boss level.', done: (p) => bossesBeaten(p) >= 1 },
  { id: 'all-bosses', title: 'Undefeated', text: 'Beat every boss.', done: (p) => bossesBeaten(p) >= BOSSES.length, count: (p) => counter(bossesBeaten(p), BOSSES.length) },
  { id: 'bug-hunter', title: 'Bug hunter', text: 'Clear every level in Find the bug.', done: (p) => bugIds.every((id) => p.cleared.has(id)), count: (p) => counter(bugIds.filter((id) => p.cleared.has(id)).length, bugIds.length) },
  { id: 'stars-60', title: 'Star collector', text: 'Collect 60 stars.', done: (p) => totalStars(p) >= 60, count: (p) => counter(totalStars(p), 60) },
  { id: 'graduate', title: 'Graduate', text: `Clear all ${SCENARIOS.length} numbered levels.`, done: (p) => levelsCleared(p) >= SCENARIOS.length, count: (p) => counter(levelsCleared(p), SCENARIOS.length) },
  { id: 'quiz-10', title: 'Sharp', text: 'Answer 10 level questions right on the first try.', done: (p) => quizRight(p) >= 10, count: (p) => counter(quizRight(p), 10) },
  { id: 'quiz-30', title: 'Know-it-all', text: 'Answer 30 level questions right on the first try.', done: (p) => quizRight(p) >= 30, count: (p) => counter(quizRight(p), 30) },
  { id: 'daily-1', title: 'Daily player', text: 'Solve a daily challenge.', done: (p) => Object.keys(p.daily).length >= 1 },
  { id: 'streak-3', title: 'Habit', text: 'Solve the daily three days in a row.', done: (p) => p.dailyStreak >= 3, count: (p) => counter(p.dailyStreak, 3) },
  { id: 'streak-7', title: 'Week on call', text: 'Solve the daily seven days in a row.', done: (p) => p.dailyStreak >= 7, count: (p) => counter(p.dailyStreak, 7) },
  { id: 'incident-3m', title: 'Steady hands', text: 'Survive three minutes in incident mode.', done: (p) => (p.incident?.seconds ?? 0) >= 180 },
  { id: 'incident-10', title: 'Firefighter', text: 'Live through ten incidents in one run.', done: (p) => (p.incident?.incidents ?? 0) >= 10, count: (p) => counter(p.incident?.incidents ?? 0, 10) },
  { id: 'reader', title: 'Bookworm', text: 'Read ten lessons.', done: (p) => p.lessonsRead >= 10, count: (p) => counter(p.lessonsRead, 10) },
  { id: 'compare', title: 'Side by side', text: 'Compare two designs.', done: (p) => p.flags.has('compared') },
  { id: 'maker', title: 'Level designer', text: 'Make a level and share it.', done: (p) => p.flags.has('made-level') },
];

/* ---------- storage ---------- */

const KEY = 'aisim.achievements.v1';
const FLAGS = 'aisim.flags.v1';

export function loadUnlocked(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function saveUnlocked(u: Record<string, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
}

export function loadFlags(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(FLAGS) ?? '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}

export function addFlag(f: string): Set<string> {
  const s = loadFlags();
  s.add(f);
  try {
    localStorage.setItem(FLAGS, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
  return s;
}

/** Achievements newly satisfied by this progress, in list order. */
export function newlyEarned(p: Progress, unlocked: Record<string, number>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlocked[a.id] && a.done(p));
}
