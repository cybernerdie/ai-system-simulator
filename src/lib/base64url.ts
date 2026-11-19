/** URL-safe base64 for UTF-8 text, used to pack designs and levels into share links. */
export function toBase64Url(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(code: string): string {
  const bytes = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
}
