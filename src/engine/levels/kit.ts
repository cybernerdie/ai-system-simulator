import type { ComponentType, Goal, NodeConfig, SimEdge, TrafficProfile } from '../types';

export interface ScenarioNode {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  config?: NodeConfig;
}

/**
 * A level told as a case: one real exchange that shows the problem, the job in plain words, a
 * question that makes the player guess the cause before touching anything, and the name of the
 * idea, given only after they've made it work.
 */
export interface CaseFile {
  /** What the player has to achieve, in one plain sentence. */
  job: string;
  /** One customer exchange: the question, the bot's bad answer, the truth, and the answer once fixed. */
  chat: {
    user: string;
    bot: string;
    truth: string;
    fixed: string;
    /** The part of \`bot\` that's wrong, highlighted so it's the first thing the eye lands on. */
    lie?: string;
    /** The part of \`truth\` (and \`fixed\`) that contradicts it. */
    fact?: string;
    /** Where the truth comes from, e.g. "from your returns policy". */
    source?: string;
    /** Who's asking, when it isn't a customer (default "Customer"). */
    userLabel?: string;
    /** The label on the truth line: "Actually" for a false answer, "Behind the scenes" when the
     *  problem is errors, cost or waiting rather than something the bot said. */
    truthLabel?: string;
  };
  /** Asked before playing. Exactly one option is right; each explains itself once picked. */
  predict: { question: string; options: { text: string; right?: true; why: string }[] };
  /** Revealed after the win: what they built is called this. */
  named: { term: string; text: string };
}

export interface Scenario {
  id: string;
  title: string;
  tagline: string;
  /** 1 = intro, 2 = core, 3 = advanced (0 for the sandbox) */
  difficulty: 0 | 1 | 2 | 3;
  /** Special kinds of level. Plain numbered levels leave this out. */
  kind?: 'boss' | 'daily' | 'incident' | 'custom';
  /** Bosses: the chapter (0-based) they close. */
  chapter?: number;
  /** Concepts the scenario teaches, shown on its card. */
  skills: string[];
  brief: string;
  traffic: TrafficProfile;
  goals: Goal[];
  nodes: ScenarioNode[];
  edges: SimEdge[];
  hint: string;
  lesson: string;
  /** The level as a case file. Levels without one fall back to the brief. */
  case?: CaseFile;
  /** A known-good design, used by tests to prove the scenario is winnable. */
  solution: { nodes: ScenarioNode[]; edges: SimEdge[] };
}

export const base: TrafficProfile = {
  rps: 5,
  kbShare: 0,
  exactTermShare: 0,
  toolShare: 0,
  adversarialShare: 0,
  easyShare: 0.6,
  repeatShare: 0.2,
};

export const chain = (...ids: string[]): SimEdge[] => ids.slice(1).map((id, i) => ({ source: ids[i], target: id }));

/** A level's name without its prefix: "07 · The store chatbot", "Boss · The launch", "Daily #3 · …" → the name alone. */
export const displayTitle = (s: { title: string }) => s.title.replace(/^(\d+|Boss|Daily #\d+) · /, '');
