import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Each layer may import only from layers to its left:
 *   engine → content → lib → share → ui → app
 * The engine stays pure (no browser, no storage, no React), so it can run in tests and scripts.
 */
const LAYERS = ['engine', 'content', 'lib', 'share', 'ui', 'app'];
const SRC = resolve(__dirname);

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });

const layerOf = (file: string) => relative(SRC, file).split(/[\\/]/)[0];

describe('architecture', () => {
  it('imports only flow from lower layers to higher ones', () => {
    const violations: string[] = [];
    for (const file of files(SRC)) {
      const from = LAYERS.indexOf(layerOf(file));
      if (from < 0) continue;
      for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
        const to = LAYERS.indexOf(layerOf(resolve(dirname(file), spec)));
        if (to > from) violations.push(`${relative(SRC, file)} → ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps the engine free of browser APIs', () => {
    const browser = /\b(window|document|localStorage|navigator)\.[a-z]\w*[(.]/;
    const offenders = files(join(SRC, 'engine')).filter((f) => browser.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });
});
