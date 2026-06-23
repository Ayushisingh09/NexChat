import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: React.ReactNode;
}

export const PageTransition: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(false);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMounted(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  return (
    <div
      key={location.pathname}
      className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${mounted ? 'opacity-100' : 'opacity-0 translate-y-3 will-change-transform will-change-opacity'}`}
    >
      {children}
    </div>
  );
};
