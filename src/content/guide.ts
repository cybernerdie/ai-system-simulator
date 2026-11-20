/**
 * Everything the guide says: coaching for the first level, customer complaints, hints,
 * and what the voice reads when a new problem appears or a level is cleared.
 * Every line has a stable id so `npm run voice` can record it once.
 */
import { PRESSURES, type PressureKey } from '../engine/pressures';
import { SCENARIOS, type Scenario } from '../engine/levels/scenarios';
import type { ComponentType, Cause, Outcome } from '../engine/types';

/** Stable ids for lines, shared with the clip generator. */
const lineId = (...parts: string[]) =>
  parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface Line {
  id: string;
  text: string;
}

/* ---------------- welcome ---------------- */

const WELCOME: Line = {
  id: 'welcome',
  text: 'Welcome to AISim. Every level hands you an AI app with a problem. Find it, fix it, and watch the numbers turn green. Ready?',
};

/* ---------------- level 1 coaching ---------------- */

export type CoachWait =
  | { kind: 'running' }
  | { kind: 'has'; type: ComponentType }
  | { kind: 'added' } // any new component on the canvas
  | { kind: 'won' }
  | { kind: 'next' }; // the player taps "Got it"

export interface CoachStep extends Line {
  /** what to highlight while this step is active */
  target?: string;
  wait: CoachWait;
  /** short label shown on the card */
  title: string;
}

/**
 * The coached first level teaches the controls, not the answer: run it, read the problem, add a
 * part, watch the numbers. Which part to add is the player's call; the case file asked them to
 * think about it, and the hints are there if they're stuck.
 */
export const COACH: CoachStep[] = [
  {
    id: 'coach-1-send',
    title: 'Send in the customers',
    text: 'Press Run. Customers start asking your bot questions, and you can watch how many answers come back right.',
    target: '.btn-run',
    wait: { kind: 'running' },
  },
  {
    id: 'coach-2-read',
    title: 'Read the problem',
    text: 'This panel names the biggest problem right now. The numbers at the bottom are your goals: they turn green once the problem is fixed.',
    target: '.pressure-window',
    wait: { kind: 'next' },
  },
  {
    id: 'coach-3-add',
    title: 'Add a part',
    text: "These are the parts you can add. Tap one to add it to your system, then tap it on the canvas to see what it does. You can delete anything you add, so it's fine to experiment.",
    target: '.palette',
    wait: { kind: 'added' },
  },
  {
    id: 'coach-4-watch',
    title: 'Watch the numbers',
    text: 'Keep both goals green for a few seconds to clear the level. If they stay red, try something else. Stuck? The hints in the Mission tab get more specific each time.',
    target: '.telemetry',
    wait: { kind: 'won' },
  },
];

/* ---------------- customer complaints ---------------- */

const BY_CAUSE: Partial<Record<Cause, string[]>> = {
  no_knowledge: ['That answer was completely made up.', "It invented a feature you don't even have."],
  retrieval_miss: ['It answered about the wrong product.', "Close, but that's not what your docs say."],
  context_noise: ['It mixed up two different answers.', 'Half right, half nonsense.'],
  weak_reasoning: ['It got the steps in the wrong order.', "That doesn't add up."],
  no_tools: ["It can't even look up my order?", "It just said it can't do that."],
  agent_limit: ['It gave up halfway through.'],
  agent_loop: ['It kept going in circles, then stopped.'],
  rate_limit: ['I got an error. Twice.', '"Too many requests"? I sent one!'],
  context_overflow: ['It errored on my long document.'],
  injection: ['Wait, why did your bot just say that?!'],
  forgot_context: ['I told it my order number two messages ago!', 'It forgot what we were talking about.'],
  provider_down: ['Your bot is down. Again.'],
  gpu_saturated: ['It timed out on me.'],
  invalid_output: ['The app crashed when the bot replied.'],
  stale_index: ["It quoted last month's prices."],
  parse_miss: ['It ignored the table in the PDF.'],
  task_unknown: ["It put my ticket in a category you don't have."],
  model_drift: ['It used to answer this fine. Not any more.'],
  sampling_noise: ['Same invoice, two different totals?!'],
  too_repetitive: ['Every description sounds identical.'],
  indirect_injection: ['Why did your assistant email my invoices to a stranger?!'],
  no_permission: ['It wrote a reply but never sent it.'],
  voice_pipeline: ["It can't hear me at all."],
  guard_false_positive: ['It blocked a totally normal question.'],
  handoff_loss: ['The final report missed what I asked for.'],
};
const BY_OUTCOME: Partial<Record<Outcome, string>> = {
  hallucinated: 'That answer was just wrong.',
  declined: "It just said it doesn't know.",
  rate_limited: 'I got an error message.',
  overflow: 'It errored out.',
  failed: 'It timed out.',
  injected: 'Something is very wrong with your bot.',
  unhelpful: 'That was useless.',
};

