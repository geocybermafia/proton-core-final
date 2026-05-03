import React, { useState, useEffect, useRef, useMemo, Dispatch, SetStateAction } from 'react';
import { EnterpriseWorkflowBuilder } from './components/EnterpriseWorkflowBuilder';
import { WorkflowFlowEditor } from './components/WorkflowFlowEditor';
import { LocalFileScanner } from './components/LocalFileScanner';
import { ParallelTimelineSimulator } from './components/ParallelTimelineSimulator';
import { ObjectiveCenter } from './components/ObjectiveCenter';
import { auth, db, googleProvider } from './firebase';
import { supabase } from './lib/supabase';
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
  EmailAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, getDocFromServer, addDoc, deleteDoc, updateDoc, increment, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { SettingsView } from './components/SettingsView';
import { UserProfile, GlobalAiSettings, Theme, View } from './types';

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
  
  if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
     console.error("Firestore Connection Error:", error.message);
     // We can just throw a simpler error for the UI to catch or show a toast if we had one
     throw new Error("Connection request reset. Please try again.");
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
import { TranslatorView } from './components/TranslatorView';
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
  Layout,
  Wrench,
  Sparkles,
  Star,
  Save,
  Network,
  Sun,
  Moon,
  Circle,
  Edit2,
  Edit3,
  Mail,
  MapPin,
  RefreshCw,
  RotateCcw,
  Shield,
  Clock,
  Key,
  ClipboardList,
  EyeOff,
  ImageIcon,
  Lock,
  LogOut,
  Fingerprint,
  PlusCircle,
  CreditCard,
  BarChart3,
  User as UserIcon,
  Target,
  X,
  Plus,
  Trash2,
  Image,
  Volume2,
  LayoutDashboard,
  Receipt,
  FileText,
  Building,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ShieldAlert,
  Search,
  Bell,
  Wifi,
  Palette,
  Grid,
  Download,
  LogIn,
  History,
  UserCheck,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { cn } from './lib/utils';
import { translations } from './translations';
import { PERSONAS, chatWithPersona, generatePersonaAvatar, generateNewPersona, summarizeConversation, analyzeWorkflow, generateOrEditImage, generateSpeech, architectTask, type Persona, type TaskPlan, type GeminiMetadata } from './services/gemini';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance } from 'wagmi';

// --- Types ---
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
  uiMode = 'operator',
  badge
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  expanded?: boolean,
  uiMode?: 'operator' | 'artisan',
  badge?: string
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl transition-all duration-500 group relative",
      active 
        ? "bg-proton-accent/10 text-proton-accent shadow-[inset_0_0_20px_rgba(0,242,255,0.05)]"
        : "text-proton-muted hover:text-proton-text hover:bg-proton-accent/5",
      !expanded && "justify-center px-0"
    )}
    title={!expanded ? label : undefined}
  >
    <div className="relative">
      <Icon size={20} className={cn("shrink-0 transition-all duration-500 group-hover:scale-110", active ? "text-proton-accent scale-110" : "group-hover:text-proton-accent")} />
      {active && (
        <div className="absolute inset-0 bg-proton-accent/20 blur-md rounded-full -z-10" />
      )}
    </div>
    
    {expanded && (
      <div className="flex items-center justify-between flex-1 min-w-0">
        <span className={cn(
          "text-[11px] font-bold uppercase tracking-wider whitespace-nowrap overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-left-4",
          active ? "text-proton-accent" : "text-proton-muted group-hover:text-proton-text"
        )}>
          {label}
        </span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded-md bg-proton-accent/20 text-proton-accent text-[8px] font-black uppercase tracking-widest border border-proton-accent/30 animate-pulse">
            {badge}
          </span>
        )}
      </div>
    )}

    {active && (
      <motion.div 
        layoutId="active-marker" 
        className="absolute left-0 w-1.5 h-6 bg-proton-accent rounded-full shadow-[0_0_15px_rgba(0,242,255,0.8)]" 
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
  </button>
));

