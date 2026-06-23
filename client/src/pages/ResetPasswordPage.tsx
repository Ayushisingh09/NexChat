import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/auth.api';
import { Lock, Loader2, CheckCircle, ArrowLeft, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      triggerError(t('reset.minLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerError(t('reset.passwordsNoMatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(token, newPassword);
      setStep('done');
    } catch (err: any) {
      triggerError(err.response?.data?.message || err.message || t('reset.failed'));
    } finally {
      setLoading(false);
    }
  };

  // Missing/invalid link — nudge the user back to request a fresh one.
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-wa-chat justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-wa-primary mb-2">{t('reset.invalidTitle')}</h2>
          <p className="text-sm text-wa-secondary mb-6">{t('reset.invalidBody')}</p>
          <button type="button" onClick={() => navigate('/forgot-password')} className="w-full py-3.5 px-4 bg-wa-green text-wa-sidebar font-bold rounded-xl hover:bg-wa-accent transition-all uppercase tracking-wide text-sm mb-3">
            {t('reset.requestNew')}
          </button>
          <Link to="/auth" className="block text-sm text-wa-secondary hover:text-wa-green transition-colors">
            {t('common.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col bg-wa-chat justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-wa-accent/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-wa-accent" />
          </div>
          <h2 className="text-xl font-bold text-wa-primary mb-2">{t('reset.doneTitle')}</h2>
          <p className="text-sm text-wa-secondary mb-6">{t('reset.doneBody')}</p>
          <button type="button" onClick={() => navigate('/auth')} className="w-full py-3.5 px-4 bg-wa-green text-wa-sidebar font-bold rounded-xl hover:bg-wa-accent transition-all uppercase tracking-wide text-sm">
            {t('common.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = newPassword.length >= 6 && newPassword === confirmPassword;

  return (
    <div className="min-h-screen flex flex-col bg-wa-chat justify-center items-center py-12 px-4">
      <div className="absolute inset-0 -z-20">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-wa-green/5 blur-[120px] animate-float" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-wa-accent/5 blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="w-18 h-18 rounded-full bg-wa-sidebar border-2 border-wa-green/30 flex items-center justify-center shadow-elevated shadow-wa-green/10 p-1">
          <img src="/logo.png" alt="NexChat" className="w-full h-full object-contain rounded-full" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-wa-primary">NexChat</h1>
      </div>

      <div className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-wa-green via-emerald-400 to-wa-green" />
        <div className="p-8">
          <Link to="/auth" className="inline-flex items-center gap-1.5 text-sm text-wa-secondary hover:text-wa-green transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> {t('common.backToLogin')}
          </Link>

          <h2 className="text-xl font-bold text-wa-primary mb-2">{t('reset.title')}</h2>
          <p className="text-sm text-wa-secondary mb-6">{t('reset.subtitle')}</p>

          {error && (
            <div role="alert" aria-live="assertive" className={`p-3 text-sm bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 mb-4 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>{error}</div>
          )}

          <form onSubmit={handleReset} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">{t('reset.newPassword')}</label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-wa-green transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('reset.newPasswordPlaceholder')}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-wa-border bg-wa-chat focus:outline-none text-wa-primary focus:border-wa-green focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-wa-secondary hover:text-wa-green transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">{t('reset.confirmPassword')}</label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-wa-green transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('reset.confirmPlaceholder')}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all ${
                    confirmPassword.length > 0 && !passwordsMatch
                      ? 'border-red-500'
                      : 'border-wa-border focus:border-wa-green focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
                  }`}
                />
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1.5 text-xs text-red-400">{t('reset.passwordsNoMatch')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full py-3.5 px-4 bg-wa-green text-wa-sidebar font-bold rounded-xl hover:bg-wa-accent disabled:bg-wa-secondary/20 disabled:text-wa-secondary transition-all uppercase tracking-wide text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t('reset.resetting')}</>
              ) : (
                t('reset.resetPassword')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
