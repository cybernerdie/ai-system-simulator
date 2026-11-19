/**
 * A shareable result card (1200×630 PNG, the size LinkedIn and X preview well),
 * drawn in the browser with canvas: no server, no image service.
 */
import type { Scenario } from '../engine/levels/scenarios';
import type { GoalMetric, Metrics } from '../engine/types';
import { METRIC_META } from '../ui/format';

export interface Improvement {
  label: string;
  before: string;
  after: string;
}

/** The goal metrics that got better between the first run and the winning run, best first. */
export function improvements(s: Scenario, before: Metrics | null, after: Metrics): Improvement[] {
  if (!before) return [];
  const out: { imp: Improvement; gain: number }[] = [];
  for (const g of s.goals) {
    const k = g.metric as GoalMetric;
    const b = before[k] as number;
    const a = after[k] as number;
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    const better = g.op === '>=' ? a > b : a < b;
    if (!better) continue;
    const gain = Math.abs(a - b) / Math.max(Math.abs(b), Math.abs(a), 1e-9);
    if (gain < 0.05) continue;
    const meta = METRIC_META[k];
    out.push({ imp: { label: meta.label, before: meta.fmt(b), after: meta.fmt(a) }, gain });
  }
  return out.sort((x, y) => y.gain - x.gain).slice(0, 3).map((x) => x.imp);
}

