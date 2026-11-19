/**
 * Product analytics.
 * - Page views: Vercel Web Analytics (free on Hobby).
 * - Custom events (levels started, run, won, quiz answers, dailies, incident runs, shares): PostHog EU,
 *   sent straight to its capture API, so there is no SDK, no cookies and no person profiles.
 *   Events carry level ids and small numbers only, plus a random id kept in this browser so funnels work.
 * The PostHog project key comes from VITE_POSTHOG_KEY (set in Vercel). Without it, no events are sent.
 */
import { inject } from '@vercel/analytics';
import { readString, writeString } from './storage';

type Props = Record<string, string | number | boolean>;

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';
let enabled = false;

function anonId(): string {
  let id = readString('analyticsId');
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    writeString('analyticsId', id);
  }
  return id;
}

function send(event: string, props?: Props) {
  if (!enabled || !KEY) return;
  const body = JSON.stringify({
    api_key: KEY,
    event,
    distinct_id: anonId(),
    timestamp: new Date().toISOString(),
    properties: {
      ...props,
      $process_person_profile: false,
      $current_url: location.origin + location.pathname,
      $pathname: location.pathname,
      $referrer: document.referrer || undefined,
      embed: new URLSearchParams(location.search).has('embed') || undefined,
      screen: window.innerWidth <= 900 ? 'phone' : 'desktop',
    },
  });
  try {
    const url = `${HOST}/i/v0/e/`;
    if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) {
      void fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
    }
  } catch {
    /* analytics must never break the app */
  }
}

export function initAnalytics() {
  if (import.meta.env.DEV || navigator.webdriver || navigator.doNotTrack === '1') return;
  enabled = true;
  try {
    inject({ mode: 'production' });
  } catch {
    /* ignore */
  }
  send('$pageview');
}

export function track(name: string, data?: Props) {
  send(name, data);
}
