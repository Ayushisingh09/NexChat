import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/auth.api';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateRetryAfter, setRateRetryAfter] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setRateRetryAfter(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      const retry = err.response?.headers?.['retry-after'];
      if (retry !== undefined) setRateRetryAfter(Number(retry));
      setError(err.response?.data?.message || err.message || t('forgot.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col bg-wa-chat justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-wa-accent/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-wa-accent" />
          </div>
          <h2 className="text-xl font-bold text-wa-primary mb-2">{t('forgot.checkEmailTitle')}</h2>
          <p className="text-sm text-wa-secondary mb-6">{t('forgot.checkEmailBody', { email })}</p>
          <Link
            to="/auth"
            className="block w-full py-3.5 px-4 bg-wa-green text-wa-sidebar font-bold rounded-xl hover:bg-wa-accent transition-all uppercase tracking-wide text-sm"
          >
            {t('common.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

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
          <button type="button" onClick={() => navigate('/auth')} className="flex items-center gap-1.5 text-sm text-wa-secondary hover:text-wa-green transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> {t('common.backToLogin')}
          </button>

          <h2 className="text-xl font-bold text-wa-primary mb-2">{t('forgot.title')}</h2>
          <p className="text-sm text-wa-secondary mb-6">{t('forgot.subtitle')}</p>

          {error && (
            <div role="alert" aria-live="assertive" className="p-3 text-sm bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 mb-4">
              {error}
              {rateRetryAfter && <div className="mt-1 text-[11px] text-red-300">{t('forgot.retryIn', { minutes: Math.ceil(rateRetryAfter / 60) })}</div>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">{t('forgot.email')}</label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-wa-green transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('forgot.emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-wa-border bg-wa-chat focus:outline-none text-wa-primary focus:border-wa-green focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3.5 px-4 bg-wa-green text-wa-sidebar font-bold rounded-xl hover:bg-wa-accent disabled:bg-wa-secondary/20 disabled:text-wa-secondary transition-all uppercase tracking-wide text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t('auth.sending')}</>
              ) : (
                t('forgot.sendResetLink')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
