const SENDER_COLORS = [
  '#f472b6',
  '#a78bfa',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#fb923c',
  '#f87171',
  '#2dd4bf',
  '#818cf8',
  '#e879f9',
  '#38bdf8',
  '#4ade80',
  '#facc15',
  '#f97316',
  '#ef4444',
  '#14b8a6',
];

export function getSenderColor(senderId: string): string {
  let hash = 0;
  for (let i = 0; i < senderId.length; i++) {
    hash = (hash * 31 + senderId.charCodeAt(i)) >>> 0;
  }
  return SENDER_COLORS[hash % SENDER_COLORS.length];
}
