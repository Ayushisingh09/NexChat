import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { CheckCircle, ArrowLeft, Shield } from 'lucide-react';

interface OtpVerifyProps {
  identity: { email?: string; phone?: string };
  displayName: string;
  username?: string;
  password?: string;
  onVerifySuccess: () => void;
  onBack: () => void;
}

const DIGIT_COUNT = 6;

export const OtpVerify: React.FC<OtpVerifyProps> = ({
  identity,
  displayName,
  username,
  password,
  onVerifySuccess,
  onBack,
}) => {
  const [code, setCode] = useState<string[]>(Array(DIGIT_COUNT).fill(''));
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [entered, setEntered] = useState(false);
  const [popIndex, setPopIndex] = useState<number | null>(null);
  const [attempted, setAttempted] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const inputRefs = useRef<HTMLInputElement[]>([]);

  const destination = identity.email || identity.phone || '';

  useEffect(() => {
    setEntered(true);
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const fullCode = code.join('');
  const isComplete = fullCode.length === DIGIT_COUNT;

  const triggerError = useCallback((msg: string) => {
    setError(msg);
    setShake(true);
    setAttempted(false);
    setTimeout(() => {
      setShake(false);
      setCode(Array(DIGIT_COUNT).fill(''));
      inputRefs.current[0]?.focus();
    }, 500);
  }, []);

  const doVerify = useCallback(async () => {
    if (loading || success) return;

    setLoading(true);
    setError(null);
    setAttempted(true);

    try {
      await authApi.verifyOtp({ ...identity, code: fullCode });

      const registerRes = await authApi.register({
        ...identity,
        displayName,
        username,
        password,
      });

      if (registerRes.success) {
        setAuth(
          registerRes.data.user,
          registerRes.data.accessToken,
          registerRes.data.refreshToken
        );

        setSuccess(true);
        setTimeout(() => onVerifySuccess(), 600);
      } else {
        triggerError(registerRes.message || 'Registration failed after OTP verification');
      }
    } catch (err: any) {
      triggerError(err.response?.data?.message || err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }, [fullCode, identity, displayName, password, loading, success, setAuth, onVerifySuccess, triggerError]);

  useEffect(() => {
    if (isComplete && !loading && !success && !attempted) {
      const delay = setTimeout(() => doVerify(), 300);
      return () => clearTimeout(delay);
    }
  }, [isComplete, doVerify, loading, success, attempted]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value)) || loading) return;

    const newCode = [...code];
    newCode[index] = value.substring(value.length - 1);
    setCode(newCode);
    setError(null);
    setAttempted(false);
    setPopIndex(index);
    setTimeout(() => setPopIndex(null), 350);

    if (value && index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter' && isComplete) {
      doVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (loading) return;
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGIT_COUNT);
    if (!pasted) return;
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    setError(null);
    setAttempted(false);
    const nextIndex = Math.min(pasted.length, DIGIT_COUNT - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setError(null);
    try {
      await authApi.sendOtp(identity);
      setTimer(60);
    } catch (err: any) {
      triggerError(err.response?.data?.message || err.message || 'Resending OTP failed');
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-pop-in">
        <div className="w-16 h-16 rounded-full bg-wa-green/20 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-wa-green animate-bounce" />
        </div>
        <h3 className="text-lg font-bold text-wa-primary">Verified Successfully!</h3>
        <p className="text-sm text-wa-secondary">Setting up your account...</p>
        <div className="w-48 h-1.5 bg-wa-border rounded-full overflow-hidden">
          <div className="h-full bg-wa-green rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 text-wa-primary text-center ${entered ? 'animate-fade-in' : 'opacity-0'}`}>
      <div className="space-y-2">
        <div className="flex justify-center mb-3">
          <Shield className="w-10 h-10 text-wa-green" />
        </div>
        <h3 className="text-lg font-bold">Verify Your Identity</h3>
        <p className="text-xs text-wa-secondary">
          We sent a 6-digit code to{' '}
          <span className="text-wa-primary font-semibold">{destination}</span>
        </p>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="p-3 text-sm bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 animate-slide-down">
          {error}
        </div>
      )}

      <div role="group" aria-label="One-time passcode" className={`flex justify-center gap-2.5 max-w-[300px] mx-auto ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        {code.map((digit, index) => (
          <input
            key={`otp-${index}`}
            type="text"
            maxLength={1}
            value={digit}
            ref={(el) => {
              inputRefs.current[index] = el as HTMLInputElement;
            }}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={index === 0 ? handlePaste : undefined}
            aria-label={`Digit ${index + 1} of ${DIGIT_COUNT}`}
            autoFocus={index === 0}
            className={`w-11 h-13 text-center text-xl font-bold bg-wa-sidebar border-2 rounded-xl focus:outline-none text-wa-primary transition-all duration-200
              ${digit
                ? 'border-wa-green shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)]'
                : 'border-wa-border focus:border-wa-green focus:shadow-[0_0_12px_-2px_rgba(16,185,129,0.25)]'
              }
              ${entered ? '' : 'opacity-0 translate-y-4'}
            `}
            style={{
              animation: entered && !shake
                ? `pop-in 0.25s ease-out ${index * 0.06}s both${popIndex === index ? ', digit-pop 0.3s ease-out' : ''}`
                : entered && shake
                ? `pop-in 0.25s ease-out ${index * 0.06}s both`
                : 'none',
            }}
            disabled={loading}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        ))}
      </div>

      <div className="space-y-4 pt-2">
        <button type="button"
          onClick={doVerify}
          disabled={loading || !isComplete}
          className={`w-full py-3.5 px-4 font-bold rounded-xl uppercase tracking-wide text-sm transition-all duration-200
            ${loading || !isComplete
              ? 'bg-wa-secondary/20 text-wa-secondary cursor-not-allowed'
              : 'bg-wa-green text-wa-sidebar hover:bg-wa-accent hover:shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)] active:scale-[0.98]'
            }
          `}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Verifying...
            </span>
          ) : (
            'Verify & Setup'
          )}
        </button>

        <div className="flex justify-between text-xs text-wa-secondary px-1">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="flex items-center gap-1 hover:text-wa-green font-semibold transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <button
            type="button"
            disabled={timer > 0 || loading}
            onClick={handleResend}
            className={`font-semibold transition-all ${
              timer > 0
                ? 'text-wa-secondary cursor-not-allowed'
                : 'text-wa-green hover:text-wa-accent active:scale-95'
            }`}
          >
            {timer > 0 ? (
              <span className="tabular-nums">Resend in {timer}s</span>
            ) : (
              'Resend Code'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
