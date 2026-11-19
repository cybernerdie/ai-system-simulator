import type { ComponentType, Goal, NodeConfig, SimEdge, TrafficProfile } from '../types';

export interface ScenarioNode {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  config?: NodeConfig;
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


/** "7 · The docs chatbot" → "The docs chatbot" */
export const stripScenarioNumbers = (title: string) => title.replace(/^\d+ · /, '');
