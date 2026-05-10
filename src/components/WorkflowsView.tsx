import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Workflow, Persona } from '../types';
import { 
  Workflow as WorkflowIcon, 
  Plus, 
  Play, 
  Clock, 
  Zap, 
  Trash2, 
  Settings,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';
import { motion } from 'framer-motion';

export default function WorkflowsView({ 
  language,
  workflows: initialWorkflows,
  personas: initialPersonas
}: { 
  language: 'en' | 'ka',
  workflows?: Workflow[],
  personas?: Persona[]
}) {
  const t = translations[language].workflows;
  const tc = translations[language].common;
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows || []);
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas || []);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (initialWorkflows) setWorkflows(initialWorkflows);
    if (initialPersonas) setPersonas(initialPersonas);
  }, [initialWorkflows, initialPersonas]);

  useEffect(() => {
    if (initialWorkflows) return; // Use props if provided
    if (!auth.currentUser) return;
    // ... (rest of the fetching logic is fine as fallback)

    // Load Workflows
    const workflowsRef = collection(db, 'users', auth.currentUser.uid, 'workflows');
    const unsubscribeWorkflows = onSnapshot(workflowsRef, (snapshot) => {
      setWorkflows(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workflow)));
    });

    // Load Personas (for assignment)
    const personasRef = collection(db, 'users', auth.currentUser.uid, 'personas');
    const unsubscribePersonas = onSnapshot(personasRef, (snapshot) => {
      setPersonas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Persona)));
    });

    return () => {
      unsubscribeWorkflows();
      unsubscribePersonas();
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    const docRef = doc(db, 'users', auth.currentUser.uid, 'workflows', id);
    await deleteDoc(docRef);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
         <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-proton-text">{t.title}</h2>
            <p className="text-sm text-proton-muted">{t.subtitle}</p>
         </div>
         <button 
           onClick={() => setIsCreating(true)}
           className="flex items-center gap-2 bg-proton-accent hover:bg-proton-accent-hover text-slate-950 font-black uppercase text-[10px] tracking-widest px-6 py-2.5 rounded-full transition-all shadow-lg shadow-proton-accent/20"
         >
            <Plus size={16} strokeWidth={3} />
            {t.create_process}
         </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
         {workflows.map((wf) => (
            <motion.div 
              layout
              key={wf.id} 
              className="bg-proton-card border border-proton-border rounded-2xl overflow-hidden hover:border-proton-accent/50 transition-all group flex flex-col"
            >
               <div className="p-6 space-y-5 flex-1">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-proton-accent/10 rounded-xl text-proton-accent">
                        <WorkflowIcon size={24} />
                     </div>
                     <div className="flex gap-2">
                        <button className="p-2 hover:bg-white/5 rounded-lg text-proton-muted transition-colors">
                           <Settings size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(wf.id)}
                          className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-proton-muted transition-colors"
                        >
                           <Trash2 size={16} />
                        </button>
                     </div>
                  </div>

                  <div className="space-y-1">
                     <h3 className="font-bold text-lg leading-tight text-proton-text group-hover:text-proton-accent transition-colors">{wf.name}</h3>
                     <p className="text-xs text-proton-muted line-clamp-2">{wf.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                     <div className="flex -space-x-2">
                        {personas.find(p => p.id === wf.personaId) ? (
                            <div className="w-8 h-8 rounded-full bg-proton-accent/20 border-2 border-proton-card flex items-center justify-center text-xs overflow-hidden">
                                {personas.find(p => p.id === wf.personaId)?.avatar ? (
                                    <img src={personas.find(p => p.id === wf.personaId)?.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span>🤖</span>
                                )}
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-proton-card border border-proton-border flex items-center justify-center text-[10px] text-proton-muted">
                                ?
                            </div>
                        )}
                     </div>
                     <span className="text-[9px] uppercase tracking-[0.2em] text-proton-muted font-black">
                        {personas.find(p => p.id === wf.personaId)?.name || "Unassigned Agent"}
                     </span>
                  </div>

                  <div className="pt-5 border-t border-proton-border flex justify-between items-center">
                     <div className="flex items-center gap-2 text-[9px] font-black text-proton-muted uppercase tracking-widest">
                        <Clock size={12} />
                        <span>{wf.lastRun ? new Date(wf.lastRun).toLocaleTimeString() : 'Never'}</span>
                     </div>
                     <div className={cn(
                        "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em]",
                        wf.status === 'active' ? "bg-proton-accent/10 text-proton-accent border border-proton-accent/20" : "bg-white/5 text-proton-muted border border-white/5"
                     )}>
                        {wf.status === 'active' ? translations[language].hub.active : wf.status}
                     </div>
                  </div>
               </div>
               
               <button className="w-full py-4 bg-white/5 hover:bg-proton-accent/10 border-t border-proton-border text-[10px] font-black uppercase tracking-[0.25em] text-proton-accent/70 hover:text-proton-accent transition-all flex items-center justify-center gap-3">
                  <Play size={14} fill="currentColor" />
                  {t.confirm_action}
               </button>
            </motion.div>
         ))}

         {workflows.length === 0 && (
            <div className="col-span-full py-24 flex flex-col items-center justify-center bg-proton-card/30 border-2 border-dashed border-proton-border rounded-[32px] opacity-40">
               <Zap size={48} className="mb-6 text-proton-muted" />
               <p className="text-xs font-black uppercase tracking-[0.3em] text-proton-text">{t.no_workflows}</p>
               <p className="text-[10px] mt-2 font-medium text-proton-muted uppercase tracking-widest">{t.no_workflows_desc}</p>
            </div>
         )}
      </div>
    </div>
  );
}
