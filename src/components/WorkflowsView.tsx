import React, { useState, useEffect, Suspense, lazy } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Workflow, WorkflowStep, Persona, Theme } from '../types';
import { translations } from '../translations';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Lock, Zap, Edit2, Trash2, Clock, ChevronDown, X, Loader2, Sparkles, Activity
} from 'lucide-react';
import { handleFirestoreError } from '../lib/firebaseUtils';
import { analyzeWorkflow } from '../lib/gemini';

function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | { [key: string]: any }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const hasRetried = window.sessionStorage.getItem('chunk-retry-flag');
    try {
      const module = await componentImport();
      window.sessionStorage.removeItem('chunk-retry-flag');
      if (module && typeof module === 'object' && 'default' in module) {
        return module as { default: T };
      }
      return { default: module } as { default: T };
    } catch (error) {
       console.error("Chunk load failed, retrying page reload...", error);
       if (!hasRetried) {
         window.sessionStorage.setItem('chunk-retry-flag', 'true');
         window.location.reload();
         return new Promise<never>(() => {});
       }
       throw error;
    }
  });
}

const EnterpriseWorkflowBuilder = lazyWithRetry(() => import('./EnterpriseWorkflowBuilder').then(module => ({ default: module.EnterpriseWorkflowBuilder })));

const sanitizeForFirestore = (data: any): any => {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data.map(v => sanitizeForFirestore(v));
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const newObj: any = {};
    for (const key in data) {
      const val = data[key];
      if (val !== undefined) {
        newObj[key] = sanitizeForFirestore(val);
      }
    }
    return newObj;
  }
  return data;
};

const WorkflowEditor = ({
  workflow,
  onSave,
  onClose,
  personas,
  uiMode,
  language,
  isAdmin,
  checkAndIncrementAiQuota
}: {
  workflow: Workflow,
  onSave: (workflow: Workflow) => void,
  onClose: () => void,
  personas: Persona[],
  uiMode: 'business' | 'creative',
  language: 'en' | 'ka',
  isAdmin: boolean,
  checkAndIncrementAiQuota: () => Promise<boolean>
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
                type="button"
                onClick={() => setEditorMode('form')} 
                className={cn(
                    "px-6 py-2.5 text-xs font-bold rounded-xl transition-all duration-300",
                    editorMode === 'form' ? 'bg-proton-accent text-proton-bg shadow-lg shadow-proton-accent/20' : 'text-proton-muted hover:text-proton-text'
                )}
             >
                {translations[language].sidebar.settings}
             </button>
             <button 
                type="button"
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
                  type="button"
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
                      type="button"
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
              type="button"
              onClick={async () => {
                const permitted = await checkAndIncrementAiQuota();
                if (!permitted) return;
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
            <Suspense fallback={
              <div className="h-full w-full flex flex-col items-center justify-center text-proton-muted/50 font-mono text-xs gap-3">
                <Loader2 className="animate-spin text-proton-accent" size={24} />
                <span className="uppercase tracking-widest">Loading Builder...</span>
              </div>
            }>
              <EnterpriseWorkflowBuilder workflow={formData} onSave={setFormData} language={language} />
            </Suspense>
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-proton-border font-bold text-sm hover:bg-proton-card transition-all">Cancel</button>
          <button type="button" onClick={() => onSave(formData)} className="flex-1 py-3 rounded-xl bg-proton-accent text-proton-bg font-bold text-sm hover:scale-105 active:scale-95 transition-all">Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function WorkflowsView({
  workflows,
  setWorkflows,
  personas,
  user,
  uiMode,
  language,
  isCreativeMode = true,
  isAdmin,
  checkAndIncrementAiQuota
}: {
  workflows: Workflow[],
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>,
  personas: Persona[],
  user: any,
  uiMode: 'business' | 'creative',
  language: 'en' | 'ka',
  isCreativeMode?: boolean,
  isAdmin: boolean,
  checkAndIncrementAiQuota: () => Promise<boolean>
}) {
  const t = translations[language].workflows;
  const common = translations[language].common;
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: () => void; message: string } | null>(null);

  const handleSave = async (updatedWorkflow: Workflow) => {
    setWorkflows(workflows.map(wf => wf.id === updatedWorkflow.id ? updatedWorkflow : wf));
    setEditingWorkflow(null);
    if (user && db) {
      const docRef = doc(db, 'users', user.uid, 'workflows', updatedWorkflow.id);
      await setDoc(docRef, sanitizeForFirestore(updatedWorkflow)).catch(e => handleFirestoreError(e, 'update', docRef.path));
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
      await setDoc(docRef, sanitizeForFirestore(newWorkflow)).catch(e => handleFirestoreError(e, 'create', docRef.path));
    }
  };

  const handleAnalyze = async (wf: Workflow) => {
    const permitted = await checkAndIncrementAiQuota();
    if (!permitted) return;

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
          type="button"
          onClick={() => {
            if (!isCreativeMode) return;
            setConfirmation({
              message: t.create_confirm,
              action: createWorkflow
            });
          }}
          disabled={!isCreativeMode}
          className="px-5 py-3 rounded-2xl bg-proton-accent text-proton-bg font-bold text-sm flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-proton-accent/20 disabled:opacity-50"
        >
          {isCreativeMode ? <Plus size={20} /> : <Lock size={16} />}
          {isCreativeMode ? t.add_workflow : t.locked}
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
                    <button type="button" onClick={() => setConfirmation(null)} className="flex-1 py-3 rounded-xl border border-proton-border text-xs font-bold hover:bg-proton-card transition-all">{common.cancel}</button>
                    <button type="button" onClick={() => { confirmation.action(); setConfirmation(null); }} className="flex-1 py-3 rounded-xl bg-proton-accent text-proton-bg text-xs font-bold hover:scale-105 transition-all shadow-lg shadow-proton-accent/20">{language === 'ka' ? 'დადასტურება' : 'Confirm'}</button>
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
            type="button"
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
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCreativeMode) return;
                        setConfirmation({
                          message: "გსურთ ვორქფლოუს ეფექტურობის ანალიზი Gemini-ს მიერ?",
                          action: () => handleAnalyze(wf)
                        });
                      }}
                      disabled={!isCreativeMode}
                      className="p-2.5 rounded-xl bg-proton-card/50 text-proton-muted hover:text-proton-accent hover:bg-proton-accent/10 transition-all border border-proton-border group-hover:shadow-[0_0_15px_rgba(0,242,255,0.1)] disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isCreativeMode ? "Analyze efficiency" : "System in Stasis"}
                    >
                      {isCreativeMode ? <Activity size={18} /> : <Lock size={14} />}
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
            isAdmin={isAdmin}
            checkAndIncrementAiQuota={checkAndIncrementAiQuota}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
