// SHA-256 hex digest of an app-lock PIN. The PIN itself is never stored.
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`nexchat-lock:${pin}`);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
