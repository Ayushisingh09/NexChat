import React from 'react';
import type { Story } from '../../api/stories.api';

interface StoryRingProps {
  stories?: Pick<Story, 'viewed'>[];
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const AVATAR_SIZES = { sm: 36, md: 42 };
const RING_GAP = 3;

export const StoryRing: React.FC<StoryRingProps> = ({ stories = [], size = 'md', children }) => {
  if (stories.length === 0) {
    return <>{children}</>;
  }

  const N = stories.length;
  const avatarPx = AVATAR_SIZES[size];
  const outerPx = avatarPx + RING_GAP * 2 + 4;
  const cx = outerPx / 2;
  const cy = cx;
  const r = (avatarPx / 2) + RING_GAP + 1;

  if (N === 1) {
    const isViewed = stories[0].viewed;
    return (
      <div className="relative shrink-0" style={{ width: outerPx, height: outerPx }}>
        <svg className="absolute inset-0 w-full h-full -rotate-90" style={{ pointerEvents: 'none' }}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={isViewed ? 'var(--color-zinc-700)' : 'var(--color-wa-green)'}
            strokeWidth="2.5"
            fill="transparent"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      </div>
    );
  }

  // Guard against too many stories — cap at 24 to prevent negative arc lengths.
  const capped = Math.min(N, 24);
  const gap = 360 / capped < 15 ? 4 : 8;
  const totalGap = capped * gap;
  const arcLength = Math.max(1, (360 - totalGap) / capped);

  return (
    <div className="relative shrink-0" style={{ width: outerPx, height: outerPx }}>
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        {stories.slice(0, capped).map((s, i) => {
          const startAngle = -90 + i * (arcLength + gap) + gap / 2;
          const endAngle = startAngle + arcLength;
          const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
          const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
          const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
          const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
          const pathData = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
          return (
            <path
              key={i}
              d={pathData}
              stroke={s.viewed ? 'var(--color-zinc-700)' : 'var(--color-wa-green)'}
              strokeWidth="2.5"
              fill="transparent"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};
