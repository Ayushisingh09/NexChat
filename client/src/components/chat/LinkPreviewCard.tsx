import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { mediaApi } from '../../api/media.api';

interface LinkPreviewCardProps {
  text: string;
  isSent: boolean;
}

// Extract the first https URL from the message text.
const URL_RE = /https:\/\/[^\s<]+/i;

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ text, isSent }) => {
  const match = text.match(URL_RE);
  const url = match?.[0]?.replace(/[.,;:!?)]+$/, '') || null;

  const { data } = useQuery({
    queryKey: ['link-preview', url],
    queryFn: () => mediaApi.linkPreview(url!),
    enabled: !!url,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  if (!url || !data || (!data.title && !data.description && !data.image)) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`block mt-1.5 mb-1 rounded-xl overflow-hidden ring-1 ring-white/[0.06] max-w-[300px] transition hover:brightness-110 ${
        isSent ? 'bg-black/10' : 'bg-wa-surface-2/40'
      }`}
    >
      {data.image && (
        <div className="w-full h-[140px] bg-wa-surface-2 overflow-hidden">
          <img src={data.image} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-2.5 border-l-[3px] border-wa-accent">
        {data.siteName && (
          <span className="text-[10px] text-wa-secondary uppercase tracking-wider block mb-0.5 truncate">
            {data.siteName}
          </span>
        )}
        {data.title && (
          <span className="text-[12.5px] font-semibold text-wa-primary line-clamp-2 leading-snug">
            {data.title}
          </span>
        )}
        {data.description && (
          <span className="text-[11px] text-wa-secondary line-clamp-2 mt-0.5 block leading-snug">
            {data.description}
          </span>
        )}
      </div>
    </a>
  );
};
