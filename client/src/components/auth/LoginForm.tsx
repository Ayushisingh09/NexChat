import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { Mail, Lock, LogIn, Smartphone, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type Mode = 'password' | 'otp';

export const LoginForm: React.FC = () => {
  const [mode, setMode] = useState<Mode>('password');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [shake, setShake] = useState(false);
  const [rateRemaining, setRateRemaining] = useState<number | null>(null);
  const [rateRetryAfter, setRateRetryAfter] = useState<number | null>(null);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const passwordSchema = z.object({
    identity: z.string().min(1, 'Email or Phone is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  });
  const otpSchema = z.object({
    identity: z.string().min(1, 'Email or Phone is required'),
    code: z.string().length(6, 'Enter the 6-digit code'),
  });

  type PasswordForm = z.infer<typeof passwordSchema>;
  type OtpForm = z.infer<typeof otpSchema>;

  const pForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const oForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const afterKeyCheck = async (res: any) => {
    setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    navigate('/chat');
  };

  const onPasswordSubmit = async (values: PasswordForm) => {
    setLoading(true); setError(null); setRateRemaining(null); setRateRetryAfter(null);
    try {
      const isEmail = values.identity.includes('@');
      const res = await authApi.login(isEmail
        ? { email: values.identity, password: values.password }
        : { phone: values.identity, password: values.password }
      );
      if (res.success) await afterKeyCheck(res);
      else triggerError(res.message || 'Login failed');
    } catch (err: any) {
      const rem = err.response?.headers?.['x-ratelimit-remaining'];
      const retry = err.response?.headers?.['retry-after'];
      if (rem !== undefined) setRateRemaining(Number(rem));
      if (retry !== undefined) setRateRetryAfter(Number(retry));
      triggerError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const sendOtpCode = async () => {
    const identity = oForm.getValues('identity');
    if (!identity) { triggerError('Enter your email or phone first'); return; }
    setSendingOtp(true); setError(null);
    try {
      const isEmail = identity.includes('@');
      await authApi.sendOtp(isEmail ? { email: identity } : { phone: identity });
      setOtpSent(true);
      setOtpTimer(60);
      const interval = setInterval(() => {
        setOtpTimer((prev) => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
      }, 1000);
    } catch (err: any) {
      triggerError(err.response?.data?.message || 'Failed to send OTP');
    } finally { setSendingOtp(false); }
  };

  const onOtpSubmit = async (values: OtpForm) => {
    setLoading(true); setError(null); setRateRemaining(null); setRateRetryAfter(null);
    try {
      const isEmail = values.identity.includes('@');
      const res = await authApi.login(isEmail
        ? { email: values.identity, code: values.code }
        : { phone: values.identity, code: values.code }
      );
      if (res.success) await afterKeyCheck(res);
      else triggerError(res.message || 'Login failed');
    } catch (err: any) {
      const rem = err.response?.headers?.['x-ratelimit-remaining'];
      const retry = err.response?.headers?.['retry-after'];
      if (rem !== undefined) setRateRemaining(Number(rem));
      if (retry !== undefined) setRateRetryAfter(Number(retry));
      triggerError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const formClass = 'space-y-5 text-wa-primary';

  return mode === 'password' ? (
    <form onSubmit={pForm.handleSubmit(onPasswordSubmit)} className={formClass}>
      {error && (
        <div className={`p-3 text-sm bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : 'animate-slide-down'}`}>
          {error}
          {rateRetryAfter && <div className="mt-1 text-[11px] text-red-300">Try again in {Math.ceil(rateRetryAfter / 60)}m</div>}
          {rateRemaining !== null && rateRemaining <= 2 && <div className="mt-1 text-[11px] text-red-300">{rateRemaining} attempt{rateRemaining !== 1 ? 's' : ''} remaining</div>}
        </div>
      )}

      <div className="animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">Email or Phone</label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors"><Mail className="w-4 h-4" /></div>
          <input type="text" placeholder="e.g. alice@example.com"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all ${pForm.formState.errors.identity ? 'border-red-500' : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'}`}
            {...pForm.register('identity')} />
        </div>
        {pForm.formState.errors.identity && <p className="mt-1.5 text-xs text-red-400">{pForm.formState.errors.identity.message}</p>}
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">Password</label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors"><Lock className="w-4 h-4" /></div>
          <input type="password" placeholder="Enter password"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all ${pForm.formState.errors.password ? 'border-red-500' : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'}`}
            {...pForm.register('password')} />
        </div>
        {pForm.formState.errors.password && <p className="mt-1.5 text-xs text-red-400">{pForm.formState.errors.password.message}</p>}
      </div>

      <div className="flex items-center justify-between -mt-3 animate-slide-up" style={{ animationDelay: '0.12s' }}>
        <button type="button" onClick={() => { setMode('otp'); setError(null); setRateRemaining(null); }}
          className="text-xs text-wa-secondary hover:text-emerald-400 font-semibold transition-colors flex items-center gap-1">
          <Smartphone className="w-3 h-3" /> Login with OTP
        </button>
        <Link to="/forgot-password" className="text-xs text-wa-secondary hover:text-emerald-400 font-semibold transition-colors">Forgot Password?</Link>
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3.5 px-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:bg-wa-secondary/20 disabled:text-wa-secondary transition-all uppercase tracking-wide text-sm flex items-center justify-center gap-2 active:scale-[0.98] animate-slide-up"
        style={{ animationDelay: '0.15s' }}>
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</> : <><LogIn className="w-4 h-4" /> Login</>}
      </button>
    </form>
  ) : (
    <form onSubmit={oForm.handleSubmit(onOtpSubmit)} className={formClass}>
      {error && (
        <div className={`p-3 text-sm bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : 'animate-slide-down'}`}>
          {error}
          {rateRetryAfter && <div className="mt-1 text-[11px] text-red-300">Try again in {Math.ceil(rateRetryAfter / 60)}m</div>}
          {rateRemaining !== null && rateRemaining <= 2 && <div className="mt-1 text-[11px] text-red-300">{rateRemaining} attempt{rateRemaining !== 1 ? 's' : ''} remaining</div>}
        </div>
      )}

      <div className="animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">Email or Phone</label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors"><Mail className="w-4 h-4" /></div>
          <input type="text" placeholder="e.g. alice@example.com"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all ${oForm.formState.errors.identity ? 'border-red-500' : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'}`}
            {...oForm.register('identity')} />
        </div>
        {oForm.formState.errors.identity && <p className="mt-1.5 text-xs text-red-400">{oForm.formState.errors.identity.message}</p>}
      </div>

      <button type="button" onClick={sendOtpCode} disabled={sendingOtp || otpTimer > 0}
        className="w-full py-2.5 px-4 bg-emerald-500/15 text-emerald-400 font-semibold rounded-xl hover:bg-emerald-500/25 disabled:bg-wa-secondary/10 disabled:text-wa-secondary transition-all text-sm flex items-center justify-center gap-2 animate-slide-up"
        style={{ animationDelay: '0.1s' }}>
        {sendingOtp ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
          : otpTimer > 0 ? <>Resend in {otpTimer}s</>
          : otpSent ? <><Smartphone className="w-3 h-3" /> Resend OTP</>
          : <><Smartphone className="w-3 h-3" /> Send OTP</>}
      </button>

      <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">OTP Code</label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors"><Smartphone className="w-4 h-4" /></div>
          <input type="text" maxLength={6} inputMode="numeric" placeholder="6-digit code"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all ${oForm.formState.errors.code ? 'border-red-500' : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'}`}
            {...oForm.register('code')} />
        </div>
        {oForm.formState.errors.code && <p className="mt-1.5 text-xs text-red-400">{oForm.formState.errors.code.message}</p>}
      </div>

      <div className="flex justify-start -mt-3 animate-slide-up" style={{ animationDelay: '0.17s' }}>
        <button type="button" onClick={() => { setMode('password'); setError(null); setRateRemaining(null); }}
          className="text-xs text-wa-secondary hover:text-emerald-400 font-semibold transition-colors flex items-center gap-1">
          <Lock className="w-3 h-3" /> Login with Password
        </button>
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3.5 px-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:bg-wa-secondary/20 disabled:text-wa-secondary transition-all uppercase tracking-wide text-sm flex items-center justify-center gap-2 active:scale-[0.98] animate-slide-up"
        style={{ animationDelay: '0.2s' }}>
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging in...</> : <><LogIn className="w-4 h-4" /> Login with OTP</>}
      </button>
    </form>
  );
};
