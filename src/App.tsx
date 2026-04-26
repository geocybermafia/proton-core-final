import React, { useState, useEffect, useRef, useMemo, Dispatch, SetStateAction } from 'react';
import { WorkflowFlowEditor } from './components/WorkflowFlowEditor';
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  fetchSignInMethodsForEmail, 
  sendPasswordResetEmail,
  linkWithCredential, 
  GoogleAuthProvider,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, getDocFromServer, addDoc, deleteDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const handleFirestoreError = (error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null) => {
  if (error.code === 'permission-denied') {
    const user = auth.currentUser;
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: {
        userId: user?.uid || 'unauthenticated',
        email: user?.email || '',
        emailVerified: user?.emailVerified || false,
        isAnonymous: user?.isAnonymous || false,
        providerInfo: user?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || ''
        })) || []
      }
    };
    console.error("Firestore Permission Denied:", errorInfo);
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
};

// Test connection helper
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell
} from 'recharts';
import { 
  Cpu, 
  MessageSquare, 
  Wallet, 
  Settings, 
  Activity, 
  Zap, 
  Workflow,
  Globe, 
  Users, 
  ChevronRight, 
  ChevronDown,
  Heart,
  Terminal, 
  ShieldCheck, 
  Cloud,
  Compass,
  ArrowRight,
  Send,
  Loader2,
  Database,
  Layers,
  Network,
  Sun,
  Moon,
  Sparkles,
  Edit2,
  X,
  Plus,
  Trash2,
  Image,
  Volume2,
  Shield,
  LayoutDashboard,
  Receipt,
  FileText,
  Building,
  Calendar as CalendarIcon,
  Check,
  ShieldAlert,
  Lock,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { cn } from './lib/utils';
import { translations } from './translations';
import { PERSONAS, chatWithPersona, generatePersonaAvatar, summarizeConversation, analyzeWorkflow, generateOrEditImage, generateSpeech, architectTask, type Persona, type TaskPlan, type GeminiMetadata } from './services/gemini';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance } from 'wagmi';

// --- Types ---
type View = 'dashboard' | 'compute' | 'personas' | 'finance' | 'blueprints' | 'profile' | 'settings' | 'image' | 'organizer' | 'device';

type ChatMessage = { role: 'user' | 'model', content: string, timestamp: number };
type PersonaHistory = { [personaId: string]: ChatMessage[] };
export type WorkflowStep = {
  id: string;
  label: string;
  description: string;
};

export type Workflow = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  personaId: string;
  analysisHistory?: { timestamp: number; result: string }[];
  nodes?: any[];
  edges?: any[];
  steps?: WorkflowStep[];
};

type UserProfile = {
  name: string;
  email: string;
  language: 'en' | 'ka';
  region: string;
  notifications: boolean;
};

type GlobalAiSettings = {
  temperature: number;
  enableSearch: boolean;
  enableMaps: boolean;
  zenMode: boolean;
  systemInstruction?: string;
  voice: string;
};

type Task = {
  id: string;
  content: string;
  contentGe: string;
  completed: boolean;
  isAiSuggested?: boolean;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
};

// --- Components ---

const SidebarItem = React.memo(({ 
  icon: Icon, 
  label, 
  active, 
  onClick,
  expanded = true,
  uiMode = 'operator'
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  expanded?: boolean,
  uiMode?: 'operator' | 'artisan'
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-4 w-full px-4 py-3 rounded-2xl transition-all duration-300 group relative",
      active 
        ? "bg-proton-accent/10 text-proton-accent"
        : "text-proton-muted hover:text-proton-text hover:bg-white/5",
      !expanded && "justify-center px-0"
    )}
    title={!expanded ? label : undefined}
  >
    <Icon size={20} className={cn("shrink-0 transition-transform duration-300 group-hover:scale-110", active ? "text-proton-accent" : "group-hover:text-proton-text")} />
    {expanded && (
      <span className={cn(
        "text-xs font-semibold tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-left-2",
        active ? "text-proton-accent" : "text-proton-muted group-hover:text-proton-text"
      )}>
        {label}
      </span>
    )}
    {active && (
      <motion.div 
        layoutId="active-pill" 
        className={cn(
          "absolute left-0 w-1 h-6 bg-proton-accent rounded-full",
          active && "shadow-[0_0_15px_rgba(59,130,246,0.5)]"
        )} 
      />
    )}
  </button>
));

