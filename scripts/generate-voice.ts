/**
 * Record every line the voice guide can say as an MP3, so players hear a natural voice
 * instead of their device's built-in one.
 *
 *   OPENAI_API_KEY=sk-...  npm run voice                 # OpenAI text-to-speech (default)
 *   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run voice
 *
 * Options (env): VOICE=nova (OpenAI voice), OPENAI_TTS_MODEL=gpt-4o-mini-tts, FORCE=1 (re-record all)
 *
 * Writes public/voice/<id>.mp3 and public/voice/manifest.json. Only lines whose text changed
 * since the last run are re-recorded, so it's cheap to run again after editing copy.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allLines } from '../src/content/guide';
import { COMPONENTS } from '../src/engine/components';

const OUT = join(process.cwd(), 'public', 'voice');
const MANIFEST = join(OUT, 'manifest.json');
const STYLE =
  'Warm, upbeat and clear, like a friendly game guide. Natural pace, light energy, never salesy.';

const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);

async function openai(text: string): Promise<ArrayBuffer> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
      voice: process.env.VOICE ?? 'nova',
      input: text,
      instructions: STYLE,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return res.arrayBuffer();
}

async function elevenlabs(text: string): Promise<ArrayBuffer> {
  const id = process.env.ELEVENLABS_VOICE_ID;
  if (!id) throw new Error('Set ELEVENLABS_VOICE_ID');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return res.arrayBuffer();
}

async function main() {
  const tts = process.env.ELEVENLABS_API_KEY ? elevenlabs : process.env.OPENAI_API_KEY ? openai : null;
  if (!tts) {
    console.error('Set OPENAI_API_KEY (or ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID) and run again.');
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  const old: Record<string, string> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  const lines = allLines(Object.values(COMPONENTS).map((c) => c.name));
  const seen = new Set<string>();
  const manifest: Record<string, string> = {};
  let made = 0;
  for (const l of lines) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    const h = hash(l.text);
    const file = join(OUT, `${l.id}.mp3`);
    if (!process.env.FORCE && old[l.id] === h && existsSync(file)) {
      manifest[l.id] = h;
      continue;
    }
    process.stdout.write(`recording ${l.id}… `);
    try {
      writeFileSync(file, Buffer.from(await tts(l.text)));
      manifest[l.id] = h;
      made++;
      console.log('ok');
    } catch (e) {
      console.log('failed:', (e as Error).message);
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\n${made} recorded, ${Object.keys(manifest).length} of ${seen.size} lines have clips.`);
}

void main();
