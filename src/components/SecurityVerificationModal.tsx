import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth';
import { googleProvider } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { SecurityPinMeta } from '../lib/securityUtils';
import { verifyStepUpPinCall } from '../services/cloudFunctionsService';

export type SecurityModalScope = 'updateSecurityPin' | 'resetUserWorkspace' | 'changeEmail' | 'generalStepUp';

export interface SecurityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (grantId?: string) => void;
  actionTitle?: string;
  scope?: SecurityModalScope;
  securityPinEnabled?: boolean;
  securityPinMeta?: SecurityPinMeta;
  language: 'ka' | 'en';
}

const MAX_CLIENT_AUTH_AGE_MS = 4 * 60 * 1000; // 4-minute client window before prompting Firebase reauth

export const SecurityVerificationModal: React.FC<SecurityVerificationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionTitle,
  scope = 'generalStepUp',
  securityPinEnabled = false,
  language = 'ka',
}) => {
  const { user } = useAuth();
  const [pinInput, setPinInput] = useState(['', '', '', '']);
  const [reauthPassword, setReauthPassword] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutSecs, setLockoutSecs] = useState(0);

  const hasPinProtection = !!securityPinEnabled;
  const providerIds = (user?.providerData || []).map((p) => p?.providerId).filter(Boolean);
  const usesPasswordProvider = providerIds.includes('password');
  const usesGoogleProvider = providerIds.includes('google.com');
  const isSensitiveNoPinScope = scope === 'changeEmail' || scope === 'resetUserWorkspace';

  useEffect(() => {
    let cancelled = false;

    if (isOpen) {
      setPinInput(['', '', '', '']);
      setReauthPassword('');
      setIsVerifying(false);
      if (lockoutSecs <= 0) {
        setErrorMsg('');
      }

      if (!hasPinProtection && isSensitiveNoPinScope && user) {
        const determineReauth = async () => {
          // For password accounts on email change, always prompt password reauthentication.
          if (scope === 'changeEmail' && usesPasswordProvider) {
            if (!cancelled) setNeedsReauth(true);
            return;
          }
          if (scope === 'changeEmail' && usesGoogleProvider) {
            if (!cancelled) setNeedsReauth(true);
            return;
          }

          if (typeof user.getIdTokenResult === 'function') {
            try {
              const tokenRes = await user.getIdTokenResult();
              const authTimeStr = (tokenRes as any)?.authTime;
              if (authTimeStr) {
                const authMs = Date.parse(authTimeStr);
                if (!Number.isNaN(authMs) && Date.now() - authMs > MAX_CLIENT_AUTH_AGE_MS) {
                  if (!cancelled && (usesPasswordProvider || usesGoogleProvider)) {
                    setNeedsReauth(true);
                  }
                  return;
                }
              }
            } catch {
              // Ignore token inspection failure; server enforces auth_time authoritatively
            }
          }

          if (!cancelled) setNeedsReauth(false);
        };
        determineReauth();
      } else {
        setNeedsReauth(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
    };
  }, [isOpen, language, hasPinProtection, scope, user]);

  // Lockout countdown timer effect
  useEffect(() => {
    if (lockoutSecs <= 0) return;

    const timer = setInterval(() => {
      setLockoutSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSecs]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, value: string) => {
    if (lockoutSecs > 0) return;

    if (value.length > 1) {
      value = value.slice(-1);
    }
    if (value && !/^\d+$/.test(value)) return;

    const newPin = [...pinInput];
    newPin[index] = value;
    setPinInput(newPin);
    setErrorMsg('');

    // Auto-advance to next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`stepup-pin-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinInput[index] && index > 0) {
      const prevInput = document.getElementById(`stepup-pin-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const fullPinEntered = pinInput.join('');

  const handleVerify = async () => {
    if (lockoutSecs > 0) {
      setErrorMsg(
        language === 'ka'
          ? `მრავალჯერადი არასწორი მცდელობა. გთხოვთ დაელოდოთ ${lockoutSecs} წამს.`
          : `Too many failed attempts. Please wait ${lockoutSecs} seconds.`
      );
      return;
    }

    let issuedGrantId: string | undefined;

    if (hasPinProtection) {
      if (fullPinEntered.length < 4 || !/^\d{4}$/.test(fullPinEntered)) {
        setErrorMsg(language === 'ka' ? 'გთხოვთ შეიყვანოთ 4-ნიშნა PIN კოდი' : 'Please enter complete 4-digit PIN');
        return;
      }

      setIsVerifying(true);
      setErrorMsg('');

      try {
        // Authoritative server-only PIN verification via Cloud Function
        const res = await verifyStepUpPinCall({ pin: fullPinEntered, scope });
        if (!res || !res.success || typeof res.grantId !== 'string' || res.grantId.length === 0) {
          throw new Error(
            language === 'ka'
              ? 'სერვერული დადასტურება ვერ მოხერხდა'
              : 'Server step-up verification did not issue a valid grant'
          );
        }
        issuedGrantId = res.grantId;
      } catch (err: any) {
        setIsVerifying(false);
        setPinInput(['', '', '', '']); // Immediately clear PIN input from memory

        const errCode = String(err?.code || '').toLowerCase();
        const errMessage = String(err?.message || '');

        if (errCode.includes('resource-exhausted') || /too many failed attempts/i.test(errMessage)) {
          const match = errMessage.match(/(\d+)\s*seconds?/i);
          const remaining = match ? Math.max(1, parseInt(match[1], 10)) : 15;
          setLockoutSecs(remaining);
          setErrorMsg(
            language === 'ka'
              ? `მრავალჯერადი არასწორი მცდელობა. გთხოვთ დაელოდოთ ${remaining} წამს.`
              : `Too many failed attempts. Please wait ${remaining} seconds.`
          );
        } else if (errCode.includes('permission-denied') || /incorrect pin/i.test(errMessage)) {
          setErrorMsg(
            language === 'ka'
              ? 'ოპერაციის შესრულება ვერ მოხერხდა — არასწორი PIN კოდი'
              : 'Operation failed — incorrect PIN code'
          );
        } else if (errCode.includes('unauthenticated')) {
          setErrorMsg(
            language === 'ka'
              ? 'დადასტურებისთვის საჭიროა ავტორიზაცია'
              : 'Authentication required for step-up verification'
          );
        } else {
          setErrorMsg(
            language === 'ka'
              ? 'სერვერთან დადასტურება ვერ მოხერხდა. სცადეთ მოგვიანებით.'
              : 'Server verification unavailable or denied. Please try again.'
          );
        }
        return;
      }

      setIsVerifying(false);
    } else if (needsReauth && user) {
      // PIN-disabled account requiring Firebase reauthentication
      if (usesPasswordProvider) {
        if (!reauthPassword) {
          setErrorMsg(
            language === 'ka'
              ? 'გთხოვთ შეიყვანოთ თქვენი მიმდინარე პაროლი'
              : 'Please enter your current password to verify identity'
          );
          return;
        }
        if (!user.email) {
          setErrorMsg(
            language === 'ka'
              ? 'ანგარიშის ელფოსტა ვერ მოიძებნა ხელახალი ავთენტიფიკაციისთვის'
              : 'Account email unavailable for password re-authentication'
          );
          return;
        }

        setIsVerifying(true);
        setErrorMsg('');
        try {
          const credential = EmailAuthProvider.credential(user.email, reauthPassword);
          await reauthenticateWithCredential(user, credential);
          if (typeof user.getIdToken === 'function') {
            await user.getIdToken(true);
          }
        } catch (reauthErr: any) {
          setIsVerifying(false);
          setReauthPassword('');
          const code = String(reauthErr?.code || '').toLowerCase();
          if (code.includes('wrong-password') || code.includes('invalid-credential')) {
            setErrorMsg(
              language === 'ka'
                ? 'მიმდინარე პაროლი არასწორია'
                : 'Incorrect current password'
            );
          } else {
            setErrorMsg(
              reauthErr?.message ||
                (language === 'ka'
                  ? 'ხელახალი ავთენტიფიკაცია ვერ მოხერხდა'
                  : 'Re-authentication failed. Please try again.')
            );
          }
          return;
        }
        setIsVerifying(false);
      } else if (usesGoogleProvider) {
        setIsVerifying(true);
        setErrorMsg('');
        try {
          await reauthenticateWithPopup(user, googleProvider);
          if (typeof user.getIdToken === 'function') {
            await user.getIdToken(true);
          }
        } catch (reauthErr: any) {
          setIsVerifying(false);
          setErrorMsg(
            reauthErr?.message ||
              (language === 'ka'
                ? 'Google-ით ხელახალი დადასტურება ვერ მოხერხდა'
                : 'Google re-authentication failed or was cancelled')
          );
          return;
        }
        setIsVerifying(false);
      }
    }

    setPinInput(['', '', '', '']); // Clear memory
    setReauthPassword('');
    onConfirm(issuedGrantId);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-proton-card border border-proton-border rounded-3xl shadow-2xl overflow-hidden z-10 p-6 sm:p-8 space-y-6"
        >
          {/* Top Header */}
          <div className="flex items-start justify-between border-b border-proton-border/50 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div className="text-left">
                <h3 className="text-base font-extrabold text-proton-text uppercase tracking-tight">
                  {language === 'ka' ? 'დამატებითი დადასტურებაა საჭირო' : 'Additional Verification Required'}
                </h3>
                <p className="text-[10px] text-proton-muted font-bold uppercase tracking-wider mt-0.5">
                  {language === 'ka' ? 'ეს მოქმედება საჭიროებს დამატებით უსაფრთხოების შემოწმებას' : 'This action requires extra security verification'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-proton-muted hover:text-proton-text hover:bg-proton-secondary/20 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-5 text-left">
            <div className="p-3.5 bg-proton-secondary/10 border border-proton-border/40 rounded-2xl flex items-center gap-3">
              <Lock size={16} className="text-proton-accent shrink-0" />
              <div>
                <span className="text-[10px] font-black text-proton-accent uppercase tracking-widest block">
                  {actionTitle || (language === 'ka' ? 'მნიშვნელოვანი მოქმედება' : 'Sensitive Operation')}
                </span>
                <span className="text-[10px] text-proton-muted font-semibold block mt-0.5">
                  {language === 'ka' ? 'გააგრძელეთ იდენტობის დადასტურება' : 'Proceed with identity confirmation'}
                </span>
              </div>
            </div>

            {hasPinProtection ? (
              <div className="space-y-4 pt-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-proton-muted block text-center">
                  {language === 'ka' ? 'შეიყვანეთ თქვენი 4-ნიშნა PIN კოდი' : 'Enter your 4-digit Security PIN'}
                </label>
                <div className="flex items-center justify-center gap-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      id={`stepup-pin-input-${idx}`}
                      type="password"
                      maxLength={1}
                      disabled={lockoutSecs > 0}
                      value={pinInput[idx]}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-12 h-14 bg-proton-bg border border-proton-border rounded-xl text-center text-xl font-bold font-mono text-proton-text focus:outline-none focus:border-proton-accent focus:ring-2 focus:ring-proton-accent/20 transition-all disabled:opacity-50"
                      autoFocus={idx === 0}
                    />
                  ))}
                </div>
              </div>
            ) : needsReauth && usesPasswordProvider ? (
              <div className="space-y-3 pt-1">
                <label
                  htmlFor="stepup-reauth-password"
                  className="text-[10px] font-black uppercase tracking-widest text-proton-muted block"
                >
                  {language === 'ka'
                    ? 'შეიყვანეთ ანგარიშის მიმდინარე პაროლი'
                    : 'Enter current account password to re-authenticate'}
                </label>
                <input
                  id="stepup-reauth-password"
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => {
                    setReauthPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full px-4 py-3 bg-proton-bg border border-proton-border rounded-xl text-sm text-proton-text focus:outline-none focus:border-proton-accent focus:ring-2 focus:ring-proton-accent/20"
                />
              </div>
            ) : needsReauth && usesGoogleProvider ? (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-[11px] text-proton-text font-medium leading-relaxed space-y-1">
                <p className="font-bold text-amber-400">
                  {language === 'ka' ? 'ხელახალი ავტორიზაცია (Google):' : 'Google Re-authentication:'}
                </p>
                <p>
                  {language === 'ka'
                    ? 'დადასტურების ღილაკზე დაჭერით გაიხსნება Google-ით ხელახალი ავტორიზაციის ფანჯარა.'
                    : 'Clicking Confirm will verify your identity via Google re-authentication before proceeding.'}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-[11px] text-proton-text font-medium leading-relaxed space-y-1">
                <p className="font-bold text-amber-400">
                  {language === 'ka' ? 'ყურადღება:' : 'Warning:'}
                </p>
                <p>
                  {language === 'ka'
                    ? 'ამ მოქმედების გაუქმება შეუძლებელია. სერვერი გადაამოწმებს თქვენს უსაფრთხოების სტატუსს. გსურთ გაგრძელება?'
                    : 'This action cannot be undone. The server will verify your authorization before proceeding.'}
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-[10px] font-bold">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying || lockoutSecs > 0}
              className="w-full sm:flex-1 py-3 px-4 bg-proton-accent text-proton-bg rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg cursor-pointer active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={16} />
              {isVerifying
                ? (language === 'ka' ? 'მოწმდება...' : 'Verifying...')
                : lockoutSecs > 0
                ? (`${lockoutSecs}s`)
                : (language === 'ka' ? 'დადასტურება' : 'Confirm')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto py-3 px-5 bg-proton-secondary/20 hover:bg-proton-secondary/40 text-proton-text border border-proton-border rounded-2xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer active:scale-95"
            >
              {language === 'ka' ? 'გაუქმება' : 'Cancel'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
