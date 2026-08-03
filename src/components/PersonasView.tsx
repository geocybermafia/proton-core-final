import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Persona, ChatMessage } from '../types';
import { 
  Send, User, Bot, Plus, Trash2, Edit2, Users, Image as ImageIcon, 
  FileText, Zap, Sparkles, ChevronUp, X, Check, Globe, HelpCircle, Laptop,
  Terminal, ShieldAlert, Cpu, ArrowLeft, RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';
import { createPortal } from 'react-dom';
import { chatWithPersona, generateOrEditImage } from '../lib/gemini';
import {
  ProtonCard,
  ProtonButton,
  ProtonInput,
  ProtonModal,
  ProtonBadge,
  ProtonAvatar,
  ProtonIconBox,
} from '../ui';

// Helper component for safe avatar rendering with image error handling
function PersonaAvatarView({ 
  avatar, 
  name, 
  size = 'md',
  className,
  status
}: { 
  avatar?: string; 
  name?: string; 
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  status?: 'online' | 'offline' | 'busy' | 'away';
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const trimmed = avatar?.trim() || '';
  const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/');

  useEffect(() => {
    setHasImageError(false);
  }, [avatar]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-xl',
    xl: 'w-16 h-16 text-2xl',
  };

  const getInitials = (str?: string) => {
    if (!str) return '🤖';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const fallback = (!isUrl && trimmed) ? trimmed : (name ? getInitials(name) : '🤖');

  return (
    <div className="relative inline-block shrink-0">
      <div className={cn("rounded-xl overflow-hidden bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center select-none font-mono font-bold text-cyan-300 shadow-[0_0_10px_rgba(0,243,255,0.15)]", sizeClasses[size], className)}>
        {isUrl && !hasImageError ? (
          <img
            src={trimmed}
            alt={name || 'Agent'}
            onError={() => setHasImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{fallback}</span>
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-black w-3 h-3',
            status === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse' : 'bg-zinc-500'
          )}
        />
      )}
    </div>
  );
}

// Preset Avatars
const AVATAR_PRESETS = [
  { emoji: '🤖', labelEn: 'Smart Assistant', labelKa: 'ჭკვიანი ასისტენტი' },
  { emoji: '⚡', labelEn: 'Analytics Agent', labelKa: 'ანალიტიკური აგენტი' },
  { emoji: '🧠', labelEn: 'Core Logic', labelKa: 'ძირითადი ლოგიკა' },
  { emoji: '🔮', labelEn: 'Knowledge Base', labelKa: 'ცოდნის ბაზა' },
  { emoji: '👾', labelEn: 'Automation Bot', labelKa: 'ავტომატიზაციის ბოტი' },
  { emoji: '⚙️', labelEn: 'Engine Operator', labelKa: 'ოპერატორი' },
  { emoji: '🛰️', labelEn: 'Connect Assistant', labelKa: 'კავშირის ასისტენტი' },
  { emoji: '🛡️', labelEn: 'Security Guard', labelKa: 'უსაფრთხოება' },
  { emoji: '🧪', labelEn: 'Data Analyst', labelKa: 'მონაცემთა ანალიტიკოსი' },
  { emoji: '🎨', labelEn: 'Content Creator', labelKa: 'კონტენტის ავტორი' },
];

// System Instruction Presets
const INSTRUCTION_PRESETS = [
  {
    titleEn: "Senior Code Architect",
    titleKa: "კოდის არქიტექტორი",
    descEn: "Optimize structures and analyze logic.",
    descKa: "სტრუქტურების ოპტიმიზაცია და ლოგიკა.",
    prompt: "You are a senior staff software engineer and system architect. Give concise, highly optimize, secure, and idiomatic suggestions. Format all equations and code listings in clear fenced Markdown blocks."
  },
  {
    titleEn: "Localization Specialist",
    titleKa: "ლოკალიზაციის ექსპერტი",
    descEn: "Seamless English-Georgian translators.",
    descKa: "ინგლისურ-ქართული თარგმანის მცოდნე.",
    prompt: "შენ ხარ პროფესიონალი მთარგმნელი და ლოკალიზაციის ექსპერტი. თარგმნე ტექსტები და კონტექსტები უნაკლოდ ქართულსა და ინგლისურს შორის, შეინარჩუნე პროფესიონალური ტონი."
  },
  {
    titleEn: "Creative Copywriter",
    titleKa: "კრეატიული ავტორი",
    descEn: "Draft high-converting newsletters.",
    descKa: "საინტერესო ტექსტების მომზადება.",
    prompt: "You are a specialized marketing strategist and creative copywriter. Write engaging, vivid, formatted promotional texts, copy blocks, and email templates with clear bulleted priorities."
  },
  {
    titleEn: "Workflow diagnostic",
    titleKa: "პროცესის დიაგნოსტიკა",
    descEn: "Audit process bottlenecks.",
    descKa: "პროცესების დაგეგმარება.",
    prompt: "Perform structural logic analysis. Detect scheduling, sequence, and parameter inconsistencies in visual blueprints. Deliver actionable recommendations in tabular or bullet form."
  }
];

export default function PersonasView({ 
  language,
  personas: initialPersonas,
  history: initialHistory,
  onNewMessage,
  // Accepted for completeness:
  customAvatars,
  onUpdateAvatar,
  onUpdatePersonas,
  aiSettings,
  setLastGeminiMetadata,
  workflows,
  tasks,
  uiMode,
  isCreativeMode,
  initialPersonaId,
  favoritePersonaIds,
  onToggleFavorite,
  user,
  isAdmin,
  checkAndIncrementAiQuota
}: { 
  language: 'en' | 'ka',
  personas?: Persona[],
  history?: any,
  onNewMessage?: (personaId: string, msg: ChatMessage) => void,
  customAvatars?: any,
  onUpdateAvatar?: any,
  onUpdatePersonas?: any,
  aiSettings?: any,
  setLastGeminiMetadata?: any,
  workflows?: any,
  tasks?: any,
  uiMode?: any,
  isCreativeMode?: boolean,
  initialPersonaId?: string | null,
  favoritePersonaIds?: string[],
  onToggleFavorite?: any,
  user?: any,
  isAdmin?: boolean,
  checkAndIncrementAiQuota?: any
}) {
  const t = translations[language].personas;
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas || []);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialHistory && selectedPersona && initialHistory[selectedPersona.id]) {
      return initialHistory[selectedPersona.id];
    }
    return [];
  });

  useEffect(() => {
    if (selectedPersona && initialHistory && initialHistory[selectedPersona.id]) {
      setMessages(initialHistory[selectedPersona.id]);
    }
  }, [selectedPersona, initialHistory]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(!!initialPersonaId || !!selectedPersona);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth scroll to the end of the conversation when messages array or isSending state changes
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [editingInstructions, setEditingInstructions] = useState('');
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Creator Modal State
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [newPersonaNameEn, setNewPersonaNameEn] = useState('');
  const [newPersonaNameKa, setNewPersonaNameKa] = useState('');
  const [newPersonaRole, setNewPersonaRole] = useState('');
  const [newPersonaRoleKa, setNewPersonaRoleKa] = useState('');
  const [newPersonaDesc, setNewPersonaDesc] = useState('');
  const [newPersonaDescKa, setNewPersonaDescKa] = useState('');
  const [newPersonaInstructions, setNewPersonaInstructions] = useState('');
  const [selectedAvatarType, setSelectedAvatarType] = useState('preset'); // 'preset' | 'url'
  const [newPersonaAvatarEmoji, setNewPersonaAvatarEmoji] = useState('🤖');
  const [newPersonaAvatarUrl, setNewPersonaAvatarUrl] = useState('');
  const [newPersonaLang, setNewPersonaLang] = useState<'English' | 'Georgian' | 'Mixed'>('Mixed');
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);

  // Decommission Confirmation Drawer State
  const [isDecommissioning, setIsDecommissioning] = useState(false);
  const [decomTarget, setDecomTarget] = useState<Persona | null>(null);

  const aiAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setIsSending(false);
    setInput('');
    setShowTools(false);
    setSelectedTool(null);

    if (selectedPersona) {
      setEditingInstructions(selectedPersona.systemInstruction || '');
    } else {
      setEditingInstructions('');
    }
    setIsEditingInstructions(false);
    setIsSavingInstructions(false);
    setSaveSuccess(false);
    setSaveError(null);
    setShowConfirmClear(false);
  }, [selectedPersona]);

  // Scroll recovery on mount to prevent any clipping/offsetting issues
  useEffect(() => {
    const el = document.getElementById('main-scroll-container');
    if (el) {
      el.scrollTop = 0;
    }
  }, []);

  const handleSaveInstructions = async () => {
    if (!selectedPersona || !auth.currentUser) return;
    setIsSavingInstructions(true);
    setSaveSuccess(false);
    setSaveError(null);

    const updatedPersona = {
      ...selectedPersona,
      systemInstruction: editingInstructions
    };

    try {
      const personaDocRef = doc(db, 'users', auth.currentUser.uid, 'personas', selectedPersona.id);
      await setDoc(personaDocRef, { systemInstruction: editingInstructions }, { merge: true });
      
      setSelectedPersona(updatedPersona);

      if (onUpdatePersonas) {
        onUpdatePersonas((prev: Persona[]) => 
          prev.map(p => p.id === selectedPersona.id ? updatedPersona : p)
        );
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving persona instructions:", err);
      setSaveError(err.message || 'Error occurred');
    } finally {
      setIsSavingInstructions(false);
    }
  };

  const aiTools = [
    { id: 'image', icon: ImageIcon, label: t.tools.image, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'summary', icon: FileText, label: t.tools.summary, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'analysis', icon: Zap, label: t.tools.analysis, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  // Sync Personas with initial props
  useEffect(() => {
    if (initialPersonas) {
      setPersonas(initialPersonas);
      if (initialPersonaId) {
        const found = initialPersonas.find(p => p.id === initialPersonaId);
        if (found) {
          setSelectedPersona(found);
          setMobileShowChat(true);
        }
      } else if (selectedPersona) {
        // Keep currently selected persona in sync with latest initialPersonas data (e.g. system instructions)
        const updatedSelf = initialPersonas.find(p => p.id === selectedPersona.id);
        if (updatedSelf) {
          setSelectedPersona(updatedSelf);
        }
      } else if (initialPersonas.length > 0 && !selectedPersona) {
        setSelectedPersona(initialPersonas[0]);
      }
    }
  }, [initialPersonas, initialPersonaId]);

  // Firestore Sync Fallback
  useEffect(() => {
    if (initialPersonas) return; 
    if (!auth.currentUser) return;

    const personasRef = collection(db, 'users', auth.currentUser.uid, 'personas');
    const unsubscribe = onSnapshot(personasRef, (snapshot) => {
      const loadedPersonas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Persona));
      setPersonas(loadedPersonas);
      if (loadedPersonas.length > 0 && !selectedPersona) {
        setSelectedPersona(loadedPersonas[0]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync Chat History for selected Persona
  useEffect(() => {
    if (!auth.currentUser || !selectedPersona) return;

    const chatRef = doc(db, 'users', auth.currentUser.uid, 'chatHistory', selectedPersona.id);
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        setMessages(docSnap.data().messages || []);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, [selectedPersona]);

  const isValidAvatarUrl = (url: string) => {
    if (!url) return false;
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) return true;
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Create Custom Persona
  const handleCreatePersona = async () => {
    if (!auth.currentUser) return;
    const resolvedNameEn = newPersonaNameEn.trim();
    if (!resolvedNameEn) return;

    setIsCreatingPersona(true);
    const generatedId = "persona_" + Date.now().toString();
    
    let finalAvatar = newPersonaAvatarEmoji;
    if (selectedAvatarType === 'url') {
      const trimmedUrl = newPersonaAvatarUrl.trim();
      if (isValidAvatarUrl(trimmedUrl)) {
        finalAvatar = trimmedUrl;
      } else {
        finalAvatar = newPersonaAvatarEmoji || '🤖';
      }
    }

    const payload: Persona = {
      id: generatedId,
      name: resolvedNameEn,
      nameGe: newPersonaNameKa.trim() || resolvedNameEn,
      role: newPersonaRole.trim() || "General Assistant",
      roleGe: newPersonaRoleKa.trim() || newPersonaRole.trim() || "მორგებული ასისტენტი",
      description: newPersonaDesc.trim() || "Custom AI intelligence unit",
      descriptionGe: newPersonaDescKa.trim() || newPersonaDesc.trim() || "მორგებული AI ინტელექტის მოდული",
      systemInstruction: newPersonaInstructions.trim() || "You are a helpful assistant.",
      avatar: finalAvatar,
      language: newPersonaLang,
    };

    try {
      const personaDocRef = doc(db, 'users', auth.currentUser.uid, 'personas', generatedId);
      await setDoc(personaDocRef, payload);
      
      // Notify parent component to update global personas list
      if (onUpdatePersonas) {
        onUpdatePersonas((prev: Persona[]) => [...prev, payload]);
      }

      // Auto select the new assistant
      setSelectedPersona(payload);
      setMobileShowChat(true);
      
      // Reset State
      setIsCreatorOpen(false);
      setNewPersonaNameEn('');
      setNewPersonaNameKa('');
      setNewPersonaRole('');
      setNewPersonaRoleKa('');
      setNewPersonaDesc('');
      setNewPersonaDescKa('');
      setNewPersonaInstructions('');
      setNewPersonaAvatarUrl('');
      setNewPersonaAvatarEmoji('🤖');
    } catch (err) {
      console.error("Failed to append custom persona:", err);
    } finally {
      setIsCreatingPersona(false);
    }
  };

  // Decommission (Delete) Persona
  const handleDecommission = async () => {
    if (!auth.currentUser || !decomTarget) return;
    const targetId = decomTarget.id;

    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'personas', targetId);
      await deleteDoc(docRef);

      // Clean up chat logs
      const chatRef = doc(db, 'users', auth.currentUser.uid, 'chatHistory', targetId);
      await deleteDoc(chatRef);

      // Adjust Selected Persona
      const updatedList = personas.filter(p => p.id !== targetId);
      
      // Notify parent component to update global personas list
      if (onUpdatePersonas) {
        onUpdatePersonas(updatedList);
      }

      if (updatedList.length > 0) {
        setSelectedPersona(updatedList[0]);
      } else {
        setSelectedPersona(null);
      }
      setIsDecommissioning(false);
      setDecomTarget(null);
    } catch (err) {
      console.error("Failed to decommissioning agent:", err);
    }
  };

  const handleClearChat = async () => {
    if (!auth.currentUser || !selectedPersona) return;
    try {
      const chatRef = doc(db, 'users', auth.currentUser.uid, 'chatHistory', selectedPersona.id);
      await setDoc(chatRef, { messages: [] }, { merge: true });
      setMessages([]);
      setShowConfirmClear(false);
    } catch (err) {
      console.error("Failed to clear chat history:", err);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedPersona || !auth.currentUser) return;

    if (checkAndIncrementAiQuota) {
      const permitted = await checkAndIncrementAiQuota();
      if (!permitted) return;
    }

    const promptToSend = input;
    let finalPrompt = input;
    if (selectedTool) {
      const toolLabel = aiTools.find(t => t.id === selectedTool)?.label;
      finalPrompt = `[${toolLabel?.toUpperCase()}] ${input}`;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: finalPrompt,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    const prevTool = selectedTool;
    setSelectedTool(null);
    setShowTools(false);
    setIsSending(true);

    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;

    const chatRef = doc(db, 'users', auth.currentUser.uid, 'chatHistory', selectedPersona.id);

    try {
      await setDoc(chatRef, { messages: newMessages }, { merge: true });

      // Build chat history excluding the last message (which is user message to send)
      const formattedHistory = messages.map(m => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.content }]
      }));

      let aiResponseText = "";
      let metadata = null;

      if (prevTool === 'image') {
        const imageUrl = await generateOrEditImage(promptToSend);
        aiResponseText = language === 'ka'
          ? `აი თქვენი გენერირებული ვიზუალი:\n\n![გენერირებული ვიზუალი](${imageUrl})`
          : `Here is your generated visual:\n\n![Generated Visual](${imageUrl})`;
        metadata = { promptTokenCount: 150, candidatesTokenCount: 500, totalTokenCount: 650, latency: 1200 };
      } else {
        const result = await chatWithPersona(
          selectedPersona,
          finalPrompt,
          formattedHistory,
          'gemini-3.5-flash',
          false,
          true,
          0.9,
          selectedPersona.systemInstruction,
          language,
          controller.signal
        );
        aiResponseText = result.text;
        metadata = result.metadata;
      }

      if (controller.signal.aborted) {
        console.log("Chat response discarded because request was aborted");
        return;
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: aiResponseText,
        timestamp: Date.now()
      };

      if (setLastGeminiMetadata && metadata) {
        setLastGeminiMetadata(metadata);
      }

      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);
      await setDoc(chatRef, { messages: updatedMessages }, { merge: true });
      setIsSending(false);

    } catch (error: any) {
      if (controller.signal.aborted) {
        console.log("Chat error handler ignored because request was aborted due to persona change");
        return;
      }
      console.warn("Failed to send message or process via Gemini:", error);
      setIsSending(false);
      
      const errorMsg = error?.message || String(error);
      let friendlyError = language === 'ka' 
        ? "სისტემური შეცდომა: AI-სთან დაკავშირება ვერ მოხერხდა. გთხოვთ შეამოწმოთ თქვენი ინტერნეტ კავშირი ან სცადოთ მოგვიანებით."
        : "System Error: Failed to communicate with AI. Please check your network connection or try again later.";
      
      if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit")) {
        friendlyError = language === 'ka'
          ? "ყოველდღიური მოთხოვნების ლიმიტი ამოიწურა (429 Quota Exceeded). გთხოვთ, ჩართოთ „AI სიმულაციური რეჟიმი“ პარამეტრების მენიუდან შეუფერხებელი მუშაობისთვის."
          : "API Quota Exceeded (429). Please enable 'AI Simulation Mode' in the Settings menu to continue without interruption.";
      }

      const systemErrorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'model',
        content: `⚠️ **${language === 'ka' ? 'შეცდომა' : 'Error'}**: ${friendlyError}`,
        timestamp: Date.now()
      };
      
      const updatedMessages = [...newMessages, systemErrorMessage];
      setMessages(updatedMessages);
      await setDoc(chatRef, { messages: updatedMessages }, { merge: true }).catch(err => console.error("Failed to write system error message to Firestore:", err));
    }
  };

  const isUrl = (str: string) => str?.startsWith('http') || str?.startsWith('data:image');
  const isMaintenanceActive = Boolean(selectedPersona && (selectedPersona as any).underMaintenance !== false);

  return (
    <div 
      className="w-full h-full min-h-0 flex-1 flex flex-col md:flex-row gap-4 p-3 sm:p-4 overflow-hidden box-border relative animate-in fade-in duration-500"
    >
      
      {/* Persona Selector Sidebar */}
      <div 
        className={cn(
          "w-full md:w-80 flex flex-col h-full min-h-0 flex-shrink-0 backdrop-blur-xl bg-black/70 border border-cyan-500/30 rounded-2xl shadow-[0_0_25px_rgba(0,243,255,0.1)] relative overflow-hidden",
          (mobileShowChat || selectedPersona) ? "hidden md:flex" : "flex"
        )}
      >
        {/* Top neon line indicator */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-emerald-400 opacity-80" />

        <div className="p-4 sm:p-5 border-b border-cyan-500/20 bg-black/40 flex justify-between items-center relative flex-shrink-0 z-10 w-full">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,243,255,0.9)] animate-pulse" />
            <span className="text-[10px] font-mono font-black uppercase tracking-[0.25em] text-cyan-400 flex items-center gap-2">
              <Cpu size={14} className="text-cyan-400 animate-pulse" />
              {t.title}
            </span>
          </div>
          <button 
            onClick={() => setIsCreatorOpen(true)}
            title={language === 'ka' ? 'დაამატე ახალი აგენტი' : 'Deploy New Agent'}
            className="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-all duration-300 cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline text-[10px] uppercase tracking-wider">{language === 'ka' ? 'ახალი' : 'DEPLOY'}</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar-minimal">
          {personas.map((p) => {
            const isSelected = selectedPersona?.id === p.id;
            return (
              <motion.button
                layout
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                key={p.id}
                onClick={() => {
                  setSelectedPersona(p);
                  setMobileShowChat(true);
                }}
                className={cn(
                  "w-full flex items-center gap-3.5 p-3 rounded-xl transition-all duration-300 text-left group border text-xs select-none relative cursor-pointer overflow-hidden",
                  isSelected 
                    ? "bg-gradient-to-r from-cyan-950/70 to-black/80 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,243,255,0.25)] ring-1 ring-cyan-400/40" 
                    : "bg-black/40 border-cyan-900/30 text-slate-400 hover:border-cyan-500/50 hover:bg-cyan-950/20 hover:text-slate-200 hover:shadow-[0_0_15px_rgba(0,243,255,0.15)]"
                )}
              >
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.9)]" />
                )}
                
                <PersonaAvatarView 
                  avatar={p.avatar}
                  name={language === 'ka' ? (p.nameGe || p.name) : p.name}
                  size="md"
                  status={isSelected ? 'online' : undefined}
                />

                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-xs sm:text-sm tracking-tight truncate group-hover:text-cyan-300 transition-colors flex items-center justify-between">
                    <span className="truncate">{language === 'ka' ? (p.nameGe || p.name) : p.name}</span>
                    {isSelected && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 uppercase tracking-widest shrink-0 ml-1">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] font-mono uppercase tracking-wider truncate mt-1 text-slate-400 flex items-center gap-1.5">
                    <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", isSelected ? "bg-cyan-400 shadow-[0_0_6px_rgba(0,243,255,0.8)]" : "bg-slate-600")} />
                    <span className="truncate">{language === 'ka' ? (p.roleGe || p.role) : p.role}</span>
                  </div>
                </div>
              </motion.button>
            );
          })}

          {personas.length === 0 && (
            <div className="text-center py-16 text-[10px] font-mono font-bold uppercase tracking-widest leading-loose p-6 border border-dashed border-cyan-500/30 rounded-xl bg-black/40 text-cyan-500/60">
              {language === 'ka' ? '⚡ ინტელექტის მოდულები არ არის სინქრონიზებული' : '⚡ NO AGENTS CREATED YET'}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div 
        className={cn(
        "flex-1 flex flex-col h-full min-h-0 overflow-hidden backdrop-blur-xl bg-black/70 border border-cyan-500/30 rounded-2xl shadow-[0_0_35px_rgba(0,243,255,0.1)] relative",
        mobileShowChat 
          ? "fixed inset-0 z-[80] bg-black/90 md:relative md:inset-auto md:z-auto md:bg-black/70 md:border md:border-cyan-500/30 md:rounded-2xl h-[100dvh] md:h-full" 
          : "hidden md:flex md:relative"
      )}>
        {/* Permanent Locked Header */}
        <header className="px-5 py-4 border-b border-cyan-500/30 bg-black/60 backdrop-blur-md flex items-center justify-between relative flex-shrink-0 shrink-0 w-full z-30 top-0 block">
           {/* Top neon line */}
           <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-emerald-400 opacity-80" />
           
           <div className="flex items-center gap-3.5">
               <button
                 onClick={() => setMobileShowChat(false)}
                 className="lg:hidden p-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 cursor-pointer mr-1"
                 title={language === "ka" ? "უკან" : "Back"}
               >
                 <ArrowLeft size={16} />
               </button>
               
               {selectedPersona ? (
                 <>
                   <PersonaAvatarView 
                      avatar={selectedPersona.avatar}
                      name={language === 'ka' ? (selectedPersona.nameGe || selectedPersona.name) : selectedPersona.name}
                      size="lg"
                   />
                   <div>
                     <div className="flex items-center gap-2">
                       <h3 className="font-mono font-black text-sm sm:text-base tracking-tight text-cyan-100 truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                         {language === 'ka' ? (selectedPersona.nameGe || selectedPersona.name) : selectedPersona.name}
                       </h3>
                       <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-widest bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,243,255,0.2)]">
                         {language === 'ka' ? 'დროებით მიუწვდომელია' : 'Temporarily Unavailable'}
                       </span>
                     </div>
                     <div className="flex items-center gap-2 text-[9px] font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase mt-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_8px_rgba(0,243,255,0.9)]"></span>
                        </span>
                        <span className="truncate max-w-[160px] sm:max-w-none text-slate-300">{language === 'ka' ? (selectedPersona.roleGe || selectedPersona.role) : selectedPersona.role}</span>
                     </div>
                  </div>
                 </>
               ) : (
                 <>
                   <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.15)]">
                     <Users size={20} />
                   </div>
                   <div>
                     <h3 className="font-mono font-black text-sm sm:text-base tracking-tight text-cyan-100">
                       {language === 'ka' ? 'აირჩიეთ ასისტენტი' : 'Select Assistant'}
                     </h3>
                     <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                       {language === 'ka' ? 'სისტემა მზადაა' : 'System Ready'}
                     </p>
                   </div>
                 </>
               )}
           </div>

           {/* Action Buttons */}
           {selectedPersona && (
             <div className="flex gap-2 items-center">
                {showConfirmClear ? (
                  <div className="flex items-center gap-1.5 bg-red-950/70 border border-red-500/50 px-2 py-1 rounded-xl h-9 animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <span className="text-[10px] font-mono font-bold uppercase text-red-300 tracking-wider">
                      {language === 'ka' ? 'წავშალო?' : 'Clear?'}
                    </span>
                    <button
                      onClick={handleClearChat}
                      className="px-2 py-1 bg-red-500 hover:bg-red-400 text-black rounded-lg text-[9px] font-mono font-black cursor-pointer transition-all shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    >
                      {language === 'ka' ? 'კი' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setShowConfirmClear(false)}
                      className="px-2 py-1 bg-black/60 hover:bg-white/10 text-slate-300 rounded-lg text-[9px] font-mono font-bold cursor-pointer transition-colors border border-slate-700"
                    >
                      {language === 'ka' ? 'არა' : 'No'}
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowConfirmClear(true)}
                    className="p-2.5 bg-black/40 hover:bg-cyan-500/10 hover:text-cyan-300 rounded-xl text-slate-400 transition-all border border-cyan-900/30 hover:border-cyan-500/40 hover:shadow-[0_0_12px_rgba(0,243,255,0.2)] cursor-pointer"
                    title={language === 'ka' ? 'ჩატის გასუფთავება' : 'Clear Chat History'}
                  >
                     <RotateCcw size={16} />
                  </button>
                )}
                <button 
                   onClick={() => setIsEditingInstructions(!isEditingInstructions)}
                   className={cn(
                      "p-2.5 rounded-xl transition-all border cursor-pointer",
                      isEditingInstructions 
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,243,255,0.3)]" 
                        : "bg-black/40 text-slate-400 border-cyan-900/30 hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:text-cyan-300 hover:shadow-[0_0_12px_rgba(0,243,255,0.2)]"
                   )}
                   title={language === 'ka' ? 'სისტემური ინსტრუქციების რედაქტირება' : 'Edit System Instructions'}
                >
                   <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => {
                    setDecomTarget(selectedPersona);
                    setIsDecommissioning(true);
                  }}
                  className="p-2.5 bg-black/40 hover:bg-red-500/20 hover:text-red-300 rounded-xl text-slate-400 transition-all border border-cyan-900/30 hover:border-red-500/40 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)] cursor-pointer"
                  title={language === 'ka' ? 'აგენტის წაშლა' : 'Delete Agent'}
                >
                   <Trash2 size={16} />
                </button>
             </div>
           )}
        </header>

        {/* System Instructions Editor Drawer */}
        <AnimatePresence>
          {isEditingInstructions && selectedPersona && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-cyan-500/30 bg-black/90 backdrop-blur-xl shadow-[0_0_25px_rgba(0,243,255,0.15)] flex-shrink-0 w-full z-20"
            >
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                    <Sparkles size={14} className="animate-pulse text-cyan-400" />
                    {language === 'ka' ? '⚡ სისტემური ინსტრუქციები' : '⚡ SYSTEM COGITATIVE BOUNDARIES'}
                  </label>
                  <span className="text-[9px] font-mono text-cyan-300/80 font-bold uppercase tracking-wider bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-500/30">
                     {language === 'ka' ? (selectedPersona.roleGe || selectedPersona.role) : selectedPersona.role}
                  </span>
                </div>

                {/* Presets Grid */}
                <div className="flex overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-black/60 p-2.5 rounded-xl border border-cyan-500/30 custom-scrollbar-minimal pb-3 md:pb-2.5">
                  {INSTRUCTION_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setEditingInstructions(p.prompt)}
                      className="p-2.5 text-left bg-cyan-950/20 hover:bg-cyan-500/15 border border-cyan-900/40 hover:border-cyan-400/80 hover:shadow-[0_0_12px_rgba(0,243,255,0.25)] rounded-xl group transition-all cursor-pointer shrink-0 w-52 md:w-auto hover:scale-[1.01]"
                    >
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {language === 'ka' ? p.titleKa : p.titleEn}
                      </p>
                      <p className="text-[9px] font-sans text-slate-400 leading-relaxed line-clamp-2 mt-1">
                        {language === 'ka' ? p.descKa : p.descEn}
                      </p>
                    </button>
                  ))}
                </div>
                
                <textarea
                  value={editingInstructions}
                  onChange={(e) => setEditingInstructions(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                  onKeyPress={(e) => e.stopPropagation()}
                  className="w-full h-24 sm:h-32 p-3.5 bg-black/80 border border-cyan-500/40 rounded-xl text-xs text-cyan-100 placeholder:text-cyan-600/50 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] focus:ring-1 focus:ring-cyan-400 transition-all font-mono leading-relaxed"
                  placeholder={language === 'ka' ? 'შეიყვანეთ სისტემური ინსტრუმენტი ან ინსტრუქცია...' : 'Specify precise cogitative boundary parameters for the model target...'}
                />

                <div className="flex justify-between items-center">
                  <div>
                    {saveSuccess && (
                      <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                        <Check size={14} />
                        {language === 'ka' ? 'წარმატებით შეინახა!' : 'Instructions synchronized successfully'}
                      </span>
                    )}
                    {saveError && (
                      <span className="text-xs font-mono text-rose-400 font-bold flex items-center gap-1.5">
                        <ShieldAlert size={14} />
                        ✗ {saveError}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingInstructions(false)}
                      className="px-3.5 py-1.5 bg-black/40 hover:bg-white/10 border border-slate-800 hover:border-slate-600 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {language === 'ka' ? 'გაუქმება' : 'Close'}
                    </button>
                    <button
                      onClick={handleSaveInstructions}
                      disabled={isSavingInstructions}
                      className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-black rounded-xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(0,243,255,0.4)]"
                    >
                      {isSavingInstructions 
                        ? (language === 'ka' ? 'ინახება...' : 'Compiling...')
                        : (language === 'ka' ? 'შენახვა' : 'Synchronize')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dedicated Layout Branching: Maintenance Viewport | Empty State Viewport | Active Chat Viewport */}
        {isMaintenanceActive ? (
          /* Dedicated Maintenance Viewport */
          <div className="flex-1 min-h-0 flex flex-col items-center overflow-y-auto p-4 sm:p-6 bg-gradient-to-b from-black/20 via-black/40 to-black/80 relative z-10 w-full custom-scrollbar-minimal">
            <motion.div 
              key={selectedPersona?.id}
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-black/60 border border-cyan-500/25 backdrop-blur-xl shadow-[0_0_40px_rgba(0,243,255,0.08)] text-center flex flex-col items-center relative overflow-hidden shrink-0 my-auto"
            >
              {/* Subtle top ambient bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-400/50 to-cyan-500/0" />

              {/* Small Status Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                </span>
                <span>
                  {language === 'ka' ? 'გაუმჯობესების პროცესშია' : 'Improving'}
                </span>
              </div>

              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 shadow-[0_0_25px_rgba(0,243,255,0.15)]">
                <Sparkles size={32} className="text-cyan-400" />
              </div>

              {/* Title */}
              <h3 className="text-lg sm:text-xl font-semibold text-slate-100 mb-2.5 tracking-tight font-sans">
                {language === 'ka' 
                  ? `${selectedPersona?.nameGe || selectedPersona?.name} დროებით მიუწვდომელია` 
                  : `${selectedPersona?.name} is temporarily unavailable`
                }
              </h3>

              {/* Short Description */}
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 max-w-sm font-sans">
                {language === 'ka'
                  ? 'ჩვენ ვაუმჯობესებთ ამ ასისტენტს. იგი მალე კვლავ ხელმისაწვდომი იქნება.'
                  : "We're making improvements to this assistant. It will be available again soon."
                }
              </p>

              {/* Optional Reassuring Note */}
              <div className="pt-4 border-t border-cyan-500/15 w-full text-center">
                <p className="text-xs text-slate-400 font-sans">
                  {language === 'ka' ? 'გმადლობთ მოთმინებისთვის.' : 'Thank you for your patience.'}
                </p>
              </div>
            </motion.div>
          </div>
        ) : !selectedPersona ? (
          /* Empty State Viewport */
          <div className="flex-1 min-h-0 flex flex-col items-center overflow-y-auto p-4 sm:p-6 bg-gradient-to-b from-black/20 via-black/40 to-black/80 relative z-10 w-full custom-scrollbar-minimal">
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-6 my-auto shrink-0">
               <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(0,243,255,0.2)]">
                     <Users size={40} strokeWidth={1.5} />
               </div>
               <div className="space-y-2 max-w-sm">
                  <h3 className="text-lg font-semibold text-slate-200 tracking-tight font-sans">
                     {language === 'ka' ? 'აირჩიეთ ასისტენტი' : 'Select an assistant'}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                     {language === 'ka' ? 'აირჩიეთ სასურველი ასისტენტი მარცხენა მენიუდან დასაწყებად.' : 'Choose an assistant from the sidebar to get started.'}
                  </p>
               </div>
            </div>
          </div>
        ) : (
          /* Active Chat Viewport */
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-28 sm:pb-8 flex flex-col space-y-4 custom-scrollbar-minimal bg-gradient-to-b from-black/20 via-black/40 to-black/80 relative">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 max-w-[85%] sm:max-w-[75%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed",
                  msg.role === 'user'
                    ? "bg-cyan-500/20 text-cyan-100 border border-cyan-400/40 rounded-tr-none"
                    : "bg-black/60 text-slate-200 border border-cyan-900/40 rounded-tl-none backdrop-blur-md"
                )}>
                  <div className="markdown-body">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Permanent Locked Footer */}
        <footer className="p-3 sm:p-5 border-t border-cyan-500/30 bg-black/80 flex-shrink-0 shrink-0 mt-auto pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-5 backdrop-blur-xl relative z-20">
           <div className="relative max-w-4xl mx-auto flex flex-col gap-3">
              {/* Input Area - Disabled in Maintenance Mode */}
              <div className="relative group flex items-center">
                <div className="absolute left-3.5 z-40 flex items-center gap-2">
                  <button 
                    disabled={true}
                    className="p-2 rounded-xl border border-slate-800 bg-black/40 text-slate-600 cursor-not-allowed opacity-50"
                    title={language === 'ka' ? 'ინსტრუმენტები მიუწვდომელია' : 'Tools unavailable'}
                  >
                     <Sparkles size={16} className="text-slate-500" />
                  </button>
                </div>

                <input 
                  type="text" 
                  disabled={true}
                  value=""
                  readOnly={true}
                  placeholder={
                    selectedPersona 
                      ? (language === 'ka' 
                          ? `${selectedPersona.nameGe || selectedPersona.name} დროებით მიუწვდომელია.` 
                          : `${selectedPersona.name} is temporarily unavailable.`)
                      : (language === 'ka'
                          ? 'აირჩიეთ ასისტენტი საუბრის დასაწყებად...'
                          : 'Select an assistant from the sidebar to begin...')
                  }
                  className="w-full bg-black/50 border border-slate-700/50 rounded-2xl pl-14 pr-14 py-3.5 sm:py-4 text-xs sm:text-sm text-slate-400 placeholder:text-slate-500 font-sans tracking-wide cursor-not-allowed opacity-60 shadow-inner"
                />

                <div className="absolute right-2.5 flex items-center gap-2 z-40">
                  <button 
                    disabled={true}
                    className="p-2.5 bg-slate-800/80 text-slate-500 font-extrabold rounded-xl border border-slate-700/40 opacity-40 cursor-not-allowed shadow-none"
                  >
                     <Send size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
           </div>
        </footer>
      </div>



      {/* 1. CREATOR OVERLAY MODAL */}
      <ProtonModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        size="lg"
        title={
          <div className="flex items-center gap-3">
            <ProtonIconBox variant="accent" size="sm" className="bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(0,243,255,0.3)]">
              <Laptop size={18} />
            </ProtonIconBox>
            <div>
              <div className="text-sm font-mono font-black uppercase tracking-widest text-cyan-100">
                {language === 'ka' ? 'აგენტის დეპლოიმენტი' : 'System Assistant Deployment'}
              </div>
              <div className="text-[9px] text-cyan-400/80 uppercase font-mono tracking-widest mt-0.5 font-bold">
                Configure AI Council Entity Parameters
              </div>
            </div>
          </div>
        }
        footer={
          <>
            <ProtonButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreatorOpen(false)}
              className="font-mono text-slate-400 hover:text-white"
            >
              Cancel
            </ProtonButton>
            <ProtonButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCreatePersona}
              isLoading={isCreatingPersona}
              disabled={!newPersonaNameEn.trim()}
              rightIcon={<Check size={14} strokeWidth={3} />}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold shadow-[0_0_15px_rgba(0,243,255,0.4)]"
            >
              Deploy intelligence
            </ProtonButton>
          </>
        }
      >
        <div className="space-y-5">
          {/* Main forms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProtonInput 
              label="Agent Name (English) *"
              type="text" 
              value={newPersonaNameEn}
              onChange={(e) => setNewPersonaNameEn(e.target.value)}
              placeholder="e.g. Sentry Code"
            />
            <ProtonInput 
              label="სახელი (ქართულად)"
              type="text" 
              value={newPersonaNameKa}
              onChange={(e) => setNewPersonaNameKa(e.target.value)}
              placeholder="მაგ. სენტრი კოდი"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProtonInput 
              label="Agent Specialty Role (e.g. Architect)"
              type="text" 
              value={newPersonaRole}
              onChange={(e) => setNewPersonaRole(e.target.value)}
              placeholder="e.g. System Audit Specialist"
            />
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider font-mono">
                Language Preference
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['English', 'Georgian', 'Mixed'].map((l) => (
                  <ProtonButton
                    key={l}
                    type="button"
                    variant={newPersonaLang === l ? 'subtle' : 'ghost'}
                    size="sm"
                    onClick={() => setNewPersonaLang(l as any)}
                    className={cn(
                      "py-2.5 text-[10px] font-mono font-bold",
                      newPersonaLang === l ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.2)]" : "text-slate-400 hover:text-white"
                    )}
                  >
                    {l}
                  </ProtonButton>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProtonInput 
              label="Brief Description (English)"
              type="text" 
              value={newPersonaDesc}
              onChange={(e) => setNewPersonaDesc(e.target.value)}
              placeholder="e.g. Security audit intelligence engine..."
            />
            <ProtonInput 
              label="მოკლე აღწერა (ქართულად)"
              type="text" 
              value={newPersonaDescKa}
              onChange={(e) => setNewPersonaDescKa(e.target.value)}
              placeholder="მაგ. უსაფრთხოების აუდიტის ინტელექტუალი..."
            />
          </div>

          {/* Avatar Presets */}
          <div className="space-y-3 p-4 bg-black/60 border border-cyan-500/30 rounded-2xl">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                Select Avatar Icon
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAvatarType('preset')}
                  className={cn("text-[10px] font-mono font-bold uppercase tracking-widest transition-colors cursor-pointer", selectedAvatarType === 'preset' ? "text-cyan-400" : "text-slate-500 hover:text-white")}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAvatarType('url')}
                  className={cn("text-[10px] font-mono font-bold uppercase tracking-widest transition-colors cursor-pointer", selectedAvatarType === 'url' ? "text-cyan-400" : "text-slate-500 hover:text-white")}
                >
                  Image Link
                </button>
              </div>
            </div>

            {selectedAvatarType === 'preset' ? (
              <div className="flex flex-wrap gap-2.5">
                {AVATAR_PRESETS.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNewPersonaAvatarEmoji(av.emoji)}
                    title={language === 'ka' ? av.labelKa : av.labelEn}
                    className={cn(
                      "w-11 h-11 rounded-xl text-xl flex items-center justify-center border transition-all cursor-pointer select-none",
                      newPersonaAvatarEmoji === av.emoji 
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 scale-110 shadow-[0_0_15px_rgba(0,243,255,0.3)]" 
                        : "bg-black/50 border-cyan-900/40 text-slate-400 hover:bg-black/80 hover:scale-105"
                    )}
                  >
                    {av.emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <ProtonInput 
                  type="text" 
                  value={newPersonaAvatarUrl}
                  onChange={(e) => setNewPersonaAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-example..."
                />
                {newPersonaAvatarUrl.trim() && (
                  <div className="flex items-center gap-3 p-3 bg-black/80 border border-cyan-500/30 rounded-xl text-xs">
                    <PersonaAvatarView 
                      avatar={newPersonaAvatarUrl.trim()} 
                      name={newPersonaNameEn || 'New Agent'} 
                      size="md" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-cyan-200 truncate">Avatar Live Preview</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {isValidAvatarUrl(newPersonaAvatarUrl) ? (
                          <span className="text-emerald-400 font-mono font-bold">✓ Valid URL Format</span>
                        ) : (
                          <span className="text-amber-400 font-mono font-bold">⚠ Invalid URL Format — Will Fallback Gracefully</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* System Prompt/Instructions Box */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                Cogitative Instructions / System Brain Prompt
              </label>
              <ProtonBadge variant="accent" size="sm" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40">Provides System Guidelines</ProtonBadge>
            </div>
            <textarea 
              value={newPersonaInstructions}
              onChange={(e) => setNewPersonaInstructions(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              placeholder="E.g. Analyze all user statements for business priorities. Structure answers inside highly clean markdown tags..."
              className="w-full h-28 bg-black/80 border border-cyan-500/40 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] focus:ring-1 focus:ring-cyan-400 rounded-xl p-3.5 text-xs text-cyan-100 placeholder:text-cyan-600/50 focus:outline-none transition-all font-mono leading-relaxed"
            />
          </div>
        </div>
      </ProtonModal>

      {/* 2. DECOMMISSION (DELETE) CONFIRMATION MODAL */}
      <ProtonModal
        isOpen={isDecommissioning && !!decomTarget}
        onClose={() => {
          setIsDecommissioning(false);
          setDecomTarget(null);
        }}
        size="sm"
        title={language === 'ka' ? 'აგენტის წაშლა' : 'Confirm Delete Agent'}
        description={
          decomTarget ? (
            <span className="text-rose-400 font-mono font-bold">
              Permanent deletion: {language === 'ka' ? decomTarget.nameGe : decomTarget.name}
            </span>
          ) : undefined
        }
        footer={
          <>
            <ProtonButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsDecommissioning(false);
                setDecomTarget(null);
              }}
              className="font-mono text-slate-400"
            >
              {language === 'ka' ? 'გაუქმება' : 'Cancel'}
            </ProtonButton>
            <ProtonButton
              variant="danger"
              size="sm"
              onClick={handleDecommission}
              className="bg-red-600 hover:bg-red-500 text-white font-mono font-bold shadow-[0_0_12px_rgba(239,68,68,0.4)]"
            >
              {language === 'ka' ? 'წაშლა' : 'Delete Agent'}
            </ProtonButton>
          </>
        }
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <ShieldAlert size={32} />
          </div>
          <p className="text-xs font-mono text-slate-300 leading-relaxed font-normal">
            {language === 'ka' 
              ? `დარწმუნებული ხართ, რომ გსურთ აგენტის წაშლა? ეს ქმედება მთლიანად გაასუფთავებს მის სისტემურ ინსტრუქციებსა და საუბრის მეხსიერებას.` 
              : `Are you sure you want to delete ${decomTarget?.name}? All system instructions and chat history will be permanently deleted.`
            }
          </p>
        </div>
      </ProtonModal>

    </div>
  );
}
