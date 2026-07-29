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
      <div className={cn("rounded-xl overflow-hidden bg-proton-accent/10 border border-proton-accent/20 flex items-center justify-center select-none font-bold text-proton-text", sizeClasses[size], className)}>
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
            'absolute bottom-0 right-0 rounded-full ring-2 ring-proton-bg w-2.5 h-2.5',
            status === 'online' ? 'bg-emerald-500' : 'bg-zinc-500'
          )}
        />
      )}
    </div>
  );
}

// Cyber Preset Avatars
const AVATAR_PRESETS = [
  { emoji: '🤖', labelEn: 'Cortex Matrix', labelKa: 'კორტექს მატრიქსი' },
  { emoji: '⚡', labelEn: 'Hyperion Vector', labelKa: 'ჰიპერიონ ვექტორი' },
  { emoji: '🧠', labelEn: 'Synapse System', labelKa: 'სინაფსის ბირთვი' },
  { emoji: '🔮', labelEn: 'Oracle Node', labelKa: 'ორაკულ ნოდი' },
  { emoji: '👾', labelEn: 'Specter Logic', labelKa: 'სპექტრის ლოგიკა' },
  { emoji: '⚙️', labelEn: 'Engine Operator', labelKa: 'ოპერატორი' },
  { emoji: '🛰️', labelEn: 'Orbit Link', labelKa: 'ორბიტალური ლინკი' },
  { emoji: '🛡️', labelEn: 'Sentry Protocol', labelKa: 'სენტრი პროტოკოლი' },
  { emoji: '🧪', labelEn: 'Helix Analytica', labelKa: 'ჰელიქს ანალიტიკა' },
  { emoji: '🎨', labelEn: 'Nova Synthesizer', labelKa: 'ნოვა სინთეზატორი' },
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
    prompt: "You are a specialized marketing strategist and sci-fi copywriter. Write engaging, vivid, formatted promotional texts, copy blocks, and email templates with clear bulleted priorities."
  },
  {
    titleEn: "Workflow diagnostic",
    titleKa: "პროცესის დიაგნოსტიკა",
    descEn: "Audit systemic node bottlenecks.",
    descKa: "ნოდური გრაფების დაგეგმარება.",
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

    if (selectedPersona) {
      setEditingInstructions(selectedPersona.systemInstruction || '');
    } else {
      setEditingInstructions('');
    }
    setIsEditingInstructions(false);
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

  return (
    <div className="flex flex-col h-full overflow-hidden w-full lg:flex-row gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Persona Selector */}
      <ProtonCard 
        padding="none"
        className={cn(
          "w-full lg:w-80 flex flex-col h-full min-h-0",
          mobileShowChat ? "hidden lg:flex" : "flex"
        )}
      >
        <div className="p-5 border-b border-proton-border bg-proton-card/40 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-proton-text flex items-center gap-2">
            <Cpu size={14} className="text-proton-accent" />
            {t.title}
          </span>
          <ProtonButton 
            onClick={() => setIsCreatorOpen(true)}
            title={language === 'ka' ? 'დაამატე ახალი აგენტი' : 'Deploy New Agent'}
            variant="subtle"
            size="sm"
            className="p-1.5 min-w-0"
          >
             <Plus size={18} strokeWidth={2.5} />
          </ProtonButton>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar-minimal">
          {personas.map((p) => {
            const isSelected = selectedPersona?.id === p.id;
            return (
              <motion.button
                layout
                key={p.id}
                onClick={() => {
                  setSelectedPersona(p);
                  setMobileShowChat(true);
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3.5 rounded-xl transition-all duration-300 text-left group border text-xs select-none relative cursor-pointer",
                  isSelected 
                    ? "bg-proton-accent/10 border-proton-accent/40 text-proton-accent shadow-[0_0_20px_rgba(6,182,212,0.1)] ring-1 ring-proton-accent/20" 
                    : "bg-proton-bg/40 border-proton-border/40 text-proton-muted hover:border-proton-border hover:bg-proton-card"
                )}
              >
                {isSelected && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-proton-accent rounded-r-full" />
                )}
                
                <PersonaAvatarView 
                  avatar={p.avatar}
                  name={language === 'ka' ? (p.nameGe || p.name) : p.name}
                  size="md"
                  status={isSelected ? 'online' : undefined}
                />

                <div className="flex-1 min-w-0">
                   <div className="font-bold text-sm tracking-tight truncate group-hover:text-proton-text transition-colors">
                     {language === 'ka' ? (p.nameGe || p.name) : p.name}
                   </div>
                   <div className="text-[10px] font-bold uppercase tracking-widest truncate mt-0.5 text-proton-muted flex items-center gap-1">
                     <span className="inline-block w-1 h-1 rounded-full bg-proton-accent" />
                     {language === 'ka' ? (p.roleGe || p.role) : p.role}
                   </div>
                </div>
              </motion.button>
            );
          })}

          {personas.length === 0 && (
             <div className="text-center py-16 opacity-40 text-[10px] font-black uppercase tracking-widest leading-loose p-6 border border-dashed border-proton-border rounded-xl">
                 {language === 'ka' ? 'ინტელექტის მოდულები არ არის სინქრონიზებული' : 'No Intelligence Units Synced'}
             </div>
          )}
        </div>
      </ProtonCard>

      {/* Chat Interface */}
      <div className={cn(
        "flex-1 bg-proton-card overflow-hidden flex flex-col shadow-xl backdrop-blur-md h-full min-h-0",
        mobileShowChat 
          ? "fixed inset-0 z-[80] bg-proton-bg lg:relative lg:inset-auto lg:z-auto lg:bg-proton-card lg:border lg:border-proton-border lg:rounded-2xl h-[100dvh] lg:h-full" 
          : "hidden lg:flex lg:relative lg:border lg:border-proton-border lg:rounded-2xl"
      )}>
        <AnimatePresence mode="wait">
        {selectedPersona ? (
           <motion.div 
             key={selectedPersona.id}
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="flex-1 min-h-0 flex flex-col overflow-hidden"
           >
              <header className="px-6 py-5 border-b border-proton-border bg-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                     <button
                       onClick={() => setMobileShowChat(false)}
                       className="lg:hidden p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-proton-muted hover:text-proton-text cursor-pointer mr-1"
                       title={language === "ka" ? "უკან" : "Back"}
                     >
                       <ArrowLeft size={16} />
                     </button>
                     
                     <PersonaAvatarView 
                        avatar={selectedPersona.avatar}
                        name={language === 'ka' ? (selectedPersona.nameGe || selectedPersona.name) : selectedPersona.name}
                        size="lg"
                     />
                     <div>
                       <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-proton-text truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                         {language === 'ka' ? (selectedPersona.nameGe || selectedPersona.name) : selectedPersona.name}
                       </h3>
                       <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.2em] text-proton-accent uppercase mt-0.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-proton-accent opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-proton-accent"></span>
                          </span>
                          <span className="truncate max-w-[180px] sm:max-w-none">{language === 'ka' ? (selectedPersona.roleGe || selectedPersona.role) : selectedPersona.role}</span>
                       </div>
                    </div>
                 </div>

                 <div className="flex gap-2 items-center">
                    {showConfirmClear ? (
                      <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-xl h-9 animate-in fade-in zoom-in-95 duration-200">
                        <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">
                          {language === 'ka' ? 'წავშალო?' : 'Clear?'}
                        </span>
                        <button
                          onClick={handleClearChat}
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[9px] font-bold cursor-pointer transition-colors"
                        >
                          {language === 'ka' ? 'კი' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setShowConfirmClear(false)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 text-proton-muted rounded-lg text-[9px] font-bold cursor-pointer transition-colors"
                        >
                          {language === 'ka' ? 'არა' : 'No'}
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowConfirmClear(true)}
                        className="p-2.5 hover:bg-white/5 hover:text-white rounded-xl text-proton-muted transition-all border border-transparent hover:border-white/10 cursor-pointer"
                        title={language === 'ka' ? 'ჩატის გასუფთავება' : 'Clear Chat History'}
                      >
                         <RotateCcw size={16} />
                      </button>
                    )}
                    <button 
                       onClick={() => setIsEditingInstructions(!isEditingInstructions)}
                       className={cn(
                          "p-2.5 rounded-xl text-proton-muted transition-all border border-transparent cursor-pointer",
                          isEditingInstructions 
                            ? "bg-proton-accent/10 border-proton-accent/30 text-proton-accent shadow-[0_0_10px_rgba(0,242,255,0.1)]" 
                            : "hover:bg-white/5 hover:border-white/10"
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
                      className="p-2.5 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-proton-muted transition-all border border-transparent hover:border-red-500/10 cursor-pointer"
                      title={language === 'ka' ? 'აგენტის დეკომისიონირება' : 'Decommission Agent'}
                    >
                       <Trash2 size={16} />
                    </button>
                 </div>
              </header>

              {/* System Instructions Editor / Presets Drawer */}
              <AnimatePresence>
                {isEditingInstructions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-proton-border bg-white/[0.015] backdrop-blur-sm"
                  >
                    <div className="p-6 space-y-5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-proton-accent flex items-center gap-2">
                          <Sparkles size={13} className="animate-bounce" />
                          {language === 'ka' ? 'სისტემური ინსტრუქციები' : 'System Cogitative Instructions'}
                        </label>
                        <span className="text-[10px] text-proton-text-light font-mono font-bold uppercase tracking-wider">
                           {language === 'ka' ? (selectedPersona.roleGe || selectedPersona.role) : selectedPersona.role}
                        </span>
                      </div>

                      {/* Presets Grid - Horizontal scrolling on mobile, grid on desktop */}
                      <div className="flex overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 bg-black/30 p-3 rounded-2xl border border-proton-border/40 custom-scrollbar-minimal pb-4 md:pb-3">
                        {INSTRUCTION_PRESETS.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => setEditingInstructions(p.prompt)}
                            className="p-3 text-left bg-white/5 hover:bg-proton-accent/10 hover:border-proton-accent/30 rounded-xl group border border-transparent transition-all cursor-pointer shrink-0 w-52 md:w-auto"
                          >
                            <p className="text-[10px] font-black uppercase tracking-wider text-proton-text group-hover:text-proton-accent transition-colors">
                              {language === 'ka' ? p.titleKa : p.titleEn}
                            </p>
                            <p className="text-[10px] text-proton-text-light/90 font-medium leading-relaxed line-clamp-2 mt-1">
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
                        className="w-full h-24 sm:h-36 p-4 bg-proton-bg border border-proton-border rounded-xl text-xs text-white placeholder-proton-muted/50 focus:outline-none focus:border-proton-accent/40 focus:ring-1 focus:ring-proton-accent/20 transition-all font-mono leading-relaxed"
                        placeholder={language === 'ka' ? 'შეიყვანეთ სისტემური ინსტრუმენტი ან ინსტრუქცია...' : 'Specify precise cogitative boundary parameters for the model target...'}
                      />

                      <div className="flex justify-between items-center">
                        <div>
                          {saveSuccess && (
                            <span className="text-xs text-emerald-400 font-black uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                              <Check size={14} />
                              {language === 'ka' ? 'წარმატებით შეინახა!' : 'Instructions synchronized successfully'}
                            </span>
                          )}
                          {saveError && (
                            <span className="text-xs text-red-500 font-extrabold flex items-center gap-1.5">
                              <ShieldAlert size={14} />
                              ✗ {saveError}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsEditingInstructions(false)}
                            className="px-4 py-2 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-proton-muted transition-colors cursor-pointer"
                          >
                            {language === 'ka' ? 'გაუქმება' : 'Close'}
                          </button>
                          <button
                            onClick={handleSaveInstructions}
                            disabled={isSavingInstructions}
                            className="px-5 py-2 bg-proton-accent hover:bg-proton-accent-hover text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-proton-accent/20"
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

              {/* Chat Container with Markdown rendering */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 sm:pb-8 space-y-6 custom-scrollbar-minimal bg-gradient-to-b from-transparent to-black/10">
                 {messages.map((m, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      key={m.id ? `${m.id}-${idx}` : `msg-${idx}`} 
                      className={cn(
                        "flex gap-4 max-w-[85%] items-start animate-in fade-in slide-in-from-bottom-2",
                        m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                      )}
                    >
                       <div className={cn(
                          "w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border text-xs shadow-md",
                          m.role === 'user' ? "bg-proton-accent border-proton-accent/30 text-slate-950" : "bg-white/5 border-proton-border text-proton-accent"
                       )}>
                          {m.role === 'user' ? <User size={16} strokeWidth={2.5} /> : <Bot size={16} strokeWidth={2.5} />}
                       </div>
                       
                       <div className={cn(
                          "p-4 px-5 rounded-2xl leading-relaxed text-xs shadow-sm hover:border-white/10 transition-all duration-300",
                          m.role === 'user' 
                            ? "bg-proton-accent/5 border border-proton-accent/20 text-proton-text rounded-tr-none font-medium" 
                            : "bg-white/[0.03] border border-proton-border/80 text-white/90 rounded-tl-none font-light"
                       )}>
                          {m.role === 'user' ? (
                            <p className="whitespace-pre-line tracking-wide leading-relaxed">{m.content}</p>
                          ) : (
                            <div className="prose prose-invert prose-xs max-w-none text-white/90 selection:bg-proton-accent/35 leading-relaxed tracking-wide space-y-2">
                              <Markdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed font-light text-white/85">{children}</p>,
                                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-white/70">{children}</li>,
                                  strong: ({ children }) => <strong className="font-extrabold text-proton-accent">{children}</strong>,
                                  pre: ({ children }) => <pre className="bg-black/30 border border-white/5 p-4 rounded-xl font-mono text-[10px] overflow-x-auto text-amber-300 my-3 leading-relaxed w-full custom-scrollbar-minimal">{children}</pre>,
                                  code: ({ children, ...props }) => {
                                    const contentStr = String(children || '');
                                    const isInline = !contentStr.includes('\n');
                                    return isInline ? (
                                      <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[9px] text-amber-300 border border-white/5">{children}</code>
                                    ) : (
                                      <code className="block font-mono text-[10px] text-white/90 leading-relaxed">{children}</code>
                                    );
                                  }
                                }}
                              >
                                {m.content}
                              </Markdown>
                            </div>
                          )}
                       </div>
                    </motion.div>
                 ))}
                 
                 {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-20 py-24 text-center">
                       <Bot size={72} className="mb-6 text-proton-accent animate-pulse" />
                       <p className="text-[11px] font-black uppercase tracking-[0.35em] text-proton-accent/80">
                         {t.start_convo.replace('{name}', language === 'ka' ? (selectedPersona.nameGe || selectedPersona.name) : selectedPersona.name)}
                       </p>
                    </div>
                 )}
                 {isSending && (
                    <div className="flex gap-4 items-center">
                       <div className="w-9 h-9 rounded-xl bg-white/5 border border-proton-border flex items-center justify-center">
                          <Bot size={16} className="text-proton-accent animate-pulse" />
                       </div>
                       <div className="px-4 py-2.5 bg-white/5 rounded-full flex gap-1.5 border border-white/5 shadow-inner">
                          <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-bounce" />
                          <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-bounce [animation-delay:0.4s]" />
                       </div>
                    </div>
                 )}
                 {/* Scroll Anchor */}
                 <div ref={chatEndRef} />
              </div>

              <footer className="p-3 sm:p-6 border-t border-proton-border bg-white/[0.02] shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-6">
                 <div className="relative max-w-4xl mx-auto flex flex-col gap-3">
                    <AnimatePresence>
                      {showTools && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full mb-4 left-0 w-64 bg-proton-card border border-proton-border rounded-2xl shadow-2xl p-2.5 z-[60] backdrop-blur-md"
                        >
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-proton-muted px-3 py-1.5 mb-1.5 opacity-60 flex items-center gap-1.5">
                            <Laptop size={12} />
                            {t.tools.title}
                          </p>
                          <div className="grid gap-1">
                            {aiTools.map((tool) => (
                              <button
                                key={tool.id}
                                onClick={() => {
                                  setSelectedTool(tool.id);
                                  setShowTools(false);
                                }}
                                className={cn(
                                  "flex items-center gap-3 w-full p-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                  selectedTool === tool.id ? "bg-proton-accent/10 text-proton-accent" : "hover:bg-white/5 text-proton-muted hover:text-proton-text"
                                )}
                              >
                                <div className={cn("p-1.5 rounded-lg shrink-0", tool.bg, tool.color)}>
                                  <tool.icon size={14} />
                                </div>
                                <span>{tool.label}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="relative group flex items-center">
                      <div className="absolute left-4 z-40 flex items-center gap-2">
                        <button 
                          onClick={() => setShowTools(!showTools)}
                          className={cn(
                            "p-2 rounded-xl transition-all border shrink-0 cursor-pointer",
                            showTools || selectedTool 
                              ? "bg-proton-accent/15 border-proton-accent/40 text-proton-accent shadow-[0_0_12px_rgba(0,242,255,0.15)] ring-2 ring-proton-accent/5" 
                              : "bg-white/5 border-white/5 text-proton-muted hover:text-proton-text hover:border-white/10"
                          )}
                        >
                           {selectedTool ? (
                             <div className="flex items-center">
                               {React.createElement(aiTools.find(t => t.id === selectedTool)?.icon || Sparkles, { size: 16 })}
                             </div>
                           ) : (
                             <Sparkles size={16} />
                           )}
                        </button>
                      </div>

                      <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') handleSendMessage();
                        }}
                        onKeyUp={(e) => e.stopPropagation()}
                        onKeyPress={(e) => e.stopPropagation()}
                        placeholder={selectedTool 
                          ? `${(aiTools.find(t => t.id === selectedTool)?.label || '').toUpperCase()} MODE...` 
                          : t.chat_placeholder.replace('{name}', language === 'ka' ? (selectedPersona.nameGe || selectedPersona.name) : selectedPersona.name)
                        }
                        className={cn(
                          "w-full bg-proton-bg border border-proton-border rounded-2xl pl-16 py-3.5 sm:py-4.5 focus:outline-none transition-all text-base sm:text-xs placeholder:text-proton-muted/40 font-medium tracking-wide",
                          selectedTool ? "pr-24 border-proton-accent/40 shadow-[0_0_20px_rgba(0,242,255,0.06)]" : "pr-14 focus:border-proton-accent/50 focus:ring-1 focus:ring-proton-accent/15"
                        )}
                      />

                      <div className="absolute right-2.5 flex items-center gap-2 z-40">
                        {selectedTool && (
                          <button 
                            onClick={() => setSelectedTool(null)}
                            className="p-1 px-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[8px] font-black rounded-md transition-colors"
                          >
                            ESC
                          </button>
                        )}
                        <button 
                          onClick={handleSendMessage}
                          disabled={!input.trim() || isSending}
                          className="p-2.5 bg-proton-accent hover:bg-proton-accent-hover disabled:opacity-20 disabled:grayscale text-slate-950 rounded-xl transition-all shadow-lg shadow-proton-accent/20 cursor-pointer"
                        >
                           <Send size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                 </div>
              </footer>
            </motion.div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 space-y-6">
               <div className="w-20 h-20 rounded-[35px] bg-white/5 border border-white/10 flex items-center justify-center text-proton-muted shadow-inner">
                     <Users size={36} strokeWidth={1.5} />
               </div>
               <div className="space-y-2">
                 <h4 className="text-xl font-black uppercase tracking-widest text-proton-text">AI Council Inactive</h4>
                 <p className="text-xs text-proton-muted max-w-xs mx-auto leading-relaxed uppercase tracking-widest opacity-60"> 
                     Select or deploy an active neural assistant from the collective panel to initialize communication.
                 </p>
                 <button 
                    onClick={() => setIsCreatorOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-proton-accent/10 hover:bg-proton-accent text-proton-accent hover:text-proton-bg border border-proton-accent/30 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-md cursor-pointer"
                 >
                    <Plus size={14} />
                    {language === 'ka' ? 'დაამატე აგენტი' : 'Deploy Neural Agent'}
                 </button>
               </div>
            </div>
         )}
         </AnimatePresence>
      </div>

      {/* 1. CREATOR OVERLAY MODAL */}
      <ProtonModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        size="lg"
        title={
          <div className="flex items-center gap-3">
            <ProtonIconBox variant="accent" size="sm">
              <Laptop size={18} />
            </ProtonIconBox>
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-proton-text">
                {language === 'ka' ? 'აგენტის დეპლოიმენტი' : 'System Assistant Deployment'}
              </div>
              <div className="text-[9px] text-proton-muted uppercase font-mono tracking-widest opacity-60 mt-0.5 font-normal">
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
            >
              Deploy intelligence
            </ProtonButton>
          </>
        }
      >
        <div className="space-y-6">
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
              <label className="text-xs font-semibold text-proton-text uppercase tracking-wider font-mono">
                Cognitive Language Node
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['English', 'Georgian', 'Mixed'].map((l) => (
                  <ProtonButton
                    key={l}
                    type="button"
                    variant={newPersonaLang === l ? 'subtle' : 'ghost'}
                    size="sm"
                    onClick={() => setNewPersonaLang(l as any)}
                    className="py-2.5 text-[10px]"
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

          {/* Avatar Presets Swiper */}
          <div className="space-y-3 p-4 bg-proton-bg/40 border border-proton-border/50 rounded-2xl">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-proton-text uppercase tracking-wider font-mono">
                Select Neural Identity Avatar
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAvatarType('preset')}
                  className={cn("text-[10px] font-mono font-bold uppercase tracking-widest transition-colors cursor-pointer", selectedAvatarType === 'preset' ? "text-proton-accent" : "text-proton-muted hover:text-white")}
                >
                  Presets
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAvatarType('url')}
                  className={cn("text-[10px] font-mono font-bold uppercase tracking-widest transition-colors cursor-pointer", selectedAvatarType === 'url' ? "text-proton-accent" : "text-proton-muted hover:text-white")}
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
                        ? "bg-proton-accent/15 border-proton-accent text-proton-accent scale-110 shadow-[0_0_12px_rgba(6,182,212,0.15)]" 
                        : "bg-proton-card/50 border-proton-border/40 text-proton-muted hover:bg-proton-card hover:scale-105"
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
                  <div className="flex items-center gap-3 p-3 bg-proton-bg/60 border border-proton-border/40 rounded-xl text-xs">
                    <PersonaAvatarView 
                      avatar={newPersonaAvatarUrl.trim()} 
                      name={newPersonaNameEn || 'New Agent'} 
                      size="md" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-proton-text truncate">Avatar Live Preview</div>
                      <div className="text-[10px] text-proton-muted mt-0.5">
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
              <label className="text-xs font-semibold text-proton-text uppercase tracking-wider font-mono">
                Cogitative Instructions / System Brain Prompt
              </label>
              <ProtonBadge variant="accent" size="sm">Provides System Guidelines</ProtonBadge>
            </div>
            <textarea 
              value={newPersonaInstructions}
              onChange={(e) => setNewPersonaInstructions(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              placeholder="E.g. Analyze all user statements for business priorities. Structure answers inside highly clean markdown tags..."
              className="w-full h-28 bg-proton-bg border border-proton-border focus:border-proton-accent focus:ring-1 focus:ring-proton-accent/50 rounded-xl p-4 text-xs text-proton-text focus:outline-none transition-all font-mono leading-relaxed"
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
        title={language === 'ka' ? 'აგენტის დეკომისიონირება' : 'Secure Decommission Protocol'}
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
            >
              {language === 'ka' ? 'გაუქმება' : 'Abort'}
            </ProtonButton>
            <ProtonButton
              variant="danger"
              size="sm"
              onClick={handleDecommission}
            >
              {language === 'ka' ? 'წაშლა' : 'Decommission'}
            </ProtonButton>
          </>
        }
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto animate-pulse">
            <ShieldAlert size={32} />
          </div>
          <p className="text-xs text-proton-muted leading-relaxed font-normal">
            {language === 'ka' 
              ? `დარწმუნებული ხართ, რომ გსურთ აგენტის წაშლა? ეს ქმედება მთლიანად გაასუფთავებს მის სისტემურ ინსტრუქციებსა და საუბრის მეხსიერებას.` 
              : `Are you absolutely certain you wish to decommission ${decomTarget?.name} from the neural matrix? All associated system prompt boundaries and chat interactions will be permanently wiped.`
            }
          </p>
        </div>
      </ProtonModal>

    </div>
  );
}
