export const formatMessageTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();

  // If invalid date, return empty
  if (isNaN(date.getTime())) return '';

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const differenceInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isThisWeek = differenceInDays < 7;

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (isYesterday) {
    return 'Yesterday';
  } else if (isThisWeek) {
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  }
};

export const formatLastSeen = (dateString: string): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 2) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 2) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  if (days < 2) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
};
