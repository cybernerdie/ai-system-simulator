import { describe, expect, it } from 'vitest';
import { COMPONENT_TERM, LESSONS, LESSON_BY_ID, LESSON_ORDER, MODULES, TERMS, TERM_BY_ID } from './learn';
import { SCENARIOS } from '../engine/levels/scenarios';

describe('learn content', () => {
  it('has unique ids', () => {
    expect(new Set(TERMS.map((t) => t.id)).size).toBe(TERMS.length);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });
  it('every lesson sits in exactly one module', () => {
    expect([...LESSON_ORDER].sort()).toEqual(LESSONS.map((l) => l.id).sort());
    expect(new Set(LESSON_ORDER).size).toBe(LESSON_ORDER.length);
    expect(MODULES.every((m) => m.lessons.length > 0)).toBe(true);
  });
  it('every cross-reference resolves', () => {
    const broken: string[] = [];
    for (const l of LESSONS) {
      for (const t of l.terms) if (!TERM_BY_ID[t]) broken.push(`lesson ${l.id} → term ${t}`);
      if (l.scenarioId && !SCENARIOS.some((s) => s.id === l.scenarioId)) broken.push(`lesson ${l.id} → scenario ${l.scenarioId}`);
    }
    for (const t of TERMS) {
      for (const r of t.related ?? []) if (!TERM_BY_ID[r]) broken.push(`term ${t.id} → term ${r}`);
      if (t.lesson && !LESSON_BY_ID[t.lesson]) broken.push(`term ${t.id} → lesson ${t.lesson}`);
    }
    for (const id of Object.values(COMPONENT_TERM)) if (!TERM_BY_ID[id!]) broken.push(`component → term ${id}`);
    expect(broken).toEqual([]);
  });
});
