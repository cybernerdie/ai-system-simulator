/**
 * Small game sounds, synthesised with Web Audio (no files to download).
 * Off by default; the player turns them on in the top bar or on the welcome screen.
 */

export type Sfx = 'add' | 'run' | 'pause' | 'problem' | 'goal' | 'win' | 'star' | 'step';

const KEY = 'aisim.sfx.v1';
type Listener = (on: boolean) => void;
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
})();
const listeners = new Set<Listener>();
let ctx: AudioContext | null = null;

export const sfxOn = () => enabled;
export function setSfx(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(on));
  if (on) play('step');
}
export function onSfxChange(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** One soft tone with a quick attack and a gentle fade. */
function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, slideTo?: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export function play(s: Sfx, delay = 0) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  switch (s) {
    case 'add': // a soft pop
      tone(ac, 520, t, 0.09, 'sine', 0.14, 880);
      break;
    case 'step':
      tone(ac, 660, t, 0.07, 'triangle', 0.08);
      break;
    case 'run': // two rising notes
      tone(ac, 392, t, 0.1, 'triangle', 0.1);
      tone(ac, 587, t + 0.08, 0.14, 'triangle', 0.1);
      break;
    case 'pause':
      tone(ac, 587, t, 0.1, 'triangle', 0.08);
      tone(ac, 392, t + 0.08, 0.14, 'triangle', 0.08);
      break;
    case 'problem': // a low, gentle "uh-oh"
      tone(ac, 330, t, 0.16, 'sine', 0.12);
      tone(ac, 262, t + 0.14, 0.24, 'sine', 0.12);
      break;
    case 'goal': // a bright tick
      tone(ac, 988, t, 0.08, 'sine', 0.1);
      tone(ac, 1319, t + 0.06, 0.14, 'sine', 0.09);
      break;
    case 'star':
      tone(ac, 1568, t, 0.18, 'triangle', 0.09);
      tone(ac, 2093, t + 0.05, 0.22, 'sine', 0.05);
      break;
    case 'win': // a short major arpeggio
      [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, t + i * 0.1, 0.3, 'triangle', 0.11));
      break;
  }
}
