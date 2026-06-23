import React from 'react';
import { Avatar } from './Avatar';

interface ListItemProps {
  avatar?: { src?: string | null; name?: string | null } | null;
  primaryText: string | null;
  secondaryText?: string | null;
  secondaryIcon?: React.ReactNode;
  indicator?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const ListItem: React.FC<ListItemProps> = ({
  avatar,
  primaryText,
  secondaryText,
  secondaryIcon,
  indicator,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {avatar && <Avatar src={avatar.src} name={avatar.name} size="sm" />}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium block truncate">{primaryText}</span>
        {(secondaryText || secondaryIcon) && (
          <span className="text-[11px] text-wa-secondary flex items-center gap-1">
            {secondaryIcon}
            {secondaryText}
          </span>
        )}
      </div>
      {indicator}
      {actions}
    </div>
  );
};