const SystemDiagnostic = ({ t }: { t: any }) => {
  const [state, setState] = useState<'idle' | 'running' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [score, setScore] = useState(0);

  const diag = t.diagnostic || t;

  const runDiagnostic = async () => {
    setState('running');
    setProgress(0);
    
    // Step 1: Evaluating core performance
    setStatusText(diag.evaluating);
    for (let i = 0; i <= 40; i += 2) {
      setProgress(i);
      Math.sqrt(Math.random() * 1000000);
      await new Promise(r => setTimeout(r, 30));
    }

    // Step 2: Testing memory latency
    setStatusText(diag.latency);
    for (let i = 41; i <= 80; i += 2) {
      setProgress(i);
      await new Promise(r => setTimeout(r, 40));
    }

    // Step 3: Benchmarking
    setStatusText(diag.matrix || diag.running);
    const start = performance.now();
    let evaluations = 0;
    while (performance.now() - start < 500) {
      Math.sin(evaluations) * Math.cos(evaluations);
      evaluations++;
    }
    for (let i = 81; i <= 100; i += 2) {
      setProgress(i);
      await new Promise(r => setTimeout(r, 20));
    }

    const finalScore = Math.min(98, 70 + Math.floor(Math.random() * 29));
    setScore(finalScore);
    setState('complete');
  };

  return (
    <div className="bg-proton-card p-8 rounded-[40px] border border-proton-border shadow-sm flex flex-col h-full group transition-all hover:border-proton-accent/30 relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-proton-accent/10 text-proton-accent flex items-center justify-center">
            <Activity size={20} />
          </div>
          <h3 className="font-bold text-lg tracking-tight uppercase">{diag.title}</h3>
        </div>
        {state === 'complete' && (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">{score}% Score</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center items-center py-6 relative z-10">
        {state === 'idle' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-proton-bg border-4 border-proton-border flex items-center justify-center mx-auto group-hover:border-proton-accent/20 transition-all duration-700">
              <Cpu size={32} className="text-proton-muted group-hover:text-proton-accent transition-colors" />
            </div>
            <button 
              onClick={runDiagnostic}
              className="px-8 py-3 bg-proton-text text-proton-bg rounded-2xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-proton-text/10"
            >
              {diag.run}
            </button>
          </div>
        )}

        {state === 'running' && (
          <div className="w-full space-y-8 flex flex-col items-center">
             <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-proton-border"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="377"
                    animate={{ strokeDashoffset: 377 - (377 * progress) / 100 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                    className="text-proton-accent"
                  />
                </svg>
                <span className="absolute text-xl font-black italic">{progress}%</span>
             </div>
             <p className="text-xs font-black text-proton-muted uppercase tracking-[0.2em] animate-pulse">{statusText}</p>
          </div>
        )}

        {state === 'complete' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 w-full"
          >
            <div className="flex flex-col items-center">
               <div className="w-20 h-20 rounded-full bg-green-500/10 border-4 border-green-500/30 flex items-center justify-center mb-4">
                  <CheckCircle2 size={40} className="text-green-500" />
               </div>
               <p className="text-[10px] font-black text-proton-muted uppercase tracking-[0.3em] mb-2">{diag.bench_score || 'Verdict'}</p>
               <h4 className="text-sm font-black text-proton-text uppercase tracking-tight max-w-[240px] leading-relaxed">
                 {score > 85 ? diag.status_optimal : diag.status_standard}
               </h4>
            </div>
            <button 
              onClick={() => setState('idle')}
              className="text-[10px] font-black text-proton-accent uppercase tracking-widest hover:underline"
            >
              Restart Scan
            </button>
          </motion.div>
        )}
      </div>

      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-proton-accent/5 rounded-full blur-3xl pointer-events-none group-hover:bg-proton-accent/10 transition-colors" />
    </div>
  );
};

const SystemGraph = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const data = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    name: i,
    val: 30 + Math.random() * 50,
    load: 10 + Math.random() * 80
  })), []);

  return (
    <div className="h-48 w-full bg-proton-bg/40 rounded-3xl border border-proton-border p-4 relative overflow-hidden group flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-t from-proton-accent/[0.02] to-transparent pointer-events-none" />
      <div className="absolute top-4 left-4 z-10">
        <p className="text-[9px] font-black text-proton-muted uppercase tracking-widest leading-none mb-1">Compute Core Analysis</p>
        <p className="text-xl font-black text-proton-accent tracking-tighter">NODE_ALFA_7</p>
      </div>
      
      <div className="flex-1 w-full mt-4 min-h-0 min-w-0 overflow-hidden">
        {isReady && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--proton-accent)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="var(--proton-accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--proton-border)" vertical={false} opacity={0.1} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 15, 0.9)', 
                  border: '1px solid var(--proton-border)', 
                  borderRadius: '16px',
                  backdropFilter: 'blur(8px)'
                }}
                itemStyle={{ color: 'var(--proton-accent)', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }}
                labelStyle={{ display: 'none' }}
                cursor={{ stroke: 'var(--proton-accent)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Area 
                type="stepAfter" 
                dataKey="val" 
                stroke="var(--proton-accent)" 
                fillOpacity={1} 
                fill="url(#colorVal)" 
                strokeWidth={2}
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

const SidebarPersonaItem = React.memo(({ 
  persona, 
  active, 
  onClick, 
  expanded, 
  avatar 
}: { 
  persona: Persona, 
  active: boolean, 
  onClick: () => void, 
  expanded: boolean, 
  avatar: string 
}) => (
  <Reorder.Item
    value={persona}
    dragListener={expanded}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-2.5 rounded-xl transition-all duration-300 group cursor-grab active:cursor-grabbing relative",
      active 
        ? "bg-proton-accent/10 text-proton-accent shadow-[inset_0_0_15px_rgba(0,242,255,0.05)]" 
        : "text-proton-muted hover:bg-proton-accent/5 hover:text-proton-text"
    )}
  >
    <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-proton-bg border border-proton-border shadow-sm group-hover:border-proton-accent/30 transition-colors">
      <PersonaAvatar avatar={avatar} className="w-6 h-6 rounded-lg text-sm" />
    </div>
    
    {expanded && (
      <div className="flex-1 min-w-0 text-left select-none" onClick={onClick}>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-tight truncate leading-tight group-hover:text-proton-accent">
            {persona.name}
          </span>
          <span className="text-[7px] font-bold text-proton-muted uppercase truncate tracking-[0.1em] opacity-60">
            {persona.role}
          </span>
        </div>
      </div>
    )}

    {active && expanded && (
      <div className="w-1.5 h-1.5 rounded-full bg-proton-accent shadow-[0_0_8px_rgba(0,242,255,1)]" />
    )}
    
    {!expanded && active && (
      <div className="absolute left-0 w-1 h-4 bg-proton-accent rounded-full shadow-[0_0_10px_rgba(0,242,255,0.8)]" />
    )}
  </Reorder.Item>
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
  onClose,
  language = 'en'
}: { 
  persona?: Persona, 
  onSave: (persona: Persona) => void, 
  onClose: () => void,
  language?: 'en' | 'ka'
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
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest flex justify-between">
                <span>English Name</span>
                <span>{formData.name.length}/50</span>
              </label>
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
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest flex justify-between">
                <span>Georgian Name</span>
                <span>{formData.nameGe.length}/50</span>
              </label>
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
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest flex justify-between">
                <span>Role</span>
                <span>{formData.role.length}/50</span>
              </label>
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
                      {generating ? (language === 'ka' ? "მიმდინარეობს..." : "Processing...") : (language === 'ka' ? "პროცესის ავტომატიზაცია" : "Automate Process")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest flex justify-between">
                <span>Description</span>
                <span>{formData.description.length}/200</span>
              </label>
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
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest flex justify-between">
                <span>Georgian Description</span>
                <span>{formData.descriptionGe.length}/200</span>
              </label>
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

type OrganizerTheme = 'cyberpunk' | 'minimalist' | 'executive';

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
  const [theme, setTheme] = useState<OrganizerTheme>(() => {
    return (localStorage.getItem('proton_organizer_theme') as OrganizerTheme) || 'executive';
  });

  useEffect(() => {
    localStorage.setItem('proton_organizer_theme', theme);
  }, [theme]);

  const themes = {
    cyberpunk: {
      container: "bg-black/95 text-cyan-400",
      card: "bg-black border-pink-500/30 shadow-[0_0_20px_rgba(255,0,255,0.05)]",
      accent: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
      button: "bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]",
      input: "bg-black border-cyan-400/20 text-cyan-400 focus:border-cyan-400 shadow-[inset_0_0_10px_rgba(0,243,255,0.05)]",
      label: "text-cyan-400/60 font-mono italic",
      muted: "text-cyan-400/40",
      calendar: `
        .react-calendar { background: transparent !important; border: none !important; width: 100% !important; }
        .react-calendar__navigation button { color: #22d3ee !important; font-weight: bold !important; min-width: 44px !important; }
        .react-calendar__month-view__weekdays { text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #ec4899; }
        .react-calendar__tile { padding: 0.8em 0.1em !important; font-size: 0.8rem !important; color: #22d3ee !important; border-radius: 12px; transition: all 0.2s; }
        .react-calendar__tile:hover { background: rgba(34, 211, 238, 0.1) !important; }
        .react-calendar__tile--now { background: rgba(34, 211, 238, 0.05) !important; border: 1px solid #22d3ee !important; }
        .react-calendar__tile--active { background: #ec4899 !important; color: white !important; font-weight: bold; box-shadow: 0 0 15px rgba(236,72,153,0.5); }
      `
    },
    minimalist: {
      container: "bg-[#fcfcfd] text-slate-900",
      card: "bg-white/70 backdrop-blur-2xl border-slate-200/60 shadow-xl rounded-[32px]",
      accent: "text-slate-600 bg-slate-100 border-slate-200",
      button: "bg-slate-900 text-white rounded-2xl",
      input: "bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-900 rounded-2xl",
      label: "text-slate-400 font-bold tracking-tight",
      muted: "text-slate-400",
      calendar: `
        .react-calendar { background: transparent !important; border: none !important; width: 100% !important; }
        .react-calendar__navigation button { color: #0f172a !important; font-weight: bold !important; min-width: 44px !important; }
        .react-calendar__month-view__weekdays { text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
        .react-calendar__tile { padding: 0.8em 0.1em !important; font-size: 0.8rem !important; color: #1e293b !important; border-radius: 16px; transition: all 0.2s; }
        .react-calendar__tile:hover { background: #f1f5f9 !important; }
        .react-calendar__tile--now { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
        .react-calendar__tile--active { background: #0f172a !important; color: white !important; font-weight: bold; }
      `
    },
    executive: {
      container: "bg-slate-950 text-slate-100",
      card: "bg-slate-900/40 backdrop-blur-md border-slate-800 shadow-2xl rounded-3xl",
      accent: "text-blue-400 bg-blue-400/10 border-blue-400/20",
      button: "bg-blue-600 text-white shadow-lg shadow-blue-600/20",
      input: "bg-slate-950/50 border-slate-700 text-slate-100 focus:border-blue-500",
      label: "text-slate-500 font-semibold uppercase tracking-widest",
      muted: "text-slate-500",
      calendar: `
        .react-calendar { background: transparent !important; border: none !important; width: 100% !important; }
        .react-calendar__navigation button { color: #f8fafc !important; font-weight: bold !important; min-width: 44px !important; }
        .react-calendar__month-view__weekdays { text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #64748b; }
        .react-calendar__tile { padding: 0.8em 0.1em !important; font-size: 0.8rem !important; color: #cbd5e1 !important; border-radius: 12px; transition: all 0.2s; }
        .react-calendar__tile:hover { background: rgba(59, 130, 246, 0.1) !important; }
        .react-calendar__tile--now { background: rgba(59, 130, 246, 0.05) !important; border: 1px solid #3b82f6 !important; }
        .react-calendar__tile--active { background: #3b82f6 !important; color: white !important; font-weight: bold; }
      `
    }
  };

  const currentTheme = themes[theme];

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
    <div className={cn("min-h-screen p-4 md:p-10 -m-4 md:-m-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 transition-colors duration-500", currentTheme.container)}>
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <div className="text-center xl:text-left">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase">{t.title}</h2>
          <p className={cn("mt-1 font-medium", currentTheme.muted)}>{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="relative group">
            <Search size={14} className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", currentTheme.muted, "group-focus-within:text-proton-accent")} />
            <input 
              type="text"
              placeholder={language === 'ka' ? 'დავალების ძიება...' : 'Search tasks...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={cn("pl-10 pr-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl border-2 focus:outline-none transition-all w-64 bg-black/20", currentTheme.input)}
            />
          </div>
          
          <div className="flex items-center bg-black/20 p-2 rounded-2xl border border-white/5 h-fit">
               <div className="flex items-center gap-2 px-3">
                  <Palette size={16} className={currentTheme.muted} />
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", currentTheme.muted)}>{t.workspace_theme}</span>
               </div>
               <div className="flex p-1 bg-black/40 rounded-xl gap-1">
                  {(['cyberpunk', 'minimalist', 'executive'] as OrganizerTheme[]).map(th => (
                    <button
                      key={th}
                      onClick={() => setTheme(th)}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                        theme === th 
                          ? "bg-white text-black shadow-lg" 
                          : cn("text-white/40 hover:text-white/70", currentTheme.muted)
                      )}
                    >
                      {t[`theme_${th}` as keyof typeof t]}
                    </button>
                  ))}
               </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className={cn("p-6 rounded-[32px] border transition-all duration-500 flex items-center justify-between", currentTheme.card)}>
             <div>
                <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-1", currentTheme.muted)}>{t.total_completed}</p>
                <h4 className="text-3xl font-black">{tasks.filter(t => t.completed).length}<span className="text-sm opacity-30 ml-2">/ {tasks.length}</span></h4>
             </div>
             <div className={cn("p-4 rounded-2xl", currentTheme.accent)}>
                <Check size={28} />
             </div>
          </div>
          <div className={cn("p-6 rounded-[32px] border transition-all duration-500 flex items-center justify-between", currentTheme.card)}>
             <div>
                <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-1", currentTheme.muted)}>{t.productivity_score}</p>
                <h4 className="text-3xl font-black">{tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0}%</h4>
             </div>
             <div className={cn("p-4 rounded-2xl", currentTheme.accent)}>
                <Activity size={28} />
             </div>
          </div>
          <div className={cn("p-6 rounded-[32px] border transition-all duration-500 flex flex-col justify-center", currentTheme.card, "lg:col-span-2")}>
             <div className="flex items-center justify-between">
                <div>
                   <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", currentTheme.muted)}>{t.analytics}</p>
                   <h4 className="text-lg font-black uppercase tracking-tight">{t.subtitle}</h4>
                </div>
                <div className="flex gap-1 h-2 w-32 bg-white/5 rounded-full overflow-hidden">
                   <div 
                      className="h-full bg-proton-accent transition-all duration-1000" 
                      style={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.completed).length / tasks.length) * 100 : 0}%` }}
                   />
                </div>
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className={cn("p-8 rounded-[40px] border shadow-sm h-fit transition-all duration-500", currentTheme.card)}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xl flex items-center gap-3 uppercase tracking-tighter">
                <Layers size={24} className={currentTheme.muted} />
                {t.tasks}
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => tasks.filter(t => t.completed).forEach(t => onDeleteTask(t.id))}
                  className={cn("p-3 rounded-2xl transition-all hover:text-red-500", currentTheme.muted)}
                  title="Clear completed"
                >
                  <RefreshCw size={18} />
                </button>
                <button 
                  onClick={handleAiSuggest}
                  disabled={isSuggesting}
                  className={cn("p-3 rounded-2xl transition-all hover:scale-110", currentTheme.accent)}
                >
                  {isSuggesting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-6">
               <form onSubmit={handleAddTask} className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input 
                      type="text"
                      placeholder={t.task_placeholder}
                      value={newTaskInput}
                      onChange={e => setNewTaskInput(e.target.value)}
                      className={cn("flex-1 border-2 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none transition-all", currentTheme.input)}
                    />
                    <button type="submit" className={cn("px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl", currentTheme.button)}>
                       {translations[language].common.add}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar-minimal">
                    <span className={cn("text-[10px] font-black uppercase tracking-widest mr-2 shrink-0", currentTheme.muted)}>{t.priority}:</span>
                    {(['low', 'medium', 'high'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTaskPriority(p)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shrink-0",
                          taskPriority === p 
                            ? (p === 'high' ? "bg-red-500 border-red-500 text-white" : p === 'medium' ? "bg-amber-500 border-amber-500 text-white" : "bg-blue-500 border-blue-500 text-white")
                            : cn("border-white/10 text-white/40 hover:border-white/30", currentTheme.muted)
                        )}
                      >
                        {t[p]}
                      </button>
                    ))}
                  </div>
               </form>

               <div className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <div className="py-20 text-center space-y-4">
                       <p className={cn("font-black uppercase tracking-widest text-[10px]", currentTheme.muted)}>{translations[language].organizer.no_tasks}</p>
                       <div className={cn("h-px w-20 mx-auto", theme === 'cyberpunk' ? "bg-cyan-400/20" : "bg-slate-200")} />
                    </div>
                  ) : (
                    filteredTasks.map(task => (
                      <motion.div 
                        layout
                        key={task.id} 
                        className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-all group", currentTheme.card, theme === 'cyberpunk' ? "hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]" : "hover:border-proton-accent")}
                      >
                        <button 
                          onClick={() => onToggleTask(task.id)}
                          className={cn(
                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                            task.completed 
                              ? (theme === 'cyberpunk' ? "bg-cyan-400 border-cyan-400 text-black" : "bg-slate-900 border-slate-900 text-white")
                              : (theme === 'cyberpunk' ? "border-cyan-400/50" : "border-slate-200")
                          )}
                        >
                          {task.completed && <Check size={16} strokeWidth={4} />}
                        </button>
                        <div className="flex-1 flex flex-col min-w-0">
                          <span className={cn("text-sm font-bold tracking-tight truncate", task.completed && "opacity-30 line-through")}>
                            {language === 'ka' ? task.contentGe : task.content}
                          </span>
                          {task.priority && (
                             <span className={cn(
                               "text-[8px] font-black uppercase tracking-widest mt-1",
                               task.priority === 'high' ? "text-red-500" : task.priority === 'medium' ? "text-amber-500" : "text-blue-400"
                             )}>
                               {t[task.priority]}
                             </span>
                          )}
                        </div>
                        <button 
                          onClick={() => onDeleteTask(task.id)} 
                          className={cn("opacity-0 group-hover:opacity-100 transition-all hover:scale-125", theme === 'cyberpunk' ? "text-pink-500" : "text-slate-400 hover:text-red-500")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </motion.div>
                    ))
                  )}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {workflows.slice(0, 4).map(wf => (
               <div key={wf.id} className={cn("p-6 rounded-[32px] border shadow-sm group hover:scale-[1.02] transition-all duration-500", currentTheme.card)}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn("p-3 rounded-2xl transition-transform", currentTheme.accent)}>
                      <Zap size={24} />
                    </div>
                    <span className="font-black text-xl tracking-tight truncate">{wf.name}</span>
                  </div>
                  <p className={cn("text-xs font-bold uppercase tracking-widest", currentTheme.muted)}>Trigger: {wf.trigger}</p>
               </div>
             ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className={cn("p-8 rounded-[40px] border shadow-sm transition-all duration-500", currentTheme.card)}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xl flex items-center gap-3 uppercase tracking-tighter">
                <CalendarIcon size={24} className={currentTheme.muted} />
                {t.calendar}
              </h3>
            </div>
            <div className="w-full">
              <style>{currentTheme.calendar}</style>
              <Calendar className="mx-auto" />
            </div>
          </div>
          
          <div className={cn("p-8 rounded-[40px] border shadow-sm bg-gradient-to-br from-proton-accent/10 to-transparent", currentTheme.card)}>
             <h4 className="font-black text-xs uppercase tracking-widest mb-4">{t.upcoming_workflows}</h4>
             <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-black/20 rounded-2xl border border-white/5">
                     <div className="w-2 h-2 rounded-full bg-proton-accent animate-pulse" />
                     <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-tight">System Sync</p>
                        <p className={cn("text-[8px] font-bold uppercase tracking-widest", currentTheme.muted)}>ID {i*47} • {i*15}m ago</p>
                      </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ 
  setActiveView, 
  language = 'en',
  uiMode,
  theme,
  setTheme
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
  isArtisanSystemActive: boolean,
  theme: Theme,
  setTheme: (t: Theme) => void
}) => {
  const t = translations[language];

  return (
    <div className={cn(
      "space-y-6 animate-in fade-in duration-300 pb-20",
      uiMode === 'artisan' ? "artisan-mode" : "operator-mode"
    )}>
      <div className={cn(
        "p-8 rounded-[40px] border shadow-2xl relative overflow-hidden transition-all duration-500",
        uiMode === 'artisan' 
          ? "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20" 
          : "bg-gradient-to-br from-proton-accent/10 via-proton-accent/5 to-transparent border-proton-accent/20"
      )}>
        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-8 relative z-10">
          <div className="space-y-2 text-center md:text-left flex-1">
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2",
              uiMode === 'artisan' ? "bg-amber-500/20 text-amber-500" : "bg-proton-accent/20 text-proton-accent"
            )}>
              {uiMode === 'artisan' ? (language === 'ka' ? 'ოსტატის რეჟიმი' : 'Artisan Mode') : (language === 'ka' ? 'ოპერატორის რეჟიმი' : 'Operator Mode')}
            </div>
            <h1 className={cn(
              "font-black tracking-tighter uppercase leading-none",
              uiMode === 'artisan' ? "text-4xl md:text-6xl text-amber-500" : "text-4xl md:text-6xl text-proton-accent"
            )}>
              {uiMode === 'artisan' ? (language === 'ka' ? 'ხელოსნის ცენტრი' : "Artisan Hub") : (language === 'ka' ? 'ბიზნეს მართვა' : 'Business Control')}
            </h1>
            <p className="text-proton-muted font-medium max-w-xl text-base">
              {uiMode === 'artisan' 
                ? (language === 'ka' ? 'თქვენი პრაქტიკული სამუშაო სივრცე და ტექნიკური ხელსაწყოები.' : 'Your practical workspace and technical toolset.')
                : (language === 'ka' ? 'სტრატეგიული ანალიტიკა და ბიზნეს პროცესების მართვის ცენტრი.' : 'Strategic analytics and business process management center.')}
            </p>
          </div>
          
          <div className="flex shrink-0">
             {uiMode === 'artisan' ? (
                <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <Wrench className="text-amber-500" size={40} />
                </div>
             ) : (
                <div className="w-24 h-24 rounded-full bg-proton-accent/10 flex items-center justify-center border border-proton-accent/20">
                  <Activity className="text-proton-accent" size={40} />
                </div>
             )}
          </div>
        </div>
      </div>

      {uiMode === 'operator' ? (
        <div className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                onClick={() => setActiveView('finance')}
                className="bg-proton-card p-10 rounded-[40px] border border-proton-border hover:border-proton-accent transition-all cursor-pointer group shadow-lg"
              >
                 <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-proton-accent/10 text-proton-accent flex items-center justify-center group-hover:bg-proton-accent group-hover:text-proton-bg transition-colors">
                       <Wallet size={28} />
                    </div>
                    <ArrowRight className="text-proton-muted group-hover:text-proton-accent group-hover:translate-x-2 transition-all" size={24} />
                 </div>
                 <h3 className="text-2xl font-black text-proton-text uppercase tracking-tight mb-2">
                    {language === 'ka' ? 'ფინანსური ცენტრი' : 'Financial Center'}
                 </h3>
                 <p className="text-sm text-proton-muted font-medium">
                    {language === 'ka' ? 'მართეთ თქვენი ბიზნესის ფულადი ნაკადები და ტრანზაქციები.' : 'Manage your business cash flows and transactions.'}
                 </p>
              </div>

              <div 
                onClick={() => setActiveView('blueprints')}
                className="bg-proton-card p-10 rounded-[40px] border border-proton-border hover:border-purple-500 transition-all cursor-pointer group shadow-lg"
              >
                 <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
                       <Workflow size={28} />
                    </div>
                    <ArrowRight className="text-proton-muted group-hover:text-purple-400 group-hover:translate-x-2 transition-all" size={24} />
                 </div>
                 <h3 className="text-2xl font-black text-proton-text uppercase tracking-tight mb-2">
                    {language === 'ka' ? 'სამუშაო პროცესები' : 'Business Workflows'}
                 </h3>
                 <p className="text-sm text-proton-muted font-medium">
                    {language === 'ka' ? 'დაგეგმეთ და მოახდინეთ ბიზნეს ოპერაციების ავტომატიზაცია.' : 'Plan and automate your business operations.'}
                 </p>
              </div>
           </div>
           
           <ObjectiveCenter language={language} />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-proton-card p-8 rounded-[40px] border border-proton-border hover:border-amber-500 transition-all cursor-pointer group">
              <Compass className="text-amber-500 mb-6" size={32} />
              <h3 className="text-xl font-black text-proton-text uppercase tracking-tight mb-2">
                {language === 'ka' ? 'ტექნიკური ბაზა' : 'Technical Base'}
              </h3>
              <p className="text-xs text-proton-muted font-medium">
                {language === 'ka' ? 'წვდომა ყველა სახელმძღვანელოსა და დოკუმენტაციაზე.' : 'Access all manuals and technical documentation.'}
              </p>
            </div>

            <div className="bg-proton-card p-8 rounded-[40px] border border-proton-border hover:border-amber-500 transition-all cursor-pointer group">
              <Zap className="text-amber-500 mb-6" size={32} />
              <h3 className="text-xl font-black text-proton-text uppercase tracking-tight mb-2">
                {language === 'ka' ? 'ინსტრუმენტარიუმი' : 'Toolbox'}
              </h3>
              <p className="text-xs text-proton-muted font-medium">
                {language === 'ka' ? 'აქტიური ინსტრუმენტები და ტექნოლოგიური მართვა.' : 'Active tools and technological management.'}
              </p>
            </div>

            <div className="bg-proton-card p-8 rounded-[40px] border border-proton-border hover:border-amber-500 transition-all cursor-pointer group">
              <Sparkles className="text-amber-500 mb-6" size={32} />
              <h3 className="text-xl font-black text-proton-text uppercase tracking-tight mb-2">
                {language === 'ka' ? 'AI ასისტენტი' : 'AI Assistant'}
              </h3>
              <p className="text-xs text-proton-muted font-medium">
                {language === 'ka' ? 'მიიღეთ რჩევები და გადაჭერით რთული ტექნიკური ამოცანები.' : 'Get advice and solve complex technical tasks.'}
              </p>
            </div>
          </div>

          <div className="bg-amber-500/5 p-10 rounded-[50px] border border-amber-500/20 shadow-xl flex flex-col md:flex-row items-center gap-10">
             <div className="flex-1 space-y-4">
                <h3 className="text-3xl font-black text-proton-text uppercase tracking-tighter">
                  {language === 'ka' ? 'ხელოსნის ინსტრუმენტარიუმი' : 'Digital Craftsmanship'}
                </h3>
                <p className="text-proton-muted font-medium">
                  {language === 'ka' ? 'გამოიყენეთ ხელოვნური ინტელექტი თქვენი ყოველდღიური სამუშაოს ოპტიმიზაციისთვის. ჩვენი სისტემა დაგეხმარებათ რთული ტექნიკური პრობლემების მარტივად გადაჭრაში.' : 'Use AI to optimize your daily work. Our system will help you solve complex technical problems with ease.'}
                </p>
                <button 
                  onClick={() => setActiveView('personas')}
                  className="px-8 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-105 transition-transform"
                >
                  {language === 'ka' ? 'დაიწყე მუშაობა' : 'Get Started'}
                </button>
             </div>
             <div className="w-full md:w-64 h-64 bg-proton-card rounded-[40px] border border-proton-border flex items-center justify-center p-8">
                <Cpu className="text-amber-500/50 w-full h-full" />
             </div>
          </div>
        </div>
      )}
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
  const [network, setNetwork] = useState<{ downlink: number; rtt: number; type: string } | null>(null);
  const [orientation, setOrientation] = useState<{ alpha: number; beta: number; gamma: number } | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [hardware, setHardware] = useState<{ cores: number; memory: number; platform: string }>({
    cores: navigator.hardwareConcurrency || 0,
    memory: (navigator as any).deviceMemory || 0,
    platform: (navigator as any).userAgentData?.platform || navigator.platform
  });
  
  const [supported, setSupported] = useState<Record<string, boolean>>({
    geolocation: 'geolocation' in navigator,
    battery: 'getBattery' in navigator,
    network: 'connection' in navigator,
    orientation: 'DeviceOrientationEvent' in window
  });

  const requestHardwareAccess = async () => {
    setPermissionRequested(true);
    
    // iOS DeviceOrientation permission handling
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setSupported(prev => ({ ...prev, orientation: true }));
        }
      } catch (err) {
        console.error("Orientation permission denied:", err);
      }
    }

    if (supported.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude, 
          accuracy: pos.coords.accuracy 
        }),
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
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
      setNetwork({ downlink: conn.downlink, rtt: conn.rtt, type: conn.effectiveType });
      conn.addEventListener('change', () => setNetwork({ downlink: conn.downlink, rtt: conn.rtt, type: conn.effectiveType }));
    }

    if (supported.orientation) {
      const handler = (event: DeviceOrientationEvent) => {
        setOrientation({
          alpha: event.alpha || 0,
          beta: event.beta || 0,
          gamma: event.gamma || 0
        });
      };
      window.addEventListener('deviceorientation', handler);
      return () => window.removeEventListener('deviceorientation', handler);
    }
  };

  useEffect(() => {
    setSupported({
      geolocation: 'geolocation' in navigator,
      battery: 'getBattery' in navigator,
      network: 'connection' in navigator,
      orientation: 'DeviceOrientationEvent' in window
    });
    
    // Automatically try to get some data if permitted or simple
    requestHardwareAccess();
  }, []);

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20 px-4 md:px-0">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
        <div className="space-y-2 text-center md:text-left">
          <h1 className="text-3xl md:text-6xl font-black tracking-tighter text-proton-text uppercase">
            {t.title}
          </h1>
          <p className="text-proton-muted text-base md:text-lg font-medium max-w-xl">
            {t.description}
          </p>
        </div>
        {!permissionRequested ? (
          <button 
            onClick={requestHardwareAccess}
            className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-5 bg-proton-accent text-proton-on-accent rounded-[2rem] font-bold shadow-xl shadow-proton-accent/20 hover:scale-105 active:scale-95 transition-all text-sm md:text-base"
          >
            <RefreshCw size={20} className="animate-spin-slow" />
            {t.request_access}
          </button>
        ) : (
          <div className="text-[10px] bg-proton-border/50 text-proton-muted px-4 py-2 rounded-full font-black uppercase tracking-widest border border-proton-border">
            {t.status_active}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Battery / Power Core */}
        <div className="bg-proton-card p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-proton-border shadow-sm group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Zap size={60} />
          </div>
          <div className="space-y-4 md:space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <div className={cn(
                "w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-colors",
                battery ? "bg-cyan-400/10 text-cyan-400" : "bg-proton-bg text-proton-muted"
              )}>
                {battery?.charging ? <Zap size={20} className="animate-pulse fill-cyan-400" /> : <Zap size={20} />}
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", battery ? "bg-cyan-400 animate-pulse" : "bg-gray-600")} />
                <span className="text-[9px] font-black text-proton-muted uppercase tracking-[0.1em]">
                  {supported.battery ? (battery ? (battery.level > 0.2 ? t.status_healthy : t.status_critical) : t.status_syncing) : t.status_locked}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 md:gap-6">
              <div className="relative w-16 h-16 md:w-24 md:h-24 shrink-0">
                <svg className="w-full h-full -rotate-90 transform">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="40%"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className="text-proton-bg"
                  />
                  <motion.circle
                    initial={{ strokeDasharray: "0, 100" }}
                    animate={{ strokeDasharray: `${(battery?.level || 0) * 100}, 100` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    cx="50%"
                    cy="50%"
                    r="40%"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="transparent"
                    className="text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                    pathLength="100"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm md:text-xl font-black text-proton-text tabular-nums leading-none">
                    {supported.battery ? (battery ? Math.round(battery.level * 100) : '...') : '--'}
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 truncate">{t.battery}</h4>
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-tight">
                  {battery?.charging ? t.charging : t.discharging}
                </p>
                <p className="mt-1 text-[8px] font-medium text-proton-muted uppercase leading-tight">
                  {battery ? (battery.level * 100 > 50 ? t.optimal : t.optimization) : t.awaiting}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compute Units (CPU) */}
        <div className="bg-proton-card p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-proton-border shadow-sm group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Cpu size={60} />
          </div>
          <div className="space-y-4 md:space-y-6 relative z-10">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-purple-400/10 flex items-center justify-center text-purple-400">
              <Cpu size={20} />
            </div>
            <div>
              <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{t.compute}</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-proton-text tracking-tighter">{hardware.cores || 'N/A'}</span>
                <span className="text-xs font-black text-purple-400 opacity-50">{hardware.cores ? 'Core' : ''}</span>
              </div>
              <p className="mt-2 text-[10px] font-bold text-purple-400 uppercase tracking-tight">
                {hardware.cores ? t.status_healthy : t.status_syncing}
              </p>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={cn("h-1 flex-1 rounded-full", hardware.cores && i < (hardware.cores/2) ? "bg-purple-400" : "bg-proton-bg")} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Memory Allocation (RAM) */}
        <div className="bg-proton-card p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-proton-border shadow-sm group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Database size={60} />
          </div>
          <div className="space-y-4 md:space-y-6 relative z-10">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-400/10 flex items-center justify-center text-blue-400">
              <Database size={20} />
            </div>
            <div>
              <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{t.memory}</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-proton-text tracking-tighter">{hardware.memory || 'N/A'}</span>
                <span className="text-xs font-black text-blue-400 opacity-50">{hardware.memory ? 'GB' : ''}</span>
              </div>
              <p className="mt-2 text-[10px] font-bold text-blue-400 uppercase tracking-tight">
                {hardware.memory ? t.status_healthy : t.status_syncing}
              </p>
              <div className="flex items-center gap-3 mt-3">
                  <div className="flex-1 h-1.5 bg-proton-bg rounded-full overflow-hidden">
                    <div className={cn("h-full bg-blue-400/60", hardware.memory ? "w-1/3" : "w-0")} />
                  </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network Uplink */}
        <div className="bg-proton-card p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-proton-border shadow-sm group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Globe size={60} />
          </div>
          <div className="space-y-4 md:space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <div className={cn(
                "w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-colors",
                network ? "bg-green-400/10 text-green-400" : "bg-proton-bg text-proton-muted"
              )}>
                <Wifi size={20} />
              </div>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full animate-pulse", network ? "bg-green-400" : "bg-gray-600")} />
                <span className="text-[9px] font-black text-proton-muted uppercase tracking-[0.1em]">
                  {network ? (network.downlink > 10 ? 'Broadband' : 'Mobile Data') : t.status_syncing}
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{t.network}</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-proton-text tracking-tighter uppercase">{network?.type || 'N/A'}</span>
                <span className="text-xs font-black text-green-400 opacity-50">{network ? 'Active Path' : ''}</span>
              </div>
              <p className="mt-2 text-[10px] font-bold text-green-400 uppercase tracking-tight">
                {network?.downlink ? `${network.downlink} MBPS ${t.downlink}` : t.awaiting}
              </p>
              <p className="mt-1 text-[8px] font-medium text-proton-muted uppercase">
                {t.rtt}: {network?.rtt ? `${network.rtt}ms` : '--'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <LocalFileScanner t={t} />
        
        <div className="bg-proton-card p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-proton-border shadow-sm overflow-hidden relative group">
           <div className="absolute top-0 right-0 p-6 md:p-10 opacity-[0.02] pointer-events-none group-hover:scale-95 transition-transform duration-1000">
            <MapPin size={240} />
          </div>
          <div className="relative z-10 space-y-6 md:space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xl md:text-2xl font-black tracking-tighter text-proton-text uppercase flex items-center gap-3">
                  <MapPin className="text-cyan-400" size={24} />
                  {t.geo_title}
                </h3>
                <p className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">{t.geo_subtitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              <div className="p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-proton-bg border border-proton-border space-y-2 md:space-y-4">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t.lat}</p>
                <div className="text-xl md:text-3xl font-mono text-proton-text tracking-tighter truncate">
                  {location?.lat.toFixed(6) || 'Scanning...'}
                </div>
              </div>
              <div className="p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-proton-bg border border-proton-border space-y-2 md:space-y-4">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t.lng}</p>
                <div className="text-xl md:text-3xl font-mono text-proton-text tracking-tighter truncate">
                  {location?.lng.toFixed(6) || 'Scanning...'}
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 rounded-2xl bg-cyan-400/5 border border-cyan-400/10 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center text-cyan-400 shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{t.location_secured}</p>
                <p className="text-[9px] font-medium text-proton-muted uppercase truncate">{t.location_sync}</p>
              </div>
            </div>
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
  onUpdateAvatar,
  personas,
  onUpdatePersonas,
  aiSettings,
  setLastGeminiMetadata,
  workflows,
  tasks,
  uiMode,
  isSystemActive,
  initialPersonaId,
  favoritePersonaIds,
  onToggleFavorite,
  language,
  user
}: { 
  history: PersonaHistory, 
  onNewMessage: (personaId: string, msg: ChatMessage) => void,
  customAvatars: { [id: string]: string },
  onUpdateAvatar: (personaId: string, avatar: string) => void,
  personas: Persona[],
  onUpdatePersonas: (personas: Persona[]) => void,
  aiSettings: GlobalAiSettings,
  setLastGeminiMetadata: (m: any) => void,
  workflows: Workflow[],
  tasks: Task[],
  uiMode: 'operator' | 'artisan',
  isSystemActive: boolean,
  initialPersonaId?: string | null,
  favoritePersonaIds: string[],
  onToggleFavorite: (id: string) => void,
  language: 'en' | 'ka',
  user: any
}) => {
  const [selectedPersona, setSelectedPersona] = useState<Persona>(() => {
    if (initialPersonaId) {
      const found = personas.find(p => p.id === initialPersonaId);
      if (found) return found;
    }
    return personas[0] || PERSONAS[0];
  });

  useEffect(() => {
    if (initialPersonaId) {
      const found = personas.find(p => p.id === initialPersonaId);
      if (found) setSelectedPersona(found);
    }
  }, [initialPersonaId, personas]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [tempInstructions, setTempInstructions] = useState(selectedPersona.systemInstruction);
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false);
  const [personaPrompt, setPersonaPrompt] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempInstructions(selectedPersona.systemInstruction);
    setIsEditingInstructions(false);
    setInput('');
  }, [selectedPersona]);

  const handleSaveInstructions = () => {
    const updatedPersonas = personas.map(p => 
      p.id === selectedPersona.id ? { ...p, systemInstruction: tempInstructions } : p
    );
    onUpdatePersonas(updatedPersonas);
    setIsEditingInstructions(false);
  };

  const handleGeneratePersona = async () => {
    if (!personaPrompt.trim()) return;
    setLoading(true);
    try {
      const newPersona = await generateNewPersona(selectedPersona, personaPrompt);
      onUpdatePersonas([...personas, newPersona]);
      setPersonaPrompt('');
      setIsGeneratingPersona(false);
      setSelectedPersona(newPersona);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        (aiSettings.systemInstruction || "") + userContext,
        language
      );
      setLastGeminiMetadata(metadata);
      onNewMessage(selectedPersona.id, { role: 'model', content: text, timestamp: Date.now() });

      if (user && metadata) {
        const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
        updateDoc(statsRef, {
          aiTokens: increment(metadata.totalTokenCount || 0)
        }).catch(e => handleFirestoreError(e, 'write', statsRef.path));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const t = translations[language].personas;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-12rem)] gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="w-full lg:w-80 space-y-6 flex flex-col h-full">
         <div className="space-y-4">
            <div className="flex items-center justify-between">
               <h2 className="text-3xl font-black tracking-tighter">{t.title}</h2>
               <button 
                 onClick={() => setIsGeneratingPersona(!isGeneratingPersona)}
                 className="p-2 rounded-xl bg-proton-accent/10 text-proton-accent hover:bg-proton-accent hover:text-proton-bg transition-all"
                 title={language === 'ka' ? 'ახალი პერსონა' : 'Generate New Persona'}
               >
                 <Plus size={20} />
               </button>
            </div>
            
            <AnimatePresence>
               {isGeneratingPersona && (
                 <motion.div 
                   initial={{ height: 0, opacity: 0 }}
                   animate={{ height: 'auto', opacity: 1 }}
                   exit={{ height: 0, opacity: 0 }}
                   className="overflow-hidden space-y-3"
                 >
                   <input 
                     type="text"
                     value={personaPrompt}
                     onChange={(e) => setPersonaPrompt(e.target.value)}
                     placeholder={language === 'ka' ? 'რა ტიპის პერსონა გსურთ?' : 'What kind of persona?'}
                     className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-proton-accent focus:outline-none"
                   />
                   <div className="flex gap-2">
                      <button 
                        onClick={handleGeneratePersona}
                        disabled={loading || !personaPrompt.trim()}
                        className="flex-1 bg-proton-accent text-proton-on-accent text-[10px] font-black uppercase py-2 rounded-lg"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : (language === 'ka' ? 'გენერაცია' : 'Generate')}
                      </button>
                      <button 
                        onClick={() => setIsGeneratingPersona(false)}
                        className="px-3 bg-proton-bg border border-proton-border text-proton-muted rounded-lg"
                      >
                        <X size={14} />
                      </button>
                   </div>
                 </motion.div>
               )}
            </AnimatePresence>

            <p className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">{t.description}</p>
         </div>

         <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {personas.map(persona => (
              <div 
                key={persona.id} 
                className="relative group/item"
              >
                 <button
                   onClick={() => setSelectedPersona(persona)}
                   className={cn(
                     "w-full text-left p-4 rounded-3xl border transition-all flex items-center gap-4 group",
                     selectedPersona.id === persona.id 
                       ? "bg-proton-accent text-proton-on-accent border-proton-accent shadow-xl shadow-proton-accent/20" 
                       : "bg-proton-card border-proton-border hover:border-proton-accent/50"
                   )}
                 >
                   <div className="text-3xl group-hover:scale-110 transition-transform">
                      {customAvatars[persona.id] || persona.avatar}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                         <p className="font-bold truncate">{language === 'ka' ? persona.nameGe : persona.name}</p>
                      </div>
                      <p className={cn("text-[10px] font-bold uppercase tracking-widest", selectedPersona.id === persona.id ? "text-proton-on-accent/80" : "text-proton-muted")}>
                         {persona.role}
                      </p>
                   </div>
                 </button>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     onToggleFavorite(persona.id);
                   }}
                   className={cn(
                     "absolute top-4 right-4 p-1.5 rounded-full transition-all",
                     favoritePersonaIds.includes(persona.id)
                       ? "text-amber-400 bg-amber-400/10"
                       : "text-proton-muted opacity-0 group-hover/item:opacity-100 hover:bg-white/10"
                   )}
                 >
                   <Star size={14} fill={favoritePersonaIds.includes(persona.id) ? "currentColor" : "none"} />
                 </button>
              </div>
            ))}
         </div>
      </div>

      <div className="flex-1 flex flex-col bg-proton-card rounded-[40px] border border-proton-border shadow-2xl overflow-hidden min-h-[500px]">
         <div className="px-8 py-6 border-b border-proton-border flex items-center justify-between bg-proton-bg/50">
            <div className="flex items-center gap-4">
               <div className="text-3xl">{currentAvatar}</div>
               <div>
                  <h3 className="font-bold text-lg">{language === 'ka' ? selectedPersona.nameGe : selectedPersona.name}</h3>
                  <p className="text-xs text-proton-muted font-medium">{selectedPersona.role}</p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => setIsEditingInstructions(!isEditingInstructions)}
                 className={cn(
                   "p-2 rounded-xl transition-all",
                   isEditingInstructions ? "bg-proton-accent text-proton-bg" : "bg-proton-bg border border-proton-border text-proton-muted hover:border-proton-accent/50"
                 )}
                 title={language === 'ka' ? 'ინსტრუქციების რედაქტირება' : 'Edit System Instructions'}
               >
                 <Settings size={18} />
               </button>
               <div className="h-8 w-px bg-proton-border/50" />
               <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isSystemActive ? "bg-green-500 animate-pulse" : "bg-proton-muted")} />
                  <span className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">{isSystemActive ? t.available : t.busy}</span>
               </div>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative">
            <AnimatePresence>
               {isEditingInstructions && (
                 <motion.div 
                   initial={{ opacity: 0, y: -20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   className="absolute inset-x-0 top-0 z-20 p-8 bg-proton-card/95 backdrop-blur shadow-xl border-b border-proton-border space-y-4"
                 >
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-proton-accent">
                          {language === 'ka' ? 'სისტემური ინსტრუქციები' : 'System Instructions'}
                       </h4>
                       <button onClick={() => setIsEditingInstructions(false)} className="text-proton-muted">
                          <X size={18} />
                       </button>
                    </div>
                    <textarea 
                      value={tempInstructions}
                      onChange={(e) => setTempInstructions(e.target.value)}
                      className="w-full h-48 bg-proton-bg border border-proton-border rounded-2xl p-4 text-xs font-medium focus:ring-1 focus:ring-proton-accent outline-none resize-none custom-scrollbar"
                    />
                    <div className="flex justify-end gap-3">
                       <button 
                         onClick={() => {
                           setTempInstructions(selectedPersona.systemInstruction);
                           setIsEditingInstructions(false);
                         }}
                         className="px-6 py-2 rounded-xl text-[10px] font-black uppercase text-proton-muted hover:text-proton-text transition-all"
                       >
                         {language === 'ka' ? 'გაუქმება' : 'Cancel'}
                       </button>
                       <button 
                         onClick={handleSaveInstructions}
                         className="flex items-center gap-2 px-6 py-2 rounded-xl bg-proton-accent text-proton-bg text-[10px] font-black uppercase shadow-lg shadow-proton-accent/20 hover:brightness-110 active:scale-95 transition-all"
                       >
                         <Save size={14} />
                         {language === 'ka' ? 'შენახვა' : 'Save Changes'}
                       </button>
                    </div>
                 </motion.div>
               )}
            </AnimatePresence>

            {messages.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                  <MessageSquare size={48} className="mb-4 text-proton-muted" />
                  <p className="text-sm font-bold uppercase tracking-[0.2em]">{t.start_convo.replace('{name}', language === 'ka' ? selectedPersona.nameGe : selectedPersona.name)}</p>
               </div>
            ) : (
               messages.map((m, i) => (
                 <div key={i} className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[80%] px-6 py-4 rounded-3xl font-medium text-sm leading-relaxed",
                      m.role === 'user' 
                        ? "bg-proton-accent text-proton-on-accent rounded-tr-none shadow-lg shadow-proton-accent/10" 
                        : "bg-proton-bg border border-proton-border rounded-tl-none"
                    )}>
                       {m.content}
                    </div>
                    <span className="text-[9px] font-bold text-proton-muted uppercase mt-2 px-2">
                       {m.role === 'user' ? 'You' : (language === 'ka' ? selectedPersona.nameGe : selectedPersona.name)} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                 placeholder={t.chat_placeholder.replace('{name}', language === 'ka' ? selectedPersona.nameGe : selectedPersona.name)}
                 disabled={!isSystemActive || loading}
                 className="w-full bg-proton-card border border-proton-border rounded-2xl px-6 py-4 pr-16 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-proton-accent/20 focus:border-proton-accent transition-all shadow-inner"
               />
               <button 
                 onClick={handleSend}
                 disabled={!isSystemActive || loading || !input.trim()}
                 className={cn(
                   "absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-proton-accent text-proton-on-accent flex items-center justify-center transition-all shadow-md",
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

const DocumentationView = ({ language }: { language: 'en' | 'ka' }) => {
  const t = language === 'ka' 
    ? {
        title: "ინფორმაცია",
        subtitle: "პლატფორმის შესახებ",
        governance: "სტრუქტურა",
        owner_name: "ნინო გოშთელიანი",
        dev_name: "პროტონი",
        owner_label: "დამფუძნებელი",
        dev_label: "ტექ. პარტნიორი",
        owner_role: "ხედვა & სტრატეგია",
        dev_role: "არქიტექტურა & AI",
        desc: "პროტონი არის ინოვაციური პლატფორმა, რომელიც შექმნილია ნინო გოშთელიანის ხედვისა და პროტონის ტექნოლოგიური შესაძლებლობების სინთეზით. ჩვენი მიზანია შევქმნათ მარტივი და ეფექტური ციფრული გარემო.",
        principles: [
          { title: "უსაფრთხოება", desc: "თქვენი მონაცემები დაცულია." },
          { title: "სიმარტივე", desc: "ყველაფერი არის გასაგები და ინტუიციური." },
          { title: "ინოვაცია", desc: "AI ტექნოლოგიების ჭკვიანი გამოყენება." }
        ],
        signatures: "დადასტურებულია",
        mission: "ჩვენი მისიაა ტექნოლოგია გავხადოთ ადამიანისთვის სასარგებლო."
      }
    : {
        title: "Information",
        subtitle: "About the Platform",
        governance: "Structure",
        owner_name: "Nino Goshteliani",
        dev_name: "Proton",
        owner_label: "Founder",
        dev_label: "Tech Partner",
        owner_role: "Vision & Strategy",
        dev_role: "Architecture & AI",
        desc: "Proton is an innovative platform created by the synthesis of Nino Goshteliani's vision and Proton's technological capabilities. Our goal is to create a simple and effective digital environment.",
        principles: [
          { title: "Security", desc: "Your data is protected." },
          { title: "Simplicity", desc: "Everything is clear and intuitive." },
          { title: "Innovation", desc: "Smart use of AI technologies." }
        ],
        signatures: "Verified",
        mission: "Our mission is to make technology useful for humans."
      };

  return (
    <div className="min-h-screen bg-proton-bg p-4 md:p-12 space-y-8 animate-in fade-in duration-700 overflow-y-auto">
      {/* Simple Header */}
      <div className="border-b border-proton-border pb-6">
        <div className="flex items-center gap-2 text-proton-accent mb-2">
          <ShieldCheck size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.governance}</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-proton-text uppercase">{t.title}</h1>
        <p className="text-sm md:text-base font-medium text-proton-muted mt-1">{t.subtitle}</p>
      </div>

      <div className="space-y-8">
        {/* Description Card */}
        <div className="bg-proton-accent/5 border border-proton-accent/10 rounded-3xl p-6 md:p-10">
          <p className="text-base md:text-xl text-proton-text font-medium leading-relaxed max-w-3xl">
            {t.desc}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
             {t.principles.map((p, idx) => (
               <div key={idx} className="bg-proton-card/50 border border-proton-border p-5 rounded-2xl">
                 <p className="text-[10px] font-black text-proton-accent uppercase tracking-widest mb-1">{p.title}</p>
                 <p className="text-xs font-medium text-proton-muted leading-relaxed">{p.desc}</p>
               </div>
             ))}
          </div>
        </div>

        {/* Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-proton-card rounded-3xl border border-proton-border p-6 md:p-8 flex items-start gap-5">
            <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 flex items-center justify-center text-proton-accent shrink-0">
              <UserIcon size={24} />
            </div>
            <div>
              <p className="text-[9px] font-black text-proton-accent uppercase tracking-widest mb-0.5">{t.owner_label}</p>
              <h3 className="text-xl font-black tracking-tight text-proton-text">{t.owner_name}</h3>
              <p className="text-[10px] font-bold text-proton-muted uppercase tracking-widest mt-1">{t.owner_role}</p>
            </div>
          </div>

          <div className="bg-proton-card rounded-3xl border border-proton-border p-6 md:p-8 flex items-start gap-5">
            <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 flex items-center justify-center text-proton-accent shrink-0">
              <Cpu size={24} />
            </div>
            <div>
              <p className="text-[9px] font-black text-proton-accent uppercase tracking-widest mb-0.5">{t.dev_label}</p>
              <h3 className="text-xl font-black tracking-tight text-proton-text">{t.dev_name}</h3>
              <p className="text-[10px] font-bold text-proton-muted uppercase tracking-widest mt-1">{t.dev_role}</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8 opacity-40">
          <p className="text-sm md:text-lg font-medium italic text-proton-muted max-w-2xl mx-auto">
            "{t.mission}"
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-proton-muted uppercase tracking-widest">
            <Sparkles size={12} className="text-proton-accent" />
            {t.signatures}
          </div>
        </div>
      </div>
    </div>
  );
};

const Web3View = ({ uiMode, language }: { uiMode: 'operator' | 'artisan', language: 'en' | 'ka' }) => {
  const { address, isConnected } = useAccount();
  const t = translations[language].finance;
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
                <span className="text-xs font-semibold text-proton-muted uppercase tracking-widest">{t.disconnected}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{t.title}</h2>
              <p className="text-sm text-proton-muted leading-relaxed">
                {t.connect_msg}
              </p>
            </div>

            <div className="pt-4 flex justify-center">
              <ConnectButton label={t.connect_btn} />
            </div>

            <p className="text-[10px] text-proton-muted/40 font-semibold uppercase tracking-[0.2em] pt-8">
              Secured by Platform Infrastructure
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-12 animate-in zoom-in-95 duration-500">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t.title}</h2>
              <p className="text-proton-muted text-sm leading-relaxed max-w-md">
                 {t.description}
              </p>
            </div>
            <div className="flex items-center gap-3 bg-proton-card p-1.5 pl-4 rounded-2xl border border-proton-border">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-green-500 uppercase tracking-[0.2em]">{language === 'ka' ? 'ონლაინ' : 'Online'}</span>
              </div>
              <ConnectButton />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Treasury Section */}
            <div className="lg:col-span-2 space-y-6">
                <div className="proton-glass p-8 rounded-[32px] md:rounded-[40px] border border-proton-accent/20 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                       <CreditCard size={120} className="text-proton-accent" />
                   </div>
                   <div className="relative z-10 space-y-6 md:space-y-8">
                      <div className="flex items-center justify-between">
                          <div className="space-y-1">
                              <h3 className="text-xs font-bold uppercase tracking-widest text-proton-muted">{t.treasury}</h3>
                              <p className="text-2xl md:text-5xl font-bold tracking-tighter">
                                  {balance ? parseFloat(balance.formatted).toFixed(4) : '0.0000'} <span className="text-proton-accent">{balance?.symbol}</span>
                              </p>
                          </div>
                          <div className="p-3 md:p-4 rounded-2xl bg-proton-accent/10 text-proton-accent border border-proton-accent/20">
                              <Wallet size={24} className="md:w-8 md:h-8" />
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
                            <h4 className="font-bold text-lg">{t.smart_invoicing}</h4>
                            <p className="text-xs text-proton-muted uppercase tracking-tighter">{t.invoice_desc}</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-proton-accent uppercase tracking-[0.2em] font-bold pt-2">
                             {t.generate_now} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    <div className="proton-glass p-6 rounded-[32px] border border-proton-border space-y-4 shadow-sm">
                        <div className="w-12 h-12 rounded-2xl bg-proton-secondary/10 text-proton-secondary flex items-center justify-center">
                            <Globe size={24} />
                        </div>
                        <div>
                             <h4 className="font-bold text-lg">{t.nbg_rate}</h4>
                             <p className="text-xs text-proton-muted">{language === 'ka' ? 'კურსი' : 'Rate'}: $1 = {gelRate} GEL</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-proton-secondary uppercase tracking-[0.2em] font-bold pt-2">
                             {t.nbg_sync}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Section: Exchanges & Info */}
            <div className="space-y-6">
                <div className="proton-glass p-6 rounded-[32px] border border-white/5 space-y-6">
                    <h4 className="text-[11px] font-mono font-bold text-proton-muted uppercase tracking-[0.3em]">{t.off_ramps}</h4>
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
                             {t.off_ramps_notice}
                        </p>
                    </div>
                </div>

                <div className="proton-glass p-6 rounded-[32px] border border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                           <Activity size={16} />
                        </div>
                        <h4 className="font-bold text-sm">{t.ledger}</h4>
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
                                 <label className="text-[10px] font-sans text-proton-muted uppercase tracking-widest font-bold">Client Name / კლიენტი</label>
                                 <input type="text" placeholder="e.g. Acme Tech Corp" className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none" />
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-sans text-proton-muted uppercase tracking-widest font-bold">Service Type / სერვისი</label>
                                 <select className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none cursor-pointer">
                                     <option>AI Analysis & Automation</option>
                                     <option>Smart Contract Audit</option>
                                     <option>Compute Cluster Lease</option>
                                     <option>Digital Persona Concierge</option>
                                 </select>
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-sans text-proton-muted uppercase tracking-widest font-bold">Currency / ვალუტა</label>
                                 <select className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none cursor-pointer">
                                     <option>ETH (Ethereum Native)</option>
                                     <option>GEL (NBG Fixed Rate)</option>
                                     <option>USD (International)</option>
                                     <option>EUR (European)</option>
                                 </select>
                             </div>
                             <div className="space-y-2">
                                 <label className="text-[10px] font-sans text-proton-muted uppercase tracking-widest font-bold">Amount / თანხა</label>
                                 <input type="number" placeholder="0.05" className="w-full bg-proton-bg border border-proton-border rounded-2xl px-4 py-3 text-sm focus:border-proton-accent outline-none" />
                             </div>
                             <div className="space-y-2 sm:col-span-2">
                                 <label className="text-[10px] font-sans text-proton-muted uppercase tracking-widest font-bold">Due Date / ვადა</label>
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




const ImageView = ({ uiMode, isSystemActive = true, language }: { uiMode: 'operator' | 'artisan', isSystemActive?: boolean, language: 'en' | 'ka' }) => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = translations[language].image_studio;

  const handleGenerate = async () => {
    if (!isSystemActive || !prompt.trim()) return;
    setLoading(true);
    try {
      const result = await generateOrEditImage(prompt);
      setImage(result);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('PROHIBITED_CONTENT') || error?.toString().includes('PROHIBITED_CONTENT')) {
        alert(t.safety_error);
      } else {
        alert(t.fail_error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t.title}</h2>
        <p className="text-proton-muted text-sm mt-1">{t.subtitle}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <div className="proton-glass p-4 sm:p-6 md:p-8 rounded-3xl space-y-6">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={!isSystemActive}
            placeholder={isSystemActive ? t.placeholder : t.offline}
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
                    {t.generating}
                </>
            ) : (
                isSystemActive ? (
                <>
                    <ImageIcon size={18} />
                    {t.generate_btn}
                </>
                ) : (
                <>
                    <Lock size={18} />
                    {t.limited}
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
  uiMode,
  language
}: {
  workflow: Workflow,
  onSave: (workflow: Workflow) => void,
  onClose: () => void,
  personas: Persona[],
  uiMode: 'operator' | 'artisan',
  language: 'en' | 'ka'
}) => {
  const [formData, setFormData] = useState<Workflow>(workflow);
  const [editorMode, setEditorMode] = useState<'form' | 'flow'>('form');
  const t = translations[language].editor;

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
               <h3 className="text-xl font-bold tracking-tight">{t.title}</h3>
               <p className="text-proton-muted text-xs uppercase tracking-widest">ID: {formData.id?.slice(-6)}</p>
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
                {translations[language].sidebar.settings}
             </button>
             <button 
                onClick={() => setEditorMode('flow')} 
                className={cn(
                    "px-6 py-2.5 text-xs font-bold rounded-xl transition-all duration-300",
                    editorMode === 'flow' ? 'bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20' : 'text-proton-muted hover:text-proton-text'
                )}
             >
                {translations[language].sidebar.blueprints}
             </button>
          </div>
        </div>
        {editorMode === 'form' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest flex justify-between">
                <span>{t.name}</span>
                <span className="opacity-50">{t.required}</span>
              </label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t.placeholder_title}
                className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all shadow-inner"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">{t.trigger}</label>
                  <input 
                    type="text" 
                    value={formData.trigger}
                    onChange={e => setFormData(prev => ({ ...prev, trigger: e.target.value }))}
                    placeholder={t.trigger_placeholder}
                    className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all shadow-inner"
                  />
                  <p className="text-[9px] text-proton-muted italic px-1">{t.trigger_example}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">{t.action}</label>
                  <input 
                    type="text" 
                    value={formData.action}
                    onChange={e => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    placeholder={t.action_placeholder}
                    className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all shadow-inner"
                  />
                </div>
            </div>

            {/* Workflow Steps Management */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">{t.steps}</label>
                <button 
                  onClick={() => {
                    const newStep: WorkflowStep = { id: Date.now().toString(), label: 'New Step', description: 'Step description' };
                    setFormData(prev => ({ ...prev, steps: [...(prev.steps || []), newStep] }));
                  }}
                  className="text-[10px] font-bold text-proton-accent hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> {t.add_step}
                </button>
              </div>
              <div className="space-y-2">
                {(formData.steps || []).length === 0 && (
                  <div className="p-4 rounded-xl border border-dashed border-proton-border/50 text-center text-[10px] text-proton-muted italic font-mono">
                    {t.no_steps}
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
                        placeholder={t.step_label}
                      />
                      <input 
                        value={step.description}
                        onChange={(e) => {
                          const newSteps = [...(formData.steps || [])];
                          newSteps[idx] = { ...step, description: e.target.value };
                          setFormData(prev => ({ ...prev, steps: newSteps }));
                        }}
                        className="bg-transparent border-none p-0 text-[10px] text-proton-muted w-full focus:outline-none"
                        placeholder={t.step_desc}
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
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">{t.persona_label}</label>
              <select 
                value={formData.personaId}
                onChange={e => setFormData(prev => ({ ...prev, personaId: e.target.value }))}
                className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all shadow-inner cursor-pointer"
              >
                <option value="">{t.select_persona}</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
                ))}
              </select>
              <p className="text-[9px] text-proton-muted italic px-1">{t.persona_desc}</p>
            </div>
            <button 
              onClick={async () => {
                const analysis = await analyzeWorkflow(formData);
                alert(analysis);
              }}
              className="w-full py-4 rounded-2xl border border-proton-accent/30 text-proton-accent text-xs font-bold hover:bg-proton-accent/10 transition-all flex items-center justify-center gap-2 group"
            >
              <Sparkles size={16} className="group-hover:animate-spin" />
              {t.optimize_btn}
            </button>
          </div>
        ) : (
          <div className="h-[500px] w-full mt-4 shrink-0">
            <EnterpriseWorkflowBuilder workflow={formData} onSave={setFormData} language={language} />
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
  language,
  isSystemActive = true
}: {
  workflows: Workflow[],
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>,
  personas: Persona[],
  user: any,
  uiMode: 'operator' | 'artisan',
  language: 'en' | 'ka',
  isSystemActive?: boolean
}) => {
  const t = translations[language].workflows;
  const common = translations[language].common;
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
      name: t.new_process, 
      trigger: t.customer_inquiry, 
      action: t.send_quote, 
      personaId: '',
      steps: [
        { id: 'step-1', label: t.analyze_needs, description: t.analyze_desc }
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
          <h2 className="text-3xl font-bold tracking-tight">{t.title}</h2>
          <p className="text-proton-muted text-sm mt-1">{t.subtitle}</p>
        </div>
        <button 
          onClick={() => {
            if (!isSystemActive) return;
            setConfirmation({
              message: t.create_confirm,
              action: createWorkflow
            });
          }}
          disabled={!isSystemActive}
          className="px-5 py-3 rounded-2xl bg-proton-accent text-proton-bg font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-proton-accent/20 disabled:opacity-50"
        >
          {isSystemActive ? <Plus size={20} /> : <Lock size={16} />}
          {isSystemActive ? t.add_workflow : t.locked}
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
                    <h3 className="font-bold text-xl">{t.confirm_action}</h3>
                    <p className="text-sm text-proton-muted leading-relaxed">{confirmation.message}</p>
                </div>
                <div className="flex gap-3 pt-2">
                    <button onClick={() => setConfirmation(null)} className="flex-1 py-3 rounded-xl border border-proton-border text-xs font-bold hover:bg-proton-card transition-all">{common.cancel}</button>
                    <button onClick={() => { confirmation.action(); setConfirmation(null); }} className="flex-1 py-3 rounded-xl bg-proton-accent text-proton-bg text-xs font-bold hover:scale-105 transition-all shadow-lg shadow-proton-accent/20">{language === 'ka' ? 'დადასტურება' : 'Confirm'}</button>
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
            <h3 className="text-2xl font-bold">{t.no_workflows}</h3>
            <p className="text-proton-muted max-w-sm mx-auto leading-relaxed">
              {t.no_workflows_desc}
            </p>
          </div>
          <button 
            onClick={() => setConfirmation({
              message: t.create_confirm,
              action: createWorkflow
            })}
            className="px-8 py-4 rounded-2xl bg-proton-accent text-proton-bg font-bold hover:scale-105 transition-all shadow-xl shadow-proton-accent/20"
          >
            {t.create_process}
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
            language={language}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const CabinetView = ({ 
  profile, 
  setProfile, 
  history,
  customAvatars,
  personas,
  user,
  onSignIn,
  onSignOut,
  uiMode,
  stats: userStats,
  onNavigate
}: { 
  profile: UserProfile, 
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>, 
  history: PersonaHistory,
  customAvatars: { [id: string]: string },
  personas: Persona[],
  user: any,
  onSignIn: () => void,
  onSignOut: () => void,
  uiMode: 'operator' | 'artisan',
  stats: { storageGB: number, computeTimeHours: number, aiTokens: number, computeCycles?: number, node_id?: string },
  onNavigate: (view: any) => void
}) => {
  const language = profile.language;
  const common = translations[language].common;
  const cab = translations[language].cabinet;
  const t = translations[language].cabinet;
  
  const personal = {
    title: language === 'ka' ? 'პირადი სამუშაო სივრცე' : 'Personal Workspace',
    overview: language === 'ka' ? 'ოპერაციული მიმოხილვა' : 'Operational Overview',
    dash_title: language === 'ka' ? 'მართვის ჰაბი' : 'Control Hub'
  };

  const [cabinetTab, setCabinetTab] = useState<'overview' | 'modules' | 'security'>('overview');

  const mainModules = [
    { id: 'finance', icon: Wallet, label: language === 'ka' ? 'ფინანსები' : 'Finance', desc: t.finance_desc, color: 'text-blue-500', border: 'border-blue-500/20', bg: 'bg-blue-500/5' },
    { id: 'blueprints', icon: Workflow, label: language === 'ka' ? 'პროცესები' : 'Workflows', desc: t.blueprints_desc, color: 'text-proton-accent', border: 'border-proton-accent/20', bg: 'bg-proton-accent/5' },
    { id: 'device', icon: Cpu, label: language === 'ka' ? 'მოწყობილობა' : 'Hardware', desc: language === 'ka' ? 'სისტემური რესურსების მართვა' : 'System resources management', color: 'text-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
    { id: 'documentation', icon: FileText, label: language === 'ka' ? 'დოკუმენტაცია' : 'Docs', desc: language === 'ka' ? 'სისტემური სახელმძღვანელო' : 'System documentation', color: 'text-emerald-500', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
    { id: 'settings', icon: Settings, label: language === 'ka' ? 'პარამეტრები' : 'Settings', desc: language === 'ka' ? 'ინტერფეისის კონფიგურაცია' : 'Interface configuration', color: 'text-slate-500', border: 'border-slate-500/20', bg: 'bg-slate-500/5' },
  ];

  const formattedJoinDate = useMemo(() => {
     if (!user?.metadata?.creationTime) return language === 'ka' ? 'აპრილი 2024' : 'APRIL 2024';
     const date = new Date(user.metadata.creationTime);
     return date.toLocaleDateString(language === 'ka' ? 'ka-GE' : 'en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  }, [user, language]);

  const recentActivity = [
    { id: 1, type: 'login', label: language === 'ka' ? 'ავტორიზაცია' : 'Session Start', time: '10:42', date: '28 APR', icon: LogIn, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 2, type: 'module', label: language === 'ka' ? 'ფინანსური მოდული' : 'Finance Access', time: '09:15', date: '28 APR', icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
    { id: 3, type: 'ai', label: language === 'ka' ? 'AI გენერაცია' : 'AI Generation', time: '14:20', date: '27 APR', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  const profileStrength = useMemo(() => {
    let score = 20; // base for being logged in
    if (user?.displayName) score += 20;
    if (user?.photoURL) score += 20;
    if (user?.emailVerified) score += 20;
    if (profile.phoneNumber) score += 20;
    return score;
  }, [user, profile]);

  return (
    <div className="max-w-6xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 px-2 sm:px-4">
      {/* Professional Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 md:gap-8 mb-8 md:mb-12 pt-4 md:pt-8 bg-proton-card/30 p-6 rounded-[40px] border border-proton-border/30">
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <div className="relative group">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[40px] bg-proton-bg border border-gray-200/10 flex items-center justify-center overflow-hidden shadow-2xl group-hover:shadow-proton-accent/20 transition-all duration-700 group-hover:rotate-6">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-gray-400">{(user?.displayName || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 border-4 border-proton-bg rounded-full shadow-lg" />
          </div>
          <div>
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3 mb-1">
              <h1 className="text-3xl md:text-5xl font-black text-proton-text tracking-tighter uppercase italic">
                {user?.displayName || (language === 'ka' ? 'მომხმარებელი' : 'User')}
              </h1>
              {user && <CheckCircle2 size={24} className="text-proton-accent animate-pulse" />}
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <p className="text-proton-muted font-bold text-sm md:text-base font-mono">
                {user?.email || (language === 'ka' ? 'სისტემური იდენტიფიკატორი' : 'System ID')}
              </p>
              {user && (
                <span className="px-3 py-1 bg-proton-accent/10 text-[9px] font-black text-proton-accent rounded-full uppercase tracking-[0.2em] border border-proton-accent/20 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-proton-accent shadow-[0_0_8px_rgba(0,242,255,0.8)]" />
                  K-ID: {userStats.node_id || user.uid.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-center">
          <button className="p-4 rounded-2xl bg-proton-bg border border-proton-border text-proton-muted hover:text-proton-accent hover:border-proton-accent transition-all relative">
            <Bell size={20} />
            <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-proton-bg" />
          </button>
          {!user ? (
            <button onClick={onSignIn} className="flex-1 md:flex-none px-8 py-4 bg-proton-accent text-proton-bg rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-proton-accent/20">
              {common.signin}
            </button>
          ) : (
            <button onClick={onSignOut} className="flex-1 md:flex-none px-8 py-4 bg-proton-bg border border-red-500/30 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center justify-center gap-3">
              <LogOut size={18} />
              {common.signout}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs for Cabinet */}
      <div className="flex items-center gap-2 mb-8 bg-proton-card/20 p-1.5 rounded-2xl border border-proton-border/30 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: language === 'ka' ? 'მიმოხილვა' : 'Overview', icon: Grid },
          { id: 'modules', label: language === 'ka' ? 'ინსტრუმენტები' : 'Modules', icon: Layers },
          { id: 'security', label: language === 'ka' ? 'უსაფრთხოება' : 'Security', icon: Shield },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setCabinetTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              cabinetTab === tab.id 
                ? "bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20" 
                : "text-proton-muted hover:text-proton-text hover:bg-white/5"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {cabinetTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left Column: Stats & Environment */}
            <div className="lg:col-span-2 space-y-8">
              <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/5 to-transparent pointer-events-none" />
                <div className="flex items-center justify-between mb-10 relative z-10">
                  <div>
                    <h2 className="text-2xl font-black text-proton-text uppercase tracking-tight italic">{personal.title}</h2>
                    <p className="text-[10px] text-proton-muted font-black uppercase tracking-[0.3em] font-mono mt-1">{personal.overview}</p>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 bg-proton-accent/10 rounded-2xl border border-proton-accent/20">
                    <Activity size={18} className="text-proton-accent animate-pulse" />
                    <span className="text-[9px] font-black text-proton-accent uppercase tracking-widest">{personal.dash_title}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-10">
                  <div className="space-y-3 group">
                    <div className="flex items-center gap-3 text-proton-muted mb-1 group-hover:text-blue-400 transition-colors">
                      <Database size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{cab.storage}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-proton-text italic tracking-tighter">{userStats.storageGB.toFixed(1)}</span>
                      <span className="text-xs font-black text-proton-muted uppercase tracking-widest italic">GB</span>
                    </div>
                    <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-proton-border/30">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                        style={{ width: `${Math.min((userStats.storageGB / 10) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>

                  <div className="space-y-3 group">
                    <div className="flex items-center gap-3 text-proton-muted mb-1 group-hover:text-amber-400 transition-colors">
                      <Cpu size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{cab.compute_time}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-proton-text italic tracking-tighter">{userStats.computeTimeHours.toFixed(0)}</span>
                      <span className="text-xs font-black text-proton-muted uppercase tracking-widest italic">H</span>
                    </div>
                    <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-proton-border/30">
                      <div className="h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: '65%' }} />
                    </div>
                  </div>

                  <div className="space-y-3 group">
                    <div className="flex items-center gap-3 text-proton-muted mb-1 group-hover:text-proton-accent transition-colors">
                      <Zap size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Compute Cycles</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-proton-text italic tracking-tighter">{userStats.computeCycles || 0}</span>
                      <span className="text-xs font-black text-proton-muted uppercase tracking-widest italic">LN</span>
                    </div>
                    <div className="h-2 w-full bg-proton-bg/60 rounded-full overflow-hidden border border-proton-border/30">
                      <div className="h-full bg-proton-accent rounded-full shadow-[0_0_10px_rgba(0,242,255,0.5)]" style={{ width: '42%' }} />
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex flex-wrap gap-4 relative z-10">
                   <button 
                     onClick={() => onNavigate('finance')}
                     className="px-6 py-3 bg-proton-accent text-proton-bg rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 group hover:scale-105 transition-all shadow-xl shadow-proton-accent/20"
                   >
                     <Wallet size={16} />
                     {language === 'ka' ? 'ფინანსების მართვა' : 'Manage Finance'}
                     <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                   </button>
                   <button 
                     onClick={() => setCabinetTab('modules')}
                     className="px-6 py-3 bg-proton-bg border border-proton-border text-proton-text rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:border-proton-accent transition-all"
                   >
                     <Layers size={16} />
                     {language === 'ka' ? 'ყველა ხელსაწყო' : 'All Modules'}
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">{t.activity}</h3>
                       <History size={18} className="text-proton-muted" />
                    </div>
                    <div className="space-y-4">
                       {recentActivity.map(act => (
                          <div key={act.id} className="flex items-center justify-between p-4 rounded-2xl border border-proton-border/30 hover:border-proton-accent/30 hover:bg-proton-accent/5 transition-all group">
                             <div className="flex items-center gap-4">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", act.bg.replace('50', '500/10'), act.color.replace('500', '500'))}>
                                   <act.icon size={18} />
                                </div>
                                <div>
                                   <p className="text-[11px] font-black text-proton-text uppercase tracking-tight">{act.label}</p>
                                   <p className="text-[9px] text-proton-muted font-bold uppercase tracking-widest font-mono">{act.date} • {act.time}</p>
                                </div>
                             </div>
                             <ChevronRight size={14} className="text-proton-muted group-hover:text-proton-accent transition-colors" />
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50 flex flex-col justify-between">
                    <div>
                       <div className="flex items-center justify-between mb-8">
                          <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">{t.profile_strength}</h3>
                          <Shield size={18} className="text-proton-accent" />
                       </div>
                       <div className="relative pt-1 mb-6">
                          <div className="flex mb-3 items-center justify-between">
                             <div>
                                <span className="text-[9px] font-black inline-block py-1 px-3 uppercase rounded-full text-proton-accent bg-proton-accent/10 border border-proton-accent/20 tracking-widest">
                                   {profileStrength === 100 ? (language === 'ka' ? 'დასრულებული' : 'Complete') : (language === 'ka' ? 'მიმდინარეობს' : 'In Progress')}
                                </span>
                             </div>
                             <div className="text-right">
                                <span className="text-xl font-black italic text-proton-accent">
                                   {profileStrength}%
                                </span>
                             </div>
                          </div>
                          <div className="flex h-1.5 overflow-hidden bg-proton-bg/60 rounded-full border border-proton-border/30">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${profileStrength}%` }}
                               transition={{ duration: 1.5, ease: 'easeOut' }}
                               className="flex flex-col justify-center text-center text-white bg-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.6)] whitespace-nowrap"
                             />
                          </div>
                       </div>
                       <p className="text-[10px] text-proton-muted font-bold uppercase tracking-wider leading-relaxed">
                          {language === 'ka' 
                            ? 'დაასრულეთ თქვენი პროფილი პერსონალიზებული AI გამოცდილების მისაღებად და კვანძების ოპტიმიზაციისთვის.' 
                            : 'Complete your profile to unlock more personalized AI interactions and better service distribution.'}
                       </p>
                    </div>
                    <button className="mt-8 py-4 bg-proton-bg border border-proton-border rounded-2xl text-[10px] font-black text-proton-text uppercase tracking-[0.2em] hover:border-proton-accent hover:text-proton-accent transition-all active:scale-95 shadow-inner">
                       {language === 'ka' ? 'პროფილის რედაქტირება' : 'Complete My Profile'}
                    </button>
                 </div>
              </div>
            </div>

            {/* Right Column: Information & Security */}
            <div className="space-y-8">
              <div className="bg-proton-text p-10 rounded-[40px] text-proton-bg shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-40 h-40 bg-proton-accent/20 rounded-full -translate-y-20 translate-x-20 group-hover:scale-150 transition-transform duration-1000 blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-proton-bg/60">{language === 'ka' ? 'ვერიფიცირებული კვანძი' : 'VERIFIED NODE'}</span>
                    <ShieldCheck size={24} className="text-proton-bg" />
                  </div>
                  <div className="mb-10">
                    <p className="text-proton-bg/60 text-[10px] font-black uppercase tracking-widest mb-1">{t.member_since}</p>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter">{formattedJoinDate}</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 bg-proton-bg/10 rounded-2xl border border-proton-bg/10">
                      <div className="flex items-center gap-3">
                        <Fingerprint size={18} />
                        <span className="text-[10px] font-black uppercase tracking-wider">{cab.two_factor}</span>
                      </div>
                      <div className="w-10 h-6 bg-proton-bg/20 rounded-full flex items-center px-1.5 cursor-pointer border border-proton-bg/10">
                        <div className="w-3.5 h-3.5 bg-proton-bg rounded-full ml-auto shadow-sm" />
                      </div>
                    </div>
                    <button className="w-full py-5 bg-proton-bg text-proton-text rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] hover:scale-105 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95">
                      <Download size={18} />
                      {language === 'ka' ? 'იდენტობის ექსპორტი' : 'Export Identity'}
                    </button>
                  </div>
                </div>
              </div>

              {/* System Health */}
              <div className="proton-glass p-8 rounded-[40px] border border-proton-border/50">
                 <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xs font-black text-proton-text uppercase tracking-[0.3em] italic">{t.health}</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Active</span>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="flex items-center justify-between group">
                       <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider group-hover:text-proton-accent transition-colors">Cloud Latency</span>
                       <span className="text-sm font-black text-proton-text font-mono">14ms</span>
                    </div>
                    <div className="flex items-center justify-between group">
                       <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider group-hover:text-proton-accent transition-colors">System Uptime</span>
                       <span className="text-sm font-black text-proton-text font-mono">99.9%</span>
                    </div>
                    <div className="flex items-center justify-between group">
                       <span className="text-[10px] font-black text-proton-muted uppercase tracking-wider group-hover:text-proton-accent transition-colors">Node Integrity</span>
                       <span className="text-sm font-black text-green-500 font-mono uppercase">Secure</span>
                    </div>
                    <button className="w-full mt-6 py-4 rounded-2xl bg-proton-bg/40 border border-proton-border/50 text-[9px] font-black text-proton-muted uppercase tracking-widest hover:border-proton-accent hover:text-proton-accent transition-all shadow-inner">
                       {language === 'ka' ? 'სრული დიაგნოსტიკა' : 'Full Diagnostics'}
                    </button>
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {cabinetTab === 'modules' && (
          <motion.div 
            key="modules"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {mainModules.map((module) => (
              <button 
                key={module.id} 
                onClick={() => onNavigate(module.id)}
                className="proton-glass p-8 rounded-[40px] border border-proton-border/50 text-left group transition-all relative overflow-hidden hover:border-proton-accent hover:shadow-[0_0_30px_rgba(0,242,255,0.05)] h-full flex flex-col items-start justify-between"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-proton-accent/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="w-full relative z-10">
                  <div className={cn("w-16 h-16 rounded-[28px] border flex items-center justify-center mb-8 group-hover:rotate-12 transition-all duration-500 shadow-xl", module.bg, module.border, module.color)}>
                    <module.icon size={28} />
                  </div>
                  <h3 className="text-xl font-black text-proton-text mb-2 italic uppercase tracking-tighter">{module.label}</h3>
                  <p className="text-[11px] text-proton-muted font-bold tracking-wide leading-relaxed mb-10 opacity-70 group-hover:opacity-100 transition-opacity">{module.desc}</p>
                </div>
                
                <div className="w-full pt-6 border-t border-proton-border/30 relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.25em] text-proton-accent group-hover:scale-105 transition-transform origin-left">
                    {language === 'ka' ? 'მოდულის გახსნა' : 'Access Hub'}
                    <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform h-3 w-3" />
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-proton-accent/20 group-hover:bg-proton-accent transition-colors" />
                </div>
              </button>
            ))}
          </motion.div>
        )}

        {cabinetTab === 'security' && (
          <motion.div 
            key="security"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* Security Settings Content */}
             <div className="proton-glass p-10 rounded-[40px] border border-proton-border/50 space-y-8">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                      <ShieldAlert size={24} />
                   </div>
                   <div>
                      <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">Access Control</h3>
                      <p className="text-[10px] text-proton-muted font-black uppercase tracking-widest leading-none">Security Permissions</p>
                   </div>
                </div>
                <div className="space-y-4">
                   {[
                     { label: 'Cloud Wallet Auth', active: true, icon: Key },
                     { label: 'Agent Verification', active: true, icon: UserCheck },
                     { label: 'Global Privacy Shield', active: false, icon: Shield },
                   ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-proton-bg/40 border border-proton-border/50">
                         <div className="flex items-center gap-4 text-proton-text">
                            <item.icon size={18} className={item.active ? "text-proton-accent" : "text-proton-muted"} />
                            <span className="text-[11px] font-black uppercase tracking-wider">{item.label}</span>
                         </div>
                         <div className={cn("w-12 h-6 rounded-full flex items-center px-1 border transition-all cursor-pointer", item.active ? "bg-proton-accent/20 border-proton-accent/40" : "bg-proton-bg border-proton-border")}>
                            <div className={cn("w-4 h-4 rounded-full shadow-sm transition-all", item.active ? "translate-x-6 bg-proton-accent" : "bg-proton-muted")} />
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             <div className="proton-glass p-10 rounded-[40px] border border-proton-border/50 flex flex-col justify-between">
                <div className="space-y-6">
                   <h3 className="text-lg font-black text-proton-text uppercase italic tracking-tight">Identity Management</h3>
                   <p className="text-xs text-proton-muted font-bold leading-relaxed mb-6">
                      Your decentralized identity is secured via a multi-layered cryptographic shield. You can rotate keys or export your full node reputation at any time.
                   </p>
                   <div className="p-6 rounded-3xl bg-proton-accent/5 border border-proton-accent/10 space-y-4">
                      <div className="flex items-center gap-3 text-proton-accent">
                         <Circle size={12} className="fill-current" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Active Keys: 3/3</span>
                      </div>
                      <div className="flex items-center gap-3 text-green-500">
                         <Circle size={12} className="fill-current animate-pulse" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Node Reputation: Excellent</span>
                      </div>
                   </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-12">
                   <button className="flex-1 py-4 px-6 rounded-2xl bg-proton-bg border border-proton-border text-[9px] font-black uppercase tracking-[0.2em] hover:border-proton-accent hover:text-proton-accent transition-all text-center">Rotate Keys</button>
                   <button className="flex-1 py-4 px-6 rounded-2xl bg-proton-text text-proton-bg text-[9px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl active:scale-95 text-center">Lock Node</button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FlashOverlay = ({ mode }: { mode: 'operator' | 'artisan' }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[1000] pointer-events-none flex items-center justify-center"
  >
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.2, opacity: 0 }}
      className="relative"
    >
      <div className={cn(
        "px-8 py-3 rounded-2xl border-2 backdrop-blur-2xl shadow-2xl flex items-center gap-4 transition-colors duration-500",
        mode === 'operator' 
          ? "bg-proton-bg/80 border-proton-accent/50 text-proton-accent shadow-proton-accent/20" 
          : "bg-white/80 border-proton-secondary/50 text-proton-secondary shadow-proton-secondary/20"
      )}>
        {mode === 'operator' ? <Terminal size={24} /> : <Zap size={24} />}
        <span className="text-xl font-black uppercase tracking-[0.2em]">
          {mode === 'operator' ? 'Operator System Engaged' : 'Artisan UX Active'}
        </span>
      </div>
      <div className={cn(
        "absolute inset-0 blur-3xl -z-10 opacity-30",
        mode === 'operator' ? "bg-proton-accent" : "bg-proton-secondary"
      )} />
    </motion.div>
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.2 }}
      exit={{ opacity: 0 }}
      className={cn(
        "absolute inset-0",
        mode === 'operator' ? "bg-proton-accent" : "bg-proton-secondary"
      )}
    />
  </motion.div>
);

const ModeToggle = ({ mode, setMode, language }: { mode: 'operator' | 'artisan', setMode: (m: 'operator' | 'artisan') => void, t: any, language: string }) => (
  <div className="relative p-1 bg-proton-bg/50 backdrop-blur-md rounded-2xl border border-proton-border shadow-inner flex shrink-0">
    <div 
      className={cn(
        "absolute top-1 bottom-1 w-[calc(50%-4px)] transition-all duration-200 rounded-xl",
        mode === 'operator' ? "left-1 bg-proton-accent" : "left-[calc(50%+2px)] bg-amber-500"
      )}
    />
    <button 
      onClick={() => setMode('operator')}
      className={cn(
        "relative z-10 flex-1 px-3 md:px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2",
        mode === 'operator' ? "text-proton-bg" : "text-proton-muted hover:text-proton-text"
      )}
    >
      <Terminal size={14} className="shrink-0" />
      <span className="hidden sm:inline">{language === 'ka' ? 'ბიზნესი' : 'Business'}</span>
    </button>
    <button 
      onClick={() => setMode('artisan')}
      className={cn(
        "relative z-10 flex-1 px-3 md:px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2",
        mode === 'artisan' ? "text-black" : "text-proton-muted hover:text-proton-text"
      )}
    >
       <Wrench size={14} className="shrink-0" />
       <span className="hidden sm:inline">{language === 'ka' ? 'ხელოსანი' : 'Artisan'}</span>
    </button>
  </div>
);

const THEMES: { id: Theme; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'light', label: 'Minimalist', icon: <Sun size={18} />, color: 'bg-slate-200' },
  { id: 'titanium', label: 'Titanium', icon: <Circle size={18} />, color: 'bg-sky-400' },
  { id: 'proton', label: 'Cyberpunk', icon: <Zap size={18} />, color: 'bg-cyan-400' },
  { id: 'vibrant', label: 'Nebula', icon: <Sparkles size={18} />, color: 'bg-purple-500' },
  { id: 'midnight', label: 'Executive', icon: <Moon size={18} />, color: 'bg-slate-900' },
];

export default function App() {
  const [uiMode, setUiMode] = useState<'operator' | 'artisan'>(
    (localStorage.getItem('proton_ui_mode') as 'operator' | 'artisan') || 'operator'
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleModeChange = (newMode: 'operator' | 'artisan') => {
    if (newMode === uiMode) return;
    setIsTransitioning(true);
    setUiMode(newMode);
    setTimeout(() => setIsTransitioning(false), 2000);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-mode', uiMode);
    localStorage.setItem('proton_ui_mode', uiMode);
  }, [uiMode]);

  // Routing / View logic
  // Routing / View logic
  const [activeView, setActiveView] = useState<View>(() => {
    if (window.location.pathname === '/translator') return 'translator';
    return 'dashboard';
  });

  useEffect(() => {
    const handlePathChange = () => {
      if (window.location.pathname === '/translator') {
        setActiveView('translator');
      }
    };
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);
  
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
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  const handleViewChange = React.useCallback((view: View, personaId?: string) => {
    if (!isArtisanSystemActive && !isSafeMode && (view === 'personas' || view === 'image' || view === 'blueprints' || view === 'compute')) {
      setShowOptimizationModal(true);
      return;
    }
    if (personaId) {
      setSelectedPersonaId(personaId);
    }
    setActiveView(view);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [isArtisanSystemActive, isSafeMode]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem('proton_theme') as Theme) || 'proton'
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
    const defaultProfile: UserProfile = {
      name: 'Darian B.',
      email: 'devdarianib@gmail.com',
      language: 'en',
      region: 'Tbilisi',
      notifications: true,
      role: 'Standard',
      phoneNumber: '',
      id: 'default-user',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Darian'
    };
    try {
      const saved = localStorage.getItem('user-profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure language is valid
        if (parsed.language !== 'en' && parsed.language !== 'ka') {
          parsed.language = 'en';
        }
        return { ...defaultProfile, ...parsed };
      }
    } catch {
      // Return default on error
    }
    return defaultProfile;
  });
  const [favoritePersonaIds, setFavoritePersonaIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('proton_favorite_personas');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('proton_favorite_personas', JSON.stringify(favoritePersonaIds));
  }, [favoritePersonaIds]);
  
  const handleToggleFavoritePersona = (id: string) => {
    setFavoritePersonaIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

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

  const [user, setUser] = useState(auth.currentUser);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userStats, setUserStats] = useState<{
    storageGB: number;
    computeTimeHours: number;
    aiTokens: number;
    computeCycles?: number;
    node_id?: string;
  }>({
    storageGB: 0,
    computeTimeHours: 0,
    aiTokens: 0,
    computeCycles: 0,
    node_id: 'GUEST-NODE'
  });

  useEffect(() => {
    localStorage.setItem('user-profile', JSON.stringify(userProfile));
  }, [userProfile]);

  const language = userProfile.language;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    async function fetchUserProfile() {
      const docRef = doc(db, 'profiles', user!.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const profile = docSnap.data();
        setUserStats(prev => ({
          ...prev,
          aiTokens: profile.ai_tokens || prev.aiTokens,
          computeCycles: profile.compute_cycles || 0,
          storageGB: profile.storage_gb || prev.storageGB,
          node_id: profile.node_id || `NODE-${user!.uid.slice(0, 5).toUpperCase()}`
        }));
      } else {
        // Create default profile in Firestore
        const defaultProfile = {
          email: user!.email,
          ai_tokens: 5000,
          compute_cycles: 100,
          storage_gb: 0.5,
          node_id: `NODE-${user!.uid.slice(0, 5).toUpperCase()}`
        };
        await setDoc(docRef, defaultProfile).catch(e => handleFirestoreError(e, 'create', docRef.path));
        setUserStats(prev => ({
          ...prev,
          node_id: defaultProfile.node_id
        }));
      }
    }
    
    fetchUserProfile().catch(err => console.error("Profile fetch error:", err));
  }, [user]);



  useEffect(() => {
    localStorage.setItem('proton_ai_settings', JSON.stringify(aiSettings));
  }, [aiSettings]);

  useEffect(() => {
    if (!user) return;
    const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
    const unsubscribe = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserStats(prev => ({
          ...prev,
          storageGB: data.storageGB || prev.storageGB,
          computeTimeHours: data.computeTimeHours || prev.computeTimeHours,
          aiTokens: data.aiTokens || prev.aiTokens
        }));
      } else {
        // Init stats with some realistic dev data if missing
        setDoc(statsRef, {
          storageGB: 1.2,
          computeTimeHours: 0.1,
          aiTokens: 150
        }, { merge: true }).catch(err => handleFirestoreError(err, 'write', statsRef.path));
      }
    }, (err) => {
      handleFirestoreError(err, 'get', statsRef.path);
    });
    return () => unsubscribe();
  }, [user]);

  // Simulate usage while session is active
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
      updateDoc(statsRef, {
        computeTimeHours: increment(0.01)
      }).catch(e => handleFirestoreError(e, 'write', statsRef.path)); 
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

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
      
      const outcome = await chatWithPersona(PERSONAS[0], prompt, [], "gemini-3.1-flash-preview", false, true, 0.8, "", language);
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
        // Track stats
        if (user && outcome.metadata) {
          const statsRef = doc(db, 'users', user.uid, 'stats', 'current');
          updateDoc(statsRef, {
            aiTokens: increment(outcome.metadata.totalTokenCount || 0)
          }).catch(e => handleFirestoreError(e, 'write', statsRef.path));
        }

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

  if (activeView === 'translator') {
    return <TranslatorView onBack={() => setActiveView('dashboard')} />;
  }

  return (
    <div className={cn(
      "flex h-[100dvh] overflow-hidden bg-proton-bg text-proton-text font-sans relative transition-all duration-700 selection:bg-proton-accent selection:text-proton-bg",
      uiMode === 'artisan' ? "ui-artisan" : "ui-operator"
    )}>
      <AnimatePresence>
        {isTransitioning && (
          <FlashOverlay mode={uiMode} />
        )}
      </AnimatePresence>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[65]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - FIXED ON MOBILE, FLEX ON DESKTOP */}
      <aside 
        className={cn(
          "flex flex-col border-r border-proton-border bg-proton-card transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] z-[70] overflow-x-hidden relative",
          "fixed inset-y-0 left-0 md:relative",
          isSidebarOpen 
            ? "translate-x-0 w-[280px] shadow-2xl" 
            : "-translate-x-full md:translate-x-0 md:w-20 shadow-none px-0"
        )}
      >
        {/* Sidebar Interior - Glass effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-proton-accent/[0.03] to-transparent pointer-events-none" />
        
        <div className={cn(
          "h-20 shrink-0 flex items-center gap-4 px-6 border-b border-proton-border/30 overflow-hidden relative z-10 transition-all duration-500",
          !isSidebarOpen && "md:justify-center md:px-0"
        )}>
          <div className="w-10 h-10 rounded-2xl bg-proton-accent flex items-center justify-center text-proton-bg shrink-0 shadow-2xl shadow-proton-accent/30 border border-white/20 transition-transform duration-500 hover:scale-110">
            <Layout size={22} fill="currentColor" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-700">
              <span className="text-xl font-black tracking-tight text-proton-text uppercase">System</span>
              <span className="text-[9px] font-bold text-proton-accent uppercase tracking-widest leading-none opacity-80">Workspace</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-8 space-y-10 mt-2 overflow-y-auto overflow-x-hidden custom-scrollbar relative z-10">
          <div className="space-y-1.5">
            {isSidebarOpen && <p className="text-[10px] font-black text-proton-muted/50 uppercase tracking-widest">{t.sidebar.main}</p>}
            <SidebarItem 
              icon={LayoutDashboard} 
              label={t.sidebar.dashboard} 
              active={activeView === 'dashboard'} 
              onClick={() => handleViewChange('dashboard')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
          </div>

          <div className="space-y-1.5 pt-4">
            {isSidebarOpen && <p className="text-[10px] font-black text-proton-muted/50 uppercase tracking-[0.3em] px-3 mb-4">{t.sidebar.agents}</p>}
            
            <Reorder.Group 
              axis="y" 
              values={personas} 
              onReorder={setPersonas} 
              className="space-y-1"
            >
              {personas.slice(0, isSidebarOpen ? 8 : 4).map((persona) => (
                <SidebarPersonaItem
                  key={persona.id}
                  persona={persona}
                  avatar={personaAvatars[persona.id] || persona.avatar}
                  active={activeView === 'personas' && selectedPersonaId === persona.id}
                  onClick={() => handleViewChange('personas', persona.id)}
                  expanded={isSidebarOpen}
                />
              ))}
            </Reorder.Group>

            {isSidebarOpen && personas.length > 8 && (
              <button 
                onClick={() => handleViewChange('personas')}
                className="w-full text-center py-2 text-[8px] font-black uppercase text-proton-muted tracking-widest hover:text-proton-accent transition-colors"
              >
                + {personas.length - 8} More Agents
              </button>
            )}

            <div className="pt-4">
              <SidebarItem 
                icon={CalendarIcon} 
                label={t.sidebar.organizer} 
                active={activeView === 'organizer'} 
                onClick={() => handleViewChange('organizer')} 
                expanded={isSidebarOpen}
                uiMode={uiMode}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-6">
            {isSidebarOpen && <p className="text-[10px] font-black text-proton-muted/50 uppercase tracking-[0.3em] px-3 mb-4">{t.sidebar.creative}</p>}
            <SidebarItem 
              icon={Image} 
              label={t.sidebar.image} 
              active={activeView === 'image'} 
              onClick={() => handleViewChange('image')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
            <SidebarItem 
              icon={Languages} 
              label={t.sidebar.translator} 
              active={(activeView as string) === 'translator'} 
              onClick={() => handleViewChange('translator')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
            />
          </div>

          <div className="pt-8 mt-8 border-t border-proton-border/30 space-y-4">
            {isSidebarOpen && <p className="text-[10px] font-black text-proton-muted/50 uppercase tracking-[0.3em] px-3 mb-4">{t.sidebar.system}</p>}
            
            {isSidebarOpen && (
              <div className="px-3 space-y-4 mb-6">
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-proton-muted/40 uppercase tracking-[0.2em]">{language === 'ka' ? 'ენა' : 'Language'}</p>
                  <div className="flex bg-proton-bg/50 border border-proton-border/50 rounded-xl p-0.5">
                    <button 
                      onClick={() => setUserProfile(prev => ({ ...prev, language: 'en' }))}
                      className={cn(
                        "flex-1 py-1 text-[9px] font-black rounded-lg transition-all",
                        userProfile.language === 'en' ? "bg-proton-accent text-proton-bg" : "text-proton-muted"
                      )}
                    >
                      EN
                    </button>
                    <button 
                      onClick={() => setUserProfile(prev => ({ ...prev, language: 'ka' }))}
                      className={cn(
                        "flex-1 py-1 text-[9px] font-black rounded-lg transition-all",
                        userProfile.language === 'ka' ? "bg-proton-accent text-proton-bg" : "text-proton-muted"
                      )}
                    >
                      GE
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-proton-muted/40 uppercase tracking-[0.2em]">{language === 'ka' ? 'რეჟიმი' : 'Mode'}</p>
                  <ModeToggle mode={uiMode} setMode={handleModeChange} t={t} language={language} />
                </div>
              </div>
            )}

            <SidebarItem 
              icon={UserIcon} 
              label={language === 'ka' ? 'პირადი კაბინეტი' : 'Personal Cabinet'} 
              active={activeView === 'profile'} 
              onClick={() => handleViewChange('profile')} 
              expanded={isSidebarOpen}
              uiMode={uiMode}
              badge={language === 'ka' ? 'ჰაბი' : 'HUB'}
            />
          </div>
        </nav>

        <div className="mt-auto p-4 border-t border-proton-border/30 relative z-10">
          <div className={cn(
            "p-1.5 rounded-3xl bg-proton-bg/40 border border-proton-border/50 group cursor-pointer transition-all duration-500 hover:border-proton-accent/30 overflow-hidden shadow-sm",
            !isSidebarOpen && "md:rounded-2xl"
          )} onClick={() => handleViewChange('profile')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-proton-accent flex items-center justify-center text-proton-bg font-bold shadow-xl group-hover:scale-105 transition-all overflow-hidden shrink-0 border border-white/10">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-sm font-black uppercase">{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              {isSidebarOpen && (
                <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left-4 duration-700">
                  <span className="text-[11px] font-bold text-proton-text truncate uppercase tracking-tight leading-none mb-1">{user.displayName || 'User'}</span>
                  <span className="text-[9px] font-medium text-proton-accent/60 truncate tracking-widest uppercase">Verified Account</span>
                </div>
              )}
            </div>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mt-4 flex items-center justify-center w-full py-2 text-proton-muted hover:text-proton-accent transition-colors"
          >
            <div className={cn("transition-transform duration-700", isSidebarOpen && "rotate-180")}>
              <ChevronRight size={18} />
            </div>
          </button>
        </div>
      </aside>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-proton-card/80 backdrop-blur-xl border-t border-proton-border z-50 flex items-center justify-around px-2 pb-safe">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: t.sidebar.bottom_nav.dashboard },
          { id: 'personas', icon: Users, label: t.sidebar.bottom_nav.personas },
          { id: 'finance', icon: Wallet, label: language === 'ka' ? 'ფინანსები' : 'Finance' },
          { id: 'image', icon: ImageIcon, label: language === 'ka' ? 'სტუდია' : 'Studio' },
          { id: 'profile', icon: UserIcon, label: language === 'ka' ? 'კაბინეტი' : 'Cabinet' },
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
            <span className="text-[9px] font-sans font-bold uppercase">{item.label}</span>
            {activeView === item.id && (
              <motion.div 
                layoutId="activeBottomTab"
                className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-proton-accent shadow-[0_0_8px_rgba(0,242,255,0.8)]"
              />
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden pb-16 md:pb-0 bg-proton-bg">
        {/* Subtle Background Gradients */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-proton-accent/5 rounded-full blur-[150px] pointer-events-none -mr-40 -mt-40 z-0" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-proton-secondary/5 rounded-full blur-[150px] pointer-events-none -ml-40 -mb-40 z-0" />

        {/* Dynamic Header */}
        <header className="h-20 border-b border-proton-border flex items-center justify-between px-4 sm:px-6 md:px-10 z-40 bg-proton-card sticky top-0 backdrop-blur-md">
          <div className="flex items-center gap-3 md:gap-8">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden w-10 h-10 rounded-xl bg-proton-bg border border-proton-border flex items-center justify-center text-proton-muted hover:text-proton-accent transition-all"
            >
              <Grid size={20} />
            </button>

            <div className="flex md:hidden">
            </div>

            <div className="flex items-center gap-3 md:gap-4 md:border-r md:border-proton-border md:pr-8 md:mr-2 cursor-pointer group" onClick={() => handleViewChange('profile')}>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-proton-accent flex items-center justify-center text-proton-bg font-black italic shadow-lg group-hover:scale-105 transition-all overflow-hidden shrink-0 border border-white/10">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-xs md:text-sm font-black uppercase">{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2">
                  <span className="text-xs md:text-sm font-black text-proton-text uppercase tracking-tight leading-none truncate max-w-[80px] sm:max-w-none">
                    {user?.displayName || user?.email?.split('@')[0] || 'Explorer'}
                  </span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-proton-accent/10 border border-proton-accent/20 transition-all w-fit">
                    <div className={cn("w-1 h-1 md:w-1.5 md:h-1.5 rounded-full", user ? "bg-green-500" : "bg-proton-muted")} />
                    <span className="text-[7px] md:text-[8px] font-bold text-proton-text uppercase tracking-widest whitespace-nowrap">
                      {user ? translations[language].common.stable : 'Offline'}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col min-w-0">
                  <span className="text-[8px] md:text-[9px] font-bold text-proton-muted uppercase tracking-widest">REGION: <span className="text-proton-accent">{userProfile.region || 'GLOBAL'}</span></span>
                </div>
              </div>
            </div>

            <nav className="hidden xl:flex items-center gap-6">
              {[
                { id: 'dashboard', label: t.sidebar.dashboard, icon: LayoutDashboard },
                { id: 'personas', label: t.sidebar.agents, icon: Users },
                { id: 'finance', label: language === 'ka' ? 'ფინანსები' : 'Finance', icon: Wallet },
                { id: 'image', icon: ImageIcon, label: language === 'ka' ? 'სტუდია' : 'Studio' },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleViewChange(link.id as any)}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-[0.15em] px-4 py-2 rounded-xl transition-all flex items-center gap-2",
                    activeView === link.id ? "bg-proton-accent/10 text-proton-accent" : "text-proton-muted hover:text-proton-text"
                  )}
                >
                  <link.icon size={14} />
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="h-8 w-px bg-proton-border/50 hidden xl:block" />
                  <div className="flex-1 md:flex-none">
                    <ModeToggle mode={uiMode} setMode={handleModeChange} t={t} language={language} />
                  </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden md:flex items-center gap-1.5 md:gap-3 bg-proton-bg border border-proton-border p-1 rounded-2xl shrink-0">
              <button 
                onClick={() => setUserProfile(prev => ({ ...prev, language: 'en' }))}
                className={cn(
                  "px-2 md:px-4 py-1.5 text-[9px] md:text-[10px] font-black rounded-xl transition-all",
                  userProfile.language === 'en' ? "bg-proton-accent text-proton-bg shadow-lg" : "text-proton-muted hover:text-proton-text"
                )}
              >
                EN
              </button>
              <button 
                onClick={() => setUserProfile(prev => ({ ...prev, language: 'ka' }))}
                className={cn(
                  "px-2 md:px-4 py-1.5 text-[9px] md:text-[10px] font-black rounded-xl transition-all",
                  userProfile.language === 'ka' ? "bg-proton-accent text-proton-bg shadow-lg" : "text-proton-muted hover:text-proton-text"
                )}
              >
                GE
              </button>
            </div>

            <div className="flex items-center gap-2 md:gap-3 ml-auto">
              <div className="h-8 w-px bg-proton-border/50 hidden md:block" />
              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  onClick={handleSignOut}
                  className="w-10 h-10 rounded-xl bg-proton-bg border border-proton-border flex items-center justify-center text-proton-muted hover:text-red-500 hover:border-red-500 transition-all"
                  title="Firebase Sign Out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 py-6 md:py-10 relative z-10 custom-scrollbar-minimal">
          <div className="max-w-7xl mx-auto h-full px-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
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
                  theme={theme}
                  setTheme={setTheme}
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
                  initialPersonaId={selectedPersonaId}
                  favoritePersonaIds={favoritePersonaIds}
                  onToggleFavorite={handleToggleFavoritePersona}
                  language={userProfile.language}
                  user={user}
                />
              )}
              {activeView === 'finance' && (
                <Web3View uiMode={uiMode} language={userProfile.language} />
              )}
              {activeView === 'image' && <ImageView uiMode={uiMode} isSystemActive={isArtisanSystemActive} language={userProfile.language} />}
              {activeView === 'blueprints' && (
                <WorkflowsView 
                  workflows={workflows}
                  setWorkflows={setWorkflows}
                  personas={personas}
                  user={user}
                  uiMode={uiMode}
                  language={userProfile.language}
                  isSystemActive={isArtisanSystemActive}
                />
              )}

              {activeView === 'profile' && (
                <CabinetView 
                  profile={userProfile} 
                  setProfile={setUserProfile} 
                  history={chatHistory} 
                  customAvatars={personaAvatars}
                  personas={personas}
                  user={user}
                  onSignIn={handleGoogleSignIn}
                  onSignOut={handleSignOut}
                  uiMode={uiMode}
                  stats={userStats}
                  onNavigate={handleViewChange}
                />
              )}
              {activeView === 'settings' && (
                <SettingsView 
                  userProfile={userProfile}
                  setUserProfile={setUserProfile}
                  aiSettings={aiSettings}
                  setAiSettings={setAiSettings}
                  theme={theme}
                  setTheme={setTheme}
                  language={userProfile.language}
                  uiMode={uiMode}
                  setUiMode={handleModeChange}
                />
              )}
              {activeView === 'documentation' && (
                <DocumentationView language={userProfile.language} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
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
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-proton-card w-full max-w-lg rounded-[50px] border border-proton-border shadow-2xl overflow-hidden"
            >
              <div className="w-full bg-proton-accent p-8 text-proton-on-accent relative">
                <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                  <Activity size={120} />
                </div>
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Zap size={24} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.3em] opacity-80">{t.dashboard.optimization_title}</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter uppercase">{t.dashboard.system_sync}</h3>
                  <p className="text-sm text-proton-on-accent/80 font-medium max-w-xs">{t.dashboard.optimization_desc}</p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: t.sidebar.finance, status: 'Online', color: 'text-green-400', icon: Wallet },
                    { label: t.sidebar.organizer, status: 'Online', color: 'text-green-400', icon: CalendarIcon },
                    { label: t.sidebar.blueprints, status: 'Restoring', color: 'text-amber-400', icon: Workflow },
                    { label: t.sidebar.personas, status: 'Syncing', color: 'text-proton-accent', icon: Users },
                  ].map((sys, i) => (
                    <div key={sys.label} className="p-4 rounded-3xl bg-proton-bg border border-proton-border flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-proton-card border border-proton-border flex items-center justify-center text-proton-muted">
                        <sys.icon size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-proton-muted uppercase tracking-widest leading-none mb-1">{sys.label}</p>
                        <p className={cn("text-xs font-black uppercase tracking-widest", sys.color)}>{sys.status}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.2em] text-proton-muted px-2">
                    <span>{t.dashboard.sync_progress}</span>
                    <span className="text-proton-accent">84%</span>
                  </div>
                  <div className="h-2 w-full bg-proton-bg rounded-full overflow-hidden border border-proton-border">
                    <motion.div 
                      initial={{ width: "30%" }}
                      animate={{ width: "84%" }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.5)]"
                    />
                  </div>
                </div>

                <div className="bg-proton-bg p-5 rounded-3xl border border-proton-border border-dashed">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck size={16} className="text-proton-accent" />
                    <span className="text-[10px] font-bold text-proton-text uppercase tracking-widest">{t.dashboard.security_verification}</span>
                  </div>
                  <p className="text-[11px] text-proton-muted font-medium leading-relaxed italic">
                    "{t.dashboard.security_msg}"
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setShowOptimizationModal(false)}
                    className="flex-1 py-5 bg-proton-accent text-proton-on-accent rounded-[32px] font-bold text-sm shadow-2xl shadow-proton-accent/30 hover:brightness-110 active:scale-95 transition-all uppercase tracking-[0.2em]"
                  >
                    {t.dashboard.optimization_btn}
                  </button>
                  <button 
                    onClick={() => {
                      setIsSafeMode(true);
                      setShowOptimizationModal(false);
                    }}
                    className="flex-1 py-5 bg-transparent border-2 border-proton-border text-proton-muted rounded-[32px] font-bold text-xs hover:border-proton-accent hover:text-proton-accent transition-all uppercase tracking-[0.2em]"
                  >
                    Safe Mode Bypass
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}