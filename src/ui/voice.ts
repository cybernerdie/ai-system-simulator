/**
 * The voice guide.
 *
 * speak(id, text) plays a recorded clip (public/voice/<id>.mp3) when one exists,
 * and otherwise reads the text with the browser's built-in voice. Captions are always
 * shown by the caller, so the voice is a bonus, never the only way to get the message.
 * Run `npm run voice` to generate natural recorded clips for every line.
 */

const KEY = 'aisim.voice.v1';
type Listener = (on: boolean) => void;

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();
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
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
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

/** Pick the most natural-sounding English voice the device has. */
function bestVoice(): SpeechSynthesisVoice | undefined {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  const prefer = ['Samantha', 'Ava', 'Serena', 'Google UK English Female', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Daniel', 'Karen', 'Moira'];
  for (const name of prefer) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.localService) ?? voices[0];
}

/** Say a line. A newer line always cuts off the previous one. */
export async function speak(id: string, text: string) {
  if (!enabled || !text) return;
  stopVoice();
  current = id;
  await loadManifest();
  if (current !== id) return; // something newer started while we waited
  if (manifest && manifest[id]) {
    const a = new Audio(`/voice/${id}.mp3`);
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
  if (v) u.voice = v;
  u.rate = 1.03;
  u.pitch = 1;
  speechSynthesis.speak(u);
}

/** Stable ids for lines, shared with the clip generator. */
export const lineId = (...parts: string[]) =>
  parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
