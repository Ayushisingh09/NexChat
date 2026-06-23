import { useEffect, useState } from 'react';
import { AlertTriangle, MessageSquare } from 'lucide-react';

interface WarnDetail {
  message: string;
}

interface MessageDetail {
  title: string;
  body: string;
  onClick?: () => void;
}

let toastId = 0;

/** Generic warning/info toast (auto-dismiss). */
export const showToast = (message: string) => {
  window.dispatchEvent(new CustomEvent<WarnDetail>('app:toast', { detail: { message } }));
};

/** Rich, clickable chat-message toast — used for in-app new-message alerts. */
export const showMessageToast = (detail: MessageDetail) => {
  window.dispatchEvent(new CustomEvent<MessageDetail>('app:toast:message', { detail }));
};

type Toast =
  | { id: number; kind: 'warn'; message: string }
  | { id: number; kind: 'message'; title: string; body: string; onClick?: () => void };

export const ToastHost = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    const onWarn = (e: Event) => {
      const { message } = (e as CustomEvent<WarnDetail>).detail;
      const id = ++toastId;
      setToasts((prev) => [...prev.slice(-2), { id, kind: 'warn', message }]);
      setTimeout(() => dismiss(id), 4000);
    };
    const onMessage = (e: Event) => {
      const { title, body, onClick } = (e as CustomEvent<MessageDetail>).detail;
      const id = ++toastId;
      setToasts((prev) => [...prev.slice(-2), { id, kind: 'message', title, body, onClick }]);
      setTimeout(() => dismiss(id), 5000);
    };
    window.addEventListener('app:toast', onWarn);
    window.addEventListener('app:toast:message', onMessage);
    return () => {
      window.removeEventListener('app:toast', onWarn);
      window.removeEventListener('app:toast:message', onMessage);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((t) =>
        t.kind === 'warn' ? (
          <div
            key={t.id}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wa-sidebar border border-wa-border shadow-pop text-[13px] text-wa-primary animate-scale-in"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{t.message}</span>
          </div>
        ) : (
          <button type="button"
            key={t.id}
            onClick={() => {
              t.onClick?.();
              dismiss(t.id);
            }}
            className="pointer-events-auto w-full flex items-start gap-3 px-4 py-3 rounded-xl bg-wa-sidebar border border-wa-border shadow-pop text-left animate-scale-in hover:bg-wa-sidebar-hover transition-colors active:scale-[0.98]"
          >
            <span className="w-8 h-8 rounded-full bg-wa-surface-2 flex items-center justify-center shrink-0 text-wa-secondary">
              <MessageSquare className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-wa-primary truncate">{t.title}</span>
              <span className="block text-[12px] text-wa-secondary truncate">{t.body}</span>
            </span>
          </button>
        )
      )}
    </div>
  );
};
