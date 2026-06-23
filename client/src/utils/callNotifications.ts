// Browser notification helper for incoming calls
// Falls back to browser Notification API when FCM is not configured

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showCallNotification(opts: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}): Notification | null {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;

  const notification = new Notification(opts.title, {
    body: opts.body,
    icon: opts.icon || '/logo.png',
    tag: opts.tag || 'nexchat-call',
    requireInteraction: true,
  });

  if (opts.onClick) {
    notification.onclick = () => {
      window.focus();
      opts.onClick!();
      notification.close();
    };
  }

  return notification;
}

export function closeCallNotification(tag = 'nexchat-call') {
  if (!('Notification' in window)) return;
  // Close any existing notification with this tag
  (Notification as any).getNotifications?.().then((notifications: Notification[]) => {
    notifications.forEach((n: Notification) => {
      if (n.tag === tag) n.close();
    });
  });
}