const PersonaAvatar = ({ avatar, className }: { avatar: string, className?: string }) => {
  const isImage = avatar.startsWith('data:image') || avatar.startsWith('http');
  
  return (
    <div className={cn("flex items-center justify-center overflow-hidden shrink-0", className)}>
      {isImage ? (
        <img src={avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-2xl leading-none">{avatar}</span>
      )}
    </div>
  );
};

const PersonaEditor = ({ 
  persona, 
  onSave, 
  onClose 
}: { 
  persona?: Persona, 
  onSave: (persona: Persona) => void, 
  onClose: () => void 
}) => {
  const [formData, setFormData] = useState<Persona>(persona || {
    id: `persona-${Date.now()}`,
    name: '',
    nameGe: '',
    role: '',
    description: '',
    descriptionGe: '',
    systemInstruction: '',
    avatar: '🤖',
    language: 'English'
  });

  const [generating, setGenerating] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const errors = {
    name: !formData.name.trim(),
    nameGe: !formData.nameGe.trim(),
    role: !formData.role.trim(),
    description: !formData.description.trim(),
    descriptionGe: !formData.descriptionGe.trim(),
    systemInstruction: !formData.systemInstruction.trim(),
  };

  const isInvalid = Object.values(errors).some(Boolean);

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSave = () => {
    if (isInvalid) {
      setTouched({ name: true, nameGe: true, role: true, description: true, descriptionGe: true, systemInstruction: true });
      return;
    }
    onSave(formData);
  };

  const handleGenerateAvatar = async () => {
    setGenerating(true);
    try {
      const prompt = avatarPrompt || `Generate a high-quality, professional digital avatar for an AI persona named '${formData.name}'. Role: ${formData.role}. Description: ${formData.description}. Style: Neo-Brutalist, technical, clean, centered, circular composition. Use a vibrant color palette with high-contrast accents (e.g., neon cyan, electric purple, or bright orange) against a deep, dark charcoal or midnight blue background. The avatar should be iconic, minimalist, and represent the persona's expertise with sharp geometric shapes and bold lines.`;
      const newAvatar = await generateOrEditImage(prompt);
      setFormData(prev => ({ ...prev, avatar: newAvatar }));
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-proton-bg/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="proton-glass p-4 sm:p-8 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 sm:space-y-6 shadow-2xl custom-scrollbar"
      >
        <div className="flex justify-between items-center sticky top-0 bg-transparent backdrop-blur-md pb-4 z-10">
          <h3 className="text-xl font-bold flex items-center gap-2 text-proton-accent">
            <Edit2 size={20} />
            {persona ? 'Edit Persona' : 'Create New Persona'}
          </h3>
          <button onClick={onClose} className="text-proton-muted hover:text-proton-text">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">English Name ({formData.name.length}/50)</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                onBlur={() => handleBlur('name')}
                className={cn(
                  "w-full bg-proton-bg border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors",
                  errors.name ? "border-red-500" : "border-proton-border"
                )}
                placeholder="e.g. Tech Strategist"
                maxLength={50}
              />
              {errors.name && <p className="text-[10px] text-red-500 font-mono">Name is required</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Georgian Name ({formData.nameGe.length}/50)</label>
              <input 
                type="text" 
                value={formData.nameGe}
                onChange={e => setFormData(prev => ({ ...prev, nameGe: e.target.value }))}
                onBlur={() => handleBlur('nameGe')}
                className={cn(
                  "w-full bg-proton-bg border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors",
                  errors.nameGe ? "border-red-500" : "border-proton-border"
                )}
                placeholder="მაგ. ტექ სტრატეგი"
                maxLength={50}
              />
              {errors.nameGe && <p className="text-[10px] text-red-500 font-mono">Georgian name is required</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Role ({formData.role.length}/50)</label>
              <input 
                type="text" 
                value={formData.role}
                onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                onBlur={() => handleBlur('role')}
                className={cn(
                  "w-full bg-proton-bg border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors",
                  errors.role ? "border-red-500" : "border-proton-border"
                )}
                placeholder="e.g. Marketing Specialist"
                maxLength={50}
              />
              {errors.role && <p className="text-[10px] text-red-500 font-mono">Role is required</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Language</label>
              <select
                value={formData.language}
                onChange={e => setFormData(prev => ({ ...prev, language: e.target.value as 'English' | 'Georgian' | 'Mixed' }))}
                className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors text-sm"
              >
                <option value="English">English</option>
                <option value="Georgian">Georgian</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Avatar Selection</label>
              <div className="flex items-center gap-4">
                <PersonaAvatar avatar={formData.avatar} className="w-16 h-16 ring-2 ring-proton-accent/20" />
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_AVATARS.slice(0, 8).map(av => (
                      <button 
                        key={av}
                        onClick={() => setFormData(prev => ({ ...prev, avatar: av }))}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-all",
                          formData.avatar === av ? "border-proton-accent bg-proton-accent/10" : "border-proton-border hover:border-proton-muted"
                        )}
                      >
                        {av}
                      </button>
                    ))}
                    <label className="w-8 h-8 rounded-lg flex items-center justify-center border border-proton-border hover:border-proton-accent cursor-pointer transition-all">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData(prev => ({ ...prev, avatar: reader.result as string }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <Image size={14} className="text-proton-muted" />
                    </label>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={avatarPrompt}
                      onChange={e => setAvatarPrompt(e.target.value)}
                      placeholder="AI Prompt (e.g. 'Cyberpunk hacking expert')"
                      className="w-full bg-proton-bg border border-proton-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-proton-accent transition-colors"
                    />
                    <button 
                      onClick={handleGenerateAvatar}
                      disabled={generating}
                      className="w-full py-2 rounded-lg bg-proton-accent/10 text-proton-accent border border-proton-accent/30 text-[10px] font-bold uppercase tracking-widest hover:bg-proton-accent/20 transition-all flex items-center justify-center gap-2"
                    >
                      {generating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                      {generating ? "Initializing Sequence..." : "Neural Projection"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Description ({formData.description.length}/200)</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                onBlur={() => handleBlur('description')}
                className={cn(
                  "w-full bg-proton-bg border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors h-24 resize-none text-sm",
                  errors.description ? "border-red-500" : "border-proton-border"
                )}
                placeholder="Briefly describe the persona's purpose..."
                maxLength={200}
              />
              {errors.description && <p className="text-[10px] text-red-500 font-mono">Description is required</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Georgian Description ({formData.descriptionGe.length}/200)</label>
              <textarea 
                value={formData.descriptionGe}
                onChange={e => setFormData(prev => ({ ...prev, descriptionGe: e.target.value }))}
                onBlur={() => handleBlur('descriptionGe')}
                className={cn(
                  "w-full bg-proton-bg border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors h-24 resize-none text-sm",
                  errors.descriptionGe ? "border-red-500" : "border-proton-border"
                )}
                placeholder="მოკლედ აღწერეთ პერსონაჟის მიზანი..."
                maxLength={200}
              />
              {errors.descriptionGe && <p className="text-[10px] text-red-500 font-mono">Georgian description is required</p>}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">System Instructions (The 'Brain') ({formData.systemInstruction.length}/4000)</label>
          <textarea 
            value={formData.systemInstruction}
            onChange={e => setFormData(prev => ({ ...prev, systemInstruction: e.target.value }))}
            onBlur={() => handleBlur('systemInstruction')}
            className={cn(
              "w-full bg-proton-bg border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors h-40 resize-none text-sm font-mono",
              errors.systemInstruction ? "border-red-500" : "border-proton-border"
            )}
            placeholder="Define how the AI should behave, its tone, knowledge base, and specific rules..."
            maxLength={4000}
          />
          {errors.systemInstruction && <p className="text-[10px] text-red-500 font-mono">System instructions are required</p>}
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-proton-border font-bold text-sm hover:bg-proton-card transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isInvalid}
            className="flex-1 py-3 rounded-xl bg-proton-accent text-proton-bg font-bold text-sm hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
          >
            {persona ? 'Update Persona' : 'Create Persona'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const AuthFlow = ({ onGoogleSignIn, language }: { onGoogleSignIn: () => void, language: 'en' | 'ka' }) => {
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

  const strengthColor = useMemo(() => {
    if (passwordStrength <= 1) return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    if (passwordStrength <= 2) return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
    return 'bg-proton-accent shadow-[0_0_15px_rgba(59,130,246,0.4)]';
  }, [passwordStrength]);

  const strengthLabel = useMemo(() => {
    if (passwordStrength <= 1) return t.weak;
    if (passwordStrength <= 2) return t.medium;
    return t.strong;
  }, [passwordStrength, t]);

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
      if (isResetting) {
        await sendPasswordResetEmail(auth, email);
        setSuccess(t.reset_email_sent);
      } else if (isLogin) {
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
    <div className="min-h-screen flex items-center justify-center bg-proton-bg p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-proton-card rounded-2xl shadow-xl border border-proton-border p-8"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-proton-accent rounded-xl mx-auto flex items-center justify-center text-white mb-4">
            <Zap size={24} fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-proton-text">
            {isResetting ? t.reset_password : (isLogin ? t.login : t.signup)}
          </h1>
          <p className="text-sm text-proton-muted mt-2">
            Professional Business Intelligence
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-proton-text">{t.email}</label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-proton-bg border border-proton-border rounded-lg outline-none focus:ring-2 focus:ring-proton-accent/20 transition-all text-proton-text"
              placeholder="name@example.com"
              required
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
            className="w-full py-2.5 bg-proton-accent text-white rounded-lg font-semibold hover:bg-proton-accent/90 transition-colors disabled:opacity-50"
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

const OrganizerView = ({
  language,
  workflows,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onAiSuggest,
}: {
  language: 'en' | 'ka',
  workflows: Workflow[],
  tasks: Task[],
  onAddTask: (content: string, priority: 'low' | 'medium' | 'high', category?: string) => void,
  onToggleTask: (id: string) => void,
  onDeleteTask: (id: string) => void,
  onEditTask: (id: string, updates: Partial<Task>) => void,
  onAiSuggest: () => void,
  uiMode: 'operator' | 'artisan'
}) => {
  const t = translations[language].organizer;
  const [newTaskInput, setNewTaskInput] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    onAddTask(newTaskInput.trim(), taskPriority, undefined);
    setNewTaskInput('');
    setTaskPriority('medium');
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const contentMatch = (language === 'ka' ? task.contentGe : task.content)
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      
      const statusMatch = filterStatus === 'all' 
        ? true 
        : filterStatus === 'completed' ? task.completed : !task.completed;
      
      return contentMatch && statusMatch;
    });
  }, [tasks, searchQuery, filterStatus, language]);

  const handleAiSuggest = async () => {
    setIsSuggesting(true);
    await onAiSuggest();
    setIsSuggesting(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.title}</h2>
          <p className="text-proton-muted mt-1 font-medium">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-proton-card p-8 rounded-3xl border border-proton-border shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <CalendarIcon size={20} className="text-proton-accent" />
                {t.calendar}
              </h3>
            </div>
            <div className="w-full">
              <style>{`
                .react-calendar { background: transparent !important; border: none !important; width: 100% !important; }
                .react-calendar__navigation button { color: var(--color-proton-text) !important; font-weight: bold !important; min-width: 44px !important; }
                .react-calendar__month-view__weekdays { text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: var(--color-proton-muted); }
                .react-calendar__tile { padding: 1.5em 0.5em !important; color: var(--color-proton-text) !important; border-radius: 12px; transition: all 0.2s; }
                .react-calendar__tile:hover { background: var(--color-proton-accent-muted) !important; }
                .react-calendar__tile--active { background: var(--color-proton-accent) !important; color: white !important; font-weight: bold; }
              `}</style>
              <Calendar className="mx-auto" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {workflows.slice(0, 4).map(wf => (
               <div key={wf.id} className="bg-proton-card p-6 rounded-2xl border border-proton-border shadow-sm group hover:border-proton-accent/50 transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-proton-accent/10 text-proton-accent group-hover:scale-110 transition-transform">
                      <Zap size={20} />
                    </div>
                    <span className="font-bold text-lg truncate">{wf.name}</span>
                  </div>
                  <p className="text-sm text-proton-muted font-medium">Trigger: {wf.trigger}</p>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-proton-card p-8 rounded-3xl border border-proton-border shadow-sm h-fit">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Layers size={20} className="text-proton-accent" />
              {t.tasks}
            </h3>
            <button 
              onClick={handleAiSuggest}
              disabled={isSuggesting}
              className="p-2 rounded-lg bg-proton-accent/10 text-proton-accent hover:bg-proton-accent/20 transition-all"
            >
              {isSuggesting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            </button>
          </div>

          <div className="space-y-6">
             <form onSubmit={handleAddTask} className="space-y-4">
                <input 
                  type="text"
                  placeholder={t.task_placeholder}
                  value={newTaskInput}
                  onChange={e => setNewTaskInput(e.target.value)}
                  className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-proton-accent transition-all"
                />
                <button type="submit" className="w-full py-3 rounded-xl bg-proton-accent text-white font-bold text-sm shadow-lg shadow-proton-accent/20">
                   Add Task
                </button>
             </form>

             <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <p className="text-center py-8 text-proton-muted font-medium italic text-xs">No tasks found.</p>
                ) : (
                  filteredTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-4 p-4 rounded-xl bg-proton-bg border border-proton-border group">
                      <button 
                        onClick={() => onToggleTask(task.id)}
                        className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                          task.completed ? "bg-proton-accent border-proton-accent text-white" : "border-proton-border"
                        )}
                      >
                        {task.completed && <Check size={14} strokeWidth={3} />}
                      </button>
                      <span className={cn("text-sm flex-1 font-medium truncate", task.completed && "line-through text-proton-muted")}>
                        {language === 'ka' ? task.contentGe : task.content}
                      </span>
                      <button onClick={() => onDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-proton-muted hover:text-red-500 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ 
  personas, 
  setActiveView, 
  chatHistory, 
  language = 'en',
  isArtisanSystemActive
}: { 
  personas: Persona[], 
  activeView: View, 
  setActiveView: (v: View) => void,
  chatHistory: PersonaHistory,
  language: 'en' | 'ka',
  user: any,
  uiMode: 'operator' | 'artisan',
  aiSettings: GlobalAiSettings,
  setLastGeminiMetadata: (m: GeminiMetadata | null) => void,
  trackFirestore: <T>(promise: Promise<T>) => Promise<T>,
  isArtisanSystemActive: boolean
}) => {
  const t = translations[language];

  const recentHistory = useMemo(() => {
    return Object.entries(chatHistory).flatMap(([id, messages]) => {
      const persona = personas.find(p => p.id === id);
      return messages.slice(-1).map(m => ({ ...m, personaName: persona?.name }));
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [chatHistory, personas]);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-4">
        <div className="space-y-3 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-proton-text">
            {t.sidebar.dashboard}
          </h1>
          <p className="text-proton-muted text-lg font-medium max-w-xl">
             {t.dashboard.explore_subtitle}
          </p>
        </div>
        {!isArtisanSystemActive && (
          <div className="bg-proton-accent/10 border border-proton-accent/20 px-6 py-4 rounded-2xl flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-proton-accent flex items-center justify-center text-white">
                <ShieldAlert size={24} />
             </div>
             <div>
                <p className="text-sm font-bold text-proton-accent uppercase tracking-widest leading-none mb-1">{t.dashboard.maintenance}</p>
                <p className="text-xs text-proton-muted font-medium">{t.dashboard.maintenance_desc}</p>
             </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-10">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setActiveView('finance')}
                className="bg-proton-card p-6 rounded-3xl border border-proton-border hover:border-proton-accent transition-all text-left space-y-4 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 text-proton-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Wallet size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{t.dashboard.financial_center}</h3>
                  <p className="text-xs text-proton-muted font-medium">{t.dashboard.financial_center_desc}</p>
                </div>
              </button>
              <button 
                onClick={() => setActiveView('organizer')}
                className="bg-proton-card p-6 rounded-3xl border border-proton-border hover:border-proton-accent transition-all text-left space-y-4 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 text-proton-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                   <CalendarIcon size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{t.dashboard.organizer_tool}</h3>
                  <p className="text-xs text-proton-muted font-medium">{t.dashboard.organizer_desc}</p>
                </div>
              </button>
           </div>

           <div className="bg-proton-card p-8 rounded-[40px] border border-proton-border shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="font-bold text-xl">{t.dashboard.recent_activity}</h3>
                 <button onClick={() => setActiveView('personas')} className="text-xs font-bold text-proton-accent uppercase hover:underline">{t.dashboard.view_all}</button>
              </div>
              <div className="space-y-4">
                 {recentHistory.length > 0 ? (
                    recentHistory.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-proton-bg border border-proton-border">
                         <div className="w-10 h-10 rounded-full bg-proton-accent/10 flex items-center justify-center text-proton-accent font-bold">
                            {item.personaName?.charAt(0)}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold">{item.personaName}</p>
                            <p className="text-xs text-proton-muted truncate">{item.content}</p>
                         </div>
                      </div>
                    ))
                 ) : (
                    <div className="text-center py-10 text-proton-muted font-medium italic">
                       {t.dashboard.no_activity}
                    </div>
                 )}
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="bg-proton-accent p-8 rounded-[40px] text-white space-y-6 shadow-2xl shadow-proton-accent/20">
              <div className="space-y-2">
                 <h3 className="text-2xl font-bold tracking-tight">{t.dashboard.system_status}</h3>
                 <p className="text-sm text-white/80 font-medium">{t.dashboard.system_status_desc}</p>
              </div>
              <div className="space-y-4 pt-4">
                 <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span>{t.dashboard.performance}</span>
                    <span>98%</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full w-[98%] bg-white" />
                 </div>
              </div>
              <button 
                onClick={() => setActiveView('settings')}
                className="w-full py-4 bg-white text-proton-accent rounded-2xl font-bold text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
              >
                {t.dashboard.configuration}
              </button>
           </div>

           <div className="bg-proton-card p-8 rounded-[40px] border border-proton-border shadow-sm">
              <h3 className="font-bold text-lg mb-4">{t.dashboard.quick_setup}</h3>
              <p className="text-xs text-proton-muted leading-relaxed font-medium font-sans">
                {t.dashboard.quick_setup_desc}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

const SystemsView = ({ 
  metadata, 
  aiSettings, 
  setAiSettings, 
  isFirestoreActive,
  language = 'en'
}: { 
  metadata: GeminiMetadata | null, 
  aiSettings: GlobalAiSettings, 
  setAiSettings: Dispatch<SetStateAction<GlobalAiSettings>>,
  isFirestoreActive: boolean,
  language?: 'en' | 'ka',
  uiMode: 'operator' | 'artisan'
}) => {
  const t_raw = translations[language];
  const ts = t_raw.systems;
  
  const stats = [
    { label: ts.cloud_status, icon: Cloud, value: isFirestoreActive ? ts.connected : ts.offline },
    { label: ts.security, icon: ShieldCheck, value: ts.active },
    { label: ts.latency, icon: Zap, value: metadata ? `${metadata.latency}ms` : '32ms' },
    { label: ts.data_sync, icon: Database, value: ts.synchronized }
  ];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-4">
        <div className="space-y-3 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-proton-text">
            {ts.title}
          </h1>
          <p className="text-proton-muted text-lg font-medium max-w-xl">
            {ts.description}
          </p>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 bg-proton-card rounded-full border border-proton-border shadow-sm">
           <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
           <span className="text-xs font-bold uppercase tracking-widest text-proton-text">{ts.operational}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-proton-card p-6 rounded-3xl border border-proton-border shadow-sm flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 flex items-center justify-center text-proton-accent">
               <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-proton-muted uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-proton-text">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 bg-proton-card p-10 rounded-[40px] border border-proton-border shadow-lg">
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="space-y-4 max-w-lg">
                 <h2 className="text-3xl font-bold tracking-tight">{ts.intelligence_level}</h2>
                 <p className="text-proton-muted font-medium">{ts.intelligence_desc}</p>
              </div>
              <div className="w-full md:w-80 space-y-6">
                 <div className="flex justify-between items-center bg-proton-bg p-4 rounded-2xl border border-proton-border">
                    <span className="text-xs font-bold uppercase tracking-widest text-proton-muted">{ts.creativity_mode}</span>
                    <span className="text-lg font-bold text-proton-accent">{(aiSettings.temperature * 100).toFixed(0)}%</span>
                 </div>
                 <div className="px-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1" 
                      value={aiSettings.temperature}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full h-3 bg-proton-bg rounded-lg appearance-none cursor-pointer accent-proton-accent border border-proton-border shadow-inner"
                    />
                    <div className="flex justify-between mt-4 text-[10px] font-bold text-proton-muted uppercase tracking-widest px-1">
                      <span>{ts.focused}</span>
                      <span>{ts.balanced}</span>
                      <span>{ts.creative}</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const HardwareView = ({ language = 'en' }: { language?: 'en' | 'ka' }) => {
  const t = translations[language].hardware;
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [network, setNetwork] = useState<{ downlink: number; rtt: number } | null>(null);
  const [orientation, setOrientation] = useState<{ alpha: number; beta: number; gamma: number } | null>(null);
  const [supported, setSupported] = useState<Record<string, boolean>>({
    geolocation: 'geolocation' in navigator,
    battery: 'getBattery' in navigator,
    network: 'connection' in navigator,
    orientation: 'DeviceOrientationEvent' in window
  });

  const requestHardwareAccess = () => {
    if (supported.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setLocation({ 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude, 
          accuracy: pos.coords.accuracy 
        }),
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }

    if (supported.battery) {
      (navigator as any).getBattery().then((bat: any) => {
        setBattery({ level: bat.level, charging: bat.charging });
        bat.addEventListener('levelchange', () => setBattery(prev => prev ? { ...prev, level: bat.level } : null));
        bat.addEventListener('chargingchange', () => setBattery(prev => prev ? { ...prev, charging: bat.charging } : null));
      });
    }

    if (supported.network) {
      const conn = (navigator as any).connection;
      setNetwork({ downlink: conn.downlink, rtt: conn.rtt });
      conn.addEventListener('change', () => setNetwork({ downlink: conn.downlink, rtt: conn.rtt }));
    }

    if (supported.orientation) {
      window.addEventListener('deviceorientation', (event) => {
        setOrientation({
          alpha: event.alpha || 0,
          beta: event.beta || 0,
          gamma: event.gamma || 0
        });
      });
    }
  };

  useEffect(() => {
    // Initial status check
    setSupported({
      geolocation: 'geolocation' in navigator,
      battery: 'getBattery' in navigator,
      network: 'connection' in navigator,
      orientation: 'DeviceOrientationEvent' in window
    });
  }, []);

  const stats = [
    { 
      label: t.location, 
      icon: Compass, 
      active: !!location,
      supported: supported.geolocation,
      value: location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : t.status_inactive,
      sub: location ? `${t.accuracy}: ${location.accuracy.toFixed(0)}m` : null
    },
    { 
      label: t.battery, 
      icon: Zap, 
      active: !!battery,
      supported: supported.battery,
      value: battery ? `${(battery.level * 100).toFixed(0)}%` : t.status_inactive,
      sub: battery ? (battery.charging ? 'Charging' : 'Discharging') : null
    },
    { 
      label: t.network, 
      icon: Cloud, 
      active: !!network,
      supported: supported.network,
      value: network ? `${network.downlink} Mbps` : t.status_inactive,
      sub: network ? `RTT: ${network.rtt}ms` : null
    },
    { 
      label: t.sensors, 
      icon: Cpu, 
      active: !!orientation,
      supported: supported.orientation,
      value: orientation ? `α:${orientation.alpha.toFixed(0)}°` : t.status_inactive,
      sub: orientation ? `β:${orientation.beta.toFixed(0)}° γ:${orientation.gamma.toFixed(0)}°` : null
    }
  ];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-4">
        <div className="space-y-3 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-proton-text uppercase">
            {t.title}
          </h1>
          <p className="text-proton-muted text-lg font-medium max-w-xl">
            {t.description}
          </p>
        </div>
        <button 
          onClick={requestHardwareAccess}
          className="flex items-center gap-3 px-8 py-4 bg-proton-accent text-white rounded-full font-bold shadow-xl shadow-proton-accent/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Zap size={20} />
          {t.request_access}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className={cn(
            "bg-proton-card p-8 rounded-[40px] border transition-all duration-500 flex flex-col items-center text-center gap-6",
            stat.active ? "border-proton-accent shadow-lg shadow-proton-accent/5" : "border-proton-border shadow-sm opactiy-60"
          )}>
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center transition-colors duration-500",
              stat.active ? "bg-proton-accent text-white" : "bg-proton-bg text-proton-muted"
            )}>
               <stat.icon size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-sm uppercase tracking-widest text-proton-muted">{stat.label}</h3>
              <p className={cn(
                "text-2xl font-black tracking-tight",
                stat.active ? "text-proton-text" : "text-proton-muted"
              )}>{stat.value}</p>
              {stat.sub && (
                <p className="text-xs font-mono text-proton-accent font-bold uppercase">{stat.sub}</p>
              )}
            </div>
            {!stat.supported && (
              <span className="text-[10px] font-bold text-proton-secondary uppercase tracking-widest px-3 py-1 bg-proton-secondary/10 rounded-full">
                Not Supported
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-proton-card p-10 rounded-[40px] border border-proton-border shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
            <Compass size={200} />
          </div>
          <div className="relative z-10 space-y-6">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 flex items-center justify-center text-proton-accent">
                   <ShieldCheck size={24} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">Apparatus Security Layer</h3>
             </div>
             <p className="text-proton-muted font-medium leading-relaxed max-w-xl">
                The hardware integration layer uses browser-native sandbox protocols. Data requested from the apparatus (Location, NFC, Sensors) is processed locally and encrypted before any transmission to optimization nodes.
             </p>
             <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Encryption', val: 'AES-256' },
                  { label: 'Sandbox', val: 'Isolated' },
                  { label: 'Auth', val: 'OAuth 2.0' },
                  { label: 'Protocol', val: 'HTTPS/TLS' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-proton-bg p-4 rounded-2xl border border-proton-border">
                    <p className="text-[10px] font-bold text-proton-muted uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-sm font-bold text-proton-text">{item.val}</p>
                  </div>
                ))}
             </div>
          </div>
        </div>
        <div className="lg:col-span-4 bg-proton-accent p-10 rounded-[40px] text-white flex flex-col justify-between shadow-2xl shadow-proton-accent/20">
           <div className="space-y-4">
              <Cpu size={48} />
              <h3 className="text-3xl font-bold tracking-tight leading-none">System Load</h3>
              <p className="text-white/70 font-medium">Real-time optimization of local computational resources based on apparatus telemetry.</p>
           </div>
           <div className="pt-8 space-y-4">
              <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                 <motion.div 
                   animate={{ width: ["20%", "45%", "32%"] }}
                   transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                   className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
                 />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Telemetry Optimized</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const PREDEFINED_AVATARS = ["👤", "👔", "💼", "🏢", "📊", "🤖", "🎨", "🚀", "⚡", "🌟", "🦁", "🏔️", "💡", "🛡️"];

const PersonasView = ({ 
  history, 
  onNewMessage,
  customAvatars,
  personas,
  aiSettings,
  setLastGeminiMetadata,
  workflows,
  tasks,
  isSystemActive
}: { 
  history: PersonaHistory, 
  onNewMessage: (personaId: string, msg: ChatMessage) => void,
  customAvatars: { [id: string]: string },
  onUpdateAvatar: (personaId: string, avatar: string) => void,
  personas: Persona[],
  onUpdatePersonas: (personas: Persona[]) => void,
  aiSettings: GlobalAiSettings,
  setLastGeminiMetadata: (m: GeminiMetadata | null) => void,
  workflows: Workflow[],
  tasks: Task[],
  uiMode: 'operator' | 'artisan',
  isSystemActive: boolean
}) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona>(personas[0] || PERSONAS[0]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const messages = history[selectedPersona.id] || [];
  const currentAvatar = customAvatars[selectedPersona.id] || selectedPersona.avatar;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!isSystemActive || !input.trim() || loading) return;

    const userMessage = input.trim();
    const timestamp = Date.now();
    setInput('');
    
    onNewMessage(selectedPersona.id, { role: 'user', content: userMessage, timestamp });
    setLoading(true);

    const apiHistory = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    const userContext = `
      CONTEXT:
      - Workflows: ${workflows.map(w => w.name).join(', ')}
      - Tasks: ${tasks.map(t => t.content).join(', ')}
    `;

    try {
      const { text, metadata } = await chatWithPersona(
        selectedPersona, 
        userMessage, 
        apiHistory, 
        "gemini-3.1-flash-preview", 
        aiSettings.enableMaps, 
        aiSettings.enableSearch, 
        aiSettings.temperature, 
        (aiSettings.systemInstruction || "") + userContext
      );
      setLastGeminiMetadata(metadata);
      onNewMessage(selectedPersona.id, { role: 'model', content: text, timestamp: Date.now() });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-12rem)] gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="w-full lg:w-80 space-y-6 flex flex-col h-full">
         <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tighter">Team Directory</h2>
            <p className="text-sm font-medium text-proton-muted">Collaborate with specialized AI personnel designed for your business needs.</p>
         </div>

         <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {personas.map(persona => (
              <button
                key={persona.id}
                onClick={() => setSelectedPersona(persona)}
                className={cn(
                  "w-full text-left p-4 rounded-3xl border transition-all flex items-center gap-4 group",
                  selectedPersona.id === persona.id 
                    ? "bg-proton-accent text-white border-proton-accent shadow-xl shadow-proton-accent/20" 
                    : "bg-proton-card border-proton-border hover:border-proton-accent/50"
                )}
              >
                <div className="text-3xl group-hover:scale-110 transition-transform">
                  {customAvatars[persona.id] || persona.avatar}
                </div>
                <div className="flex-1 min-w-0">
                   <p className="font-bold truncate">{persona.name}</p>
                   <p className={cn("text-[10px] font-bold uppercase tracking-widest", selectedPersona.id === persona.id ? "text-white/80" : "text-proton-muted")}>
                      {persona.role}
                   </p>
                </div>
              </button>
            ))}
         </div>
      </div>

      <div className="flex-1 flex flex-col bg-proton-card rounded-[40px] border border-proton-border shadow-2xl overflow-hidden min-h-[500px]">
         <div className="px-8 py-6 border-b border-proton-border flex items-center justify-between bg-proton-bg/50">
            <div className="flex items-center gap-4">
               <div className="text-3xl">{currentAvatar}</div>
               <div>
                  <h3 className="font-bold text-lg">{selectedPersona.name}</h3>
                  <p className="text-xs text-proton-muted font-medium">{selectedPersona.role}</p>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <div className={cn("w-2 h-2 rounded-full", isSystemActive ? "bg-green-500 animate-pulse" : "bg-proton-muted")} />
               <span className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">{isSystemActive ? 'Available' : 'Busy'}</span>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {messages.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                  <MessageSquare size={48} className="mb-4 text-proton-muted" />
                  <p className="text-sm font-bold uppercase tracking-[0.2em]">Start a conversation with {selectedPersona.name}</p>
               </div>
            ) : (
               messages.map((m, i) => (
                 <div key={i} className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[80%] px-6 py-4 rounded-3xl font-medium text-sm leading-relaxed",
                      m.role === 'user' 
                        ? "bg-proton-accent text-white rounded-tr-none shadow-lg shadow-proton-accent/10" 
                        : "bg-proton-bg border border-proton-border rounded-tl-none"
                    )}>
                       {m.content}
                    </div>
                    <span className="text-[9px] font-bold text-proton-muted uppercase mt-2 px-2">
                       {m.role === 'user' ? 'You' : selectedPersona.name} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 </div>
               ))
            )}
            <div ref={chatEndRef} />
         </div>

         <div className="p-8 bg-proton-bg/50 border-t border-proton-border">
            <div className="relative group">
               <input 
                 type="text"
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                 placeholder={`Consult with ${selectedPersona.name}...`}
                 disabled={!isSystemActive || loading}
                 className="w-full bg-proton-card border border-proton-border rounded-2xl px-6 py-4 pr-16 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-proton-accent/20 focus:border-proton-accent transition-all shadow-inner"
               />
               <button 
                 onClick={handleSend}
                 disabled={!isSystemActive || loading || !input.trim()}
                 className={cn(
                   "absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-proton-accent text-white flex items-center justify-center transition-all shadow-md",
                   loading ? "opacity-50" : "hover:brightness-110 active:scale-95"
                 )}
               >
                 {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

const Web3View = ({ uiMode }: { uiMode: 'operator' | 'artisan' }) => {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address: address,
  });






  const [gelRate] = useState(2.72); // Mock NBG Rate
  const [eurRate] = useState(0.92); // Mock EUR Rate
  const [gbpRate] = useState(0.79); // Mock GBP Rate
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  return (
    <div className="space-y-12 md:space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {!isConnected ? (
        <div className="max-w-md mx-auto w-full space-y-8 text-center py-20 px-6 bg-proton-card rounded-[40px] border border-proton-border relative overflow-hidden shadow-xl">
          <div className="relative z-10 space-y-6">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-proton-bg border border-proton-border flex items-center justify-center text-proton-muted shadow-sm">
              <Wallet size={40} className="opacity-20" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-proton-muted" />
                <span className="text-xs font-semibold text-proton-muted uppercase tracking-widest">Disconnected</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Payments & Settlement</h2>
              <p className="text-sm text-proton-muted leading-relaxed">
                Connect your secure wallet to access the Proton Hub financial services and managed compute credits.
              </p>
            </div>

            <div className="pt-4 flex justify-center">
              <ConnectButton label="Connect Wallet" />
            </div>

            <p className="text-[10px] text-proton-muted/40 font-semibold uppercase tracking-[0.2em] pt-8">
              Secured by Proton Hub Infrastructure
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-12 animate-in zoom-in-95 duration-500">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Payments & Settlement</h2>
              <p className="text-proton-muted text-sm leading-relaxed max-w-md">
                 AI სერვისებისა და ბიზნეს პროცესების ფინანსური მართვა ქართულ და გლობალურ ჭრილში.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-proton-card p-1.5 pl-4 rounded-2xl border border-proton-border">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-green-500 uppercase tracking-[0.2em]">Online</span>
              </div>
              <ConnectButton />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Treasury Section */}
            <div className="lg:col-span-2 space-y-6">
                <div className="proton-glass p-8 rounded-[40px] border border-proton-accent/20 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                       <Zap size={120} className="text-proton-accent" />
                   </div>
                   <div className="relative z-10 space-y-8">
                      <div className="flex items-center justify-between">
                          <div className="space-y-1">
                              <h3 className="text-sm font-mono font-bold uppercase tracking-[0.2em] text-proton-muted">Active Global Treasury</h3>
                              <p className="text-3xl md:text-5xl font-bold tracking-tighter">
                                  {balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000'} <span className="text-proton-accent">{balance?.symbol}</span>
                              </p>
                          </div>
                          <div className="p-4 rounded-2xl bg-proton-accent/10 text-proton-accent border border-proton-accent/20">
                              <Wallet size={32} />
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="p-4 rounded-2xl bg-proton-bg/40 border border-proton-border group/card hover:border-proton-accent/50 transition-all">
                              <p className="text-[9px] font-mono text-proton-muted uppercase tracking-widest mb-1">GEL (₾)</p>
                              <p className="text-lg font-bold">₾ {(parseFloat(balance?.formatted || '0') * 2650 * gelRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          </div>
                          <div className="p-4 rounded-2xl bg-proton-bg/40 border border-proton-border group/card hover:border-proton-accent/50 transition-all">
                              <p className="text-[9px] font-mono text-proton-muted uppercase tracking-widest mb-1">USD ($)</p>
                              <p className="text-lg font-bold">$ {(parseFloat(balance?.formatted || '0') * 2650).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          </div>
                          <div className="p-4 rounded-2xl bg-proton-bg/40 border border-proton-border group/card hover:border-proton-accent/50 transition-all">
                              <p className="text-[9px] font-mono text-proton-muted uppercase tracking-widest mb-1">EUR (€)</p>
                              <p className="text-lg font-bold">€ {(parseFloat(balance?.formatted || '0') * 2650 * eurRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          </div>
                          <div className="p-4 rounded-2xl bg-proton-bg/40 border border-proton-border group/card hover:border-proton-accent/50 transition-all">
                              <p className="text-[9px] font-mono text-proton-muted uppercase tracking-widest mb-1">GBP (£)</p>
                              <p className="text-lg font-bold">£ {(parseFloat(balance?.formatted || '0') * 2650 * gbpRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          </div>
                      </div>
                   </div>
                </div>

                {/* Dashboard Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button 
                        onClick={() => setShowInvoiceModal(true)}
                        className="proton-glass p-6 rounded-[32px] border border-proton-border hover:border-proton-accent/50 transition-all text-left space-y-4 group cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 text-proton-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg">Smart Invoicing</h4>
                            <p className="text-xs text-proton-muted uppercase tracking-tighter">შექმენით ინვოისი AI სერვისებისთვის</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-proton-accent uppercase tracking-[0.2em] font-bold pt-2">
                            Generate Now <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    <div className="proton-glass p-6 rounded-[32px] border border-proton-border space-y-4 shadow-sm">
                        <div className="w-12 h-12 rounded-2xl bg-proton-secondary/10 text-proton-secondary flex items-center justify-center">
                            <Globe size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-lg">NBG Real-time Rate</h4>
                            <p className="text-xs text-proton-muted">კურსი: $1 = {gelRate} GEL</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-proton-secondary uppercase tracking-[0.2em] font-bold pt-2">
                            Synced with Central Bank
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Section: Exchanges & Info */}
            <div className="space-y-6">
                <div className="proton-glass p-6 rounded-[32px] border border-white/5 space-y-6">
                    <h4 className="text-[11px] font-mono font-bold text-proton-muted uppercase tracking-[0.3em]">Local Off-Ramps</h4>
                    <div className="space-y-4">
                        {[
                            { name: 'Cryptal', desc: 'Secure P2P & Instant GEL', url: 'https://cryptal.com' },
                            { name: 'MyCoins', desc: 'Direct BOG/TBC Integration', url: 'https://mycoins.ge' },
                            { name: 'Emoney', desc: 'Digital Wallet Ecosystem', url: 'https://emoney.ge' }
                        ].map((ex, i) => (
                            <a 
                                key={i} 
                                href={ex.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 rounded-2xl bg-proton-bg/40 border border-proton-border hover:border-proton-accent/30 transition-all group"
                            >
                                <div>
                                    <p className="font-bold text-sm group-hover:text-proton-accent transition-colors">{ex.name}</p>
                                    <p className="text-[9px] text-proton-muted uppercase">{ex.desc}</p>
                                </div>
                                <ArrowRight size={14} className="text-proton-muted group-hover:text-proton-accent" />
                            </a>
                        ))}
                    </div>
                    <div className="p-4 rounded-2xl bg-proton-accent/5 border border-proton-accent/10">
                        <p className="text-[10px] leading-relaxed text-proton-muted italic">
                            NBG რეგულაციების შესაბამისად, კრიპტო-აქტივების განაღდება შესაძლებელია მხოლოდ ლიცენზირებულ სერვის-პროვაიდერებთან.
                        </p>
                    </div>
                </div>

                <div className="proton-glass p-6 rounded-[32px] border border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                           <Activity size={16} />
                        </div>
                        <h4 className="font-bold text-sm">Blockchain Ledger</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between text-[10px] opacity-60">
                            <span className="font-mono">TX_ID: 0x4f...a12</span>
                            <span className="text-green-400">+0.012 ETH</span>
                        </div>
                        <div className="flex justify-between text-[10px] opacity-60">
                            <span className="font-mono">TX_ID: 0x9b...e4f</span>
                            <span className="text-red-400">-0.005 ETH</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <AnimatePresence>
            {showInvoiceModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-proton-bg/95 backdrop-blur-xl">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="proton-glass p-8 rounded-[40px] max-w-2xl w-full border border-proton-border/80 shadow-2xl space-y-8 relative overflow-hidden"
                    >
                         <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent pointer-events-none" />
                         
                         <div className="flex items-center justify-between relative z-10">
                             <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-proton-accent/10 text-proton-accent">
                                    <FileText size={28} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight">Smart Invoicing</h3>
                                    <p className="text-xs text-proton-muted font-mono uppercase tracking-widest">Generate Settlement Document</p>
                                </div>
                             </div>
                             <button onClick={() => setShowInvoiceModal(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                 <Plus size={24} className="rotate-45 text-proton-muted" />
                             </button>
                         </div>

                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-mono text-proton-muted uppercase tracking-[0.2em] font-bold">Client Name / კლიენტი</label>
                                 <input type="text" placeholder="e.g. Acme Tech Corp" className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none" />
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-mono text-proton-muted uppercase tracking-[0.2em] font-bold">Service Type / სერვისი</label>
                                 <select className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none cursor-pointer">
                                     <option>AI Analysis & Automation</option>
                                     <option>Smart Contract Audit</option>
                                     <option>Compute Cluster Lease</option>
                                     <option>Digital Persona Concierge</option>
                                 </select>
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-mono text-proton-muted uppercase tracking-[0.2em] font-bold">Settlement Currency / ვალუტა</label>
                                 <select className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none cursor-pointer">
                                     <option>ETH (Ethereum Native)</option>
                                     <option>GEL (NBG Fixed Rate)</option>
                                     <option>USD (International)</option>
                                     <option>EUR (European)</option>
                                 </select>
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-mono text-proton-muted uppercase tracking-[0.2em] font-bold">Amount / თანხა</label>
                                 <input type="number" placeholder="0.05" className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none" />
                             </div>
                             <div className="space-y-2 sm:col-span-2">
                                 <label className="text-[10px] font-mono text-proton-muted uppercase tracking-[0.2em] font-bold">Due Date / ვადა</label>
                                 <input type="date" className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none" />
                             </div>
                         </div>

                         <div className="pt-4 relative z-10">
                            <button className="w-full py-4 rounded-2xl bg-proton-accent text-proton-bg font-bold shadow-xl shadow-proton-accent/20 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                                <Receipt size={18} />
                                Generate & Finalize Invoice
                            </button>
                         </div>

                         <p className="text-[9px] text-center text-proton-muted relative z-10 italic">
                             ინვოისი ავტომატურად დაუკავშირდება თქვენს ამჟამინდელ Wallet მისამართს: {address?.slice(0,6)}...{address?.slice(-4)}
                         </p>
                    </motion.div>
                </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};




const ImageView = ({ uiMode, isSystemActive = true }: { uiMode: 'operator' | 'artisan', isSystemActive?: boolean }) => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!isSystemActive || !prompt.trim()) return;
    setLoading(true);
    try {
      const result = await generateOrEditImage(prompt);
      setImage(result);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('PROHIBITED_CONTENT') || error?.toString().includes('PROHIBITED_CONTENT')) {
        alert("We couldn't generate that image because it violates safety policies. Please try a different prompt.");
      } else {
        alert("Failed to generate image. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Image Studio</h2>
        <p className="text-proton-muted text-sm mt-1">Create and edit images with Gemini</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <div className="proton-glass p-4 sm:p-6 md:p-8 rounded-3xl space-y-6">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={!isSystemActive}
            placeholder={isSystemActive ? "Describe the image you want to create or edit..." : "Image Studio is offline during system recalibration."}
            className={cn(
              "w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all h-32 md:h-48 text-sm resize-none focus:ring-1 focus:ring-proton-accent/30",
              !isSystemActive && "opacity-50"
            )}
          />
          <button 
            onClick={handleGenerate}
            disabled={!isSystemActive || loading}
            className="w-full py-4 rounded-xl bg-proton-accent text-proton-bg font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-proton-accent/20"
          >
            {loading ? (
                <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating...
                </>
            ) : (
                isSystemActive ? (
                <>
                    <Zap size={18} />
                    Generate Image
                </>
                ) : (
                <>
                    <Lock size={18} />
                    Limited Mode
                </>
                )
            )}
          </button>
        </div>

        {image && (
          <div className="proton-glass p-4 rounded-3xl overflow-hidden shadow-2xl">
            <img src={image} alt="Generated" className="rounded-2xl w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        )}
      </div>
    </div>
  );
};

const WorkflowEditor = ({
  workflow,
  onSave,
  onClose,
  personas,
  uiMode
}: {
  workflow: Workflow,
  onSave: (workflow: Workflow) => void,
  onClose: () => void,
  personas: Persona[],
  uiMode: 'operator' | 'artisan'
}) => {
  const [formData, setFormData] = useState<Workflow>(workflow);
  const [editorMode, setEditorMode] = useState<'form' | 'flow'>('form');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-proton-bg/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="proton-glass p-4 sm:p-8 rounded-3xl max-w-4xl w-full space-y-4 sm:space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-proton-border pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-proton-accent/10 text-proton-accent shadow-inner">
               <Edit2 size={22} />
            </div>
            <div>
               <h3 className="text-xl font-bold tracking-tight">Edit Workflow</h3>
               <p className="text-proton-muted text-xs uppercase tracking-widest font-mono">ID: {formData.id?.slice(-6)}</p>
            </div>
          </div>
          <div className="flex bg-proton-card p-1 rounded-2xl border border-proton-border shadow-sm">
             <button 
                onClick={() => setEditorMode('form')} 
                className={cn(
                    "px-6 py-2.5 text-xs font-bold rounded-xl transition-all duration-300",
                    editorMode === 'form' ? 'bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20' : 'text-proton-muted hover:text-proton-text'
                )}
             >
                PROX PROPS
             </button>
             <button 
                onClick={() => setEditorMode('flow')} 
                className={cn(
                    "px-6 py-2.5 text-xs font-bold rounded-xl transition-all duration-300",
                    editorMode === 'flow' ? 'bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20' : 'text-proton-muted hover:text-proton-text'
                )}
             >
                FLOW DESIGN
             </button>
          </div>
        </div>
        {editorMode === 'form' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest flex justify-between">
                <span>Name / სახელი</span>
                <span className="opacity-50">Required</span>
              </label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Workflow title..."
                className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all shadow-inner"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Trigger / ტრიგერი</label>
                  <input 
                    type="text" 
                    value={formData.trigger}
                    onChange={e => setFormData(prev => ({ ...prev, trigger: e.target.value }))}
                    placeholder="Event that starts it..."
                    className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all shadow-inner"
                  />
                  <p className="text-[9px] text-proton-muted italic px-1">მაგ: ახალი შეტყობინება</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Action / მოქმედება</label>
                  <input 
                    type="text" 
                    value={formData.action}
                    onChange={e => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    placeholder="Final action..."
                    className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all shadow-inner"
                  />
                </div>
            </div>

            {/* Workflow Steps Management */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Execution Steps / პროცესის ნაბიჯები</label>
                <button 
                  onClick={() => {
                    const newStep: WorkflowStep = { id: Date.now().toString(), label: 'New Step', description: 'Step description' };
                    setFormData(prev => ({ ...prev, steps: [...(prev.steps || []), newStep] }));
                  }}
                  className="text-[10px] font-bold text-proton-accent hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> ADD STEP
                </button>
              </div>
              <div className="space-y-2">
                {(formData.steps || []).length === 0 && (
                  <div className="p-4 rounded-xl border border-dashed border-proton-border/50 text-center text-[10px] text-proton-muted italic font-mono">
                    No intermediate steps defined. Trigger will lead directly to action.
                  </div>
                )}
                {(formData.steps || []).map((step, idx) => (
                  <div key={step.id} className="p-4 rounded-2xl bg-proton-bg/40 border border-proton-border flex gap-4 items-start group/step">
                    <div className="w-6 h-6 rounded-lg bg-proton-accent/20 text-proton-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input 
                        value={step.label}
                        onChange={(e) => {
                          const newSteps = [...(formData.steps || [])];
                          newSteps[idx] = { ...step, label: e.target.value };
                          setFormData(prev => ({ ...prev, steps: newSteps }));
                        }}
                        className="bg-transparent border-none p-0 text-xs font-bold w-full focus:outline-none text-proton-text"
                        placeholder="Step label..."
                      />
                      <input 
                        value={step.description}
                        onChange={(e) => {
                          const newSteps = [...(formData.steps || [])];
                          newSteps[idx] = { ...step, description: e.target.value };
                          setFormData(prev => ({ ...prev, steps: newSteps }));
                        }}
                        className="bg-transparent border-none p-0 text-[10px] text-proton-muted w-full focus:outline-none"
                        placeholder="Briefly describe this step..."
                      />
                    </div>
                    <button 
                      onClick={() => {
                        setFormData(prev => ({ ...prev, steps: (prev.steps || []).filter(s => s.id !== step.id) }));
                      }}
                      className="opacity-0 group-hover/step:opacity-100 p-1 text-proton-muted hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Digital Persona / პერსონა</label>
              <select 
                value={formData.personaId}
                onChange={e => setFormData(prev => ({ ...prev, personaId: e.target.value }))}
                className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all shadow-inner cursor-pointer"
              >
                <option value="">Select a persona</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
                ))}
              </select>
              <p className="text-[9px] text-proton-muted italic px-1">აირჩიეთ აგენტი, რომელიც შეასრულებს ამ პროცესს.</p>
            </div>
            <button 
              onClick={async () => {
                const analysis = await analyzeWorkflow(formData);
                alert(analysis);
              }}
              className="w-full py-4 rounded-2xl border border-proton-accent/30 text-proton-accent text-xs font-bold hover:bg-proton-accent/10 transition-all flex items-center justify-center gap-2 group"
            >
              <Sparkles size={16} className="group-hover:animate-spin" />
              Gemini-ს მიერ პროცესის ოპტიმიზაცია
            </button>
          </div>
        ) : (
          <div className="h-[300px] sm:h-[400px] md:h-[500px] w-full mt-4 shrink-0">
            <WorkflowFlowEditor workflow={formData} onSave={setFormData} personas={personas} uiMode={uiMode} />
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-proton-border font-bold text-sm hover:bg-proton-card transition-all">Cancel</button>
          <button onClick={() => onSave(formData)} className="flex-1 py-3 rounded-xl bg-proton-accent text-proton-bg font-bold text-sm hover:scale-105 active:scale-95 transition-all">Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const WorkflowsView = ({
  workflows,
  setWorkflows,
  personas,
  user,
  uiMode,
  isSystemActive = true
}: {
  workflows: Workflow[],
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>,
  personas: Persona[],
  user: any,
  uiMode: 'operator' | 'artisan',
  isSystemActive?: boolean
}) => {
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: () => void; message: string } | null>(null);

  const handleSave = async (updatedWorkflow: Workflow) => {
    setWorkflows(workflows.map(wf => wf.id === updatedWorkflow.id ? updatedWorkflow : wf));
    setEditingWorkflow(null);
    if (user && db) {
      const docRef = doc(db, 'users', user.uid, 'workflows', updatedWorkflow.id);
      await setDoc(docRef, updatedWorkflow).catch(e => handleFirestoreError(e, 'update', docRef.path));
    }
  };

  const createWorkflow = async () => {
    const newWorkflow: Workflow = { 
      id: Date.now().toString(), 
      name: 'New Business Process', 
      trigger: 'Customer Inquiry', 
      action: 'Send Quote', 
      personaId: '',
      steps: [
        { id: 'step-1', label: 'Analyze Needs', description: 'AI agent evaluates the request complexity' }
      ]
    };
    setWorkflows([...workflows, newWorkflow]);
    if (user && db) {
      const docRef = doc(db, 'users', user.uid, 'workflows', newWorkflow.id);
      await setDoc(docRef, newWorkflow).catch(e => handleFirestoreError(e, 'create', docRef.path));
    }
  };

  const handleAnalyze = async (wf: Workflow) => {

    const result = await analyzeWorkflow(wf);
    const updatedWorkflow = {
      ...wf,
      analysisHistory: [
        ...(wf.analysisHistory || []),
        { timestamp: Date.now(), result }
      ]
    };
    setWorkflows(workflows.map(w => w.id === wf.id ? updatedWorkflow : w));
    
    if (user && db) {
      const docRef = doc(db, 'users', user.uid, 'workflows', wf.id);
      await setDoc(docRef, updatedWorkflow).catch(e => handleFirestoreError(e, 'update', docRef.path));
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workflows</h2>
          <p className="text-proton-muted text-sm mt-1">ბიზნეს პროცესების ვიზუალური ავტომატიზაცია</p>
        </div>
        <button 
          onClick={() => {
            if (!isSystemActive) return;
            setConfirmation({
              message: "გსურთ ახალი ვორქფლოუს შექმნა?",
              action: createWorkflow
            });
          }}
          disabled={!isSystemActive}
          className="px-5 py-3 rounded-2xl bg-proton-accent text-proton-bg font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-proton-accent/20 disabled:opacity-50"
        >
          {isSystemActive ? <Plus size={20} /> : <Lock size={16} />}
          {isSystemActive ? "Add Workflow" : "LOCKED"}
        </button>
      </div>
      {confirmation && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-proton-bg/90 backdrop-blur-md">
          <div className="proton-glass p-8 rounded-[40px] w-full max-w-sm space-y-6 shadow-2xl border border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent pointer-events-none" />
            <div className="relative z-10 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-proton-accent/10 flex items-center justify-center text-proton-accent">
                    <Zap size={32} />
                </div>
                <div className="space-y-1">
                    <h3 className="font-bold text-xl">ქმედების დადასტურება</h3>
                    <p className="text-sm text-proton-muted leading-relaxed">{confirmation.message}</p>
                </div>
                <div className="flex gap-3 pt-2">
                    <button onClick={() => setConfirmation(null)} className="flex-1 py-3 rounded-xl border border-proton-border text-xs font-bold hover:bg-proton-card transition-all">გაუქმება</button>
                    <button onClick={() => { confirmation.action(); setConfirmation(null); }} className="flex-1 py-3 rounded-xl bg-proton-accent text-proton-bg text-xs font-bold hover:scale-105 transition-all shadow-lg shadow-proton-accent/20">დადასტურება</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {workflows.length === 0 ? (
        <div className="proton-glass p-12 rounded-[40px] flex flex-col items-center justify-center text-center space-y-6 border border-dashed border-proton-border/50">
          <div className="w-20 h-20 rounded-[32px] bg-proton-accent/10 flex items-center justify-center text-proton-accent shadow-[0_0_50px_rgba(0,242,255,0.1)]">
            <Zap size={40} className="animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">ვორქფლოუები არ არის</h3>
            <p className="text-proton-muted max-w-sm mx-auto leading-relaxed">
              დაიწყეთ თქვენი პირველი ავტომატიზირებული პროცესის შექმნა პერსონებისა და სერვისების დაკავშირებით.
            </p>
          </div>
          <button 
            onClick={() => setConfirmation({
              message: "გსურთ ახალი ვორქფლოუს შექმნა?",
              action: createWorkflow
            })}
            className="px-8 py-4 rounded-2xl bg-proton-accent text-proton-bg font-bold hover:scale-105 transition-all shadow-xl shadow-proton-accent/20"
          >
            პროცესის შექმნა
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map(wf => {
            const persona = personas.find(p => p.id === wf.personaId);
            return (
              <div 
                key={wf.id} 
                className="group proton-glass p-6 rounded-[32px] space-y-6 hover:border-proton-accent/50 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-full" 
                onClick={() => setEditingWorkflow(wf)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-proton-accent/10 text-proton-accent group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <Zap size={22} fill="currentColor" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-proton-accent transition-colors">{wf.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                           <span className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Active System</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSystemActive) return;
                        setConfirmation({
                          message: "გსურთ ვორქფლოუს ეფექტურობის ანალიზი Gemini-ს მიერ?",
                          action: () => handleAnalyze(wf)
                        });
                      }}
                      disabled={!isSystemActive}
                      className="p-2.5 rounded-xl bg-proton-card/50 text-proton-muted hover:text-proton-accent hover:bg-proton-accent/10 transition-all border border-proton-border group-hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isSystemActive ? "Analyze efficiency" : "System in Stasis"}
                    >
                      {isSystemActive ? <Activity size={18} /> : <Lock size={14} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs">
                    <div className="p-4 rounded-2xl bg-proton-bg/40 border border-proton-border group-hover:border-proton-accent/20 transition-colors">
                      <div className="text-proton-muted uppercase tracking-[0.2em] text-[8px] font-bold mb-2 flex items-center gap-1.5">
                         <div className="w-1 h-1 rounded-full bg-proton-accent" />
                         TRIGGER / ტრიგერი
                      </div>
                      <p className="text-proton-text font-mono text-sm truncate">{wf.trigger || '—'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-proton-bg/40 border border-proton-border group-hover:border-proton-accent/20 transition-colors">
                      <div className="text-proton-muted uppercase tracking-[0.2em] text-[8px] font-bold mb-2 flex items-center gap-1.5">
                         <div className="w-1 h-1 rounded-full bg-proton-secondary" />
                         ACTION / მოქმედება
                      </div>
                      <p className="text-proton-text font-mono text-sm truncate">{wf.action || '—'}</p>
                    </div>
                  </div>

                  {/* Visual Step Indicator */}
                  {wf.steps && wf.steps.length > 0 && (
                    <div className="flex items-center gap-1">
                       {wf.steps.map((_, i) => (
                         <div key={i} className="h-1.5 flex-1 rounded-full bg-proton-accent/30" />
                       ))}
                       <span className="text-[8px] font-mono text-proton-accent ml-2 uppercase">{wf.steps.length} STAGES</span>
                    </div>
                  )}
                </div>
                
                <div className="relative z-10 flex items-center justify-between text-[11px] text-proton-muted pt-4 border-t border-proton-border/50">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-proton-card border border-proton-border flex items-center justify-center text-xs">
                           {persona?.avatar || '🤖'}
                        </div>
                        <span className="font-bold tracking-tight">
                            {persona ? persona.name : 'Unknown Agent'}
                        </span>
                    </div>
                    <div className="px-2 py-1 rounded bg-proton-bg border border-proton-border text-[9px] font-mono opacity-60">
                        LN: {wf.id?.slice(-4)}
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AnimatePresence>
        {editingWorkflow && (
          <WorkflowEditor 
            workflow={editingWorkflow}
            onSave={handleSave}
            onClose={() => setEditingWorkflow(null)}
            personas={personas}
            uiMode={uiMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ProfileView = ({ 
  profile, 
  setProfile, 
  history,
  customAvatars,
  personas,
  user,
  onSignIn,
  onSignOut,
  uiMode
}: { 
  profile: UserProfile, 
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>, 
  history: PersonaHistory,
  customAvatars: { [id: string]: string },
  personas: Persona[],
  user: any,
  onSignIn: () => void,
  onSignOut: () => void,
  uiMode: 'operator' | 'artisan'
}) => {
  const language = profile.language;
  const t = translations[language].sidebar;
  const common = translations[language].common;
  const totalInteractions = Object.values(history).reduce((acc, msgs) => acc + msgs.length, 0);
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{language === 'ka' ? 'მომხმარებლის პროფილი' : 'User Profile'}</h2>
          <p className="text-proton-muted text-sm mt-1">{language === 'ka' ? 'მართეთ თქვენი Proton Core AI ანგარიში და ისტორია' : 'Manage your Proton Core AI account and history'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
        {/* Account Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="proton-glass p-4 sm:p-8 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings size={20} className="text-proton-accent" />
                {language === 'ka' ? 'ანგარიშის პარამეტრები' : 'Account Settings'}
              </h3>
              {user ? (
                <button onClick={onSignOut} className="text-sm text-red-400 hover:text-red-300">{language === 'ka' ? 'გასვლა' : 'Sign Out'}</button>
              ) : (
                <button onClick={onSignIn} className="text-sm text-proton-accent hover:text-proton-accent/80">{language === 'ka' ? 'შესვლა Google-ით' : 'Sign In with Google'}</button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-mono text-proton-muted uppercase tracking-widest">{language === 'ka' ? 'სრული სახელი' : 'Full Name'}</label>
                <input 
                  type="text" 
                  value={user?.displayName || profile.name}
                  disabled
                  className="w-full bg-proton-bg/50 border border-proton-border rounded-lg px-3 py-2 text-sm text-proton-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-proton-muted uppercase tracking-widest">{language === 'ka' ? 'ელ.ფოსტა' : 'Email Address'}</label>
                <input 
                  type="email" 
                  value={user?.email || profile.email}
                  disabled
                  className="w-full bg-proton-bg/50 border border-proton-border rounded-lg px-3 py-2 text-sm text-proton-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-proton-muted uppercase tracking-widest">{language === 'ka' ? 'ენა' : 'Preferred Language'}</label>
                <select 
                  value={profile.language}
                  onChange={(e) => setProfile(prev => ({ ...prev, language: e.target.value as 'en' | 'ka' }))}
                  className="w-full bg-proton-bg border border-proton-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-proton-accent transition-colors"
                >
                  <option value="en">English</option>
                  <option value="ka">ქართული (Georgian)</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-proton-bg/30 border border-proton-border">
                <div>
                  <p className="text-sm font-medium">{language === 'ka' ? 'შეტყობინებები ელ.ფოსტაზე' : 'Email Notifications'}</p>
                  <p className="text-[10px] text-proton-muted">{language === 'ka' ? 'მიიღეთ განახლებები ვიდეო ბარათის სტატუსზე' : 'Receive updates on GPU status'}</p>
                </div>
                <button 
                  onClick={() => setProfile(prev => ({ ...prev, notifications: !prev.notifications }))}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    profile.notifications ? "bg-proton-accent" : "bg-proton-border"
                  )}
                >
                  <motion.div 
                    animate={{ x: profile.notifications ? 26 : 2 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button 
                onClick={() => {
                  const exportData = {
                    name: profile.name,
                    language: profile.language,
                    notifications: profile.notifications
                  };
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
                  const downloadAnchorNode = document.createElement('a');
                  downloadAnchorNode.setAttribute("href", dataStr);
                  downloadAnchorNode.setAttribute("download", "user_profile_data.json");
                  document.body.appendChild(downloadAnchorNode);
                  downloadAnchorNode.click();
                  downloadAnchorNode.remove();
                }}
                className="px-6 py-2 rounded-xl border border-proton-border text-proton-muted font-bold text-sm hover:bg-proton-card transition-all"
              >
                {language === 'ka' ? 'პროფილის მონაცემების ჩამოტვირთვა' : 'Download Profile Data'}
              </button>
            </div>
          </div>

          <div className="proton-glass p-4 sm:p-8 rounded-3xl space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity size={20} className="text-proton-secondary" />
              {language === 'ka' ? 'ინტერაქციების ისტორია' : 'Interaction History'}
            </h3>
            
            <div className="space-y-4">
              {personas.map(persona => {
                const personaMsgs = history[persona.id] || [];
                if (personaMsgs.length === 0) return null;
                
                return (
                  <div key={persona.id} className="flex items-center justify-between p-4 rounded-2xl bg-proton-bg/50 border border-proton-border">
                    <div className="flex items-center gap-4">
                      <PersonaAvatar avatar={customAvatars[persona.id] || persona.avatar} className="w-10 h-10" />
                      <div>
                        <p className="font-bold text-sm">{language === 'ka' ? persona.nameGe : persona.name}</p>
                        <p className="text-xs text-proton-muted">{personaMsgs.length} {common.messages}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-proton-muted uppercase font-mono">
                        {language === 'ka' ? 'ბოლოს აქტიური' : 'Last Active'}
                      </p>
                      <p className="text-xs font-mono">
                        {new Date(personaMsgs[personaMsgs.length - 1].timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {totalInteractions === 0 && (
                <div className="text-center py-8 text-proton-muted italic text-sm">
                  {language === 'ka' ? 'ისტორია ჯერჯერობით ცარიელია' : 'No interaction history found yet.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Sidebar */}
        <div className="space-y-6">
          <div className="proton-glass p-6 rounded-2xl text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-proton-accent/10 flex items-center justify-center text-proton-accent mx-auto border-2 border-proton-accent/20">
              <Users size={40} />
            </div>
            <div>
              <h4 className="font-bold text-lg">{user?.displayName || profile.name}</h4>
              <p className="text-xs text-proton-muted font-mono uppercase tracking-widest">{language === 'ka' ? 'Proton Core AI-ის მკვლევარი' : 'Proton Core AI Explorer'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-3 rounded-xl bg-proton-bg/50 border border-proton-border">
                <p className="text-xl font-bold font-mono text-proton-accent">{totalInteractions}</p>
                <p className="text-[10px] text-proton-muted uppercase">{common.messages}</p>
              </div>
              <div className="p-3 rounded-xl bg-proton-bg/50 border border-proton-border">
                <p className="text-xl font-bold font-mono text-proton-secondary">{personas.length}</p>
                <p className="text-[10px] text-proton-muted uppercase">{language === 'ka' ? 'პერსონაჟი' : 'Personas'}</p>
              </div>
            </div>
          </div>

          <div className="proton-glass p-6 rounded-2xl space-y-4">
            <h4 className="font-bold text-sm uppercase tracking-widest text-proton-muted">{language === 'ka' ? 'უსაფრთხოების სტატუსი' : 'Security Status'}</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-proton-muted">{language === 'ka' ? '2FA-ს სტატუსი' : '2FA Status'}</span>
                <span className="text-green-400 font-mono">{language === 'ka' ? 'აქტიური' : 'ENABLED'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-proton-muted">{language === 'ka' ? 'ბოლო შესვლა' : 'Last Login'}</span>
                <span className="text-proton-text font-mono">Tbilisi, GE</span>
              </div>
              <button className="w-full py-2 rounded-lg border border-proton-secondary/30 text-proton-secondary text-xs font-bold hover:bg-proton-secondary/10 transition-all">
                {language === 'ka' ? 'პაროლის განახლება' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ModeToggle = ({ mode, setMode, t }: { mode: 'operator' | 'artisan', setMode: (m: 'operator' | 'artisan') => void, t: any }) => (
  <div className="flex items-center gap-2 p-1 rounded-xl bg-proton-card border border-proton-border shadow-inner">
    <button
      onClick={() => setMode('operator')}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
        mode === 'operator' 
          ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" 
          : "text-proton-muted hover:text-proton-text"
      )}
    >
      <Terminal size={14} />
      <span className="hidden lg:inline">{t.modes.operator}</span>
    </button>
    <button
      onClick={() => setMode('artisan')}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
        mode === 'artisan' 
          ? "bg-proton-accent text-white shadow-lg shadow-proton-accent/10" 
          : "text-proton-muted hover:text-proton-text"
      )}
    >
      <Edit2 size={14} />
      <span className="hidden lg:inline">{t.modes.artisan}</span>
    </button>
  </div>
);

export default function App() {
  const [uiMode, setUiMode] = useState<'operator' | 'artisan'>(
    (localStorage.getItem('proton_ui_mode') as 'operator' | 'artisan') || 'operator'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-mode', uiMode);
    localStorage.setItem('proton_ui_mode', uiMode);
  }, [uiMode]);

  const [activeView, setActiveView] = useState<View>('dashboard');
  const [lastGeminiMetadata, setLastGeminiMetadata] = useState<GeminiMetadata | null>(null);
  const [isArtisanSystemActive, setIsArtisanSystemActive] = useState<boolean>(false);

  // Bootstrap system config if missing
  useEffect(() => {
    const bootstrapConfig = async () => {
      try {
        const configRef = doc(db, 'system', 'config');
        const snap = await getDoc(configRef);
        if (!snap.exists()) {
          // Note: This might fail if rules are already tightened, 
          // but serves as a one-time helper.
          await setDoc(configRef, { isArtisanSystemActive: false }, { merge: true });
        }
      } catch (e) {
        console.log("System config already exists or restricted.");
      }
    };
    bootstrapConfig();
  }, []);

  useEffect(() => {
    const configRef = doc(db, 'system', 'config');
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setIsArtisanSystemActive(snapshot.data().isArtisanSystemActive ?? false);
      } else {
        setIsArtisanSystemActive(false);
      }
    }, (error) => {
      setIsArtisanSystemActive(false);
    });
    return () => unsubscribe();
  }, []);

  const [isFirestoreActive, setIsFirestoreActive] = useState(false);
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const handleViewChange = React.useCallback((view: View) => {
    if (!isArtisanSystemActive && (view === 'personas' || view === 'image' || view === 'blueprints' || view === 'compute')) {
      setShowOptimizationModal(true);
      return;
    }
    setActiveView(view);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [isArtisanSystemActive]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [theme, setTheme] = useState<'proton' | 'light' | 'vibrant' | 'midnight'>(
    (localStorage.getItem('proton_theme') as any) || 'proton'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-ui-mode', uiMode);
    localStorage.setItem('proton_theme', theme);
  }, [theme, uiMode]);
  
  const [chatHistory, setChatHistory] = useState<PersonaHistory>(() => {
    try {
      const saved = localStorage.getItem('proton_chat_history');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [playingMsgIndex, setPlayingMsgIndex] = useState<number | null>(null);
  const [personaAvatars, setPersonaAvatars] = useState<{ [id: string]: string }>(() => {
    try {
      const saved = localStorage.getItem('proton_persona_avatars');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [personas, setPersonas] = useState<Persona[]>(() => {
    try {
      const saved = localStorage.getItem('proton_personas');
      return saved ? JSON.parse(saved) : PERSONAS;
    } catch { return PERSONAS; }
  });
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  useEffect(() => {
    localStorage.setItem('proton_chat_history', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem('proton_persona_avatars', JSON.stringify(personaAvatars));
  }, [personaAvatars]);

  useEffect(() => {
    localStorage.setItem('proton_personas', JSON.stringify(personas));
  }, [personas]);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('user-profile');
      return saved ? JSON.parse(saved) : {
        name: 'Darian B.',
        email: 'devdarianib@gmail.com',
        language: 'en',
        region: 'Tbilisi',
        notifications: true
      };
    } catch {
      return {
        name: 'Darian B.',
        email: 'devdarianib@gmail.com',
        language: 'en',
        region: 'Tbilisi',
        notifications: true
      };
    }
  });
  const [favoritePersonaIds, setFavoritePersonaIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('proton_favorite_personas');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('proton_favorite_personas', JSON.stringify(favoritePersonaIds));
  }, [favoritePersonaIds]);
  
  const [aiSettings, setAiSettings] = useState<GlobalAiSettings>(() => {
    try {
      const saved = localStorage.getItem('proton_ai_settings');
      return saved ? JSON.parse(saved) : {
        temperature: 0.8,
        enableSearch: true,
        enableMaps: false,
        zenMode: false,
        systemInstruction: "",
        voice: "Kore"
      };
    } catch {
      return {
        temperature: 0.8,
        enableSearch: true,
        enableMaps: false,
        zenMode: false,
        systemInstruction: "",
        voice: "Kore"
      };
    }
  });

  useEffect(() => {
    localStorage.setItem('user-profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('proton_ai_settings', JSON.stringify(aiSettings));
  }, [aiSettings]);

  const [user, setUser] = useState(auth.currentUser);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    localStorage.setItem('proton_tasks', JSON.stringify(tasks));
  }, [tasks]);

  async function handleTTS(text: string) {
    try {
      const base64Audio = await generateSpeech(text, aiSettings.voice);
      const binary = atob(base64Audio);
      const dataSize = binary.length;
      
      // Create WAV header (WAV header is 44 bytes)
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);
      
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, 24000, true); // 24kHz
      view.setUint32(28, 48000, true); // ByteRate
      view.setUint16(32, 2, true); // BlockAlign
      view.setUint16(34, 16, true); // BitsPerSample
      writeString(36, 'data');
      view.setUint32(40, dataSize, true);
      
      const pcmData = new Uint8Array(buffer, 44);
      for (let i = 0; i < dataSize; i++) pcmData[i] = binary.charCodeAt(i);
      
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (error) {
      console.error("TTS Playback Error:", error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Fetch Workflows
          const workflowsRef = collection(db, 'users', currentUser.uid, 'workflows');
          const wfSnapshot = await getDocs(workflowsRef).catch(e => handleFirestoreError(e, 'list', workflowsRef.path));
          const loadedWorkflows = wfSnapshot.docs.map(doc => doc.data() as Workflow);
          setWorkflows(loadedWorkflows);

          // Fetch Personas
          const personasRef = collection(db, 'users', currentUser.uid, 'personas');
          const pSnapshot = await getDocs(personasRef).catch(e => handleFirestoreError(e, 'list', personasRef.path));
          let loadedPersonas = pSnapshot.docs.map(doc => doc.data() as Persona);
          
          if (loadedPersonas.length === 0) {
            // Initialize defaults
            loadedPersonas = PERSONAS;
            for (const p of PERSONAS) {
              const pDoc = doc(db, 'users', currentUser.uid, 'personas', p.id);
              await setDoc(pDoc, p).catch(e => handleFirestoreError(e, 'create', pDoc.path));
            }
          }
          setPersonas(loadedPersonas);

          // Fetch Chat History
          const chatRef = collection(db, 'users', currentUser.uid, 'chatHistory');
          const chatSnap = await getDocs(chatRef).catch(e => handleFirestoreError(e, 'list', chatRef.path));
          const historyObj: PersonaHistory = {};
          chatSnap.docs.forEach(d => {
            historyObj[d.id] = d.data().messages || [];
          });
          setChatHistory(historyObj);

          // Fetch Tasks
          const tasksRef = collection(db, 'users', currentUser.uid, 'tasks');
          const tasksSnap = await getDocs(tasksRef).catch(e => handleFirestoreError(e, 'list', tasksRef.path));
          const loadedTasks = tasksSnap.docs.map(doc => doc.data() as Task);
          setTasks(loadedTasks.length > 0 ? loadedTasks : []);

          // Fetch Custom Avatars
          const avatarRef = collection(db, 'users', currentUser.uid, 'customAvatars');
          const avatarSnap = await getDocs(avatarRef).catch(e => handleFirestoreError(e, 'list', avatarRef.path));
          const avatarObj: { [id: string]: string } = {};
          avatarSnap.docs.forEach(d => {
            avatarObj[d.id] = d.data().avatar;
          });
          setPersonaAvatars(avatarObj);
        } catch (error) {
          console.error("Initial load error:", error);
        }
      } else {
        setWorkflows([]);
        setPersonas(PERSONAS);
        setChatHistory({});
        setPersonaAvatars({});
        setTasks([]);
      }
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef).catch(e => handleFirestoreError(e, 'get', userDocRef.path));
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName
        }).catch(e => handleFirestoreError(e, 'create', userDocRef.path));
      }
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };
  
  const handleSignOut = async () => {
    await signOut(auth);
  };


  const handleNewMessage = (personaId: string, msg: ChatMessage) => {
    const updatedHistory = {
      ...chatHistory,
      [personaId]: [...(chatHistory[personaId] || []), msg]
    };
    setChatHistory(updatedHistory);
    
    if (user) {
      const docRef = doc(db, 'users', user.uid, 'chatHistory', personaId);
      setDoc(docRef, { messages: updatedHistory[personaId] }).catch(e => handleFirestoreError(e, 'write', docRef.path));
    }
  };

  const handleUpdatePersonas = async (newPersonas: Persona[] | ((prev: Persona[]) => Persona[])) => {
    const updated = typeof newPersonas === 'function' ? newPersonas(personas) : newPersonas;
    setPersonas(updated);
    
    if (user) {
      try {
        await Promise.all(updated.map(p => {
          const docRef = doc(db, 'users', user.uid, 'personas', p.id);
          return setDoc(docRef, p);
        })).catch(e => handleFirestoreError(e, 'update', 'multiple personas'));
      } catch (error) {
        console.error("Error syncing personas:", error);
      }
    }
  };

  const handleUpdateAvatar = (personaId: string, avatar: string) => {
    const updatedAvatars = {
      ...personaAvatars,
      [personaId]: avatar
    };
    setPersonaAvatars(updatedAvatars);
    
    if (user) {
      const docRef = doc(db, 'users', user.uid, 'customAvatars', personaId);
      setDoc(docRef, { avatar }).catch(e => handleFirestoreError(e, 'update', docRef.path));
    }
  };

  async function trackFirestore<T>(promise: Promise<T>): Promise<T> {
    setIsFirestoreActive(true);
    try {
      return await promise;
    } finally {
      setTimeout(() => setIsFirestoreActive(false), 800);
    }
  }

  const handleAddTask = (content: string, priority: 'low' | 'medium' | 'high' = 'medium', category?: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      content,
      contentGe: content,
      completed: false,
      priority,
      category
    };
    setTasks(prev => [...prev, newTask]);
    if (user) {
      const docRef = doc(db, 'users', user.uid, 'tasks', newTask.id);
      trackFirestore(setDoc(docRef, newTask)).catch(e => handleFirestoreError(e, 'write', docRef.path));
    }
  };

  const handleEditTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        if (user) {
          const docRef = doc(db, 'users', user.uid, 'tasks', id);
          trackFirestore(setDoc(docRef, updated)).catch(e => handleFirestoreError(e, 'write', docRef.path));
        }
        return updated;
      }
      return t;
    }));
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const updated = { ...t, completed: !t.completed };
        if (user) {
          const docRef = doc(db, 'users', user.uid, 'tasks', id);
          trackFirestore(setDoc(docRef, updated)).catch(e => handleFirestoreError(e, 'write', docRef.path));
        }
        return updated;
      }
      return t;
    }));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (user) {
      const docRef = doc(db, 'users', user.uid, 'tasks', id);
      trackFirestore(deleteDoc(docRef)).catch(e => handleFirestoreError(e, 'delete', docRef.path));
    }
  };

  const handleAiSuggestTasks = async () => {
    if (!isArtisanSystemActive) return;
    try {
      const workflowContext = workflows.map(w => `${w.name}: ${w.trigger} -> ${w.action}`).join('; ');
      const existingTasks = tasks.map(t => t.content).join(', ');
      
      const prompt = `Based on these active project workflows: [${workflowContext}] and existing tasks: [${existingTasks}], suggest 3 next actionable steps as tasks that are not already listed. 
      Return ONLY valid JSON in format: [{"content": "string", "contentGe": "string"}]
      Ensure the content is specific to the user's business niche.`;
      
      const outcome = await chatWithPersona(PERSONAS[0], prompt, [], "gemini-3-flash-preview");
      setLastGeminiMetadata(outcome.metadata);
      const suggestions = JSON.parse(outcome.text.replace(/```json|```/g, '').trim());
      
      const newTasks = suggestions.map((s: any, i: number) => ({
        id: `ai-task-${Date.now()}-${i}`,
        content: s.content,
        contentGe: s.contentGe,
        completed: false,
        isAiSuggested: true
      }));

      setTasks(prev => [...prev, ...newTasks]);
      
      if (user) {
        for (const task of newTasks) {
          const docRef = doc(db, 'users', user.uid, 'tasks', task.id);
          setDoc(docRef, task).catch(e => handleFirestoreError(e, 'write', docRef.path));
        }
      }
    } catch (error) {
      console.error("AI Suggestion Error:", error);
    }
  };

  if (!authInitialized) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-proton-bg">
        <Loader2 className="w-8 h-8 text-proton-accent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthFlow onGoogleSignIn={handleGoogleSignIn} language={userProfile.language} />
    );
  }

  const currentLanguage = (userProfile?.language === 'ka' || userProfile?.language === 'en') ? userProfile.language : 'en';
  const t = translations[currentLanguage];

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-proton-bg text-proton-text font-sans relative">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - FIXED ON MOBILE, FLEX ON DESKTOP */}
      <aside 
        className={cn(
          "flex flex-col border-r border-proton-border bg-proton-card transition-all duration-300 ease-in-out z-[70] overflow-x-hidden shadow-sm",
          "fixed inset-y-0 left-0 md:relative",
          isSidebarOpen 
            ? "translate-x-0 w-64 px-4 shadow-xl" 
            : "-translate-x-full md:translate-x-0 md:w-20 w-64 px-2"
        )}
      >
        <div className={cn("py-8 flex items-center gap-3 overflow-hidden whitespace-nowrap transition-all duration-300", !isSidebarOpen && "md:justify-center px-0")}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 bg-proton-accent text-white shadow-lg shadow-proton-accent/20">
            <Zap size={24} fill="currentColor" />
          </div>
          {isSidebarOpen && (
            <div className="font-bold text-xl tracking-tight transition-opacity duration-300">
              Proton<span className="text-proton-accent italic">Hub</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-6 mt-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="space-y-1">
            {isSidebarOpen && <p className="text-[10px] font-mono text-proton-muted uppercase tracking-widest px-3 mb-2">{t.sidebar.core}</p>}
            <SidebarItem 
              icon={LayoutDashboard} 
              label={t.sidebar.dashboard} 
              active={activeView === 'dashboard'} 
              onClick={() => handleViewChange('dashboard')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
            <SidebarItem 
              icon={Workflow} 
              label={t.sidebar.blueprints} 
              active={activeView === 'blueprints'} 
              onClick={() => handleViewChange('blueprints')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
            <SidebarItem 
              icon={Wallet} 
              label={t.sidebar.finance} 
              active={activeView === 'finance'} 
              onClick={() => handleViewChange('finance')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
          </div>

          <div className="space-y-1">
            {isSidebarOpen && <p className="text-[10px] font-mono text-proton-muted uppercase tracking-widest px-3 mb-2">{t.sidebar.agents}</p>}
            <SidebarItem 
              icon={Users} 
              label={t.sidebar.personas} 
              active={activeView === 'personas'} 
              onClick={() => handleViewChange('personas')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
            <SidebarItem 
              icon={CalendarIcon} 
              label={t.sidebar.organizer} 
              active={activeView === 'organizer'} 
              onClick={() => handleViewChange('organizer')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
          </div>

          <div className="space-y-1">
            {isSidebarOpen && <p className="text-[10px] font-mono text-proton-muted uppercase tracking-widest px-3 mb-2">{t.sidebar.creative}</p>}
            <SidebarItem 
              icon={Image} 
              label={t.sidebar.image} 
              active={activeView === 'image'} 
              onClick={() => handleViewChange('image')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
          </div>

          <div className="pt-4 mt-4 border-t border-proton-border space-y-1">
            {isSidebarOpen && <p className="text-[10px] font-mono text-proton-muted uppercase tracking-widest px-3 mb-2">{t.sidebar.system}</p>}
            <SidebarItem 
              icon={Terminal} 
              label={t.sidebar.profile} 
              active={activeView === 'profile'} 
              onClick={() => handleViewChange('profile')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
            <SidebarItem 
              icon={Settings} 
              label={t.sidebar.settings} 
              active={activeView === 'settings'} 
              onClick={() => handleViewChange('settings')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
            <SidebarItem 
              icon={Cpu} 
              label={t.sidebar.device} 
              active={activeView === 'device'} 
              onClick={() => handleViewChange('device')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
          </div>
        </nav>

        <div className="mt-auto py-4 border-t border-proton-border/50">
          <div className="px-3 mb-2">
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl bg-proton-card/50 border border-proton-border/50 overflow-hidden cursor-pointer hover:bg-proton-accent/10 transition-all duration-300",
              !isSidebarOpen && "justify-center px-0"
            )} onClick={() => handleViewChange('profile')}>
              <div className="w-8 h-8 rounded-full bg-proton-accent/20 flex items-center justify-center text-proton-accent font-bold shrink-0 overflow-hidden shadow-[0_0_10px_rgba(0,242,255,0.2)]">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-xs uppercase">{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              {isSidebarOpen && (
                <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left-2">
                  <span className="text-[10px] font-bold text-proton-text truncate leading-tight">{user.displayName || 'Proton Core User'}</span>
                  <span className="text-[8px] text-proton-muted truncate tracking-tighter">Proton Tier 1 Member</span>
                </div>
              )}
            </div>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={cn(
              "hidden md:flex items-center gap-3 w-full px-4 py-3 text-proton-muted hover:text-proton-text hover:bg-proton-accent/10 transition-all duration-300",
              !isSidebarOpen && "justify-center px-0"
            )}
          >
            <div className={cn("transition-transform duration-500", isSidebarOpen && "rotate-180")}>
              <ChevronRight size={20} />
            </div>
            {isSidebarOpen && <span className="font-bold text-[10px] uppercase tracking-widest">{t.sidebar.collapse}</span>}
          </button>
        </div>
      </aside>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-proton-card/80 backdrop-blur-xl border-t border-proton-border z-50 flex items-center justify-around px-2 pb-safe">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: t.sidebar.bottom_nav.dashboard },
          { id: 'device', icon: Cpu, label: t.sidebar.bottom_nav.device },
          { id: 'finance', icon: Wallet, label: t.sidebar.bottom_nav.finance },
          { id: 'blueprints', icon: Workflow, label: t.sidebar.bottom_nav.blueprints },
          { id: 'personas', icon: Users, label: t.sidebar.bottom_nav.personas },
          { id: 'profile', icon: Terminal, label: t.sidebar.bottom_nav.profile },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => handleViewChange(item.id as any)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300 relative",
              activeView === item.id ? "text-proton-accent" : "text-proton-muted"
            )}
          >
            <item.icon size={20} className={cn(activeView === item.id && "animate-pulse")} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-tighter">{item.label}</span>
            {activeView === item.id && (
              <motion.div 
                layoutId="activeBottomTab"
                className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-proton-accent shadow-[0_0_8px_rgba(0,242,255,0.8)]"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden pb-16 md:pb-0">
        {/* Header */}
        <header className="h-16 border-b border-proton-border flex items-center justify-between px-4 md:px-8 z-30 bg-proton-card shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-proton-bg text-proton-muted transition-colors hidden md:flex"
            >
              <LayoutDashboard size={20} />
            </button>
            <div className="h-4 w-px bg-proton-border hidden md:block" />
            <div className="flex items-center gap-2 text-xs font-semibold text-proton-muted uppercase tracking-wider">
              <Globe size={14} />
              <span>{userProfile.region}</span>
              <span className="text-proton-border">|</span>
              <span className="text-proton-accent">{activeView.charAt(0).toUpperCase() + activeView.slice(1)}</span>
              {!isArtisanSystemActive && (
                <div className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1 bg-proton-secondary/10 border border-proton-secondary/20 rounded-full">
                   <div className="w-1.5 h-1.5 rounded-full bg-proton-secondary animate-pulse" />
                   <span className="text-[9px] font-bold text-proton-secondary tracking-widest">{t.dashboard.maintenance}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="scale-75 sm:scale-100 origin-right">
              <ModeToggle mode={uiMode} setMode={setUiMode} t={t} />
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <select
                value={userProfile.language}
                onChange={(e) => setUserProfile(prev => ({ ...prev, language: e.target.value as 'en' | 'ka' }))}
                className="bg-proton-card border border-proton-border rounded-lg px-1 py-1 text-[10px] font-mono text-proton-text focus:outline-none cursor-pointer hover:border-proton-accent transition-colors"
              >
                <option value="en">English (EN)</option>
                <option value="ka">Georgian (GE)</option>
              </select>

              <div className="text-[10px] font-mono text-right hidden sm:block">
                <span className="text-proton-muted block">{t.common.gpu}</span>
                <span className="text-proton-accent">84%</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 proton-grid relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto h-full"
            >
              {activeView === 'dashboard' && (
                <DashboardView 
                  personas={personas} 
                  activeView={activeView} 
                  setActiveView={setActiveView}
                  chatHistory={chatHistory}
                  language={userProfile.language}
                  user={user}
                  uiMode={uiMode}
                  aiSettings={aiSettings}
                  setLastGeminiMetadata={setLastGeminiMetadata}
                  trackFirestore={trackFirestore}
                  isArtisanSystemActive={isArtisanSystemActive}
                />
              )}
              {activeView === 'organizer' && (
                <OrganizerView 
                  language={userProfile.language}
                  workflows={workflows}
                  tasks={tasks}
                  onAddTask={handleAddTask}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onEditTask={handleEditTask}
                  onAiSuggest={handleAiSuggestTasks}
                  uiMode={uiMode}
                />
              )}
              {activeView === 'compute' && (
                <SystemsView 
                  metadata={lastGeminiMetadata} 
                  aiSettings={aiSettings} 
                  setAiSettings={setAiSettings} 
                  isFirestoreActive={isFirestoreActive} 
                  language={userProfile.language}
                  uiMode={uiMode}
                />
              )}
              {activeView === 'device' && (
                <HardwareView language={userProfile.language} />
              )}
              {activeView === 'personas' && (
                <PersonasView 
                  history={chatHistory} 
                  onNewMessage={handleNewMessage} 
                  customAvatars={personaAvatars}
                  onUpdateAvatar={handleUpdateAvatar}
                  personas={personas}
                  onUpdatePersonas={handleUpdatePersonas}
                  aiSettings={aiSettings}
                  setLastGeminiMetadata={setLastGeminiMetadata}
                  workflows={workflows}
                  tasks={tasks}
                  uiMode={uiMode}
                  isSystemActive={isArtisanSystemActive}
                />
              )}
              {activeView === 'finance' && (
                <Web3View uiMode={uiMode} />
              )}
              {activeView === 'image' && <ImageView uiMode={uiMode} isSystemActive={isArtisanSystemActive} />}
              {activeView === 'blueprints' && (
                <WorkflowsView 
                  workflows={workflows}
                  setWorkflows={setWorkflows}
                  personas={personas}
                  user={user}
                  uiMode={uiMode}
                  isSystemActive={isArtisanSystemActive}
                />
              )}
              {activeView === 'profile' && (
                <ProfileView 
                  profile={userProfile} 
                  setProfile={setUserProfile} 
                  history={chatHistory} 
                  customAvatars={personaAvatars}
                  personas={personas}
                  user={user}
                  onSignIn={handleGoogleSignIn}
                  onSignOut={handleSignOut}
                  uiMode={uiMode}
                />
              )}
              {activeView === 'settings' && (
                <div className="flex flex-col h-full w-full max-w-2xl mx-auto p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <Settings size={32} className="text-proton-accent" />
                    <h2 className="text-2xl font-bold">{t.settings.title}</h2>
                  </div>
 
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <h3 className="font-bold border-b border-proton-border pb-2">{t.sidebar.profile}</h3>
                      <div className="space-y-2">
                        <label className="text-xs text-proton-muted">{t.settings.region || 'Region'}</label>
                        <input 
                          value={userProfile.region || ''}
                          onChange={e => setUserProfile(prev => ({ ...prev, region: e.target.value }))}
                          className="w-full bg-proton-card p-3 rounded-xl border border-proton-border text-xs focus:outline-none focus:border-proton-accent"
                          placeholder="e.g. Tbilisi"
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="font-bold border-b border-proton-border pb-2">{t.settings.ai_config}</h3>
                      
                      <div className="space-y-2">
                        <label className="text-xs text-proton-muted">{t.settings.temperature}: {aiSettings.temperature}</label>
                        <input 
                          type="range" min="0" max="1" step="0.1"
                          value={aiSettings.temperature}
                          onChange={e => setAiSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                          className="w-full accent-proton-accent"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs">{t.settings.search}</label>
                        <input 
                          type="checkbox" checked={aiSettings.enableSearch}
                          onChange={e => setAiSettings(prev => ({ ...prev, enableSearch: e.target.checked }))}
                          className="accent-proton-accent"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs">{t.settings.maps}</label>
                        <input 
                          type="checkbox" checked={aiSettings.enableMaps}
                          onChange={e => setAiSettings(prev => ({ ...prev, enableMaps: e.target.checked }))}
                          className="accent-proton-accent"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs">Enable Zen Mode (Hide Sidebar)</label>
                        <input 
                          type="checkbox" checked={aiSettings.zenMode}
                          onChange={e => setAiSettings(prev => ({ ...prev, zenMode: e.target.checked }))}
                          className="accent-proton-accent"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs text-proton-muted">Voice Style (Tbilisi Accent Enabled)</label>
                        <select
                          value={aiSettings.voice}
                          onChange={e => setAiSettings(prev => ({ ...prev, voice: e.target.value }))}
                          className="w-full bg-proton-card p-3 rounded-xl border border-proton-border text-xs focus:outline-none focus:border-proton-accent"
                        >
                          <option value="Kore">Professional (Kore)</option>
                          <option value="Fenrir">Deep Male Voice (Fenrir)</option>
                          <option value="Charon">Warm Male Voice (Charon)</option>
                          <option value="TbilisiDialect">Tbilisi Local (Beta)</option>
                          <option value="GeorgianModern">Modern Kartuli</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                         <label className="text-xs text-proton-muted">Global System Instruction</label>
                         <textarea
                           value={aiSettings.systemInstruction || ""}
                           onChange={e => setAiSettings(prev => ({ ...prev, systemInstruction: e.target.value }))}
                           className="w-full bg-proton-card p-3 rounded-xl border border-proton-border text-xs focus:outline-none focus:border-proton-accent"
                           rows={3}
                           placeholder="Enter global system instructions..."
                         />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="font-bold border-b border-proton-border pb-2">Appearance</h3>
                      <div className="flex gap-4">
                        {(['proton', 'light', 'vibrant', 'midnight'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setTheme(t)}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                              theme === t ? "bg-proton-accent text-proton-bg" : "bg-proton-card hover:bg-proton-border"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {showOptimizationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOptimizationModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-proton-card w-full max-w-md rounded-[40px] border border-proton-border shadow-2xl p-8 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <ShieldAlert size={160} />
              </div>
              <div className="space-y-6 relative z-10">
                <div className="w-16 h-16 rounded-3xl bg-proton-accent/10 flex items-center justify-center text-proton-accent">
                  <Zap size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight">{t.dashboard.optimization_title}</h3>
                  <p className="text-sm text-proton-muted leading-relaxed font-medium">
                    {t.dashboard.optimization_desc}
                  </p>
                </div>
                <button 
                  onClick={() => setShowOptimizationModal(false)}
                  className="w-full py-4 bg-proton-accent text-white rounded-2xl font-bold text-sm shadow-xl shadow-proton-accent/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  {t.dashboard.optimization_btn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}