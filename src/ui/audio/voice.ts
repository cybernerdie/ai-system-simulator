/**
 * The voice guide.
 *
 * speak(id, text) plays a recorded clip (public/voice/<id>.mp3) when one exists,
 * and otherwise reads the text with the browser's built-in voice. Captions are always
 * shown by the caller, so the voice is a bonus, never the only way to get the message.
 * Run `npm run voice` to generate natural recorded clips for every line.
 */
import { readFlag, readString, writeFlag, writeString } from '../../lib/storage';

type Listener = (on: boolean) => void;

let enabled = readFlag('voice', true);
const listeners = new Set<Listener>();
let manifest: Record<string, string> | null = null;
let manifestLoad: Promise<void> | null = null;
let audio: HTMLAudioElement | null = null;
let current = '';

function loadManifest() {
  manifestLoad ??= fetch('/voice/manifest.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => {
      manifest = m && typeof m === 'object' ? (m as Record<string, string>) : {};
    })
    .catch(() => {
      manifest = {};
    });
  return manifestLoad;
}
if (typeof window !== 'undefined') void loadManifest();

export const voiceOn = () => enabled;
export function setVoice(on: boolean) {
  enabled = on;
  writeFlag('voice', on);
  if (!on) stopVoice();
  listeners.forEach((l) => l(on));
}
export function onVoiceChange(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function stopVoice() {
  current = '';
  if (audio) {
    audio.pause();
    audio = null;
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/* ---------- choosing a voice and speed ---------- */

let chosen = readString('voiceName') ?? '';
let rate = Number(readString('voiceRate')) || 1;
export const voiceRate = () => rate;
export const chosenVoice = () => chosen;
export function setVoiceRate(r: number) {
  rate = Math.min(1.6, Math.max(0.7, r));
  writeString('voiceRate', String(rate));
}
export function setChosenVoice(name: string) {
  chosen = name;
  writeString('voiceName', name);
}

/** Names that usually mean a natural-sounding voice, best first. */
const NATURAL = [
  'Natural',
  'Neural',
  'Premium',
  'Enhanced',
  'Samantha',
  'Ava',
  'Serena',
  'Google UK English Female',
  'Google US English',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Daniel',
  'Karen',
  'Moira',
];
const score = (v: SpeechSynthesisVoice) => {
  const i = NATURAL.findIndex((n) => v.name.includes(n));
  return i < 0 ? 100 : i;
};

/** English voices on this device, the most natural-sounding first. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}
/** Voices arrive asynchronously in some browsers; call back when the list changes. */
export function onVoicesChanged(cb: () => void) {
  if (typeof speechSynthesis === 'undefined') return () => {};
  speechSynthesis.addEventListener('voiceschanged', cb);
  return () => speechSynthesis.removeEventListener('voiceschanged', cb);
}

/** The player's choice if it's on this device, otherwise the most natural English voice. */
function bestVoice(): SpeechSynthesisVoice | undefined {
  const voices = listVoices();
  return voices.find((v) => v.name === chosen) ?? voices[0];
}

/** Say a sample line in a given voice, even if the guide is muted. */
export function previewVoice(name?: string) {
  if (typeof speechSynthesis === 'undefined') return;
  stopVoice();
  const u = new SpeechSynthesisUtterance("Hi! I'll guide you through each level. This is how I sound.");
  const v = listVoices().find((x) => x.name === (name ?? chosen)) ?? bestVoice();
  try {
    if (v) u.voice = v;
  } catch {
    /* some browsers reject voices from a stale list; the default voice still speaks */
  }
  u.rate = rate;
  speechSynthesis.speak(u);
}

/** Say a line. A newer line always cuts off the previous one. */
export async function speak(id: string, text: string) {
  if (!enabled || !text) return;
  stopVoice();
  current = id;
  await loadManifest();
  if (current !== id) return; // something newer started while we waited
  if (manifest && manifest[id] && !chosen) {
    const a = new Audio(`/voice/${id}.mp3`);
    a.playbackRate = rate;
    audio = a;
    a.play().catch(() => fallbackSpeak(id, text));
    return;
  }
  fallbackSpeak(id, text);
}

function fallbackSpeak(id: string, text: string) {
  if (typeof speechSynthesis === 'undefined' || current !== id) return;
  const u = new SpeechSynthesisUtterance(text);
  const v = bestVoice();
  try {
    if (v) u.voice = v;
  } catch {
    /* some browsers reject voices from a stale list; the default voice still speaks */
  }
  u.rate = rate;
  u.pitch = 1;
  speechSynthesis.speak(u);
}
