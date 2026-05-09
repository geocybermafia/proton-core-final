import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { Persona, ChatMessage } from '../types';
import { Send, User, Bot, Plus, Trash2, Edit2, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';

export default function PersonasView({ 
  language,
  personas: initialPersonas,
  history: initialHistory,
  onNewMessage
}: { 
  language: 'en' | 'ka',
  personas?: Persona[],
  history?: ChatMessage[],
  onNewMessage?: (msg: ChatMessage) => void
}) {
  const t = translations[language].personas;
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas || []);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialHistory || []);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (initialPersonas) {
      setPersonas(initialPersonas);
      if (initialPersonas.length > 0 && !selectedPersona) {
        setSelectedPersona(initialPersonas[0]);
      }
    }
  }, [initialPersonas]);

  useEffect(() => {
    if (initialPersonas) return; // Use props if provided
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

  const handleSendMessage = async () => {
    if (!input.trim() || !selectedPersona || !auth.currentUser) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsSending(true);

    try {
       const chatRef = doc(db, 'users', auth.currentUser.uid, 'chatHistory', selectedPersona.id);
       await setDoc(chatRef, { messages: newMessages }, { merge: true });
       
       // Simulate AI response for now
       setTimeout(async () => {
         const aiMessage: ChatMessage = {
           id: (Date.now() + 1).toString(),
           role: 'model',
           content: `[RECOVERY_MODE] ${selectedPersona.name} is currently optimizing neural pathways. Detailed response capability will be restored shortly.`,
           timestamp: Date.now()
         };
         const updatedMessages = [...newMessages, aiMessage];
         setMessages(updatedMessages);
         await setDoc(chatRef, { messages: updatedMessages }, { merge: true });
         setIsSending(false);
       }, 1000);

    } catch (error) {
      console.error("Failed to send message:", error);
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-14rem)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Persona Selector */}
      <div className="w-full lg:w-80 bg-proton-card border border-proton-border rounded-2xl overflow-hidden flex flex-col shadow-xl">
        <div className="p-5 border-b border-proton-border bg-white/5 flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-proton-text">{t.title}</span>
          <button className="p-1.5 hover:bg-proton-accent/10 rounded-lg text-proton-accent transition-colors">
             <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPersona(p)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left group border",
                selectedPersona?.id === p.id 
                  ? "bg-proton-accent/10 border-proton-accent/30 text-proton-accent shadow-sm" 
                  : "bg-white/5 border-transparent text-proton-muted hover:border-white/10 hover:bg-white/10"
              )}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden border border-proton-border shrink-0">
                {p.avatar ? (
                    <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl bg-proton-accent/5">🤖</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                 <div className="font-bold text-sm tracking-tight truncate group-hover:text-proton-text transition-colors">{p.name}</div>
                 <div className="text-[10px] font-black uppercase tracking-widest opacity-60 truncate mt-0.5">{p.role}</div>
              </div>
            </button>
          ))}
          {personas.length === 0 && (
             <div className="text-center py-12 opacity-30 text-xs font-black uppercase tracking-widest leading-loose p-6">
                {translations[language].workflows.no_workflows}
             </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 bg-proton-card border border-proton-border rounded-2xl overflow-hidden flex flex-col shadow-xl relative">
        <AnimatePresence mode="wait">
        {selectedPersona ? (
           <motion.div 
             key={selectedPersona.id}
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="flex flex-col h-full"
           >
              <header className="px-6 py-5 border-b border-proton-border bg-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-proton-accent/10 border border-proton-accent/20 flex items-center justify-center overflow-hidden">
                       {selectedPersona.avatar ? (
                            <img src={selectedPersona.avatar} alt="" className="w-full h-full object-cover" />
                       ) : (
                            <span className="text-2xl">🤖</span>
                       )}
                    </div>
                    <div>
                       <h3 className="font-bold text-base tracking-tight text-proton-text">{selectedPersona.name}</h3>
                       <div className="flex items-center gap-2 text-[9px] font-black tracking-[0.2em] text-proton-accent uppercase">
                          <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-pulse shadow-[0_0_8px_rgba(0,242,255,0.8)]" />
                          <span>SYNCHRONIZED</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button className="p-2.5 hover:bg-white/5 rounded-xl text-proton-muted transition-all border border-transparent hover:border-white/10">
                       <Edit2 size={18} />
                    </button>
                    <button className="p-2.5 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-proton-muted transition-all border border-transparent hover:border-red-500/10">
                       <Trash2 size={18} />
                    </button>
                 </div>
              </header>

              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                 {messages.map((m) => (
                    <div key={m.id} className={cn(
                       "flex gap-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2",
                       m.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}>
                       <div className={cn(
                          "w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border",
                          m.role === 'user' ? "bg-proton-accent border-proton-accent/30 text-slate-950" : "bg-white/5 border-proton-border text-proton-accent"
                       )}>
                          {m.role === 'user' ? <User size={20} strokeWidth={2.5} /> : <Bot size={20} strokeWidth={2.5} />}
                       </div>
                       <div className={cn(
                          "p-5 rounded-2xl text-sm leading-relaxed tracking-wide shadow-sm",
                          m.role === 'user' ? "bg-proton-accent/10 border border-proton-accent/20 text-proton-text" : "bg-white/5 border border-proton-border text-white/90"
                       )}>
                          {m.content}
                       </div>
                    </div>
                 ))}
                 {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-10 py-20 text-center">
                       <Bot size={80} className="mb-6" />
                       <p className="text-xl font-black uppercase tracking-[0.4em]">{t.start_convo.replace('{name}', selectedPersona.name)}</p>
                    </div>
                 )}
                 {isSending && (
                    <div className="flex gap-4 items-center">
                       <div className="w-10 h-10 rounded-xl bg-white/5 border border-proton-border flex items-center justify-center">
                          <Bot size={20} className="text-proton-accent animate-pulse" />
                       </div>
                       <div className="px-4 py-3 bg-white/5 rounded-full flex gap-1.5 border border-white/5">
                          <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-bounce" />
                          <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-proton-accent animate-bounce [animation-delay:0.4s]" />
                       </div>
                    </div>
                 )}
              </div>

              <footer className="p-6 border-t border-proton-border bg-white/5">
                 <div className="relative max-w-4xl mx-auto">
                    <input 
                      type="text" 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={t.chat_placeholder.replace('{name}', selectedPersona.name)}
                      className="w-full bg-proton-bg border border-proton-border rounded-2xl pl-6 pr-16 py-4 focus:outline-none focus:border-proton-accent/50 focus:ring-1 focus:ring-proton-accent/20 transition-all text-sm placeholder:text-proton-muted/50"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isSending}
                      className="absolute right-2.5 top-2 p-2.5 bg-proton-accent hover:bg-proton-accent-hover disabled:opacity-30 disabled:grayscale text-slate-950 rounded-xl transition-all shadow-lg shadow-proton-accent/20"
                    >
                       <Send size={20} strokeWidth={2.5} />
                    </button>
                 </div>
              </footer>
           </motion.div>
        ) : (
           <div className="flex flex-col items-center justify-center h-full text-center p-12 space-y-6">
              <div className="w-24 h-24 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center text-proton-muted">
                    <Users size={48} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black uppercase tracking-widest text-proton-text">Initialization Required</h4>
                <p className="text-sm text-proton-muted max-w-sm mx-auto font-medium leading-relaxed uppercase tracking-widest opacity-60"> 
                    Select a specialist entity from the collective hub to initialize secure neural communication.
                </p>
              </div>
           </div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
