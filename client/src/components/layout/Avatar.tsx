import React, { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  presence?: 'online' | 'offline' | 'away' | 'dnd';
  showRing?: boolean;
  shape?: 'circle' | 'squircle';
}

const colorGradients = [
  'from-pink-500 via-rose-400 to-rose-600',
  'from-purple-500 via-indigo-400 to-indigo-600',
  'from-blue-500 via-sky-400 to-cyan-600',
  'from-teal-400 via-emerald-400 to-emerald-600',
  'from-emerald-500 via-green-400 to-lime-600',
  'from-amber-400 via-orange-400 to-orange-600',
  'from-orange-500 via-red-400 to-red-700',
  'from-violet-500 via-fuchsia-400 to-fuchsia-600',
  'from-rose-500 via-pink-400 to-purple-600',
  'from-cyan-400 via-teal-400 to-emerald-600',
  'from-indigo-500 via-blue-400 to-sky-600',
  'from-lime-500 via-amber-400 to-orange-500',
];

const getInitials = (name?: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getGradientClass = (name?: string | null) => {
  if (!name) return 'bg-wa-border text-wa-secondary';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorGradients.length;
  return `bg-gradient-to-br ${colorGradients[index]}`;
};

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-32 h-32 text-3xl',
};

const presenceColors = {
  online: 'bg-green-500 ring-2 ring-wa-sidebar shadow-[0_0_6px_rgba(34,197,94,0.5)]',
  away: 'bg-amber-400 ring-2 ring-wa-sidebar',
  dnd: 'bg-red-500 ring-2 ring-wa-sidebar',
  offline: 'bg-zinc-500 ring-2 ring-wa-sidebar',
};

const presenceSizeMap = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
};

const AvatarComponent: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  presence,
  showRing = false,
  shape = 'circle',
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClass = sizeClasses[size];
  const initials = getInitials(name);
  const bgGradient = getGradientClass(name);
  const shapeClass = shape === 'squircle' ? 'rounded-[30%]' : 'rounded-full';

  const img = src && !hasError ? (
    <img
      src={src}
      alt={name || 'User avatar'}
      onError={() => setHasError(true)}
      className={`${shapeClass} object-cover shrink-0 select-none ${sizeClass} ${className}`}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <div
      className={`${shapeClass} flex items-center justify-center select-none shrink-0 font-bold tracking-wider text-white ${bgGradient} shadow-inner shadow-black/30 ${sizeClass} ${className}`}
    >
      <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{initials}</span>
    </div>
  );

  return (
    <div className="relative shrink-0 inline-flex">
      {showRing && src && !hasError ? (
        <div className={`${shapeClass} p-[3px]`} style={{ background: 'linear-gradient(135deg, var(--color-wa-green), var(--color-wa-green-deep))' }}>
          {img}
        </div>
      ) : img}
      {presence && presence !== 'offline' && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full animate-presence-in ${presenceColors[presence]} ${presenceSizeMap[size]}`}
        />
      )}
    </div>
  );
};

export const Avatar = React.memo(AvatarComponent);

export { getInitials, getGradientClass };
