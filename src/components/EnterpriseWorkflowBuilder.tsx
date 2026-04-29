import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  Globe, 
  Code, 
  Plus, 
  Trash2, 
  ArrowDown, 
  Layers,
  Sparkles,
  Zap,
  Bot,
  MessageSquare,
  Mail,
  MoreVertical,
  ChevronRight,
  GitBranch,
  Hourglass,
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { translations } from '../translations';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'logic';
  subtype: string;
  label: string;
  config?: any;
}

const NODE_TYPES = [
  { id: 'lead', type: 'trigger', subtype: 'lead', icon: Bot, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
  { id: 'time', type: 'trigger', subtype: 'time', icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  { id: 'crm', type: 'action', subtype: 'crm', icon: Database, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  { id: 'slack', type: 'action', subtype: 'slack', icon: MessageSquare, color: 'text-pink-500', bgColor: 'bg-pink-50' },
  { id: 'email', type: 'action', subtype: 'email', icon: Mail, color: 'text-cyan-500', bgColor: 'bg-cyan-50' },
  { id: 'wait', type: 'logic', subtype: 'wait', icon: Hourglass, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  { id: 'condition', type: 'logic', subtype: 'condition', icon: GitBranch, color: 'text-purple-500', bgColor: 'bg-purple-50' },
  { id: 'scraper', type: 'action', subtype: 'scraper', icon: Globe, color: 'text-green-500', bgColor: 'bg-green-50' },
];

export const EnterpriseWorkflowBuilder = ({ 
  workflow, 
  onSave,
  language
}: { 
  workflow: any, 
  onSave: (wf: any) => void,
  language: 'en' | 'ka'
}) => {
  const t = translations[language].workflows.builder;
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow.nodes || []);
  const [workflowName, setWorkflowName] = useState(workflow.name || '');

  const nodeLibraryLabels: Record<string, string> = {
    lead: t.trigger_lead,
    time: t.trigger_time,
    crm: t.action_crm,
    slack: t.action_slack,
    email: t.action_email,
    wait: t.logic_wait,
    condition: t.logic_condition,
    scraper: t.action_scraper
  };

  const addNode = (nodeType: typeof NODE_TYPES[0]) => {
    const newNode: WorkflowNode = {
      id: Math.random().toString(36).substr(2, 9),
      type: nodeType.type as any,
      subtype: nodeType.subtype,
      label: nodeLibraryLabels[nodeType.subtype].split(': ')[1],
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    onSave({ ...workflow, name: workflowName, nodes: newNodes });
  };

  const removeNode = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    setNodes(newNodes);
    onSave({ ...workflow, name: workflowName, nodes: newNodes });
  };

  const loadScalableTemplate = () => {
    const templateNodes: WorkflowNode[] = [
      { id: 'n1', type: 'trigger', subtype: 'lead', label: nodeLibraryLabels.lead.split(': ')[1] },
      { id: 'n2', type: 'action', subtype: 'crm', label: nodeLibraryLabels.crm.split(': ')[1] },
      { id: 'n3', type: 'action', subtype: 'slack', label: nodeLibraryLabels.slack.split(': ')[1] },
      { id: 'n4', type: 'logic', subtype: 'condition', label: nodeLibraryLabels.condition.split(': ')[1] },
      { id: 'n5', type: 'action', subtype: 'email', label: nodeLibraryLabels.email.split(': ')[1] },
      { id: 'n6', type: 'logic', subtype: 'wait', label: nodeLibraryLabels.wait.split(': ')[1] },
      { id: 'n7', type: 'action', subtype: 'email', label: nodeLibraryLabels.email.split(': ')[1] },
    ];
    setNodes(templateNodes);
    setWorkflowName('[Inbound] - General Website Lead Nurture');
    onSave({ 
      ...workflow, 
      name: '[Inbound] - General Website Lead Nurture', 
      nodes: templateNodes 
    });
  };

  useEffect(() => {
    onSave({ ...workflow, name: workflowName, nodes });
  }, [workflowName]);

  return (
    <div className="flex h-full w-full bg-[#F8FAFC] rounded-3xl overflow-hidden border border-[#E2E8F0] shadow-2xl relative">
      {/* Sidebar: Node Library */}
      <div className="w-72 bg-white border-r border-[#E2E8F0] flex flex-col p-6 space-y-8 z-20 shadow-sm relative">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#64748B] mb-4">
            <Layers size={16} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">{t.node_library}</h3>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {NODE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => addNode(type)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#F1F5F9] bg-white hover:border-proton-accent hover:shadow-sm transition-all group text-left"
              >
                <div className={cn("p-2 rounded-lg transition-colors shrink-0", type.bgColor, type.color)}>
                  <type.icon size={16} />
                </div>
                <div className="min-w-0">
                   <p className="text-[11px] font-bold text-[#1E293B] group-hover:text-proton-accent transition-colors truncate">{nodeLibraryLabels[type.subtype].split(': ')[1]}</p>
                   <p className="text-[8px] text-[#94A3B8] font-black uppercase tracking-widest">{type.type}</p>
                </div>
                <Plus size={12} className="ml-auto text-[#CBD5E1] group-hover:text-proton-accent shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-4">
            <button 
                onClick={loadScalableTemplate}
                className="w-full py-3 bg-proton-accent/5 border border-proton-accent/20 text-proton-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-proton-accent hover:text-white transition-all flex items-center justify-center gap-2"
            >
                <Zap size={12} />
                Load Scalable Logic
            </button>
            
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-[#1E293B]">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Enterprise Ready</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Standardized naming and multi-step logic implemented for high-throughput scaling.</p>
            </div>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex flex-1 flex-col relative overflow-hidden">
        {/* Header: Global Settings */}
        <div className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-8 flex-shrink-0 z-20">
            <div className="flex-1 max-w-md flex items-center gap-4">
                <div className="shrink-0 bg-slate-100 p-2 rounded-lg">
                    <AlertCircle size={14} className="text-slate-400" />
                </div>
                <div className="flex-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.workflow_name}</p>
                    <input 
                        type="text" 
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        placeholder={t.placeholder_name}
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-[#1E293B] focus:ring-0 placeholder:text-slate-300"
                    />
                </div>
            </div>
            <button 
              onClick={() => {
                alert(language === 'ka' ? 'ვორქფლოუ წარმატებით შეინახა და გაიშვა!' : 'Workflow successfully saved and deployed!');
                onSave({ ...workflow, name: workflowName, nodes });
              }}
              className="bg-proton-text text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
            >
                {t.save_workflow}
                <ChevronRight size={14} />
            </button>
        </div>

        {/* Workspace Background (Dotted) */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ 
            backgroundImage: `radial-gradient(#1E293B 1px, transparent 1px)`,
            backgroundSize: `24px 24px`
          }} 
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 relative z-10">
          <div className="max-w-2xl mx-auto flex flex-col items-center">
            <AnimatePresence mode="popLayout" initial={false}>
              {nodes.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center py-32 text-center space-y-6"
                >
                  <div className="w-20 h-20 rounded-[32px] bg-white shadow-xl shadow-slate-200/50 flex items-center justify-center text-[#94A3B8]">
                    <Zap size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-[#1E293B]">{t.empty_canvas}</h3>
                    <p className="text-sm text-[#64748B] max-w-xs mx-auto font-medium">
                      {t.empty_desc}
                    </p>
                  </div>
                </motion.div>
              ) : (
                nodes.map((node, index) => {
                  const nodeType = NODE_TYPES.find(t => t.subtype === node.subtype);
                  if (!nodeType) return null;

                  return (
                    <React.Fragment key={node.id}>
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full group"
                      >
                        <div className={cn(
                            "bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-all relative flex flex-col md:flex-row items-center gap-6",
                            node.subtype === 'condition' && "border-dashed border-purple-200 bg-purple-50/10"
                        )}>
                          <div className={cn("p-4 rounded-xl shrink-0", nodeType.bgColor, nodeType.color)}>
                            <nodeType.icon size={24} />
                          </div>
                          
                          <div className="flex-1 text-center md:text-left space-y-1">
                             <div className="flex items-center justify-center md:justify-start gap-2">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest", nodeType.color)}>
                                    {node.type}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-[#E2E8F0]" />
                                <span className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-widest font-mono">NODE_{node.id.toUpperCase().substring(0,4)}</span>
                             </div>
                             <h4 className="text-base font-bold text-[#1E293B]">{node.label}</h4>
                          </div>

                          <div className="flex items-center gap-4">
                             <div className="hidden lg:block px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                {node.subtype === 'condition' ? 'Decision Point' : 'Standard'}
                             </div>
                             <button
                               onClick={() => removeNode(node.id)}
                               className="p-2.5 rounded-xl hover:bg-red-50 text-[#CBD5E1] hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                             >
                               <Trash2 size={18} />
                             </button>
                          </div>

                          {node.subtype === 'condition' && (
                             <div className="absolute -right-3 top-1/2 -translate-y-1/2 flex flex-col gap-10">
                                <div className="p-1.5 bg-green-500 rounded-full text-white shadow-lg border-2 border-white">
                                    <ChevronRight size={10} strokeWidth={3} />
                                </div>
                                <div className="p-1.5 bg-red-500 rounded-full text-white shadow-lg border-2 border-white">
                                    <ChevronRight size={10} strokeWidth={3} />
                                </div>
                             </div>
                          )}
                        </div>
                      </motion.div>

                      {index < nodes.length - 1 && (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="py-4 flex flex-col items-center"
                        >
                          <div className="w-px h-8 bg-gradient-to-b from-[#E2E8F0] to-transparent relative">
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[#CBD5E1]">
                               <ArrowDown size={14} strokeWidth={3} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
