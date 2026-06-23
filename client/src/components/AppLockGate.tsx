import React, { useState, useRef, useEffect } from 'react';
import { Lock, Delete } from 'lucide-react';
import { useLockStore } from '../store/lock.store';

// Full-screen overlay shown whenever the app is locked behind a PIN.
export const AppLockGate: React.FC = () => {
  const locked = useLockStore((s) => s.locked);
  const unlock = useLockStore((s) => s.unlock);

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!locked) {
      setPin('');
      setError(false);
    }
  }, [locked]);

  const submit = async (value: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const ok = await unlock(value);
    busyRef.current = false;
    if (!ok) {
      setError(true);
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 600);
    }
  };

  const press = (digit: string) => {
    if (error) return;
    const next = (pin + digit).slice(0, 8);
    setPin(next);
    if (next.length >= 4) submit(next);
  };

  const backspace = () => setPin((p) => p.slice(0, -1));

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0b0b0d] select-none">
      <div className="w-14 h-14 rounded-2xl bg-wa-green/15 flex items-center justify-center mb-5">
        <Lock className="w-7 h-7 text-wa-green" />
      </div>
      <h2 className="text-lg font-semibold text-wa-primary">NexChat is locked</h2>
      <p className="text-xs text-wa-secondary mt-1 mb-6">Enter your PIN to continue</p>

      <div className={`flex items-center gap-3 mb-8 ${error ? 'animate-shake' : ''}`}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-colors ${
              i < pin.length ? (error ? 'bg-red-500' : 'bg-wa-green') : 'bg-wa-sidebar-hover'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button type="button"
            key={d}
            onClick={() => press(d)}
            className="w-16 h-16 rounded-full bg-wa-sidebar hover:bg-wa-sidebar-hover text-xl font-semibold text-wa-primary transition active:scale-90"
          >
            {d}
          </button>
        ))}
        <div />
        <button type="button"
          onClick={() => press('0')}
          className="w-16 h-16 rounded-full bg-wa-sidebar hover:bg-wa-sidebar-hover text-xl font-semibold text-wa-primary transition active:scale-90"
        >
          0
        </button>
        <button type="button"
          onClick={backspace}
          className="w-16 h-16 rounded-full flex items-center justify-center text-wa-secondary hover:text-wa-primary hover:bg-wa-sidebar-hover transition active:scale-90"
          aria-label="Delete"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
