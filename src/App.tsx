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
  Check
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
type View = 'dashboard' | 'compute' | 'personas' | 'finance' | 'blueprints' | 'profile' | 'settings' | 'image' | 'organizer';

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
      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-300 group relative",
      active 
        ? "bg-proton-accent/10 text-proton-accent border border-proton-accent/20"
        : "text-proton-muted hover:text-proton-text hover:bg-proton-text/5",
      !expanded && "justify-center px-0"
    )}
    title={!expanded ? label : undefined}
  >
    <Icon size={18} className={cn("shrink-0 transition-transform duration-300 group-hover:scale-110", active ? "text-proton-accent" : "group-hover:text-proton-text")} />
    {expanded && (
      <span className={cn(
        "text-[10px] uppercase tracking-widest whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2",
        uiMode === 'artisan' ? "font-sans font-semibold" : "font-mono font-bold"
      )}>
        {label}
      </span>
    )}
    {active && expanded && (
      <motion.div 
        layoutId="active-pill" 
        className={cn(
          "ml-auto w-1 h-1 rounded-full bg-proton-accent",
          uiMode === 'operator' && "shadow-[0_0_8px_rgba(0,242,255,0.8)]"
        )} 
      />
    )}
    {active && !expanded && <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-proton-accent rounded-full" />}
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const t = translations[language].auth;

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
    return 'bg-proton-accent shadow-[0_0_10px_rgba(0,242,255,0.5)]';
  }, [passwordStrength]);

  const strengthLabel = useMemo(() => {
    if (passwordStrength <= 1) return t.weak;
    if (passwordStrength <= 2) return t.medium;
    return t.strong;
  }, [passwordStrength, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.includes('@')) {
      setError(t.invalid_email);
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
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0 && methods.includes('google.com')) {
          // In a real app, you might want to show a specific message or handle linking
          // For now, let's just attempt sign in which might trigger account linking flows if enabled
        }
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] flex items-center justify-center bg-proton-bg p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-proton-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-proton-secondary/5 blur-[120px] pointer-events-none" />
      
      <motion.div 
        layout
        className="relative z-10 w-full max-w-md proton-glass p-8 rounded-3xl space-y-6 shadow-2xl border border-white/5"
      >
        <div className="space-y-2 text-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-proton-accent to-proton-secondary flex items-center justify-center text-proton-bg shadow-[0_0_30px_rgba(0,242,255,0.3)] mb-4"
          >
            <Zap size={32} fill="currentColor" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">Proton Core <span className="text-proton-accent">AI</span></h1>
          <p className="text-proton-muted text-xs uppercase tracking-widest font-mono">
            {isLogin ? t.login : t.signup}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest px-1">{t.email}</label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-proton-card/50 border border-proton-border focus:border-proton-accent rounded-xl px-4 py-3 text-sm transition-all focus:outline-none"
              placeholder="operator@proton.core"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest px-1">{t.password}</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-proton-card/50 border border-proton-border focus:border-proton-accent rounded-xl px-4 py-3 text-sm transition-all focus:outline-none"
              placeholder="••••••••"
              required
            />
            {password && (
              <div className="px-1 pt-1 space-y-1">
                <div className="flex items-center justify-between text-[8px] font-mono uppercase tracking-widest text-proton-muted">
                  <span>{t.password_strength}</span>
                  <span className={cn("font-bold", passwordStrength > 2 ? "text-proton-accent" : "text-yellow-500")}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="h-1 w-full bg-proton-muted/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(passwordStrength / 4) * 100}%` }}
                    className={cn("h-full transition-colors", strengthColor)}
                  />
                </div>
              </div>
            )}
          </div>

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest px-1">{t.confirm_password}</label>
              <input 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-proton-card/50 border border-proton-border focus:border-proton-accent rounded-xl px-4 py-3 text-sm transition-all focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-red-500 font-mono text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-proton-accent text-proton-bg font-bold rounded-xl shadow-[0_0_20px_rgba(0,242,255,0.2)] hover:shadow-[0_0_30px_rgba(0,242,255,0.4)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 mt-2"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (isLogin ? t.login : t.signup)}
          </button>
        </form>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-proton-border"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-proton-muted bg-transparent">
            <span className="px-2 bg-proton-bg">{t.or_continue_with}</span>
          </div>
        </div>

        <button 
          onClick={onGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-proton-card/50 hover:bg-proton-card text-proton-text font-semibold rounded-xl transition-all border border-proton-border active:scale-[0.98]"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.26v2.84C4.09 20.61 7.74 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.26C1.43 8.72 1 10.3 1 12s.43 3.28 1.26 4.93l3.58-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.74 1 4.09 3.39 2.26 7.07l3.58 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t.google_auth}
        </button>

        <div className="text-center pt-2">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-proton-accent hover:underline font-medium"
          >
            {isLogin ? t.dont_have_account : t.already_have_account}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const DigitalClock = ({ uiMode }: { uiMode?: 'operator' | 'artisan' }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-end px-4">
      <div className={cn(
        "text-sm md:text-xl font-mono font-bold tracking-tighter transition-all duration-500",
        "text-proton-accent drop-shadow-[0_0_10px_var(--color-proton-accent)]"
      )}>
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </div>
      <div className="text-[8px] font-mono text-proton-muted uppercase tracking-[0.3em] font-bold">
        {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
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
  onAiSuggest,
  uiMode
}: {
  language: 'en' | 'ka',
  workflows: Workflow[],
  tasks: Task[],
  onAddTask: (content: string) => void,
  onToggleTask: (id: string) => void,
  onDeleteTask: (id: string) => void,
  onAiSuggest: () => void,
  uiMode: 'operator' | 'artisan'
}) => {
  const t = translations[language].organizer;
  const common = translations[language].common;
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    onAddTask(newTaskInput.trim());
    setNewTaskInput('');
  };

  const handleAiSuggest = async () => {
    setIsSuggesting(true);
    await onAiSuggest();
    setIsSuggesting(false);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-proton-text">{t.title}</h1>
          <p className="text-proton-muted text-[10px] md:text-xs font-mono uppercase tracking-[0.2em]">{t.subtitle}</p>
        </div>
        <DigitalClock uiMode={uiMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Calendar & Workflows */}
        <div className="lg:col-span-7 space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <CalendarIcon size={18} className="text-proton-accent" />
              {t.calendar}
            </h2>
            <div className="p-3 sm:p-4 rounded-2xl proton-glass border border-proton-border/30 shadow-sm">
              <style>{`
                .react-calendar {
                  background: transparent !important;
                  border: none !important;
                  font-family: inherit !important;
                  width: 100% !important;
                  font-size: 0.85rem !important;
                }
                .react-calendar__navigation {
                  margin-bottom: 0.5em !important;
                  height: 36px !important;
                }
                .react-calendar__navigation button {
                  color: var(--color-proton-text) !important;
                  font-weight: bold !important;
                  min-width: 36px !important;
                  background: none !important;
                }
                .react-calendar__month-view__weekdays {
                  text-transform: uppercase;
                  font-size: 0.6rem;
                  font-weight: bold;
                  color: var(--color-proton-muted);
                }
                .react-calendar__tile {
                  padding: 0.8em 0.2em !important;
                  color: var(--color-proton-text) !important;
                  opacity: 0.7;
                  border-radius: 8px;
                  transition: all 0.2s;
                }
                .react-calendar__tile:hover {
                  background: color-mix(in srgb, var(--color-proton-text), transparent 90%) !important;
                  opacity: 1;
                }
                .react-calendar__tile--active {
                  background: var(--color-proton-accent) !important;
                  color: var(--color-proton-bg) !important;
                  opacity: 1 !important;
                  font-weight: bold;
                  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-proton-accent), transparent 50%);
                }
                .react-calendar__tile--now {
                  background: color-mix(in srgb, var(--color-proton-accent), transparent 85%) !important;
                  color: var(--color-proton-accent) !important;
                  border: 1px solid color-mix(in srgb, var(--color-proton-accent), transparent 70%) !important;
                }
                .react-calendar__month-view__days__day--neighboringMonth {
                  opacity: 0.15 !important;
                }
              `}</style>
              <Calendar />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Workflow size={18} className="text-proton-accent" />
              {t.upcoming_workflows}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workflows.slice(0, 4).map(wf => (
                <div key={wf.id} className="p-4 rounded-2xl bg-proton-card/40 border border-proton-border hover:border-proton-accent/30 transition-all group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-proton-accent/10 text-proton-accent group-hover:scale-110 transition-transform">
                      <Zap size={16} />
                    </div>
                    <span className="font-bold text-sm truncate">{wf.name}</span>
                  </div>
                  <div className="text-[10px] text-proton-muted font-mono uppercase tracking-widest truncate">
                    Trigger: {wf.trigger}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className={cn(
            "p-4 rounded-2xl bg-proton-card/30 border border-proton-border flex flex-col h-full min-h-[400px]",
            uiMode === 'artisan' ? "artisan-shadow" : ""
          )}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Layers size={18} className="text-proton-accent" />
                {t.tasks}
              </h2>
              <button 
                onClick={handleAiSuggest}
                disabled={isSuggesting}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                  isSuggesting 
                    ? "bg-proton-muted/20 text-proton-muted" 
                    : "bg-proton-accent/10 text-proton-accent hover:bg-proton-accent/20 border border-proton-accent/30"
                )}
              >
                {isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isSuggesting ? t.generating : t.ai_suggest}
              </button>
            </div>

            <form onSubmit={handleAddTask} className="flex gap-2 mb-6">
              <input 
                type="text"
                placeholder={t.task_placeholder}
                value={newTaskInput}
                onChange={e => setNewTaskInput(e.target.value)}
                className="flex-1 bg-proton-bg/50 border border-proton-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-proton-accent transition-colors"
              />
              <button type="submit" className="p-2 rounded-xl bg-proton-accent text-black font-bold">
                <Plus size={20} />
              </button>
            </form>

            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
              <AnimatePresence initial={false}>
                {tasks.length === 0 ? (
                  <div className="text-center py-12 text-proton-muted text-sm italic">
                    {t.no_tasks}
                  </div>
                ) : (
                  tasks.map(task => (
                    <motion.div 
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className={cn(
                        "group p-4 rounded-2xl flex items-center gap-4 transition-all border",
                        task.completed 
                          ? "bg-proton-accent/5 border-proton-accent/20 opacity-60" 
                          : (uiMode === 'artisan' ? "bg-proton-card border-proton-border artisan-shadow" : "bg-proton-card/50 border-proton-border")
                      )}
                    >
                      <button 
                        onClick={() => onToggleTask(task.id)}
                        className={cn(
                          "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                          task.completed 
                            ? "bg-proton-accent border-proton-accent text-black" 
                            : "border-proton-muted/50 hover:border-proton-accent"
                        )}
                      >
                        {task.completed && <Check size={14} strokeWidth={4} />}
                      </button>
                      <div className="flex-1">
                        <p className={cn(
                          "text-sm transition-all",
                          task.completed ? "line-through text-proton-muted" : "text-proton-text"
                        )}>
                          {language === 'ka' ? task.contentGe : task.content}
                        </p>
                        {task.isAiSuggested && (
                          <span className="text-[9px] uppercase tracking-widest text-proton-accent/80 font-bold flex items-center gap-1 mt-1">
                            <Sparkles size={10} /> AI Recommendation
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => onDeleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-proton-muted hover:text-red-400 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemAlert = ({ 
  title, 
  message, 
  uiMode,
  onClose 
}: { 
  title: string, 
  message: string, 
  uiMode: 'operator' | 'artisan',
  onClose: () => void 
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9, y: 20 }}
    className="fixed bottom-8 right-8 z-[100] max-w-sm w-full"
  >
    <div className="proton-glass border-proton-secondary/20 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-proton-secondary" />
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-xl bg-proton-secondary/10 text-proton-secondary">
          <Shield size={20} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-proton-text">{title}</h3>
          <p className="text-xs text-proton-muted mt-1">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className="p-1 transition-colors text-proton-muted hover:text-proton-text"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  </motion.div>
);

const NeuralPulse = ({ language, onSelect }: { language: 'en' | 'ka', onSelect: (topic: string) => void }) => {
  const [pulses, setPulses] = useState<any[]>([]);
  const t = translations[language].architect;

  useEffect(() => {
    const q = query(
      collection(db, 'neural_pulse'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livePulses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const simulated: any[] = [
        { id: 'sim-1', projectTitle: language === 'ka' ? 'ხის მაგიდის რესტავრაცია' : 'Antique Table Restoration', createdAt: { seconds: Date.now() / 1000 - 3600 } },
        { id: 'sim-2', projectTitle: language === 'ka' ? 'ჭკვიანი სახლის მოწყობა' : 'Smart Home Setup', createdAt: { seconds: Date.now() / 1000 - 7200 } }
      ];
      setPulses(livePulses.length > 0 ? livePulses : simulated);
    }, (error) => {
      console.warn("NeuralPulse connection deferred or denied:", error.message);
      // Fallback to simulated data on error
      setPulses([
        { id: 'sim-1', projectTitle: language === 'ka' ? 'ხის მაგიდის რესტავრაცია' : 'Antique Table Restoration', createdAt: { seconds: Date.now() / 1000 - 3600 } },
        { id: 'sim-2', projectTitle: language === 'ka' ? 'ჭკვიანი სახლის მოწყობა' : 'Smart Home Setup', createdAt: { seconds: Date.now() / 1000 - 7200 } }
      ]);
    });

    return () => unsubscribe();
  }, [language]);

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return t.pulse_just_now;
    const seconds = Math.floor((Date.now() - timestamp.seconds * 1000) / 1000);
    if (seconds < 60) return t.pulse_just_now;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ${t.pulse_ago}`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${t.pulse_ago}`;
  };

  return (
    <div className="w-full overflow-hidden py-4 select-none">
      <div className="flex items-center gap-4 mb-2 px-4">
        <Activity size={14} className="text-proton-accent animate-pulse" />
        <span className="text-[10px] font-mono text-proton-muted uppercase tracking-[0.2em] font-bold">{t.pulse_title}</span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 no-scrollbar">
        <AnimatePresence mode="popLayout">
          {pulses.map((pulse, idx) => (
            <motion.button
              key={pulse.id}
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -20 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(pulse.projectTitle)}
              className="flex-shrink-0 group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-proton-accent to-proton-secondary rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-300" />
              <div className="relative flex items-center gap-3 px-4 py-2 bg-proton-card/50 backdrop-blur-md rounded-2xl border border-proton-border hover:border-proton-accent/50 transition-all font-medium">
                <div className="w-2 h-2 rounded-full bg-proton-accent animate-ping" />
                <div className="flex flex-col items-start">
                  <span className="text-[10px] text-proton-accent font-bold uppercase tracking-tight">{t.pulse_prefix}</span>
                  <span className="text-xs text-proton-text truncate max-w-[150px]">{pulse.projectTitle}</span>
                </div>
                <span className="text-[9px] font-mono text-proton-muted self-end ml-4 italic">{getTimeAgo(pulse.createdAt)}</span>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const SmartTaskArchitect = ({ 
  language, 
  projectText, 
  setProjectText,
  user,
  uiMode,
  onLoadingChange,
  aiSettings,
  setLastGeminiMetadata,
  trackFirestore
}: { 
  language: 'en' | 'ka',
  projectText: string,
  setProjectText: Dispatch<SetStateAction<string>>,
  user: any,
  uiMode: 'operator' | 'artisan',
  onLoadingChange?: (loading: boolean) => void,
  aiSettings: GlobalAiSettings,
  setLastGeminiMetadata: (m: GeminiMetadata | null) => void,
  trackFirestore: <T>(promise: Promise<T>) => Promise<T>
}) => {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [error, setError] = useState<{ title: string, message: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const t = translations[language].architect;

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleAnalyze = async () => {
    if (!projectText.trim() || loading || cooldown > 0) return;

    const cacheKey = `architect_cache_${user?.uid || 'anon'}_${projectText.trim().toLowerCase()}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        setPlan(JSON.parse(cachedData));
        return;
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    if (!navigator.onLine) {
      setError({
        title: t.error_title,
        message: t.offline_error
      });
      return;
    }

    setLoading(true);
    onLoadingChange?.(true);
    setPlan(null);
    setError(null);

    try {
      const outcome = await architectTask(projectText, aiSettings.temperature);
      setPlan(outcome.data);
      setLastGeminiMetadata(outcome.metadata);
      localStorage.setItem(cacheKey, JSON.stringify(outcome.data));
      
      // Emit pulse event
      await trackFirestore(addDoc(collection(db, 'neural_pulse'), {
        projectTitle: projectText.trim(),
        createdAt: serverTimestamp()
      }));

      // Automatically create a main task and its steps for the user
      if (user) {
        const projectId = `project-task-${Date.now()}`;
        const mainTask: Task = {
          id: projectId,
          content: `Project: ${projectText}`,
          contentGe: `პროექტი: ${projectText}`,
          completed: false
        };
        const mainRef = doc(db, 'users', user.uid, 'tasks', mainTask.id);
        await trackFirestore(setDoc(mainRef, mainTask)).catch(e => handleFirestoreError(e, 'write', mainRef.path));

        for (let i = 0; i < outcome.data.firstSteps.length; i++) {
          const stepTask: Task = {
            id: `step-${Date.now()}-${i}`,
            content: outcome.data.firstSteps[i],
            contentGe: outcome.data.firstSteps[i], // Fallback if no translation returned for steps
            completed: false,
            isAiSuggested: true
          };
          const stepRef = doc(db, 'users', user.uid, 'tasks', stepTask.id);
          await trackFirestore(setDoc(stepRef, stepTask)).catch(e => handleFirestoreError(e, 'write', stepRef.path));
        }
      }

      setCooldown(5);
    } catch (err: any) {
      console.error(err);
      const errStr = JSON.stringify(err).toLowerCase();
      const isQuotaError = errStr.includes('quota') || 
                           errStr.includes('429') || 
                           err.message?.toLowerCase().includes('quota') ||
                           err.message?.includes('429');
      
      setError({
        title: t.error_title,
        message: isQuotaError ? t.quota_error : t.api_error
      });
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center py-4 space-y-4 max-w-4xl mx-auto w-full relative z-10 p-4">

      <AnimatePresence>
        {error && (
          <SystemAlert 
            title={error.title} 
            message={error.message} 
            uiMode={uiMode}
            onClose={() => setError(null)} 
          />
        )}
      </AnimatePresence>
      <div className="w-full text-center space-y-2">
        <motion.h2 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "text-2xl md:text-4xl font-black tracking-tight",
            uiMode === 'artisan' 
              ? "text-proton-text" 
              : "bg-gradient-to-r from-proton-accent via-proton-text to-proton-secondary bg-clip-text text-transparent"
          )}
        >
          {t.title}
        </motion.h2>
        <p className="text-proton-muted text-xs md:text-base font-medium max-w-md mx-auto line-clamp-1">
          {t.placeholder}
        </p>
      </div>

      <div className="relative w-full group">
        {uiMode === 'operator' && (
          <div className="absolute -inset-1 bg-gradient-to-r from-proton-accent to-proton-secondary rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        )}
        <div className={cn(
          "relative flex flex-col md:flex-row p-1.5 bg-proton-card/80 backdrop-blur-xl rounded-2xl border border-proton-border hover:border-proton-accent/40 transition-all",
          uiMode === 'artisan' ? "artisan-shadow" : "shadow-2xl"
        )}>
          <input 
            type="text" 
            value={projectText}
            onChange={(e) => setProjectText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            placeholder={t.placeholder}
            className="flex-1 bg-transparent px-4 py-3 text-sm md:text-base focus:outline-none placeholder:text-proton-muted font-medium"
          />
          <button 
            onClick={handleAnalyze}
            disabled={loading || !projectText.trim() || cooldown > 0}
            className={cn(
              "m-0.5 px-6 py-3 rounded-xl font-bold text-xs md:text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2",
              uiMode === 'artisan' 
                ? "bg-proton-text text-proton-bg" 
                : "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20"
            )}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : cooldown > 0 ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={16} />}
            {loading ? t.analyzing : cooldown > 0 ? `${t.cooldown} (${cooldown}s)` : t.button}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {plan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full group"
          >
            <div className={cn(
              "proton-glass p-6 md:p-8 rounded-3xl border border-proton-accent/20 space-y-6 relative overflow-hidden",
              uiMode === 'artisan' ? "artisan-shadow" : "shadow-2xl"
            )}>
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <LayoutDashboard size={80} className="text-proton-accent rotate-12" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-mono text-proton-accent uppercase tracking-[0.3em] font-bold">{t.complexity}</p>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center border transition-colors",
                        uiMode === 'artisan' ? "bg-proton-accent/5 border-proton-accent/20" : "bg-proton-accent/10 border-proton-accent/20"
                      )}>
                        <Terminal size={24} className="text-proton-accent" />
                      </div>
                      <p className="text-3xl font-bold text-proton-text">{plan.complexity}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] font-mono text-proton-secondary uppercase tracking-[0.3em] font-bold">{t.time}</p>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center border transition-colors",
                        uiMode === 'artisan' ? "bg-proton-secondary/5 border-proton-secondary/20" : "bg-proton-secondary/10 border-proton-secondary/20"
                      )}>
                        <Zap size={24} className="text-proton-secondary" />
                      </div>
                      <p className="text-3xl font-bold text-proton-text">{plan.estimatedTime}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                   <p className="text-[10px] font-mono text-proton-muted uppercase tracking-[0.3em] font-bold">{t.materials}</p>
                   <div className="space-y-3 overflow-y-auto max-h-64 pr-2 custom-scrollbar">
                      {plan.materials.map((m, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex justify-between items-center p-4 rounded-2xl bg-proton-text/5 border border-proton-border hover:bg-proton-text/10 transition-colors"
                        >
                          <span className="text-sm font-bold">{m.item}</span>
                          <span className="text-xs font-mono bg-proton-accent/20 text-proton-accent px-3 py-1 rounded-full border border-proton-accent/30">{m.cost}</span>
                        </motion.div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="space-y-6 pt-10 border-t border-proton-border/30 relative z-10">
                <p className="text-[10px] font-mono text-proton-text uppercase tracking-[0.3em] font-bold">{t.steps}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plan.firstSteps.map((step, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                      className="p-6 rounded-3xl bg-proton-card/40 border border-proton-border relative group/step hover:border-proton-accent/40 transition-all h-full"
                    >
                      <span className="absolute -top-3 -left-3 w-10 h-10 rounded-2xl bg-proton-accent text-proton-bg flex items-center justify-center font-bold text-xs shadow-lg group-hover/step:scale-110 transition-transform">
                        0{idx + 1}
                      </span>
                      <p className="text-sm md:text-base leading-relaxed font-medium mt-2">{step}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const ClusterTelemetry = ({ 
  isLoading, 
  uiMode, 
  language 
}: { 
  isLoading: boolean, 
  uiMode: 'operator' | 'artisan',
  language: 'en' | 'ka'
}) => {
  const [latency, setLatency] = useState(42);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsConnected(!!user));
    const interval = setInterval(() => {
      setLatency(prev => {
        const jitter = Math.floor(Math.random() * 20) - 10;
        return Math.max(30, Math.min(150, prev + jitter));
      });
    }, 3000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={cn(
      "p-4 rounded-2xl border transition-all duration-500 overflow-hidden relative",
      "bg-proton-card/50 border-proton-border/50 shadow-lg",
      uiMode === 'artisan' && "artisan-shadow"
    )}>
      {uiMode === 'operator' && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(var(--color-proton-accent) 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }} />
      )}
      
      <div className="relative z-10 flex flex-col gap-4">
        {/* Top: Status Indicators */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <p className="text-[7px] font-mono text-proton-muted uppercase tracking-widest">Core Node</p>
            <div className="flex items-center gap-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-proton-muted animate-pulse")} />
              <span className={cn("text-[10px] font-bold uppercase", uiMode === 'operator' ? "font-mono" : "font-sans")}>
                {isConnected ? 'CONN' : 'SYNC'}
              </span>
            </div>
          </div>
          <div className="space-y-1 border-x border-proton-border/30 px-2">
            <p className="text-[7px] font-mono text-proton-muted uppercase tracking-widest">Gemini Uplink</p>
            <div className="flex items-center gap-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", isLoading ? "bg-proton-accent animate-ping" : "bg-blue-500/50")} />
              <span className={cn("text-[10px] font-bold uppercase", uiMode === 'operator' ? "font-mono" : "font-sans")}>
                {isLoading ? 'PROC' : 'IDLE'}
              </span>
            </div>
          </div>
          <div className="space-y-1 pl-1">
            <p className="text-[7px] font-mono text-proton-muted uppercase tracking-widest">Network Latency</p>
            <div className="flex items-center gap-1.5">
              <span className={cn("text-[10px] font-bold", uiMode === 'operator' ? "font-mono text-proton-secondary" : "font-sans text-proton-text")}>
                {latency}ms
              </span>
            </div>
          </div>
        </div>

        {/* Bottom: The Pulse Visualizer (Unified UI for both modes) */}
        <div className="h-12 flex items-end justify-around gap-1 px-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ height: "20%" }}
              animate={{ 
                height: isLoading ? [ "40%", "90%", "30%", "100%", "50%" ] : [ "10%", "30%", "15%", "40%", "20%" ]
              }}
              transition={{ 
                duration: isLoading ? 0.3 : 1.2, 
                repeat: Infinity,
                delay: i * 0.05
              }}
              className={cn(
                "w-1.5 rounded-t-[2px] transition-all duration-500",
                uiMode === 'operator' 
                  ? "bg-proton-accent/80 shadow-[0_0_10px_rgba(0,242,255,0.3)]" 
                  : "bg-proton-accent shadow-[0_0_8px_rgba(0,113,227,0.1)]"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ 
  personas, 
  activeView,
  setActiveView,
  chatHistory,
  language = 'en',
  user,
  uiMode,
  aiSettings,
  setLastGeminiMetadata,
  trackFirestore
}: { 
  personas: Persona[], 
  activeView: View, 
  setActiveView: (v: View) => void,
  chatHistory: PersonaHistory,
  language?: 'en' | 'ka',
  user: any,
  uiMode: 'operator' | 'artisan',
  aiSettings: GlobalAiSettings,
  setLastGeminiMetadata: (m: GeminiMetadata | null) => void,
  trackFirestore: <T>(promise: Promise<T>) => Promise<T>
}) => {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [projectText, setProjectText] = useState('');
  const [isComputing, setIsComputing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [operatorTab, setOperatorTab] = useState<'ops' | 'finance'>('ops');
  const t = translations[language].dashboard;
  const common = translations[language].common;

  // Artisan Mode Layout
  if (uiMode === 'artisan') {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 px-4 sm:px-6 lg:px-8">
        {/* Artisan Header */}
        <div className="pt-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-proton-text">
            {t.artisan_title}
          </h1>
          <p className="text-proton-muted text-sm mt-1 font-medium italic">
            Curated Workspace Active
          </p>
        </div>

        {/* Persona Quick Selection (Horizontal Scroll) */}
        <div className="relative group">
          <div className="flex items-center gap-3 overflow-x-auto pb-4 custom-scrollbar no-scrollbar scroll-smooth">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveView('personas')}
                className="flex-shrink-0 flex items-center gap-3 p-3 px-5 rounded-2xl bg-proton-card border border-proton-border artisan-shadow hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span className="text-xl">{p.avatar}</span>
                <div className="text-left">
                  <p className="text-xs font-bold whitespace-nowrap">{language === 'ka' ? p.nameGe : p.name}</p>
                  <p className="text-[10px] text-proton-muted uppercase font-mono">{p.role}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="absolute top-0 right-0 h-full w-20 bg-gradient-to-l from-proton-bg to-transparent pointer-events-none" />
        </div>

        {/* Main Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Architect & Tasks */}
          <div className="lg:col-span-8 space-y-8">
            <div className="proton-glass rounded-[40px] border border-proton-border artisan-shadow overflow-hidden group/architect relative bg-proton-card">
              <SmartTaskArchitect 
                language={language} 
                projectText={projectText}
                setProjectText={setProjectText}
                user={user}
                uiMode={uiMode}
                onLoadingChange={setIsComputing}
                aiSettings={aiSettings}
                setLastGeminiMetadata={setLastGeminiMetadata}
                trackFirestore={trackFirestore}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-proton-text flex items-center gap-2">
                  <LayoutDashboard size={14} className="text-proton-accent" />
                  Active Blueprints
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="p-5 rounded-3xl bg-proton-card border border-proton-border artisan-shadow flex items-center justify-between group cursor-pointer hover:border-proton-accent transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-proton-accent/10 text-proton-accent flex items-center justify-center">
                        <Layers size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Project_Log_{i}</p>
                        <p className="text-[10px] text-proton-muted font-mono uppercase">Version 1.2.4</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-proton-muted group-hover:translate-x-1 transition-transform" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Activity Feed */}
          <div className="lg:col-span-4 space-y-6">
            <div className="proton-glass rounded-[40px] border border-proton-border p-8 artisan-shadow bg-proton-card flex flex-col h-full min-h-[500px]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest flex items-center gap-2 text-proton-text">
                  <Zap size={14} className="text-proton-accent" />
                  Activity Log
                </h3>
                <div className="w-2 h-2 rounded-full bg-proton-accent animate-pulse" />
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                {Object.entries(chatHistory).length > 0 ? (
                  Object.entries(chatHistory).flatMap(([personaId, msgs]) => 
                    msgs.slice(-2).map((m, i) => (
                      <div key={`${personaId}-${i}`} className="p-4 rounded-2xl bg-proton-bg/50 border border-proton-border hover:border-proton-accent/30 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono text-proton-accent uppercase font-bold">{personas.find(p => p.id === personaId)?.name || 'System'}</span>
                          <span className="text-[8px] font-mono text-proton-muted font-bold">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-proton-muted leading-relaxed font-medium group-hover:text-proton-text transition-colors italic">"{m.content}"</p>
                      </div>
                    ))
                  )
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <Shield size={40} className="mb-4 text-proton-muted opacity-30" />
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-proton-muted">No recent neural activity</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-8 border-t border-proton-border">
                <button 
                  onClick={() => setActiveView('organizer')}
                  className="w-full py-4 rounded-2xl bg-proton-bg border border-proton-border hover:bg-proton-accent hover:text-white transition-all text-xs font-bold uppercase tracking-widest text-proton-text active:scale-95"
                >
                  Open Task Hub
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Operator Mode Layout (Existing with Toggle)
  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-8 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Operator Header & Top Nav */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tighter transition-all duration-500 font-mono text-proton-accent uppercase text-proton-text">
            {t.title}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <p className="text-proton-muted text-[10px] md:text-xs font-mono uppercase tracking-[0.2em]">
              Neural Command Node [Active]
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:bg-transparent lg:p-0 sticky top-0 z-40 bg-proton-bg/80 backdrop-blur-md p-2 md:relative md:top-auto md:z-auto w-full md:w-auto">
          <div className="flex p-1 bg-proton-card/50 border border-proton-border rounded-xl backdrop-blur-md shadow-lg shadow-proton-bg/20 w-full md:w-auto">
            {[
              { id: 'ops', label: 'Operations' },
              { id: 'finance', label: 'Financials' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setOperatorTab(tab.id as any)}
                className={cn(
                  "flex-1 md:flex-none px-4 md:px-6 py-2.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest transition-all duration-300 active:scale-95",
                  operatorTab === tab.id 
                    ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" 
                    : "text-proton-muted hover:text-proton-text"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-proton-border hidden sm:block mx-2" />

          <button 
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={cn(
              "px-4 py-2 rounded-xl flex items-center gap-3 transition-all border font-mono text-[10px] uppercase tracking-widest",
              showDiagnostics ? "bg-proton-accent/20 border-proton-accent text-proton-accent shadow-[inset_0_0_10px_rgba(0,242,255,0.1)]" : "bg-proton-card border-proton-border text-proton-muted hover:border-proton-accent/30"
            )}
          >
            <Activity size={14} className={cn(showDiagnostics && "animate-pulse")} />
            Monitor {showDiagnostics ? '[ON]' : '[OFF]'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {operatorTab === 'ops' ? (
          <motion.div 
            key="ops"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Operator Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t.compute, value: '1.2 PFL', icon: Cpu, color: 'text-proton-accent' },
                { label: t.latency, value: '0.4ms', icon: Zap, color: 'text-proton-secondary' },
                { label: t.uptime, value: '99.9%', icon: ShieldCheck, color: 'text-green-400' },
                { label: 'Nodes', value: '32 Active', icon: Network, color: 'text-proton-accent' },
              ].map((stat, i) => (
                <div key={i} className="proton-glass p-4 rounded-2xl border border-proton-border/30 hover:border-proton-accent/20 transition-all flex flex-col gap-1 group">
                  <div className="flex items-center justify-between opacity-60">
                    <span className="text-[8px] font-mono uppercase tracking-[0.2em]">{stat.label}</span>
                    <stat.icon size={12} className={cn("transition-transform group-hover:scale-110", stat.color)} />
                  </div>
                  <p className="font-mono font-bold text-sm tracking-tight text-proton-text">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Command Console */}
              <div className="md:col-span-12 lg:col-span-8 space-y-6 w-full">
                <div className="proton-glass rounded-[40px] border border-proton-border shadow-2xl overflow-hidden relative group/architect">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-proton-accent to-transparent opacity-30 animate-pulse" />
                  <SmartTaskArchitect 
                    language={language} 
                    projectText={projectText}
                    setProjectText={setProjectText}
                    user={user}
                    uiMode={uiMode}
                    onLoadingChange={setIsComputing}
                    aiSettings={aiSettings}
                    setLastGeminiMetadata={setLastGeminiMetadata}
                    trackFirestore={trackFirestore}
                  />
                </div>

                <div className="p-2 proton-glass rounded-[30px] border border-proton-border/30 bg-proton-card/20 backdrop-blur-md shadow-lg transition-transform hover:scale-[1.01] duration-500">
                  <NeuralPulse 
                    language={language} 
                    onSelect={(topic) => {
                      setProjectText(topic);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} 
                  />
                </div>
              </div>

              {/* Sidebar: Telemetry & Activity Log */}
              <div className="md:col-span-12 lg:col-span-4 space-y-6 lg:sticky lg:top-6 w-full">
                <div className={cn(
                  "proton-glass rounded-[30px] border border-proton-border/50 p-6 shadow-xl transition-all duration-700",
                  showDiagnostics ? "opacity-100" : "opacity-40 hover:opacity-100 scale-[0.98] blur-[1px] hover:blur-0 hover:scale-100"
                )}>
                  <div className="flex items-center justify-between mb-4 border-b border-proton-border/30 pb-4">
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 text-proton-text">
                      <Activity size={14} className="text-proton-accent animate-pulse" />
                      Infrastructure
                    </h3>
                  </div>
                  <ClusterTelemetry 
                    isLoading={isComputing} 
                    uiMode={uiMode} 
                    language={language} 
                  />
                </div>

                <div className="proton-glass rounded-[30px] border border-proton-border/50 p-6 flex flex-col h-full shadow-xl max-h-[440px] bg-gradient-to-b from-proton-card/30 to-transparent">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 text-proton-text">
                      <Zap size={14} className="text-proton-accent" />
                      Neural Activity
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {Object.entries(chatHistory).length > 0 ? (
                      Object.entries(chatHistory).flatMap(([personaId, msgs]) => 
                        msgs.slice(-2).map((m, i) => (
                          <div key={`${personaId}-${i}`} className="p-3 rounded-2xl border transition-all duration-300 bg-proton-card/40 border-proton-border/30 hover:border-proton-accent/40 group">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-mono text-proton-accent uppercase font-black">{personas.find(p => p.id === personaId)?.name || 'System'}</span>
                              <span className="text-[8px] font-mono text-proton-muted opacity-50">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-[11px] text-proton-muted line-clamp-3 leading-relaxed italic group-hover:text-proton-text transition-colors">"{m.content}"</p>
                          </div>
                        ))
                      )
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-30">
                        <Shield size={32} className="mb-4" />
                        <p className="text-[10px] font-mono uppercase tracking-[0.2em]">Neural Silence</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-proton-border/50">
                    <button 
                      onClick={() => setActiveView('organizer')}
                      className="w-full py-3 rounded-2xl border border-proton-border hover:bg-proton-accent text-proton-bg transition-all text-[10px] font-mono font-bold uppercase tracking-widest active:scale-95 shadow-lg shadow-proton-bg/20"
                    >
                      Open Task Hub
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="finance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Operator Financial Section (Modular) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                 <div className="proton-glass rounded-[40px] border border-proton-border p-8 shadow-2xl space-y-8 relative overflow-hidden bg-gradient-to-br from-proton-card/50 to-transparent">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                     <div className="flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-proton-accent/10 border border-proton-accent/20 text-proton-accent flex items-center justify-center shadow-inner">
                         <Wallet size={28} />
                       </div>
                       <div>
                         <h2 className="text-2xl font-black tracking-tight uppercase font-mono text-proton-text">Operations Fund</h2>
                         <p className="text-[10px] font-mono text-proton-muted uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                           Settlements Connected
                         </p>
                       </div>
                     </div>
                     <ConnectButton />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="p-8 rounded-[2.5rem] bg-proton-bg/80 border border-proton-border shadow-inner group hover:border-proton-accent/40 transition-all duration-500 flex flex-col justify-center">
                       <p className="text-[10px] font-mono text-proton-muted uppercase tracking-widest mb-3">Total Liquidity</p>
                       <div className="flex items-baseline gap-2">
                         <span className="text-3xl font-bold font-mono tracking-tighter text-proton-text">
                           {isConnected && balance ? parseFloat(balance.formatted).toFixed(4) : '0.000'}
                         </span>
                         <span className="text-proton-accent font-bold text-lg">{balance?.symbol || 'ETH'}</span>
                       </div>
                       <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-proton-accent mt-4 border-t border-proton-border/30 pt-4">
                          <span className="opacity-70">≈ ₾ {(parseFloat(balance?.formatted || '0') * 2650 * 2.7).toLocaleString()}</span>
                          <span className="opacity-70">≈ $ {(parseFloat(balance?.formatted || '0') * 2650).toLocaleString()}</span>
                       </div>
                     </div>
                     
                     <div className="p-8 rounded-[2.5rem] bg-proton-card/50 border border-proton-border space-y-6 flex flex-col justify-center">
                       <p className="text-[10px] font-mono text-proton-muted uppercase tracking-widest border-l-2 border-proton-accent pl-3">Sovereign Actions</p>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <button className="py-4 rounded-2xl bg-proton-accent text-proton-bg font-black text-[10px] uppercase tracking-widest hover:brightness-110 hover:shadow-lg shadow-proton-accent/20 active:scale-95 transition-all">Deposit</button>
                         <button className="py-4 rounded-2xl border border-proton-border text-proton-text font-black text-[10px] uppercase tracking-widest hover:bg-proton-card transition-all active:scale-95">Withdraw</button>
                       </div>
                     </div>
                   </div>
                 </div>

                 <div className="proton-glass rounded-[40px] border border-proton-border p-8 shadow-xl bg-proton-card/10">
                   <h3 className="text-sm font-mono font-bold uppercase tracking-widest mb-8 flex items-center gap-2 text-proton-text">
                     <Receipt size={16} className="text-proton-accent" />
                     Recent Settlements
                   </h3>
                   <div className="space-y-3">
                     {[1, 2, 3].map(i => (
                       <div key={i} className="flex items-center justify-between p-5 rounded-3xl bg-proton-bg/40 border border-proton-border/50 hover:bg-proton-bg/60 transition-all group">
                         <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-proton-accent/5 border border-proton-accent/10 flex items-center justify-center text-proton-accent group-hover:scale-110 transition-transform">
                             <Zap size={14} />
                           </div>
                           <div>
                             <p className="text-xs font-bold font-mono text-proton-text">SETTLE_TX_{10920 + i}</p>
                             <p className="text-[10px] text-proton-muted uppercase tracking-tighter">Automatic Revenue Share</p>
                           </div>
                         </div>
                         <div className="text-right">
                           <p className="text-xs font-black font-mono text-proton-accent">+ 0.0{i}22 ETH</p>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
              </div>

              <div className="space-y-6">
                <div className="proton-glass rounded-[30px] border border-proton-border p-6 shadow-xl space-y-6 bg-gradient-to-br from-proton-card to-transparent">
                   <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest border-b border-proton-border/30 pb-4 text-proton-text">Node Economics</h3>
                   <div className="space-y-5">
                     {[
                       { label: 'Ethereum (ETH)', val: '$ 2,650.42', trend: '+1.4%' },
                       { label: 'Network Gas', val: '24.1 Gwei', trend: '-2.3%' },
                       { label: 'Compute ROI', val: '12.4% APR', trend: '+0.5%' },
                     ].map((idx, i) => (
                       <div key={i} className="flex items-center justify-between group">
                         <span className="text-[10px] font-medium text-proton-muted group-hover:text-proton-text transition-colors">{idx.label}</span>
                         <div className="text-right font-mono">
                           <p className="text-[11px] font-black text-proton-text">{idx.val}</p>
                           <p className={cn("text-[8px] font-bold", idx.trend.startsWith('+') ? "text-green-400" : "text-proton-secondary")}>{idx.trend}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                   <button 
                     onClick={() => setActiveView('finance')}
                     className="w-full py-4 rounded-2xl bg-proton-accent/10 border border-proton-accent/30 text-proton-accent text-[10px] font-bold uppercase tracking-widest hover:bg-proton-accent hover:text-proton-bg transition-all active:scale-95 shadow-lg shadow-proton-accent/5"
                   >
                     Full Ledger
                   </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="space-y-4 pt-4 border-t border-proton-border/30">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-2 text-proton-text">
            <Users size={16} className="text-proton-accent" />
            Neural Specializations
          </h2>
          <button 
            onClick={() => setActiveView('personas')}
            className="text-[10px] font-mono text-proton-accent hover:underline flex items-center gap-1 group"
          >
            View All <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {personas.slice(0, 6).map((p) => (
            <div 
              key={p.id}
              onClick={() => setActiveView('personas')}
              className="group proton-glass p-4 rounded-3xl hover:border-proton-accent/50 transition-all cursor-pointer relative overflow-hidden flex flex-col items-center text-center gap-3 bg-gradient-to-b from-proton-card/50 to-transparent"
            >
              <div className="text-2xl bg-proton-card w-12 h-12 rounded-2xl flex items-center justify-center border border-proton-border group-hover:rotate-12 group-hover:scale-110 transition-transform shadow-xl">
                {p.avatar}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[10px] truncate max-w-full text-proton-text">{language === 'ka' ? p.nameGe : p.name}</h3>
                <p className="text-[8px] font-mono text-proton-muted uppercase truncate leading-none mt-1 tracking-tighter">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ComputeView = ({ 
  metadata, 
  aiSettings, 
  setAiSettings, 
  isFirestoreActive,
  uiMode
}: { 
  metadata: GeminiMetadata | null, 
  aiSettings: GlobalAiSettings, 
  setAiSettings: Dispatch<SetStateAction<GlobalAiSettings>>,
  isFirestoreActive: boolean,
  uiMode: 'operator' | 'artisan'
}) => {
  const [provisioning, setProvisioning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'provisioning' | 'active'>('active');

  // Resource Data: map to actual resource load (linked to temperature and usage)
  const resourceData = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    time: i,
    gpu: aiSettings.temperature * 100 + (Math.random() * 10),
    cpu: (metadata?.totalTokenCount ? Math.min(100, metadata.totalTokenCount / 10) : 10) + Math.random() * 5,
  })), [aiSettings.temperature, metadata]);

  const stats = [
    { 
      label: 'Compute Power', 
      value: metadata ? `${metadata.totalTokenCount} TOK` : '0 TOK', 
      subValue: metadata ? `${metadata.promptTokenCount}p / ${metadata.candidatesTokenCount}c` : '--',
      icon: Cpu 
    },
    { 
      label: 'Active GPU Nodes', 
      value: metadata ? '32' : '0', 
      subValue: metadata ? 'CONNECTED' : 'STANDBY',
      icon: Activity 
    },
    { 
      label: 'Network Throughput', 
      value: isFirestoreActive ? `${(Math.random() * 5 + 10).toFixed(1)} Gbps` : '0.1 Gbps', 
      subValue: isFirestoreActive ? 'SYNCING' : 'IDLE',
      icon: Network 
    },
    { 
      label: 'Cluster Latency', 
      value: metadata ? `${metadata.latency}ms` : '--', 
      subValue: metadata ? 'REAL-TIME' : 'N/A',
      icon: Zap 
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">System Infrastructure</h2>
          <p className="text-proton-muted text-xs sm:text-sm mt-1">Real-time compute cluster diagnostics and management</p>
        </div>
        <div className={cn(
          "px-4 py-2 rounded-full text-xs font-mono border flex items-center gap-2",
          status === 'active' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-proton-card text-proton-muted border-proton-border"
        )}>
          <div className={cn("w-2 h-2 rounded-full", status === 'active' ? "bg-green-400 animate-pulse" : "bg-proton-muted")} />
          {status === 'idle' ? 'SYSTEM IDLE' : status === 'provisioning' ? 'PROVISIONING...' : 'CLUSTER ACTIVE'}
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="proton-glass p-6 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-proton-muted text-[10px] uppercase font-mono tracking-widest">{stat.label}</span>
              <stat.icon size={16} className="text-proton-accent" />
            </div>
            <p className="text-2xl font-bold font-mono">{stat.value}</p>
            <p className="text-[10px] font-mono text-proton-muted uppercase tracking-tighter">{stat.subValue}</p>
          </div>
        ))}
      </div>

      {/* Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 proton-glass p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold flex items-center gap-2">Resource Load Overview</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-proton-accent" />
                <span className="text-[10px] font-mono text-proton-muted uppercase">LOAD (TEMP)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-[10px] font-mono text-proton-muted uppercase">TRAFFIC (TOKENS)</span>
              </div>
            </div>
          </div>
          <div className="h-full w-full relative min-h-[256px] overflow-hidden">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <AreaChart data={resourceData}>
                <defs>
                  <linearGradient id="colorGpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-proton-accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-proton-accent)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-proton-secondary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-proton-secondary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-proton-border)" />
                <XAxis dataKey="time" hide />
                <YAxis stroke="var(--color-proton-muted)" fontSize={10} />
                <Tooltip contentStyle={{ 
                  backgroundColor: 'var(--color-proton-card)', 
                  border: '1px solid var(--color-proton-border)', 
                  fontSize: '12px',
                  borderRadius: '12px',
                  color: 'var(--color-proton-text)'
                }} />
                <Area type="monotone" dataKey="gpu" stroke="var(--color-proton-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorGpu)" />
                <Area type="monotone" dataKey="cpu" stroke="var(--color-proton-secondary)" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Provisioning/Cluster Control -> Now Interactive Temperature Slider */}
        <div className="proton-glass p-6 rounded-2xl flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h4 className="font-bold">Model Temperature</h4>
            <Sparkles size={16} className="text-proton-accent" />
          </div>
          <div className="flex-1 flex flex-col justify-center gap-8">
             <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-proton-muted uppercase tracking-widest block">COMPUTE LOAD</span>
                      <p className="text-sm font-bold">{aiSettings.temperature < 0.4 ? 'CONCISE / STRICT' : aiSettings.temperature > 0.7 ? 'CREATIVE / VERBOSE' : 'BALANCED'}</p>
                    </div>
                    <span className="text-2xl font-mono font-bold text-proton-accent">{(aiSettings.temperature * 100).toFixed(0)}%</span>
                </div>
                <div className="relative pt-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1" 
                      value={aiSettings.temperature}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full h-1 bg-proton-border rounded-lg appearance-none cursor-pointer accent-proton-accent"
                    />
                    <div className="flex justify-between mt-2 text-[8px] font-mono text-proton-muted uppercase tracking-widest">
                      <span>Strict</span>
                      <span>Balanced</span>
                      <span>Creative</span>
                    </div>
                </div>
             </div>
             
             <div className="p-4 rounded-xl bg-proton-accent/5 border border-proton-accent/10">
               <p className="text-[10px] leading-relaxed text-proton-muted">
                 Adjusting temperature directly modifies the underlying <span className="text-proton-accent">Gemini Core</span> provisioning. 
                 Higher percentages yield more diverse and complex outputs at the cost of strict instruction following.
               </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PREDEFINED_AVATARS = ["🏺", "⛓️", "📈", "🤖", "🧠", "💎", "🎨", "🚀", "⚡", "🌈", "🦁", "🏔️", "🍷", "⚔️"];

const PersonasView = ({ 
  history, 
  onNewMessage,
  customAvatars,
  onUpdateAvatar,
  personas,
  onUpdatePersonas,
  aiSettings,
  setLastGeminiMetadata,
  workflows,
  tasks,
  uiMode
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
  uiMode: 'operator' | 'artisan'
}) => {
  const handleTTS = async (text: string) => {
    try {
      const base64Audio = await generateSpeech(text, aiSettings.voice);
      const binary = atob(base64Audio);
      const dataSize = binary.length;
      
      // Create WAV header
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
  };

  const [selectedPersona, setSelectedPersona] = useState<Persona>(personas[0] || PERSONAS[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [languageFilter, setLanguageFilter] = useState<string>('All');
  const [showGeorgian, setShowGeorgian] = useState<Record<string, boolean>>({});
  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null);
  const [editingInstructionsId, setEditingInstructionsId] = useState<string | null>(null);
  const [tempInstructions, setTempInstructions] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showPersonaEditor, setShowPersonaEditor] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | undefined>(undefined);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [favoritePersonaIds, setFavoritePersonaIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('proton_favorite_personas');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('proton_favorite_personas', JSON.stringify(favoritePersonaIds));
  }, [favoritePersonaIds]);

  const filteredPersonas = useMemo(() => {
    const list = personas.filter(p => 
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       p.role.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (roleFilter === 'All' || p.role === roleFilter) &&
      (languageFilter === 'All' || p.language === languageFilter)
    );
    return list.sort((a, b) => {
      const aFav = favoritePersonaIds.includes(a.id);
      const bFav = favoritePersonaIds.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });
  }, [personas, searchQuery, roleFilter, languageFilter, favoritePersonaIds]);

  const messages = history[selectedPersona.id] || [];
  const currentAvatar = customAvatars[selectedPersona.id] || selectedPersona.avatar;

  useEffect(() => {
    if (!personas.find(p => p.id === selectedPersona.id)) {
      setSelectedPersona(personas[0] || PERSONAS[0]);
    }
  }, [personas]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const timestamp = Date.now();
    setInput('');
    
    onNewMessage(selectedPersona.id, { role: 'user', content: userMessage, timestamp });
    setLoading(true);

    const apiHistory = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    // Choose model based on query complexity/need
    let model = "gemini-3-flash-preview";
    if (userMessage.toLowerCase().includes("complex") || userMessage.toLowerCase().includes("code")) {
      model = "gemini-3.1-pro-preview";
    } else if (userMessage.length < 50) {
      model = "gemini-3.1-flash-lite-preview";
    }
    
    // Apply grounding settings from AI configuration
    const includeSearch = aiSettings.enableSearch;
    const includeMaps = aiSettings.enableMaps || (userMessage.toLowerCase().includes("location") || userMessage.toLowerCase().includes("maps"));

    // Inject User Context as Global Instruction
    const userContext = `
      CURRENT USER DATA CONTEXT:
      - Workflows: ${workflows.map(w => `${w.name} (Trigger: ${w.trigger}, Action: ${w.action})`).join('; ')}
      - Current Tasks: ${tasks.map(t => `${t.content} (Status: ${t.completed ? 'Done' : 'Pending'})`).join('; ')}
      
      PERSONALIZATION RULES:
      - Always prioritize the user's existing business workflows and tasks when giving advice.
      - If you are 'Artisan Guide', use the specific tasks and workflows to give localized, relevant advice for their Georgian business.
      - Reference the user's specific progress from their history.
    `;

    const { text, metadata } = await chatWithPersona(
      selectedPersona, 
      userMessage, 
      apiHistory, 
      model, 
      includeMaps, 
      includeSearch, 
      aiSettings.temperature, 
      (aiSettings.systemInstruction || "") + userContext
    );
    setLastGeminiMetadata(metadata);
    onNewMessage(selectedPersona.id, { role: 'model', content: text, timestamp: Date.now() });
    setLoading(false);
  };

  const handleSavePersona = (persona: Persona) => {
    const exists = personas.find(p => p.id === persona.id);
    if (exists) {
      onUpdatePersonas(personas.map(p => p.id === persona.id ? persona : p));
    } else {
      onUpdatePersonas([...personas, persona]);
    }
    setShowPersonaEditor(false);
    setSelectedPersona(persona);
  };

  const handleDeletePersona = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (personas.length <= 1) return;
    onUpdatePersonas(personas.filter(p => p.id !== id));
  };

  const handleGenerateAI = async () => {
    setGeneratingAvatar(true);
    try {
      const newAvatar = await generatePersonaAvatar(selectedPersona);
      onUpdateAvatar(selectedPersona.id, newAvatar);
    } catch (error) {
      console.error(error);
    } finally {
      setGeneratingAvatar(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full gap-0 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Persona Selector */}
      <div className={cn(
        "w-full md:w-80 flex-col gap-4 shrink-0 h-full",
        mobileView === 'chat' ? "hidden md:flex" : "flex"
      )}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={20} className="text-proton-accent" />
            Digital Personas
          </h2>
          <button 
            onClick={() => {
              setEditingPersona(undefined);
              setShowPersonaEditor(true);
            }}
            className="p-1.5 rounded-lg bg-proton-accent/10 text-proton-accent hover:bg-proton-accent/20 transition-all"
            title="Create Persona"
          >
            <Plus size={18} />
          </button>
        </div>
        <input
          type="text"
          placeholder="Search personas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-proton-card border border-proton-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-proton-accent transition-colors"
        />
        <div className="flex gap-2">
          <select 
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 bg-proton-card border border-proton-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-proton-accent transition-colors"
          >
            <option value="All">All Roles</option>
            {Array.from(new Set(personas.map(p => p.role))).map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <select 
            value={languageFilter} 
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="flex-1 bg-proton-card border border-proton-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-proton-accent transition-colors"
          >
            <option value="All">All Languages</option>
            {['English', 'Georgian', 'Mixed'].map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar pb-4">
          {filteredPersonas.map(persona => (
            <div
              key={persona.id}
              className={cn(
                "rounded-2xl transition-all border overflow-hidden group/card",
                selectedPersona.id === persona.id 
                  ? "bg-proton-accent/10 border-proton-accent/30 proton-glow" 
                  : "bg-proton-card border-proton-border hover:border-proton-muted/30"
              )}
            >
              <div className="relative">
              <div
                  onClick={() => {
                    setSelectedPersona(persona);
                    setMobileView('chat');
                  }}
                  className="w-full text-left p-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <PersonaAvatar avatar={customAvatars[persona.id] || persona.avatar} className="w-10 h-10" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm">{showGeorgian[persona.id] ? persona.nameGe : persona.name}</p>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setFavoritePersonaIds(prev => 
                                prev.includes(persona.id) ? prev.filter(id => id !== persona.id) : [...prev, persona.id]
                              );
                            }}
                            className={cn("p-1 rounded-full transition-colors", favoritePersonaIds.includes(persona.id) ? "text-proton-secondary" : "text-proton-muted hover:text-proton-secondary")}
                          >
                            <Heart size={14} fill={favoritePersonaIds.includes(persona.id) ? "currentColor" : "none"} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowGeorgian(prev => ({ ...prev, [persona.id]: !prev[persona.id] }));
                            }}
                            className="text-[10px] font-mono bg-proton-accent/10 text-proton-accent px-2 py-0.5 rounded hover:bg-proton-accent/20 transition-colors"
                          >
                            {showGeorgian[persona.id] ? 'EN' : 'GE'}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-proton-muted uppercase tracking-wider">{persona.role}</p>
                    </div>
                    <ChevronRight 
                      size={16} 
                      className={cn("text-proton-muted transition-transform", selectedPersona.id === persona.id ? "rotate-90 text-proton-accent" : "")} 
                    />
                  </div>
                  <p className="text-xs text-proton-muted mt-3 line-clamp-2 leading-relaxed">
                    {showGeorgian[persona.id] ? persona.descriptionGe : persona.description}
                  </p>
                </div>

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPersona(persona);
                      setShowPersonaEditor(true);
                    }}
                    className="p-1.5 rounded-md bg-proton-bg/80 text-proton-muted hover:text-proton-accent transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    onClick={(e) => handleDeletePersona(persona.id, e)}
                    className="p-1.5 rounded-md bg-proton-bg/80 text-proton-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              
              <div className="px-4 pb-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedPersonaId(expandedPersonaId === persona.id ? null : persona.id);
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-mono text-proton-accent uppercase tracking-widest hover:opacity-80 transition-opacity"
                >
                  <ChevronDown size={12} className={cn("transition-transform", expandedPersonaId === persona.id ? "rotate-180" : "")} />
                  {expandedPersonaId === persona.id ? "Hide Directives" : "View Directives"}
                </button>
                
                <AnimatePresence>
                  {expandedPersonaId === persona.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-proton-muted uppercase tracking-widest px-1">Directives (The 'Brain')</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editingInstructionsId === persona.id) {
                                // Save
                                onUpdatePersonas(personas.map(p => p.id === persona.id ? { ...p, systemInstruction: tempInstructions } : p));
                                setEditingInstructionsId(null);
                              } else {
                                // Start editing
                                setEditingInstructionsId(persona.id);
                                setTempInstructions(persona.systemInstruction);
                              }
                            }}
                            className="text-[10px] font-mono text-proton-accent uppercase hover:underline transition-all"
                          >
                            {editingInstructionsId === persona.id ? "Apply Changes" : "Modify Core"}
                          </button>
                        </div>
                        
                        {editingInstructionsId === persona.id ? (
                          <textarea
                            value={tempInstructions}
                            onChange={(e) => setTempInstructions(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-proton-bg border border-proton-accent/30 rounded-xl p-3 text-[11px] leading-relaxed text-proton-text font-mono h-32 focus:outline-none focus:border-proton-accent transition-all custom-scrollbar"
                            autoFocus
                          />
                        ) : (
                          <div className="p-3 rounded-xl bg-proton-bg/50 border border-proton-border/50 text-[11px] leading-relaxed text-proton-muted font-mono whitespace-pre-wrap">
                            {persona.systemInstruction}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Interface */}
      <div className={cn(
        "flex-1 flex-col proton-glass rounded-3xl overflow-hidden h-full w-full",
        mobileView === 'list' ? "hidden md:flex" : "flex"
      )}>
        {/* Chat Header */}
        <div className="p-4 border-b border-proton-border flex items-center justify-between bg-proton-bg/30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileView('list')}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-lg text-proton-muted hover:bg-proton-card transition-colors"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div className="relative group">
              <PersonaAvatar avatar={currentAvatar} className="w-10 h-10 ring-2 ring-proton-accent/20" />
              <button 
                onClick={() => setShowAvatarPicker(true)}
                className="absolute -bottom-1 -right-1 p-1 bg-proton-accent text-proton-bg rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <Edit2 size={10} />
              </button>
            </div>
            <div>
              <p className="font-bold text-sm">{selectedPersona.name}</p>
              <div className="text-[10px] text-green-400 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                ONLINE
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAvatarPicker(true)}
              className="p-2 rounded-lg hover:bg-proton-bg transition-colors text-proton-muted flex items-center gap-2 text-xs font-mono"
            >
              <Sparkles size={16} className="text-proton-accent" />
              <span className="hidden sm:inline">CUSTOMIZE</span>
            </button>
            <div className="h-4 w-px bg-proton-border mx-1" />
            <button className="p-2 rounded-lg hover:bg-proton-bg transition-colors text-proton-muted">
              <ShieldCheck size={18} />
            </button>
            <button 
              onClick={async () => {
                const historyToSummarize = (history[selectedPersona.id] || []).map(m => ({
                  role: m.role,
                  parts: [{ text: m.content }]
                }));
                const summary = await summarizeConversation(historyToSummarize);
                alert(summary);
              }}
              className="p-2 rounded-lg hover:bg-proton-bg transition-colors text-proton-muted"
              title="Summarize Conversation"
            >
              <Database size={18} />
            </button>
            <button className="p-2 rounded-lg hover:bg-proton-bg transition-colors text-proton-muted">
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Avatar Picker Modal */}
        <AnimatePresence>
          {showAvatarPicker && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-proton-bg/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="proton-glass p-4 sm:p-8 rounded-3xl max-w-md w-full space-y-4 sm:space-y-6 shadow-2xl border-proton-border/80"
              >
                <div className="flex justify-between items-center bg-transparent pb-4 border-b border-proton-border/50">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="text-proton-accent" size={20} />
                    Customize Avatar
                  </h3>
                  <button onClick={() => setShowAvatarPicker(false)} className="p-2 rounded-full hover:bg-proton-bg transition-all text-proton-muted hover:text-proton-text">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6 pt-2">
                  <div className="space-y-3">
                    <p className="text-[10px] text-proton-muted uppercase tracking-[0.2em] font-mono font-bold">Predefined Identities</p>
                    <div className="grid grid-cols-7 gap-2 pb-2">
                      {PREDEFINED_AVATARS.map(av => (
                        <button
                          key={av}
                          onClick={() => {
                            onUpdateAvatar(selectedPersona.id, av);
                            setShowAvatarPicker(false);
                          }}
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all border overflow-hidden",
                            currentAvatar === av 
                              ? "bg-proton-accent/10 border-proton-accent/30 scale-110 shadow-[0_0_15px_rgba(0,242,255,0.2)]" 
                              : "bg-proton-bg border-proton-border hover:border-proton-muted/50"
                          )}
                        >
                          <PersonaAvatar avatar={av} className="w-full h-full text-xl" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-proton-bg/50 border border-proton-border group/upload hover:border-proton-accent/30 transition-all">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-proton-card flex items-center justify-center text-proton-muted group-hover/upload:text-proton-accent transition-colors">
                          <Image size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-proton-text uppercase tracking-widest">Local Data</p>
                          <p className="text-[10px] text-proton-muted">Upload custom image</p>
                        </div>
                        <label className="w-full py-2 rounded-lg bg-proton-card text-proton-text hover:bg-proton-border cursor-pointer transition-all border border-proton-border text-[10px] font-bold uppercase tracking-widest">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  onUpdateAvatar(selectedPersona.id, reader.result as string);
                                  setShowAvatarPicker(false);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          Select File
                        </label>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-proton-accent/5 border border-proton-accent/10 group/ai hover:border-proton-accent/30 transition-all">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl bg-proton-accent/10 flex items-center justify-center text-proton-accent",
                          generatingAvatar && "animate-pulse"
                        )}>
                          <Sparkles size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-proton-accent uppercase tracking-widest">Neural Projection</p>
                          <p className="text-[10px] text-proton-muted">AI generated avatar</p>
                        </div>
                        <button 
                          onClick={handleGenerateAI}
                          disabled={generatingAvatar}
                          className="w-full py-2 rounded-lg bg-proton-accent text-proton-bg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(0,242,255,0.2)]"
                        >
                          {generatingAvatar ? "Generating..." : "Generate AI"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {generatingAvatar && (
                    <div className="space-y-2 py-2">
                      <div className="h-1 bg-proton-border rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-proton-accent"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        />
                      </div>
                      <p className="text-[10px] text-proton-muted text-center animate-pulse font-mono font-bold tracking-widest">SYNTHESIZING VISUAL CONTEXT...</p>
                    </div>
                  )}

                  <button 
                    onClick={() => setShowAvatarPicker(false)}
                    className="w-full py-3 rounded-xl border border-proton-border font-bold text-sm hover:bg-proton-card transition-all mt-2"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPersonaEditor && (
            <PersonaEditor 
              persona={editingPersona}
              onSave={handleSavePersona}
              onClose={() => setShowPersonaEditor(false)}
            />
          )}
        </AnimatePresence>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 proton-grid">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
              <div className="w-16 h-16 rounded-full bg-proton-accent/10 flex items-center justify-center text-proton-accent">
                <MessageSquare size={32} />
              </div>
              <div>
                <p className="font-bold">Start a conversation with {selectedPersona.nameGe}</p>
                <p className="text-sm">Ask about business, Web3, or automation in Georgia.</p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex flex-col max-w-[85%]",
                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-proton-accent text-proton-bg font-medium rounded-tr-none" 
                  : cn("bg-proton-card border border-proton-border rounded-tl-none prose prose-sm max-w-none", uiMode === 'operator' && "prose-invert")
              )}>
                {msg.role === 'model' ? (
                  <div className="space-y-2">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    <button 
                      onClick={() => handleTTS(msg.content)}
                      className="text-proton-muted hover:text-proton-accent transition-colors"
                    >
                      <Volume2 size={16} />
                       <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Listen</span>
                    </button>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              <span className="text-[10px] text-proton-muted mt-1 uppercase font-mono">
                {msg.role === 'user' ? 'You' : selectedPersona.name}
              </span>
            </motion.div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-proton-muted">
              <Loader2 className="animate-spin" size={14} />
              <span className="text-[10px] font-mono uppercase tracking-widest">Proton Core AI Thinking...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-proton-bg/50 border-t border-proton-border">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Message ${selectedPersona.nameGe}...`}
              className="w-full bg-proton-bg border border-proton-border rounded-2xl py-4 pl-6 pr-16 focus:outline-none focus:border-proton-accent transition-colors text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-proton-accent text-proton-bg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-[10px] text-proton-muted text-center mt-3 uppercase tracking-widest">
            Powered by Proton Core AI Infrastructure • Tbilisi, Georgia
          </p>
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
        <div className="max-w-md mx-auto w-full space-y-8 text-center py-20 px-6 proton-glass rounded-[40px] border border-proton-border relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 via-transparent to-proton-secondary/5 pointer-events-none" />
          
          <div className="relative z-10 space-y-6">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-proton-card border border-proton-border flex items-center justify-center text-proton-muted shadow-2xl">
              <Wallet size={40} className="opacity-20" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs font-mono text-red-400 uppercase tracking-widest">Status: Disconnected</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Enterprise Web3 Node</h2>
              <p className="text-sm text-proton-muted leading-relaxed">
                Connect your secure hardware or browser wallet to access the Proton Core AI compute settlement layer.
              </p>
            </div>

            <div className="pt-4 flex justify-center">
              <ConnectButton label="Connect Wallet" />
            </div>

            <p className="text-[10px] text-proton-muted/40 font-mono uppercase tracking-[0.2em] pt-8">
              Secured by Proton Infrastructure
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
            <div className="flex items-center gap-3 bg-proton-card/50 p-1.5 pl-4 rounded-2xl border border-proton-border backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-mono text-green-400 uppercase tracking-[0.2em] font-bold">Node Online</span>
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




const ImageView = ({ uiMode }: { uiMode: 'operator' | 'artisan' }) => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
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
            placeholder="Describe the image you want to create or edit..."
            className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all h-32 md:h-48 text-sm resize-none focus:ring-1 focus:ring-proton-accent/30"
          />
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-proton-accent to-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-proton-accent/20"
          >
            {loading ? (
                <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating your masterpiece...
                </>
            ) : (
                <>
                    <Zap size={18} />
                    Generate Image
                </>
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
               <p className="text-proton-muted text-xs uppercase tracking-widest font-mono">ID: {formData.id.slice(-6)}</p>
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
  uiMode
}: {
  workflows: Workflow[],
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>,
  personas: Persona[],
  user: any,
  uiMode: 'operator' | 'artisan'
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
          onClick={() => setConfirmation({
            message: "გსურთ ახალი ვორქფლოუს შექმნა?",
            action: createWorkflow
          })}
          className="px-5 py-3 rounded-2xl bg-proton-accent text-proton-bg font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-proton-accent/20"
        >
          <Plus size={20} />
          Add Workflow
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
                        setConfirmation({
                          message: "გსურთ ვორქფლოუს ეფექტურობის ანალიზი Gemini-ს მიერ?",
                          action: () => handleAnalyze(wf)
                        });
                      }}
                      className="p-2.5 rounded-xl bg-proton-card/50 text-proton-muted hover:text-proton-accent hover:bg-proton-accent/10 transition-all border border-proton-border group-hover:shadow-[0_0_15px_rgba(0,242,255,0.1)]"
                      title="Analyze efficiency"
                    >
                      <Activity size={18} />
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
                        LN: {wf.id.slice(-4)}
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
  const [isFirestoreActive, setIsFirestoreActive] = useState(false);
  const handleViewChange = React.useCallback((view: View) => {
    setActiveView(view);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);
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
    const saved = localStorage.getItem('proton_chat_history');
    return saved ? JSON.parse(saved) : {};
  });
  const [playingMsgIndex, setPlayingMsgIndex] = useState<number | null>(null);
  const [personaAvatars, setPersonaAvatars] = useState<{ [id: string]: string }>(() => {
    const saved = localStorage.getItem('proton_persona_avatars');
    return saved ? JSON.parse(saved) : {};
  });
  const [personas, setPersonas] = useState<Persona[]>(() => {
    const saved = localStorage.getItem('proton_personas');
    return saved ? JSON.parse(saved) : PERSONAS;
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
    const saved = localStorage.getItem('user-profile');
    return saved ? JSON.parse(saved) : {
      name: 'Darian B.',
      email: 'devdarianib@gmail.com',
      language: 'en',
      region: 'Tbilisi',
      notifications: true
    };
  });
  const [favoritePersonaIds, setFavoritePersonaIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('proton_favorite_personas');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('proton_favorite_personas', JSON.stringify(favoritePersonaIds));
  }, [favoritePersonaIds]);
  
  const [aiSettings, setAiSettings] = useState<GlobalAiSettings>(() => {
    const saved = localStorage.getItem('proton_ai_settings');
    return saved ? JSON.parse(saved) : {
      temperature: 0.8,
      enableSearch: true,
      enableMaps: false,
      zenMode: false,
      systemInstruction: "",
      voice: "Kore"
    };
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

  const handleAddTask = (content: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      content,
      contentGe: content,
      completed: false
    };
    setTasks(prev => [...prev, newTask]);
    if (user) {
      const docRef = doc(db, 'users', user.uid, 'tasks', newTask.id);
      trackFirestore(setDoc(docRef, newTask)).catch(e => handleFirestoreError(e, 'write', docRef.path));
    }
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

  const t = translations[userProfile.language];

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
          "flex flex-col border-r border-proton-border bg-proton-card/95 md:bg-proton-card/50 backdrop-blur-xl transition-all duration-300 ease-in-out z-[70] overflow-x-hidden",
          "fixed inset-y-0 left-0 md:relative",
          isSidebarOpen 
            ? "translate-x-0 w-64 px-3" 
            : "-translate-x-full md:translate-x-0 md:w-20 w-64 px-2"
        )}
      >
        <div className={cn("p-6 flex items-center gap-3 overflow-hidden whitespace-nowrap transition-all duration-300", !isSidebarOpen && "md:justify-center px-0")}>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500",
            uiMode === 'artisan' 
              ? "bg-proton-text text-proton-bg" 
              : "bg-gradient-to-br from-proton-accent to-proton-secondary text-proton-bg shadow-[0_0_15px_rgba(0,242,255,0.3)]"
          )}>
            <Zap size={24} fill="currentColor" />
          </div>
          {isSidebarOpen && (
            <div className="font-bold text-lg tracking-tight transition-opacity duration-300 animate-in fade-in slide-in-from-left-1">
              {uiMode === 'artisan' ? 'Proton' : 'Proton Core'} <span className="text-proton-accent">{uiMode === 'artisan' ? 'Studio' : 'AI'}</span>
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
          { id: 'blueprints', icon: Workflow, label: t.sidebar.bottom_nav.blueprints },
          { id: 'finance', icon: Wallet, label: t.sidebar.bottom_nav.finance },
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
        <header className={cn(
          "h-16 border-b border-proton-border flex items-center justify-between px-4 md:px-8 z-30 transition-colors backdrop-blur-md",
          uiMode === 'artisan' ? "bg-proton-bg" : "bg-proton-bg/50"
        )}>
          <div className="flex items-center gap-1 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-proton-card text-proton-muted transition-colors hidden md:flex"
            >
              <ChevronRight className={cn("transition-transform duration-300", isSidebarOpen ? "rotate-180" : "")} size={20} />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-proton-card text-proton-muted transition-colors md:hidden"
            >
              <ChevronRight size={20} />
            </button>
            <div className="h-4 w-px bg-proton-border hidden md:block" />
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-proton-muted uppercase tracking-widest">
              <Globe size={14} className="min-w-[14px]" />
              <span className="hidden sm:inline">{userProfile.region} {t.common.node}</span>
              <span className="inline sm:hidden">{userProfile.region.substring(0,3)}</span>
              <span className="text-proton-accent">•</span>
              <span className="hidden xs:inline">v1.2.0</span>
              <span className="inline xs:hidden opacity-0 w-0">.</span>
            </div>
            <div className="h-4 w-px bg-proton-border hidden md:block" />
            <div className="hidden xs:block">
              <DigitalClock uiMode={uiMode} />
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
                  onAiSuggest={handleAiSuggestTasks}
                  uiMode={uiMode}
                />
              )}
              {activeView === 'compute' && (
                <ComputeView 
                  metadata={lastGeminiMetadata} 
                  aiSettings={aiSettings} 
                  setAiSettings={setAiSettings} 
                  isFirestoreActive={isFirestoreActive} 
                  uiMode={uiMode}
                />
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
                />
              )}
              {activeView === 'finance' && (
                <Web3View uiMode={uiMode} />
              )}
              {activeView === 'image' && <ImageView uiMode={uiMode} />}
              {activeView === 'blueprints' && (
                <WorkflowsView 
                  workflows={workflows}
                  setWorkflows={setWorkflows}
                  personas={personas}
                  user={user}
                  uiMode={uiMode}
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
                    <h2 className="text-2xl font-bold">{translations[userProfile.language].settings.title}</h2>
                  </div>
 
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <h3 className="font-bold border-b border-proton-border pb-2">{translations[userProfile.language].sidebar.profile}</h3>
                      <div className="space-y-2">
                        <label className="text-xs text-proton-muted">{translations[userProfile.language].settings.region || 'Region'}</label>
                        <input 
                          value={userProfile.region || ''}
                          onChange={e => setUserProfile(prev => ({ ...prev, region: e.target.value }))}
                          className="w-full bg-proton-card p-3 rounded-xl border border-proton-border text-xs focus:outline-none focus:border-proton-accent"
                          placeholder="e.g. Tbilisi"
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="font-bold border-b border-proton-border pb-2">{translations[userProfile.language].settings.ai_config}</h3>
                      
                      <div className="space-y-2">
                        <label className="text-xs text-proton-muted">{translations[userProfile.language].settings.temperature}: {aiSettings.temperature}</label>
                        <input 
                          type="range" min="0" max="1" step="0.1"
                          value={aiSettings.temperature}
                          onChange={e => setAiSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                          className="w-full accent-proton-accent"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs">{translations[userProfile.language].settings.search}</label>
                        <input 
                          type="checkbox" checked={aiSettings.enableSearch}
                          onChange={e => setAiSettings(prev => ({ ...prev, enableSearch: e.target.checked }))}
                          className="accent-proton-accent"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs">{translations[userProfile.language].settings.maps}</label>
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
    </div>
  );
}