/** One sentence for the post text. */
export function shareText(s: Scenario, label: string, stars: number, imps: Improvement[]): string {
  const name = s.title.replace(/^(\d+|Boss|Daily #\d+) · /, '');
  const what = imps[0] ? ` ${imps[0].label}: ${imps[0].before} → ${imps[0].after}.` : '';
  return `I cleared ${label.toLowerCase().startsWith('level') ? label.toLowerCase() : `the ${label.toLowerCase()}`}, "${name}", on AISim with ${stars}/3 stars.${what} Learn how AI systems really work by fixing broken ones:`;
}

function star(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (c.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawCard(opts: { s: Scenario; label: string; stars: number; imps: Improvement[]; site: string }): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  try {
    await document.fonts?.ready;
  } catch {
    /* fall back to system fonts */
  }
  const sans = "'Geist Variable', ui-sans-serif, system-ui, sans-serif";
  const mono = "'Geist Mono Variable', ui-monospace, monospace";

  // background
  c.fillStyle = '#0c0c0e';
  c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(W - 160, 80, 20, W - 160, 80, 520);
  glow.addColorStop(0, 'rgba(59,130,246,0.28)');
  glow.addColorStop(1, 'rgba(59,130,246,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);

  // brand
  c.fillStyle = '#6366f1';
  roundRect(c, 72, 64, 18, 18, 5);
  c.fill();
  c.fillStyle = '#38bdf8';
  c.beginPath();
  c.arc(98, 66, 8, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#f97316';
  roundRect(c, 90, 76, 16, 16, 4);
  c.fill();
  c.fillStyle = '#fafafa';
  c.font = `600 30px ${sans}`;
  c.fillText('AISim', 120, 88);

  // level + stars
  c.fillStyle = '#a1a1aa';
  c.font = `500 26px ${sans}`;
  c.fillText(`${opts.label} cleared`, 72, 176);
  for (let i = 0; i < 3; i++) star(c, W - 210 + i * 64, 165, 26, i < opts.stars ? '#f59e0b' : '#3f3f46');

  // title
  c.fillStyle = '#fafafa';
  c.font = `650 60px ${sans}`;
  const title = opts.s.title.replace(/^(\d+|Boss|Daily #\d+) · /, '');
  const tl = wrap(c, title, W - 144).slice(0, 2);
  tl.forEach((l, i) => c.fillText(l, 72, 250 + i * 68));
  let y = 250 + tl.length * 68 + 10;

  // before → after
  const rows = opts.imps.length ? opts.imps : [];
  if (rows.length) {
    const colW = (W - 144 - (rows.length - 1) * 24) / rows.length;
    rows.forEach((r, i) => {
      const x = 72 + i * (colW + 24);
      c.fillStyle = '#18181b';
      roundRect(c, x, y, colW, 150, 18);
      c.fill();
      c.fillStyle = '#a1a1aa';
      c.font = `500 22px ${sans}`;
      c.fillText(r.label, x + 24, y + 44);
      c.font = `500 40px ${mono}`;
      c.fillStyle = '#71717a';
      c.fillText(r.before, x + 24, y + 108);
      const bw = c.measureText(r.before).width;
      c.fillStyle = '#52525b';
      c.fillText('→', x + 24 + bw + 14, y + 108);
      const aw = c.measureText('→').width;
      c.fillStyle = '#34d399';
      c.fillText(r.after, x + 24 + bw + 14 + aw + 14, y + 108);
    });
    y += 150;
  } else {
    c.fillStyle = '#d4d4d8';
    c.font = `400 28px ${sans}`;
    wrap(c, opts.s.tagline, W - 144).slice(0, 2).forEach((l, i) => c.fillText(l, 72, y + 30 + i * 40));
  }

  // footer
  c.fillStyle = '#71717a';
  c.font = `400 24px ${sans}`;
  c.fillText('Learn how AI systems really work, by fixing broken ones', 72, H - 56);
  c.fillStyle = '#e4e4e7';
  c.font = `500 24px ${mono}`;
  const site = opts.site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  c.fillText(site, W - 72 - c.measureText(site).width, H - 56);

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw the card'))), 'image/png'));
}

/** Completion certificate, 1600×1131 (A4 landscape ratio). */
export async function drawCertificate(opts: { name: string; levels: number; stars: number; maxStars: number; bosses: number; date: Date; site: string }): Promise<Blob> {
  const W = 1600;
  const H = 1131;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  try {
    await document.fonts?.ready;
  } catch {
    /* fall back to system fonts */
  }
  const sans = "'Geist Variable', ui-sans-serif, system-ui, sans-serif";
  const mono = "'Geist Mono Variable', ui-monospace, monospace";
  c.fillStyle = '#fafafa';
  c.fillRect(0, 0, W, H);
  // frame
  c.strokeStyle = '#18181b';
  c.lineWidth = 3;
  roundRect(c, 48, 48, W - 96, H - 96, 28);
  c.stroke();
  c.strokeStyle = '#d4d4d8';
  c.lineWidth = 1.5;
  roundRect(c, 64, 64, W - 128, H - 128, 20);
  c.stroke();
  // brand
  c.fillStyle = '#6366f1';
  roundRect(c, W / 2 - 62, 130, 22, 22, 6);
  c.fill();
  c.fillStyle = '#0ea5e9';
  c.beginPath();
  c.arc(W / 2 - 28, 132, 10, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#f97316';
  roundRect(c, W / 2 - 40, 144, 20, 20, 5);
  c.fill();
  c.fillStyle = '#18181b';
  c.font = `600 34px ${sans}`;
  c.fillText('AISim', W / 2 - 10, 160);
  c.textAlign = 'center';
  c.fillStyle = '#71717a';
  c.font = `500 28px ${sans}`;
  c.fillText('Certificate of completion', W / 2, 270);
  c.fillStyle = '#18181b';
  c.font = `650 96px ${sans}`;
  const name = opts.name.length > 32 ? `${opts.name.slice(0, 31)}…` : opts.name;
  c.fillText(name, W / 2, 400);
  c.fillStyle = '#3f3f46';
  c.font = `400 32px ${sans}`;
  const body = `designed, debugged and fixed ${opts.levels} broken AI systems: retrieval, agents, guardrails, evals, inference, cost, privacy and more.`;
  wrap(c, body, W - 400).forEach((l, i) => c.fillText(l, W / 2, 490 + i * 46));
  // stats
  const stats: [string, string][] = [
    [`${opts.levels}`, 'levels cleared'],
    [`${opts.stars}/${opts.maxStars}`, 'stars'],
    [`${opts.bosses}`, 'bosses beaten'],
  ];
  const colW = 300;
  stats.forEach(([v, l], i) => {
    const x = W / 2 + (i - 1) * colW;
    c.fillStyle = '#18181b';
    c.font = `600 56px ${mono}`;
    c.fillText(v, x, 690);
    c.fillStyle = '#71717a';
    c.font = `500 24px ${sans}`;
    c.fillText(l, x, 730);
  });
  for (let i = 0; i < 3; i++) star(c, W / 2 - 70 + i * 70, 820, 26, '#f59e0b');
  c.fillStyle = '#71717a';
  c.font = `400 24px ${sans}`;
  c.fillText(opts.date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), W / 2, 930);
  c.fillStyle = '#18181b';
  c.font = `500 24px ${mono}`;
  c.fillText(opts.site.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, 970);
  c.textAlign = 'left';
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw the certificate'))), 'image/png'));
}
