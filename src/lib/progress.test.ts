import { beforeEach, describe, expect, it } from 'vitest';
import { readFlag } from './storage';
import type { SharedDesign } from './designLink';
import { addFlag, loadCleared, loadDaily, loadDesign, loadIncidentBest, loadQuiz, loadStars, saveDaily, saveDesign, saveIncidentBest, saveQuiz } from './progress';

/** A tiny in-memory localStorage, so these tests run in plain Node. */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, String(v));
  removeItem = (k: string) => void this.m.delete(k);
  clear = () => this.m.clear();
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe('stored progress', () => {
  it('reads values written by earlier versions of the app', () => {
    localStorage.setItem('aisim.sfx.v1', 'on');
    localStorage.setItem('aisim.voice.v1', 'off');
    localStorage.setItem('aisim.unlockAll.v1', '1');
    localStorage.setItem('aisim.cleared.v1', JSON.stringify(['docs-bot', 'wrong-chunks']));
    localStorage.setItem('aisim.stars.v1', JSON.stringify({ 'docs-bot': 3 }));
    expect(readFlag('sfx', false)).toBe(true);
    expect(readFlag('voice', true)).toBe(false);
    expect(readFlag('unlockAll', false)).toBe(true);
    expect([...loadCleared()]).toEqual(['docs-bot', 'wrong-chunks']);
    expect(loadStars()).toEqual({ 'docs-bot': 3 });
  });

  it('drops junk instead of crashing', () => {
    localStorage.setItem('aisim.stars.v1', JSON.stringify({ a: 7, b: 'x', c: 2 }));
    localStorage.setItem('aisim.cleared.v1', '{not json');
    localStorage.setItem('aisim.daily.v1', JSON.stringify({ '2026-11-19': { stars: 'three' } }));
    expect(loadStars()).toEqual({ c: 2 });
    expect(loadCleared().size).toBe(0);
    expect(loadDaily()).toEqual({});
  });

  it('keeps the better daily result and the longer incident run', () => {
    saveDaily('2026-11-19', { stars: 2, cost: 5, parts: 3 });
    saveDaily('2026-11-19', { stars: 2, cost: 4, parts: 4 });
    saveDaily('2026-11-19', { stars: 1, cost: 1, parts: 1 });
    expect(loadDaily()['2026-11-19']).toEqual({ stars: 2, cost: 4, parts: 4 });
    saveIncidentBest({ seconds: 90, incidents: 3 });
    saveIncidentBest({ seconds: 60, incidents: 5 });
    expect(loadIncidentBest()).toEqual({ seconds: 90, incidents: 3 });
  });

  it('counts only the first quiz answer, and keeps flags as a set', () => {
    saveQuiz('docs-bot', false);
    saveQuiz('docs-bot', true);
    expect(loadQuiz()).toEqual({ 'docs-bot': false });
    addFlag('compared');
    expect([...addFlag('compared')]).toEqual(['compared']);
  });

  it('round-trips a design per level', () => {
    const d: SharedDesign = {
      scenarioId: 'docs-bot',
      nodes: [
        { id: 'users', type: 'users', x: 0, y: 0, config: {} },
        {
          id: 'llm',
          type: 'llm',
          x: 270,
          y: 0,
          config: { size: 'medium', streaming: false, provider: 'A', thinking: 'off', jsonMode: false, promptCache: false, fineTuned: false, version: 'pinned', temperature: 0.7 },
        },
      ],
      edges: [{ source: 'users', target: 'llm' }],
    };
    saveDesign(d);
    expect(loadDesign('docs-bot')).toEqual(d);
    expect(loadDesign('wrong-chunks')).toBeNull();
  });
});
