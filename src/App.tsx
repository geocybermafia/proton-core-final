import React, { useState, useEffect, useRef, useMemo, Dispatch, SetStateAction } from 'react';
import { WorkflowFlowEditor } from './components/WorkflowFlowEditor';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
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
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { PERSONAS, chatWithPersona, generatePersonaAvatar, summarizeConversation, analyzeWorkflow, generateOrEditImage, generateSpeech, type Persona } from './services/gemini';

declare global {
  interface Window {
    ethereum: any;
  }
}

// --- Types ---
type View = 'compute' | 'personas' | 'web3' | 'workflows' | 'profile' | 'settings' | 'image';

type ChatMessage = { role: 'user' | 'model', content: string, timestamp: number };
type PersonaHistory = { [personaId: string]: ChatMessage[] };
export type Workflow = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  personaId: string;
  analysisHistory?: { timestamp: number; result: string }[];
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

// --- Components ---

const SidebarItem = React.memo(({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200 group",
      active 
        ? "bg-proton-accent/10 text-proton-accent border border-proton-accent/20" 
        : "text-proton-muted hover:text-proton-text hover:bg-proton-card"
    )}
  >
    <Icon size={20} className={cn(active ? "text-proton-accent" : "group-hover:text-proton-text")} />
    <span className="font-medium text-sm">{label}</span>
    {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-proton-accent shadow-[0_0_8px_rgba(0,242,255,0.8)]" />}
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
      className="fixed inset-0 z-[100] bg-proton-bg/80 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="proton-glass p-8 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl"
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
              <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Avatar</label>
              <div className="flex items-center gap-4">
                <PersonaAvatar avatar={formData.avatar} className="w-16 h-16 ring-2 ring-proton-accent/20" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    {['🤖', '🧠', '🏺', '⛓️', '📈'].map(av => (
                      <button 
                        key={av}
                        onClick={() => setFormData(prev => ({ ...prev, avatar: av }))}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-sm border",
                          formData.avatar === av ? "border-proton-accent bg-proton-accent/10" : "border-proton-border"
                        )}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={avatarPrompt}
                    onChange={e => setAvatarPrompt(e.target.value)}
                    placeholder="Enter custom prompt..."
                    className="w-full bg-proton-bg border border-proton-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-proton-accent transition-colors"
                  />
                  <button 
                    onClick={handleGenerateAvatar}
                    disabled={generating}
                    className="w-full py-2 rounded-lg bg-proton-accent/10 text-proton-accent border border-proton-accent/20 text-[10px] font-bold uppercase tracking-widest hover:bg-proton-accent/20 transition-all flex items-center justify-center gap-2"
                  >
                    {generating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                    Generate with AI
                  </button>
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

const ComputeView = () => {
  const [provisioning, setProvisioning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'provisioning' | 'active'>('idle');
  const [progress, setProgress] = useState(0);

  // Mock data for charts
  const resourceData = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    time: i,
    gpu: 40 + Math.random() * 50,
    cpu: 20 + Math.random() * 30,
  })), []);

  const startProvisioning = () => {
    setProvisioning(true);
    setStatus('provisioning');
    setProgress(0);
  };

  useEffect(() => {
    if (status === 'provisioning') {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setStatus('active');
            setProvisioning(false);
            return 100;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Infrastructure</h2>
          <p className="text-proton-muted mt-1">Real-time compute cluster diagnostics and management</p>
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
        {[
          { label: 'Compute Power', value: '1.2 PFLOPS', icon: Cpu },
          { label: 'Active GPU Nodes', value: status === 'active' ? '32' : '0', icon: Activity },
          { label: 'Network Throughput', value: '14.2 Gbps', icon: Network },
          { label: 'Cluster Latency', value: status === 'active' ? '0.4ms' : '--', icon: Zap },
        ].map((stat, i) => (
          <div key={i} className="proton-glass p-6 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-proton-muted text-[10px] uppercase font-mono tracking-widest">{stat.label}</span>
              <stat.icon size={16} className="text-proton-accent" />
            </div>
            <p className="text-2xl font-bold font-mono">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Graphs Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 proton-glass p-6 rounded-2xl">
          <h4 className="font-bold flex items-center gap-2 mb-6">Resource Load Overload</h4>
          <div className="h-64 min-h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={resourceData}>
                <defs>
                  <linearGradient id="colorGpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#666" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '12px' }} />
                <Area type="monotone" dataKey="gpu" stroke="#00f2ff" fillOpacity={1} fill="url(#colorGpu)" />
                <Area type="monotone" dataKey="cpu" stroke="#8884d8" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Provisioning/Cluster Control */}
        <div className="proton-glass p-6 rounded-2xl flex flex-col gap-6">
          <h4 className="font-bold">Cluster Provisioning</h4>
          <div className="flex-1 flex flex-col justify-center gap-4">
             <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-proton-muted">
                    <span>PROGRESS</span>
                    <span>{progress}%</span>
                </div>
                <div className="h-2 bg-proton-border rounded-full overflow-hidden">
                    <motion.div 
                        className="h-full bg-proton-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                    />
                </div>
             </div>
             
             <button 
              onClick={startProvisioning}
              disabled={status !== 'idle'}
              className={cn(
                "proton-button",
                status === 'idle' 
                  ? "bg-proton-accent text-proton-bg hover:bg-proton-accent/90" 
                  : "bg-proton-border text-proton-muted cursor-not-allowed"
              )}
            >
              {status === 'provisioning' ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
              {status === 'idle' ? 'Provision Cluster' : status === 'provisioning' ? 'Provisioning...' : 'Provisioned'}
            </button>
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
  aiSettings
}: { 
  history: PersonaHistory, 
  onNewMessage: (personaId: string, msg: ChatMessage) => void,
  customAvatars: { [id: string]: string },
  onUpdateAvatar: (personaId: string, avatar: string) => void,
  personas: Persona[],
  onUpdatePersonas: (personas: Persona[]) => void,
  aiSettings: GlobalAiSettings
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
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showPersonaEditor, setShowPersonaEditor] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | undefined>(undefined);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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

    const response = await chatWithPersona(selectedPersona, userMessage, apiHistory, model, includeMaps, includeSearch, aiSettings.temperature, aiSettings.systemInstruction);
    onNewMessage(selectedPersona.id, { role: 'model', content: response, timestamp: Date.now() });
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
    <div className="flex h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Persona Selector */}
      <div className="w-80 flex flex-col gap-4">
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
        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
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
                      <div className="mt-3 p-3 rounded-xl bg-proton-bg/50 border border-proton-border/50 text-[11px] leading-relaxed text-proton-muted font-mono whitespace-pre-wrap">
                        {persona.systemInstruction}
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
      <div className="flex-1 flex flex-col proton-glass rounded-3xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-proton-border flex items-center justify-between bg-proton-bg/30">
          <div className="flex items-center gap-3">
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
              className="absolute inset-0 z-50 bg-proton-bg/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="proton-glass p-8 rounded-3xl max-w-md w-full space-y-6 shadow-2xl"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="text-proton-accent" size={20} />
                    Customize Avatar
                  </h3>
                  <button onClick={() => setShowAvatarPicker(false)} className="text-proton-muted hover:text-proton-text">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-proton-muted uppercase tracking-widest font-mono">Select Predefined Avatar</p>
                  <div className="grid grid-cols-5 gap-3">
                    {PREDEFINED_AVATARS.map(av => (
                      <button
                        key={av}
                        onClick={() => {
                          onUpdateAvatar(selectedPersona.id, av);
                          setShowAvatarPicker(false);
                        }}
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-all border overflow-hidden",
                          currentAvatar === av 
                            ? "bg-proton-accent/10 border-proton-accent/30 scale-110" 
                            : "bg-proton-bg border-proton-border hover:border-proton-muted/50"
                        )}
                      >
                        <PersonaAvatar avatar={av} className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                </div>

                  <div className="p-4 rounded-xl bg-proton-bg/50 border border-proton-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-proton-text uppercase tracking-widest">Upload Custom Image</p>
                        <p className="text-xs text-proton-muted">Upload your own avatar image.</p>
                      </div>
                      <label className="p-2 rounded-lg bg-proton-card text-proton-text hover:bg-proton-border cursor-pointer transition-all">
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
                        <Image size={18} />
                      </label>
                    </div>
                  </div>

                <div className="p-4 rounded-xl bg-proton-accent/5 border border-proton-accent/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-proton-accent uppercase tracking-widest">AI Generation</p>
                      <p className="text-xs text-proton-muted">Create a unique visual representation.</p>
                    </div>
                    <button 
                      onClick={handleGenerateAI}
                      disabled={generatingAvatar}
                      className="p-2 rounded-lg bg-proton-accent text-proton-bg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                    >
                      {generatingAvatar ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    </button>
                  </div>
                  {generatingAvatar && (
                    <div className="space-y-2">
                      <div className="h-1 bg-proton-border rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-proton-accent"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        />
                      </div>
                      <p className="text-[10px] text-proton-muted text-center animate-pulse">PRODUCING VISUAL CONTEXT...</p>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-proton-card border border-proton-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-proton-text uppercase tracking-widest">Custom Upload</p>
                      <p className="text-xs text-proton-muted">Upload your own image.</p>
                    </div>
                    <label className="p-2 rounded-lg bg-proton-bg border border-proton-border text-proton-text hover:bg-proton-border cursor-pointer transition-all">
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
                      <Plus size={18} />
                    </label>
                  </div>
                </div>

                <button 
                  onClick={() => setShowAvatarPicker(false)}
                  className="w-full py-3 rounded-xl bg-proton-accent text-proton-bg font-bold text-sm"
                >
                  Done
                </button>
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
                  : "bg-proton-card border border-proton-border rounded-tl-none prose prose-invert prose-sm"
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
              <span className="text-[10px] font-mono uppercase tracking-widest">Proton-Core Thinking...</span>
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
            Powered by Proton-Core GPU Cluster • Tbilisi, Georgia
          </p>
        </div>
      </div>
    </div>
  );
};

const Web3View = ({
  walletAddress,
  onConnect,
  onDisconnect,
  walletError,
  isConnecting
}: {
  walletAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  walletError: string | null;
  isConnecting: boolean;
}) => {
  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);

  const transactions = [
    { id: 1, type: 'Service Fee', amount: '-0.05 ETH', date: '2 hours ago', status: 'Confirmed', hash: '0x1234567890abcdef1234567890abcdef12345678', gasPrice: '0.002 ETH', explorerLink: '#' },
    { id: 2, type: 'Compute Refund', amount: '+0.01 ETH', date: 'Yesterday', status: 'Confirmed', hash: '0xabcdef1234567890abcdef1234567890abcdef12', gasPrice: '0.001 ETH', explorerLink: '#' },
    { id: 3, type: 'Subscription', amount: '-0.12 ETH', date: '3 days ago', status: 'Confirmed', hash: '0x9876543210fedcba9876543210fedcba98765432', gasPrice: '0.003 ETH', explorerLink: '#' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Web3 Integration</h2>
          <p className="text-proton-muted text-sm mt-1">AI-as-a-Service Payment Infrastructure</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {walletAddress ? (
            <div className="flex items-center gap-4 bg-proton-card p-2 rounded-xl border border-proton-border">
              <span className="text-sm font-mono text-proton-text px-2">{walletAddress}</span>
              <button 
                onClick={onDisconnect}
                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={onConnect}
              disabled={isConnecting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-proton-secondary to-purple-600 text-white font-bold text-sm flex items-center gap-2 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,45,85,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet size={18} />
                  Connect Ethereum Wallet
                </>
              )}
            </button>
          )}
          {walletError && <p className="text-xs text-red-400 font-mono">{walletError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="proton-glass p-8 rounded-3xl bg-gradient-to-br from-proton-card to-proton-bg relative overflow-hidden">
            <div className="relative z-10 space-y-8">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs text-proton-muted uppercase tracking-widest font-mono">Current Balance</p>
                  <p className="text-4xl font-bold font-mono">0.42 ETH</p>
                  <p className="text-sm text-proton-accent font-mono">≈ $1,240.50 USD</p>
                </div>
                <div className="p-3 bg-proton-accent/10 rounded-2xl text-proton-accent">
                  <Zap size={24} />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-all">Deposit</button>
                <button className="flex-1 py-3 rounded-xl border border-proton-border font-bold text-sm hover:bg-proton-card transition-all">Withdraw</button>
              </div>
            </div>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-proton-accent/10 rounded-full blur-3xl" />
          </div>

          <div className="proton-glass p-6 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-widest text-proton-muted">Recent Transactions</h3>
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div key={tx.id} className="border-b border-proton-border last:border-0">
                  <button 
                    onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                    className="w-full flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        tx.amount.startsWith('-') ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                      )}>
                        {tx.amount.startsWith('-') ? <ChevronRight size={14} className="rotate-90" /> : <ChevronRight size={14} className="-rotate-90" />}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">{tx.type}</p>
                        <p className="text-[10px] text-proton-muted">{tx.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold">{tx.amount}</p>
                      <p className="text-[10px] text-green-400 uppercase font-mono">{tx.status}</p>
                    </div>
                  </button>
                  {expandedTxId === tx.id && (
                    <div className="p-4 bg-proton-bg/50 rounded-xl mt-2 space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-proton-muted">Hash:</span>
                        <span className="truncate max-w-[200px]">{tx.hash}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-proton-muted">Gas Price:</span>
                        <span>{tx.gasPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-proton-muted">Gas Used:</span>
                        <span>21,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-proton-muted">Tx Fee:</span>
                        <span>0.00042 ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-proton-muted">Explorer:</span>
                        <a href="https://georgia-blockchain-explorer.ge" target="_blank" rel="noopener noreferrer" className="text-proton-accent hover:underline">View on GeoBlock</a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const ImageView = () => {
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="proton-glass p-8 rounded-3xl space-y-6">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to create or edit..."
            className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-all h-48 text-sm resize-none focus:ring-1 focus:ring-proton-accent/30"
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
  personas
}: {
  workflow: Workflow,
  onSave: (workflow: Workflow) => void,
  onClose: () => void,
  personas: Persona[]
}) => {
  const [formData, setFormData] = useState<Workflow>(workflow);
  const [editorMode, setEditorMode] = useState<'form' | 'flow'>('form');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-proton-bg/80 backdrop-blur-md flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="proton-glass p-8 rounded-3xl max-w-4xl w-full space-y-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-proton-accent">Edit Workflow</h3>
          <div className="flex bg-proton-bg p-1 rounded-lg">
             <button onClick={() => setEditorMode('form')} className={`px-4 py-2 text-xs font-bold rounded ${editorMode === 'form' ? 'bg-proton-accent text-proton-bg' : 'text-proton-muted'}`}>FORM</button>
             <button onClick={() => setEditorMode('flow')} className={`px-4 py-2 text-xs font-bold rounded ${editorMode === 'flow' ? 'bg-proton-accent text-proton-bg' : 'text-proton-muted'}`}>FLOW</button>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Trigger</label>
            <input 
              type="text" 
              value={formData.trigger}
              onChange={e => setFormData(prev => ({ ...prev, trigger: e.target.value }))}
              className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Action</label>
            <input 
              type="text" 
              value={formData.action}
              onChange={e => setFormData(prev => ({ ...prev, action: e.target.value }))}
              className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">Digital Persona</label>
            <select 
              value={formData.personaId}
              onChange={e => setFormData(prev => ({ ...prev, personaId: e.target.value }))}
              className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors"
            >
              <option value="">Select a persona</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={async () => {
              const analysis = await analyzeWorkflow(formData);
              alert(analysis);
            }}
            className="w-full py-2 rounded-xl border border-proton-accent/30 text-proton-accent text-xs font-bold hover:bg-proton-accent/10 transition-all"
          >
            Analyze Workflow with Gemini
          </button>
        </div>
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
  user
}: {
  workflows: Workflow[],
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>,
  personas: Persona[],
  user: any
}) => {
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: () => void; message: string } | null>(null);

  const handleSave = (updatedWorkflow: Workflow) => {
    setWorkflows(workflows.map(wf => wf.id === updatedWorkflow.id ? updatedWorkflow : wf));
    setEditingWorkflow(null);
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
      await setDoc(doc(db, 'users', user.uid, 'workflows', wf.id), updatedWorkflow);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workflows</h2>
          <p className="text-proton-muted text-sm mt-1">Visually build automated business processes</p>
        </div>
        <button 
          onClick={() => setConfirmation({
            message: "Are you sure you want to create a new workflow?",
            action: () => setWorkflows([...workflows, { id: Date.now().toString(), name: 'New Workflow', trigger: 'New Lead', action: 'Send Email', personaId: '' }])
          })}
          className="px-4 py-2 rounded-xl bg-proton-accent text-proton-bg font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all"
        >
          <Zap size={18} />
          Create Workflow
        </button>
      </div>
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-proton-bg/80 backdrop-blur-sm">
          <div className="proton-glass p-6 rounded-3xl w-full max-w-sm space-y-4">
            <h3 className="font-bold text-lg">Confirm Action</h3>
            <p className="text-sm text-proton-muted">{confirmation.message}</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmation(null)} className="flex-1 py-2 rounded-xl border border-proton-border text-sm font-bold">Cancel</button>
              <button onClick={() => { confirmation.action(); setConfirmation(null); }} className="flex-1 py-2 rounded-xl bg-proton-accent text-proton-bg text-sm font-bold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {workflows.length === 0 ? (
        <div className="proton-glass p-12 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-proton-accent/10 flex items-center justify-center text-proton-accent">
            <Zap size={32} />
          </div>
          <h3 className="text-xl font-bold">No Workflows Yet</h3>
          <p className="text-proton-muted max-w-sm">Start building your first automated business process by connecting personas and services.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map(wf => {
            const persona = personas.find(p => p.id === wf.personaId);
            return (
              <div 
                key={wf.id} 
                className="group proton-glass p-6 rounded-2xl space-y-4 hover:border-proton-accent/50 transition-all cursor-pointer relative overflow-hidden" 
                onClick={() => setEditingWorkflow(wf)}
              >
                <div className="absolute inset-0 bg-proton-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <div className="flex justify-between items-start relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-proton-accent/10 text-proton-accent">
                      <Zap size={18} />
                    </div>
                    <h3 className="font-bold text-lg">{wf.name}</h3>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmation({
                        message: "Analyze workflow efficiency with Gemini?",
                        action: () => handleAnalyze(wf)
                      });
                    }}
                    className="p-2 rounded-lg bg-proton-card text-proton-muted hover:text-proton-accent hover:bg-proton-accent/10 transition-all border border-proton-border"
                    title="Analyze Workflow"
                  >
                    <Activity size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs relative z-10">
                  <div className="p-2 rounded-lg bg-proton-bg/50 border border-proton-border">
                    <p className="text-proton-muted uppercase tracking-wider text-[9px] mb-1">Trigger</p>
                    <p className="text-proton-text font-mono truncate">{wf.trigger || '—'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-proton-bg/50 border border-proton-border">
                    <p className="text-proton-muted uppercase tracking-wider text-[9px] mb-1">Action</p>
                    <p className="text-proton-text font-mono truncate">{wf.action || '—'}</p>
                  </div>
                </div>
                
                <div className="relative z-10 flex items-center justify-between text-xs text-proton-muted pt-2 border-t border-proton-border">
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-proton-accent" />
                        {persona ? persona.name : 'No Persona'}
                    </span>
                    <span className="font-mono text-[10px]">ID: {wf.id.slice(-4)}</span>
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
  onSignOut
}: { 
  profile: UserProfile, 
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>, 
  history: PersonaHistory,
  customAvatars: { [id: string]: string },
  personas: Persona[],
  user: any,
  onSignIn: () => void,
  onSignOut: () => void
}) => {
  const totalInteractions = Object.values(history).reduce((acc, msgs) => acc + msgs.length, 0);
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Profile</h2>
          <p className="text-proton-muted text-sm mt-1">Manage your Proton-Core account and history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Account Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="proton-glass p-8 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings size={20} className="text-proton-accent" />
                Account Settings
              </h3>
              {user ? (
                <button onClick={onSignOut} className="text-sm text-red-400 hover:text-red-300">Sign Out</button>
              ) : (
                <button onClick={onSignIn} className="text-sm text-proton-accent hover:text-proton-accent/80">Sign In with Google</button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-mono text-proton-muted uppercase tracking-widest">Full Name</label>
                <input 
                  type="text" 
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-proton-muted uppercase tracking-widest">Email Address</label>
                <input 
                  type="email" 
                  value={profile.email}
                  disabled
                  className="w-full bg-proton-bg/50 border border-proton-border rounded-xl px-4 py-3 text-proton-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-proton-muted uppercase tracking-widest">Preferred Language</label>
                <select 
                  value={profile.language}
                  onChange={(e) => setProfile(prev => ({ ...prev, language: e.target.value as 'en' | 'ka' }))}
                  className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-proton-accent transition-colors"
                >
                  <option value="en">English</option>
                  <option value="ka">ქართული (Georgian)</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-proton-bg/30 border border-proton-border">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-[10px] text-proton-muted">Receive updates on GPU status</p>
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
                Download Profile Data
              </button>
            </div>
          </div>

          <div className="proton-glass p-8 rounded-3xl space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity size={20} className="text-proton-secondary" />
              Interaction History
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
                        <p className="font-bold text-sm">{persona.name}</p>
                        <p className="text-xs text-proton-muted">{personaMsgs.length} messages exchanged</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-proton-muted uppercase font-mono">Last Active</p>
                      <p className="text-xs font-mono">
                        {new Date(personaMsgs[personaMsgs.length - 1].timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {totalInteractions === 0 && (
                <div className="text-center py-8 text-proton-muted italic text-sm">
                  No interaction history found yet.
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
              <h4 className="font-bold text-lg">{profile.name}</h4>
              <p className="text-xs text-proton-muted font-mono uppercase tracking-widest">Proton-Core Explorer</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-3 rounded-xl bg-proton-bg/50 border border-proton-border">
                <p className="text-xl font-bold font-mono text-proton-accent">{totalInteractions}</p>
                <p className="text-[10px] text-proton-muted uppercase">Messages</p>
              </div>
              <div className="p-3 rounded-xl bg-proton-bg/50 border border-proton-border">
                <p className="text-xl font-bold font-mono text-proton-secondary">3</p>
                <p className="text-[10px] text-proton-muted uppercase">Personas</p>
              </div>
            </div>
          </div>

          <div className="proton-glass p-6 rounded-2xl space-y-4">
            <h4 className="font-bold text-sm uppercase tracking-widest text-proton-muted">Security Status</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-proton-muted">2FA Status</span>
                <span className="text-green-400 font-mono">ENABLED</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-proton-muted">Last Login</span>
                <span className="text-proton-text font-mono">Tbilisi, GE</span>
              </div>
              <button className="w-full py-2 rounded-lg border border-proton-secondary/30 text-proton-secondary text-xs font-bold hover:bg-proton-secondary/10 transition-all">
                Reset Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [activeView, setActiveView] = useState<View>('compute');                
  const handleViewChange = React.useCallback((view: View) => {
    setActiveView(view);
  }, []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [theme, setTheme] = useState<'proton' | 'light' | 'vibrant' | 'midnight'>(
    (localStorage.getItem('proton_theme') as any) || 'proton'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('proton_theme', theme);
  }, [theme]);
  
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

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [user, setUser] = useState(auth.currentUser);

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
        const workflowsRef = collection(db, 'users', currentUser.uid, 'workflows');
        const snapshot = await getDocs(workflowsRef);
        const loadedWorkflows = snapshot.docs.map(doc => doc.data() as Workflow);
        setWorkflows(loadedWorkflows);
      } else {
        setWorkflows([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName
        });
      }
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };
  
  const handleSignOut = async () => {
    await signOut(auth);
  };

  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    setWalletError(null);
    setIsConnecting(true);
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
      } catch (error) {
        console.error("User denied account access", error);
        setWalletError("User denied account access.");
      } finally {
        setIsConnecting(false);
      }
    } else {
      setWalletError("Please install MetaMask or another Ethereum-compatible wallet.");
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setWalletError(null);
  };

  const handleNewMessage = (personaId: string, msg: ChatMessage) => {
    setChatHistory(prev => ({
      ...prev,
      [personaId]: [...(prev[personaId] || []), msg]
    }));
  };

  const handleUpdateAvatar = (personaId: string, avatar: string) => {
    setPersonaAvatars(prev => ({
      ...prev,
      [personaId]: avatar
    }));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-proton-bg text-proton-text font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="border-r border-proton-border bg-proton-card/50 backdrop-blur-xl flex flex-col z-50"
      >
        <div className="p-6 flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-proton-accent to-proton-secondary flex items-center justify-center text-proton-bg shadow-[0_0_15px_rgba(0,242,255,0.3)]">
            <Zap size={24} fill="currentColor" />
          </div>
          {isSidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-lg tracking-tight">
              PROTON<span className="text-proton-accent">CORE</span>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4">
          <SidebarItem 
            icon={Cpu} 
            label="Compute Cluster" 
            active={activeView === 'compute'} 
            onClick={() => handleViewChange('compute')} 
          />
          <SidebarItem 
            icon={Users} 
            label="Digital Personas" 
            active={activeView === 'personas'} 
            onClick={() => handleViewChange('personas')} 
          />
          <SidebarItem 
            icon={Zap} 
            label="Workflows" 
            active={activeView === 'workflows'} 
            onClick={() => handleViewChange('workflows')} 
          />
          <SidebarItem 
            icon={Wallet} 
            label="Web3 Payments" 
            active={activeView === 'web3'} 
            onClick={() => handleViewChange('web3')} 
          />
          <SidebarItem 
            icon={Image} 
            label="Image Studio" 
            active={activeView === 'image'} 
            onClick={() => handleViewChange('image')} 
          />
          <SidebarItem 
            icon={Terminal} 
            label="User Profile" 
            active={activeView === 'profile'} 
            onClick={() => handleViewChange('profile')} 
          />
          <div className="pt-4 mt-4 border-t border-proton-border">
            <SidebarItem 
              icon={Settings} 
              label="System Settings" 
              active={activeView === 'settings'} 
              onClick={() => handleViewChange('settings')} 
            />
          </div>
        </nav>

        <div className="p-4 border-t border-proton-border">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl bg-proton-bg/50 border border-proton-border overflow-hidden",
            !isSidebarOpen && "justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-proton-accent/20 flex items-center justify-center text-proton-accent shrink-0">
              <Terminal size={16} />
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">devdarianib@gmail.com</p>
                <p className="text-[10px] text-proton-muted uppercase tracking-widest">Admin Access</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-proton-border flex items-center justify-between px-8 bg-proton-bg/50 backdrop-blur-md z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-proton-card text-proton-muted transition-colors"
            >
              <ChevronRight className={cn("transition-transform duration-300", isSidebarOpen ? "rotate-180" : "")} size={20} />
            </button>
            <div className="h-4 w-px bg-proton-border" />
            <div className="flex items-center gap-2 text-xs font-mono text-proton-muted uppercase tracking-widest">
              <Globe size={14} />
              <span>{userProfile.region} Node</span>
              <span className="text-proton-accent">•</span>
              <span>v1.2.0-stable</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Language Switcher */}
            <div className="flex items-center gap-3">
              <select
                value={userProfile.language}
                onChange={(e) => setUserProfile(prev => ({ ...prev, language: e.target.value as 'en' | 'ka' }))}
                className="bg-proton-card border border-proton-border rounded-lg px-2 py-1 text-[10px] font-mono text-proton-text focus:outline-none"
              >
                <option value="en">EN</option>
                <option value="ka">GE</option>
              </select>

              <div className="text-[10px] font-mono text-right hidden sm:block">
                <span className="text-proton-muted block">GPU</span>
                <span className="text-proton-accent">84%</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 proton-grid relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto h-full"
            >
              {activeView === 'compute' && <ComputeView />}
              {activeView === 'personas' && (
                <PersonasView 
                  history={chatHistory} 
                  onNewMessage={handleNewMessage} 
                  customAvatars={personaAvatars}
                  onUpdateAvatar={handleUpdateAvatar}
                  personas={personas}
                  onUpdatePersonas={setPersonas}
                  aiSettings={aiSettings}
                />
              )}
              {activeView === 'web3' && (
                <Web3View 
                  walletAddress={walletAddress}
                  onConnect={connectWallet}
                  onDisconnect={disconnectWallet}
                  walletError={walletError}
                  isConnecting={isConnecting}
                />
              )}
              {activeView === 'image' && <ImageView />}
              {activeView === 'workflows' && (
                <WorkflowsView 
                  workflows={workflows}
                  setWorkflows={setWorkflows}
                  personas={personas}
                  user={user}
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
                />
              )}
              {activeView === 'settings' && (
                <div className="flex flex-col h-full w-full max-w-2xl mx-auto p-8 space-y-8">
                  <div className="flex items-center gap-4">
                    <Settings size={32} className="text-proton-accent" />
                    <h2 className="text-2xl font-bold">System Settings</h2>
                  </div>
 
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <h3 className="font-bold border-b border-proton-border pb-2">Profile</h3>
                      <div className="space-y-2">
                        <label className="text-xs text-proton-muted">Region</label>
                        <input 
                          value={userProfile.region || ''}
                          onChange={e => setUserProfile(prev => ({ ...prev, region: e.target.value }))}
                          className="w-full bg-proton-card p-3 rounded-xl border border-proton-border text-xs focus:outline-none focus:border-proton-accent"
                          placeholder="e.g. Tbilisi"
                        />
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h3 className="font-bold border-b border-proton-border pb-2">AI Configuration</h3>
                      
                      <div className="space-y-2">
                        <label className="text-xs text-proton-muted">Temperature: {aiSettings.temperature}</label>
                        <input 
                          type="range" min="0" max="1" step="0.1"
                          value={aiSettings.temperature}
                          onChange={e => setAiSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                          className="w-full accent-proton-accent"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs">Enable Google Search Grounding</label>
                        <input 
                          type="checkbox" checked={aiSettings.enableSearch}
                          onChange={e => setAiSettings(prev => ({ ...prev, enableSearch: e.target.checked }))}
                          className="accent-proton-accent"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-xs">Enable Google Maps Grounding</label>
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