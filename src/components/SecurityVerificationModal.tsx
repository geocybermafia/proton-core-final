import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SecurityPinMeta,
  verifyPinWithMeta,
  checkPinLockout,
  registerFailedPinAttempt,
  resetPinLockoutAttempts,
} from '../lib/securityUtils';

export interface SecurityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionTitle?: string;
  securityPinEnabled?: boolean;
  securityPinMeta?: SecurityPinMeta;
  correctPin?: string; // Legacy fallback
  language: 'ka' | 'en';
}

export const SecurityVerificationModal: React.FC<SecurityVerificationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  actionTitle,
  securityPinEnabled = false,
  securityPinMeta,
  correctPin,
  language = 'ka',
}) => {
  const [pinInput, setPinInput] = useState(['', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutSecs, setLockoutSecs] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPinInput(['', '', '', '']);
      setErrorMsg('');
      setIsVerifying(false);

      const lockout = checkPinLockout();
      if (lockout.isLocked) {
        setLockoutSecs(lockout.remainingSeconds);
        setErrorMsg(language === 'ka' ? lockout.messageKa! : lockout.messageEn!);
      } else {
        setLockoutSecs(0);
      }
    }
  }, [isOpen, language]);

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
    const currentLockout = checkPinLockout();
    if (currentLockout.isLocked) {
      setLockoutSecs(currentLockout.remainingSeconds);
      setErrorMsg(language === 'ka' ? currentLockout.messageKa! : currentLockout.messageEn!);
      return;
    }

    if (securityPinEnabled && (securityPinMeta || correctPin)) {
      if (fullPinEntered.length < 4) {
        setErrorMsg(language === 'ka' ? 'გთხოვთ შეიყვანოთ 4-ნიშნა PIN კოდი' : 'Please enter complete 4-digit PIN');
        return;
      }

      setIsVerifying(true);

      let isValid = false;

      if (securityPinMeta) {
        isValid = await verifyPinWithMeta(fullPinEntered, securityPinMeta);
      } else if (correctPin) {
        // Fallback for immediate legacy in-memory checks if meta not set yet
        isValid = fullPinEntered === correctPin;
      }

      setIsVerifying(false);

      if (!isValid) {
        const lockoutStatus = registerFailedPinAttempt();
        setPinInput(['', '', '', '']); // Immediately clear pin input from memory
        if (lockoutStatus.isLocked) {
          setLockoutSecs(lockoutStatus.remainingSeconds);
          setErrorMsg(language === 'ka' ? lockoutStatus.messageKa! : lockoutStatus.messageEn!);
        } else {
          setErrorMsg(
            language === 'ka'
              ? 'ოპერაციის შესრულება ვერ მოხერხდა — არასწორი PIN კოდი'
              : 'Operation failed — incorrect PIN code'
          );
        }
        return;
      }

      // Success! Reset lockout counter
      resetPinLockoutAttempts();
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setPinInput(['', '', '', '']); // Clear memory
      onConfirm();
      onClose();
    }, 200);
  };

  const hasPinProtection = securityPinEnabled && (!!securityPinMeta || !!correctPin);

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
                  {actionTitle || (language === 'ka' ? 'სენსიტიური ოპერაცია' : 'Sensitive Operation')}
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
            ) : (
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-[11px] text-proton-text font-medium leading-relaxed space-y-1">
                <p className="font-bold text-amber-400">
                  {language === 'ka' ? 'ყურადღება:' : 'Warning:'}
                </p>
                <p>
                  {language === 'ka'
                    ? 'ამ მოქმედების გაუქმება შეუძლებელია. გსურთ გაგრძელება?'
                    : 'This action cannot be undone. Are you sure you want to proceed?'}
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
