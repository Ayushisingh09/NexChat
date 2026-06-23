import React, { useState } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { OtpVerify } from '../components/auth/OtpVerify';
import { useNavigate } from 'react-router-dom';

const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'otp'>('login');

  const [regCredentials, setRegCredentials] = useState<{
    displayName: string;
    username?: string;
    identity: { email?: string; phone?: string };
    password?: string;
  } | null>(null);

  const navigate = useNavigate();

  const handleRegisterSuccess = (
    identity: { email?: string; phone?: string },
    formValues: { displayName: string; username?: string; password?: string }
  ) => {
    setRegCredentials({
      displayName: formValues.displayName,
      username: formValues.username,
      identity,
      password: formValues.password,
    });
    setActiveTab('otp');
  };

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-[100dvw] bg-[#0b0b0e]">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight text-white">
              {activeTab === 'otp' ? 'Verify Account' : activeTab === 'register' ? 'Create Account' : 'Welcome'}
            </h1>
            <p className="animate-element animate-delay-200 text-zinc-400">
              {activeTab === 'otp' ? 'Enter the verification code sent to your email' : 'Access your account and continue your journey with us'}
            </p>

            {activeTab !== 'otp' && (
              <div className="animate-element animate-delay-300 flex border-b border-white/10">
                <button type="button"
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-4 text-sm font-semibold tracking-wider uppercase transition-all duration-200 relative ${
                    activeTab === 'login'
                      ? 'text-emerald-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Login
                  {activeTab === 'login' && (
                    <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-emerald-400 rounded-full" />
                  )}
                </button>
                <button type="button"
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-4 text-sm font-semibold tracking-wider uppercase transition-all duration-200 relative ${
                    activeTab === 'register'
                      ? 'text-emerald-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Register
                  {activeTab === 'register' && (
                    <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-emerald-400 rounded-full" />
                  )}
                </button>
              </div>
            )}

            <div className="animate-element animate-delay-400">
              {activeTab === 'login' && <LoginForm key="login" />}
              {activeTab === 'register' && (
                <RegisterForm
                  key="register"
                  onRegisterSuccess={handleRegisterSuccess}
                />
              )}
              {activeTab === 'otp' && regCredentials && (
                <OtpVerify
                  key="otp"
                  identity={regCredentials.identity}
                  displayName={regCredentials.displayName}
                  username={regCredentials.username}
                  password={regCredentials.password}
                  onVerifySuccess={() => navigate('/chat')}
                  onBack={() => setActiveTab('register')}
                />
              )}
            </div>

            {activeTab !== 'otp' && (
              <p className="animate-element animate-delay-500 text-center text-sm text-zinc-400">
                {activeTab === 'login' ? "New to our platform?" : "Already have an account?"}{' '}
                <button
                  onClick={() => setActiveTab(activeTab === 'login' ? 'register' : 'login')}
                  className="text-emerald-400 hover:underline transition-colors"
                >
                  {activeTab === 'login' ? 'Create Account' : 'Sign In'}
                </button>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Right column: hero image */}
      <section className="hidden md:block flex-1 relative p-4">
        <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80)` }}></div>
      </section>
    </div>
  );
};

export default AuthPage;
