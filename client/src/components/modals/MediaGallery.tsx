import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { messagesApi } from '../../api/messages.api';
import type { Message } from '../../types/chat.types';
import { FileText, Download, Play, Loader2 } from 'lucide-react';

interface MediaGalleryProps {
  conversationId: string;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ conversationId }) => {
  const [tab, setTab] = useState<'MEDIA' | 'DOCS'>('MEDIA');

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['media', conversationId, tab],
    queryFn: ({ pageParam }) => messagesApi.listMedia(conversationId, tab, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
  });

  const items: Message[] = data ? data.pages.flatMap((p) => p.messages) : [];

  return (
    <div className="bg-wa-sidebar p-4 border-b border-wa-border space-y-3">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['MEDIA', 'DOCS'] as const).map((t) => (
          <button type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full transition ${
              tab === t ? 'bg-wa-green text-wa-sidebar' : 'text-wa-secondary hover:bg-wa-sidebar-hover'
            }`}
          >
            {t === 'MEDIA' ? 'Media' : 'Docs'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-wa-secondary">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-xs text-wa-secondary">
          {tab === 'MEDIA' ? 'No media shared yet' : 'No documents shared yet'}
        </div>
      ) : tab === 'MEDIA' ? (
        <div className="grid grid-cols-3 gap-1.5 max-h-[260px] overflow-y-auto">
          {items.map((m) => (
            <div
              key={m.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-wa-sidebar-hover ring-1 ring-white/5 cursor-pointer group"
              onClick={() => m.mediaUrl && window.open(m.mediaUrl, '_blank')}
            >
              {m.type === 'IMAGE' ? (
                <img src={m.mediaUrl} alt="" className="object-cover w-full h-full group-hover:scale-105 transition-transform" loading="lazy" />
              ) : m.type === 'VIDEO' ? (
                <div className="w-full h-full flex items-center justify-center bg-black/40">
                  <Play className="w-6 h-6 text-white fill-current" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-wa-sidebar">
                  <Play className="w-5 h-5 text-wa-green" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-[260px] overflow-y-auto">
          {items.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 bg-wa-sidebar-hover/40 p-2 rounded-lg">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="w-7 h-7 text-wa-green shrink-0" />
                <span className="text-[13px] text-wa-primary truncate">{m.content || 'Document'}</span>
              </div>
              {m.mediaUrl && (
                <a
                  href={m.mediaUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-wa-secondary hover:text-wa-primary rounded-full transition shrink-0"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <button type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full py-2 text-xs font-semibold text-wa-green hover:bg-wa-sidebar-hover rounded-lg transition"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
};
