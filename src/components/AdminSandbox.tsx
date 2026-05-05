import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Terminal as TerminalIcon, 
  Settings as SettingsIcon, 
  Activity, 
  Zap, 
  ShieldAlert, 
  Database,
  RefreshCw,
  Cpu,
  Lock,
  Code,
  Layout
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AdminSandboxProps {
  isSystemActive: boolean;
  isCreativeMode: boolean;
  stats: {
    ai_tokens: number;
    compute_cycles: number;
  };
  language: 'en' | 'ka';
}

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

export const AdminSandbox = ({ isSystemActive, isCreativeMode, stats, language }: AdminSandboxProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initial logs
    const initialLogs: LogEntry[] = [
      { id: '1', timestamp: new Date().toLocaleTimeString(), action: 'Admin Sandbox Initialized', type: 'info' },
      { id: '2', timestamp: new Date().toLocaleTimeString(), action: `System Status: ${isSystemActive ? 'ACTIVE' : 'INACTIVE'}`, type: isSystemActive ? 'success' : 'warning' },
      { id: '3', timestamp: new Date().toLocaleTimeString(), action: `Creative Mode: ${isCreativeMode ? 'ON' : 'OFF'}`, type: 'info' },
    ];
    setLogs(initialLogs);
  }, [isSystemActive, isCreativeMode]);

  const addLog = (action: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      action,
      type
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const refreshDiagnostics = () => {
    setIsRefreshing(true);
    addLog('Manual diagnostic refresh triggered', 'info');
    setTimeout(() => {
      setIsRefreshing(false);
      addLog('System integrity check complete: 100%', 'success');
    }, 1500);
  };

  return (
    <div className="p-6 md:p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-proton-accent/10 border border-proton-accent/20 flex items-center justify-center text-proton-accent">
              <Lock size={20} />
            </div>
            <h1 className="text-4xl font-black text-proton-text uppercase tracking-tighter italic">
              Admin <span className="text-proton-accent">Sandbox</span>
            </h1>
          </div>
          <p className="text-proton-muted font-medium text-sm tracking-wide">
            {language === 'ka' ? 'კონფიდენციალური დიაგნოსტიკური სამუშაო სივრცე.' : 'Confidential diagnostic and experimental workspace.'}
          </p>
        </div>

        <button 
          onClick={refreshDiagnostics}
          disabled={isRefreshing}
          className="flex items-center gap-3 px-6 py-3 bg-proton-card border border-proton-border rounded-2xl text-proton-text font-black uppercase tracking-widest text-[11px] hover:border-proton-accent/50 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
          {language === 'ka' ? 'განახლება' : 'Refresh System'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Activity} 
          label="System Status" 
          value={isSystemActive ? "ACTIVE" : "INACTIVE"} 
          color={isSystemActive ? "text-green-500" : "text-amber-500"}
          subValue="Real-time heartbeat"
        />
        <StatCard 
          icon={Zap} 
          label="Creative Mode" 
          value={isCreativeMode ? "ENABLED" : "DISABLED"} 
          color={isCreativeMode ? "text-amber-500" : "text-proton-muted"}
          subValue="UI State Flag"
        />
        <StatCard 
          icon={Cpu} 
          label="AI Tokens" 
          value={stats.ai_tokens.toLocaleString()} 
          color="text-proton-accent"
          subValue="Current session quota"
        />
        <StatCard 
          icon={SettingsIcon} 
          label="Compute Cycles" 
          value={stats.compute_cycles.toLocaleString()} 
          color="text-proton-secondary"
          subValue="System resources consumed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-proton-card border border-proton-border rounded-[32px] overflow-hidden flex flex-col h-[500px]">
            <div className="p-6 border-b border-proton-border bg-proton-bg/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TerminalIcon size={18} className="text-proton-accent" />
                <h3 className="font-black uppercase tracking-widest text-xs">System Logs</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-mono text-green-500 uppercase">Live Output</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-3 custom-scrollbar bg-black/20">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-4 group">
                  <span className="text-proton-muted shrink-0">[{log.timestamp}]</span>
                  <span className={cn(
                    "flex-1",
                    log.type === 'error' && "text-red-500 font-bold",
                    log.type === 'warning' && "text-amber-500",
                    log.type === 'success' && "text-green-500",
                    log.type === 'info' && "text-proton-accent"
                  )}>
                    {log.action}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-proton-card/50 backdrop-blur-md border border-proton-border rounded-[32px] p-8 space-y-6">
            <div className="flex items-center gap-3">
              <ShieldAlert size={20} className="text-amber-500" />
              <h3 className="font-black uppercase tracking-widest text-xs">Diagnostic Panel</h3>
            </div>
            
            <div className="space-y-4">
              <ActionButton 
                icon={Database} 
                label="Clear Cache" 
                onClick={() => addLog('Application cache cleared', 'warning')} 
              />
              <ActionButton 
                icon={RefreshCw} 
                label="Re-Sync Firestore" 
                onClick={() => addLog('Relational data sync triggered', 'info')} 
              />
              <ActionButton 
                icon={Code} 
                label="Export Debug Data" 
                onClick={() => addLog('System state exported to JSON', 'success')} 
              />
              <ActionButton 
                icon={Layout} 
                label="Toggle Dev Overlays" 
                onClick={() => addLog('Layout debugging toggled', 'info')} 
              />
            </div>
          </div>

          <div className="p-8 rounded-[32px] bg-proton-accent/5 border border-proton-accent/10 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-proton-accent/10 flex items-center justify-center text-proton-accent">
              <Lock size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest">Admin Access Restricted</p>
              <p className="text-[10px] text-proton-muted font-medium italic">UID: PROTON-ROOT-001</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, subValue }: any) => (
  <div className="bg-proton-card border border-proton-border p-6 rounded-3xl hover:border-proton-accent/30 transition-all group">
    <div className="flex items-center gap-3 mb-4">
      <div className={cn("p-2 rounded-xl bg-proton-bg border border-proton-border group-hover:border-proton-accent/20 transition-all", color.replace('text-', 'bg-').replace('500', '500/10'))}>
        <Icon size={18} className={cn("", color)} />
      </div>
      <p className="text-[10px] font-black text-proton-muted uppercase tracking-widest">{label}</p>
    </div>
    <p className={cn("text-2xl font-black italic tracking-tighter mb-1", color)}>{value}</p>
    <p className="text-[9px] font-mono text-proton-muted uppercase tracking-widest">{subValue}</p>
  </div>
);

const ActionButton = ({ icon: Icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-proton-bg/40 border border-proton-border hover:border-proton-accent/50 hover:bg-proton-card transition-all group"
  >
    <Icon size={16} className="text-proton-muted group-hover:text-proton-accent transition-colors" />
    <span className="text-[10px] font-black uppercase tracking-widest text-left">{label}</span>
  </button>
);