/** A short, human complaint for a failed request. */
export function complaintFor(outcome: Outcome, cause: Cause | undefined, seed: number): string | null {
  if (outcome === 'correct' || outcome === 'blocked') return null;
  const pool = (cause && BY_CAUSE[cause]) || null;
  if (pool) return pool[seed % pool.length];
  return BY_OUTCOME[outcome] ?? null;
}

export const SLOW_COMPLAINT = 'Still waiting for an answer…';

/* ---------------- pressures, hints, wins ---------------- */

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

/** What the voice says when a new binding pressure appears. */
export function pressureLine(key: PressureKey): Line | null {
  if (key === 'stable') return null;
  const p = PRESSURES[key];
  return { id: lineId('pressure', key), text: `${p.title}. ${firstSentence(p.why)}` };
}

export function nudgeLine(key: PressureKey): Line | null {
  if (key === 'stable') return null;
  return { id: lineId('nudge', key), text: `Stuck? Read the panel at the top. The problem right now is: ${PRESSURES[key].title.toLowerCase()}.` };
}

export const hintLine = (s: Scenario): Line => ({ id: lineId('hint', s.id), text: `Here's a hint. ${s.hint}` });

export const showMeLine = (name: string): Line => ({ id: lineId('showme', name), text: `Try adding ${name}. It's glowing in the list of components.` });

/** On a case level the idea is named on screen after the quiz, so the voice doesn't give it away first. */
export const winLine = (s: Scenario): Line => ({
  id: lineId('win', s.id),
  text: s.case ? 'Level cleared! Same customer, same question, and this time the answer is right.' : `Level cleared! ${firstSentence(s.lesson)}`,
});

/** Read when a level's case opens: the exchange, why it's wrong, and the job. */
export const caseLine = (s: Scenario): Line | null =>
  s.case
    ? {
        id: lineId('case', s.id),
        text: `A customer asked: ${s.case.chat.user} Your bot said: ${s.case.chat.bot} That's wrong. ${s.case.chat.truth} Your job: ${s.case.job}`,
      }
    : null;

/** Read when the player picks a cause in the case's guess. */
export const guessLine = (s: Scenario, i: number): Line | null => {
  const o = s.case?.predict.options[i];
  return o ? { id: lineId('guess', s.id, String(i)), text: `${o.right ? 'Right.' : 'Not quite.'} ${o.why}` } : null;
};

/** Every line the app can say, for the clip generator. */
export function allLines(componentNames: string[]): Line[] {
  const out: Line[] = [WELCOME, ...COACH];
  for (const k of Object.keys(PRESSURES) as PressureKey[]) {
    const a = pressureLine(k);
    const b = nudgeLine(k);
    if (a) out.push(a);
    if (b) out.push(b);
  }
  for (const s of SCENARIOS) {
    out.push(hintLine(s), winLine(s));
    const c = caseLine(s);
    if (c) out.push(c, ...(s.case?.predict.options.map((_, i) => guessLine(s, i)!) ?? []));
  }
  for (const n of componentNames) out.push(showMeLine(n));
  return out;
}
