import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth.api';
import { User, Mail, Lock, UserPlus, AtSign } from 'lucide-react';

const registerSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores').optional().or(z.literal('')),
  identity: z.string().min(1, 'Email or Phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onRegisterSuccess: (
    identity: { email?: string; phone?: string },
    formValues: { displayName: string; username?: string; password?: string }
  ) => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onRegisterSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const isEmail = values.identity.includes('@');
      const identityPayload = isEmail
        ? { email: values.identity }
        : { phone: values.identity };

      await authApi.sendOtp(identityPayload);

      onRegisterSuccess(identityPayload, {
        displayName: values.displayName,
        username: values.username || undefined,
        password: values.password,
      });
    } catch (err: any) {
      triggerError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-wa-primary">
      {error && (
        <div className={`p-3 text-sm bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : 'animate-slide-down'}`}>
          {error}
        </div>
      )}

      <div className="animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">
          Display Name
        </label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors duration-200">
            <User className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="e.g. John Doe"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all duration-200 ${
              errors.displayName
                ? 'border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
            }`}
            {...register('displayName')}
          />
        </div>
        {errors.displayName && (
          <p className="mt-1.5 text-xs text-red-400 animate-slide-down">{errors.displayName.message}</p>
        )}
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.075s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">
          Username <span className="text-wa-secondary/50 normal-case lowercase">(optional)</span>
        </label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors duration-200">
            <AtSign className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="e.g. johndoe"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all duration-200 ${
              errors.username
                ? 'border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
            }`}
            {...register('username')}
          />
        </div>
        {errors.username && (
          <p className="mt-1.5 text-xs text-red-400 animate-slide-down">{errors.username.message}</p>
        )}
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">
          Email or Phone
        </label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors duration-200">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="e.g. johndoe@example.com"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all duration-200 ${
              errors.identity
                ? 'border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
            }`}
            {...register('identity')}
          />
        </div>
        {errors.identity && (
          <p className="mt-1.5 text-xs text-red-400 animate-slide-down">{errors.identity.message}</p>
        )}
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">
          Password
        </label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors duration-200">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type="password"
            placeholder="••••••••"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all duration-200 ${
              errors.password
                ? 'border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
            }`}
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p className="mt-1.5 text-xs text-red-400 animate-slide-down">{errors.password.message}</p>
        )}
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <label className="block text-xs font-semibold text-wa-secondary uppercase tracking-wider mb-2">
          Confirm Password
        </label>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wa-secondary group-focus-within:text-emerald-400 transition-colors duration-200">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type="password"
            placeholder="••••••••"
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-wa-chat focus:outline-none text-wa-primary transition-all duration-200 ${
              errors.confirmPassword
                ? 'border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                : 'border-wa-border focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
            }`}
            {...register('confirmPassword')}
          />
        </div>
        {errors.confirmPassword && (
          <p className="mt-1.5 text-xs text-red-400 animate-slide-down">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 px-4 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:bg-wa-secondary/20 disabled:text-wa-secondary transition-all duration-200 uppercase tracking-wide text-sm flex items-center justify-center gap-2 active:scale-[0.98] hover:shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)] animate-slide-up"
        style={{ animationDelay: '0.25s' }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending Code...
          </span>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            Register & Verify
          </>
        )}
      </button>
    </form>
  );
};
