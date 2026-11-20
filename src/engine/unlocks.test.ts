import { describe, expect, it } from 'vitest';
import { SCENARIOS } from './levels/scenarios';
import { settingLocks, settingLevels } from './unlocks';

/** Words that would send a player looking for a setting. Provider is left out: it also means "the company you call". */
const MENTIONS: Record<string, RegExp> = {
  'llm.streaming': /\bstream/i,
  'llm.thinking': /\bthinking\b/i,
  'llm.jsonMode': /json mode|structured output/i,
  'vector_db.refresh': /re-?index/i,
  'vector_db.parser': /document parsing|layout-aware/i,
  'llm.promptCache': /prompt cach/i,
  'llm.fineTuned': /fine-?tun/i,
  'llm.version': /model version|pin the (model|version)/i,
  'eval_harness.testSet': /test set/i,
  'eval_harness.judge': /llm judge|calibrat/i,
  'memory.windowTurns': /window size/i,
  'embedding.multilingual': /multilingual/i,
};

describe('settings that open up later', () => {
  it('belong to a later lesson than their component', () => {
    expect([...settingLevels().keys()]).toContain('vector_db.parser');
    expect(settingLevels().has('llm.size')).toBe(false);
  });

  it('are never what a level asks the player to change', () => {
    const problems: string[] = [];
    for (const s of SCENARIOS) {
      const hidden = settingLocks(s, false)?.hidden;
      if (!hidden) continue;
      const text = [s.brief, s.hint].join(' ');
      for (const id of hidden) if (MENTIONS[id]?.test(text)) problems.push(`${s.id} mentions ${id}`);
    }
    expect(problems).toEqual([]);
  });

  it('are all open when everything is unlocked', () => {
    expect(settingLocks(SCENARIOS[0], true)).toBeNull();
  });

  it('marks the settings a level is the first to show', () => {
    expect(
      settingLocks(
        SCENARIOS.find((s) => s.id === 'broke-parser')!,
        false,
      )?.fresh.has('llm.jsonMode'),
    ).toBe(true);
  });
});
