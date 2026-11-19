/**
 * Product analytics. Page views go to Vercel Web Analytics (free on Hobby).
 * Custom events go to Umami when VITE_UMAMI_WEBSITE_ID is set (Umami Cloud's free plan supports them).
 * No cookies, no personal data: events carry level ids and small numbers only.
 */
import { inject } from '@vercel/analytics';

type Props = Record<string, string | number | boolean>;
declare global {
  interface Window {
    umami?: { track: (name: string, data?: Props) => void };
  }
}

const UMAMI_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
const UMAMI_SRC = (import.meta.env.VITE_UMAMI_SRC as string | undefined) ?? 'https://cloud.umami.is/script.js';
const queue: [string, Props | undefined][] = [];

export function initAnalytics() {
  if (import.meta.env.DEV || navigator.webdriver) return;
  try {
    inject({ mode: 'production' });
  } catch {
    /* ignore */
  }
  if (UMAMI_ID) {
    const s = document.createElement('script');
    s.defer = true;
    s.src = UMAMI_SRC;
    s.dataset.websiteId = UMAMI_ID;
    s.onload = () => {
      while (queue.length) {
        const [n, d] = queue.shift()!;
        window.umami?.track(n, d);
      }
    };
    document.head.appendChild(s);
  }
}

export function track(name: string, data?: Props) {
  if (import.meta.env.DEV) return;
  try {
    if (window.umami) window.umami.track(name, data);
    else if (UMAMI_ID && queue.length < 50) queue.push([name, data]);
  } catch {
    /* analytics must never break the app */
  }
}
