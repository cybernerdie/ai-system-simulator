import { IS_TOUCH } from './device';

/** On touch devices with a share sheet, share; elsewhere copy. Throws if neither works. */
export async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  try {
    if (navigator.share && IS_TOUCH) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
    throw e;
  }
}

/** Copy, falling back to a prompt the player can copy from when the clipboard is blocked. */
export async function copyWithFallback(text: string, promptLabel: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt(promptLabel, text);
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
