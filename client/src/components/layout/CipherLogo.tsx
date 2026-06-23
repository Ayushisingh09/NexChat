import React from 'react';

interface CipherLogoProps {
  className?: string;
}

/**
 * Cipher brand mark — a faceted hexagon "gem" (encryption/secure motif)
 * enclosing a stylised "C" arc with an orbiting node. Uses currentColor /
 * white strokes so it sits on the emerald gradient avatar background.
 */
export const CipherLogo: React.FC<CipherLogoProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 2.4 20 7v10l-8 4.6L4 17V7l8-4.6Z"
      fill="white"
      fillOpacity="0.18"
    />
    <path
      d="M12 2.4 20 7v10l-8 4.6L4 17V7l8-4.6Z"
      stroke="white"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path
      d="M15.1 9.1a4 4 0 1 0 0 5.8"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="15.3" cy="12" r="1.25" fill="white" />
  </svg>
);

export default CipherLogo;
