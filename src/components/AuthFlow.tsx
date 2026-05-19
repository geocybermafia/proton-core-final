import React, { useState, useMemo } from 'react';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { translations } from '../translations';
import { motion } from 'framer-motion';
import { Zap, Loader2, ChevronLeft } from 'lucide-react';

interface AuthFlowProps {
  onGoogleSignIn: () => void;
  onBack?: () => void;
  language: 'en' | 'ka';
}

export const AuthFlow = ({ onGoogleSignIn, onBack, language }: AuthFlowProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const currentLang = (language === 'ka' || language === 'en') ? language : 'en';
  const t = translations[currentLang].auth;

  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email.includes('@')) {
      setError(t.invalid_email);
      return;
    }

    if (isResetting) {
      setLoading(true);
      try {
        await sendPasswordResetEmail(auth, email);
        setSuccess(t.reset_email_sent);
      } catch (err: any) {
        console.error("Reset Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setError(t.password_too_short);
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError(t.passwords_dont_match);
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-proton-bg p-4 relative">
      {onBack && (
        <button 
          onClick={onBack}
          className="absolute top-8 left-8 p-3 rounded-xl bg-proton-card border border-proton-border text-proton-muted hover:text-proton-text transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest"
        >
          <ChevronLeft size={16} />
          {language === 'ka' ? 'უკან' : 'Back'}
        </button>
      )}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-proton-card rounded-2xl shadow-xl border border-proton-border p-8"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-proton-accent rounded-xl mx-auto flex items-center justify-center text-proton-on-accent mb-4">
            <Zap size={24} fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-proton-text">
            {isResetting ? t.reset_password : (isLogin ? t.login : t.signup)}
          </h1>
          <p className="text-sm text-proton-muted mt-2">
            Professional Business Intelligence
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-current">
              {language === 'ka' ? 'ელ-ფოსტა' : 'Email Address'}
            </label>
            <input
              type="email"
              name="email"
              id="email"
              required
              placeholder={language === 'ka' ? 'name@example.com' : 'name@example.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-transparent border-current focus:outline-none focus:ring-2 focus:ring-proton-accent"
            />
          </div>

          {!isResetting && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-proton-text">{t.password}</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={() => setIsResetting(true)}
                    className="text-xs text-proton-accent hover:underline"
                  >
                    {t.forgot_password}
                  </button>
                )}
              </div>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-proton-bg border border-proton-border rounded-lg outline-none focus:ring-2 focus:ring-proton-accent/20 transition-all text-proton-text"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {!isLogin && !isResetting && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-proton-text">{t.confirm_password}</label>
              <input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-proton-bg border border-proton-border rounded-lg outline-none focus:ring-2 focus:ring-proton-accent/20 transition-all text-proton-text"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {error && <div className="p-3 bg-red-500/10 text-red-500 rounded-lg text-sm border border-red-500/20">{error}</div>}
          {success && <div className="p-3 bg-green-500/10 text-green-500 rounded-lg text-sm border border-green-500/20">{success}</div>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-proton-accent text-proton-on-accent rounded-lg font-semibold hover:bg-proton-accent/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (isResetting ? t.send_reset_link : (isLogin ? t.login : t.signup))}
          </button>
        </form>

        {!isResetting && (
          <>
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-proton-border"></div></div>
              <span className="relative px-3 bg-proton-card text-xs text-proton-muted">OR</span>
            </div>

            <button 
              onClick={onGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-2 bg-proton-bg border border-proton-border rounded-lg text-sm font-medium text-proton-text hover:bg-proton-muted/5 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.26v2.84C4.09 20.61 7.74 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.26C1.43 8.72 1 10.3 1 12s.43 3.28 1.26 4.93l3.58-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.74 1 4.09 3.39 2.26 7.07l3.58 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
          </>
        )}

        <div className="mt-8 text-center">
          <button 
            onClick={() => {
              if (isResetting) setIsResetting(false);
              else setIsLogin(!isLogin);
            }}
            className="text-sm text-proton-muted hover:text-proton-accent transition-colors"
          >
            {isResetting ? t.back_to_login : (isLogin ? t.dont_have_account : t.already_have_account)}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
