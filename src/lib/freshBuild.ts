/**
 * After a deploy, a tab that's already open can ask for code files the new build doesn't have
 * (their names change with every build), and the import fails. Reloading picks up the new build.
 * It only reloads once in a short window, so a real outage can't cause a reload loop.
 */
const KEY = 'aisim.reloadedForBuild';
const WINDOW_MS = 30_000;

function reloadForNewBuild(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** A dynamic import that reloads into the new build if its file has gone. */
export function importOrReload<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((e: unknown) => {
    // the page is reloading: never settle, so nothing renders an error in the meantime
    if (reloadForNewBuild()) return new Promise<T>(() => {});
    throw e;
  });
}
