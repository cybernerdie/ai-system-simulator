/** App-wide settings and facts about how the page was opened. */
export const SITE = 'https://ai-system-simulator.vercel.app';

/** Real milliseconds per simulation tick. Each tick advances simulated time by TICK_SECONDS. */
export const TICK_MS = 700;
/** Requests simulated per tick: enough for stable numbers, cheap enough to run every 700ms. */
export const SAMPLES_PER_TICK = 1500;
/** Consecutive ticks with every goal met before a level counts as cleared. */
export const HOLD_TICKS = 5;
/** Ticks of history kept for the sparklines. */
export const HISTORY = 40;
/** At or below this width the layout stacks and the canvas becomes touch-first. */
export const PHONE_QUERY = '(max-width: 900px)';

const search = typeof window === 'undefined' ? '' : window.location.search;
const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;

/** Running inside another page's iframe (?embed): a stripped-down layout with no onboarding. */
export const EMBED = new URLSearchParams(search).has('embed');
/** Opened on a level's own page (/play/<id>). */
export const PLAY_ID = pathname.match(/^\/play\/([\w-]+)/)?.[1] ?? null;
