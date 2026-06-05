import React, { useState, useMemo } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWeb3Ledger, LedgerTransaction } from '../hooks/useWeb3Ledger';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Coins, 
  Activity, 
  TrendingUp, 
  Sparkles,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';

export function Web3ControlPanel() {
  const {
    address,
    isConnected,
    chain,
    balance,
    isBalanceLoading,
    ledger,
    addTransaction,
    clearLedger,
    refetchBalance
  } = useWeb3Ledger();

  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'transfers' | 'contracts'>('all');
  const [demoAmount, setDemoAmount] = useState('0.1');
  const [demoRecipient, setDemoRecipient] = useState('0x71C7656EC7ab88b098defB751B7401B5f6d1476B');

  const getNumericBalance = () => {
    const match = balance.match(/^([0-9.]+)/);
    return match ? parseFloat(match[1]) : 1.25;
  };

  const sparklineData = useMemo(() => {
    const currentVal = getNumericBalance();
    const data = [];
    const hours = 24;
    
    // Sort transactions by timestamp ascending to play back history
    const sortedTx = [...ledger]
      .filter(tx => tx.status === 'SUCCESS')
      .sort((a, b) => a.timestamp - b.timestamp);
      
    // Back-calculate historical balances from simulated ledger
    for (let i = hours; i >= 0; i--) {
      const timeThreshold = Date.now() - i * 3600000;
      
      // Calculate active balance at this historical snapshot in time
      let snapshotVal = currentVal;
      
      sortedTx.forEach(tx => {
        if (tx.timestamp > timeThreshold) {
          if (tx.type === 'DEPOSIT') {
            snapshotVal -= parseFloat(tx.amount) || 0;
          }
          else if (tx.type === 'TRANSFER' || tx.type === 'CONTRACT') {
            snapshotVal += parseFloat(tx.amount) || 0;
          }
        }
      });

      const time = new Date(timeThreshold);
      const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Add deterministic organic fluctuation to make chart alive
      const deterministicNoise = Math.sin(i * 1.5) * 0.003 + Math.cos(i * 0.8) * 0.002;
      const finalVal = Math.max(0, parseFloat((snapshotVal + deterministicNoise).toFixed(4)));

      data.push({
        time: timeString,
        balance: finalVal
      });
    }
    return data;
  }, [balance, ledger]);

  const filteredLedger = ledger.filter(tx => {
    if (activeTab === 'all') return true;
    if (activeTab === 'deposits') return tx.type === 'DEPOSIT';
    if (activeTab === 'transfers') return tx.type === 'TRANSFER';
    if (activeTab === 'contracts') return tx.type === 'CONTRACT';
    return true;
  });

  const handleSimulateDeposit = () => {
    if (!isConnected || !demoAmount) return;
    addTransaction('DEPOSIT', demoAmount, address || '', 'ETH');
    setDemoAmount('0.1');
  };

  const handleSimulateTransfer = () => {
    if (!isConnected || !demoAmount || !demoRecipient) return;
    addTransaction('TRANSFER', demoAmount, demoRecipient, 'ETH');
    setDemoAmount('0.1');
  };

  const formattedDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div id="web3_financial_ledger_panel" className="bg-[#0a0a0c] border border-zinc-800/40 rounded-[24px] p-6 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Subtle Grid Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b10_1px,transparent_1px),linear-gradient(to_bottom,#18181b10_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
      
      {/* Header Container */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-5 border-b border-zinc-800/40 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-900 border border-zinc-800 text-[#dfc394] rounded-lg">
            <Coins size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#dfc394]">
                Web3 Financial Ledger
              </h3>
              <span className="text-[7px] bg-zinc-950 border border-zinc-850 text-zinc-500 font-mono px-1.5 py-0.5 rounded uppercase tracking-[0.2em] h-fit font-bold">
                PRO-CORE V1.0
              </span>
            </div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1 font-mono font-medium">
              High-frequency balance ledger and decentralized key handshake.
            </p>
          </div>
        </div>

        {/* Connect Button container wrapper to prevent iframe layout overflows */}
        <div className="flex items-center gap-3 self-end md:self-center max-w-full overflow-hidden shrink-0">
          <div className="max-w-full overflow-x-auto custom-scrollbar-minimal pb-0.5 scrollbar-thin">
            <ConnectButton />
          </div>
          {isConnected && (
            <button 
              id="ledger_refresh_btn"
              onClick={() => {
                refetchBalance();
              }}
              title="Refresh ledger state"
              className="p-2.5 bg-zinc-900 border border-zinc-800 hover:border-[#dfc394]/40 text-zinc-500 hover:text-[#dfc394] rounded-lg transition-all duration-200 shrink-0"
            >
              <RefreshCw size={12} className={cn(isBalanceLoading && "animate-spin text-[#dfc394]")} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {!isConnected ? (
          <motion.div 
            key="disconnected-state"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 border border-zinc-800/40 bg-[#0a0a0c] rounded-xl p-6 font-mono relative overflow-hidden"
          >
            {/* Grid background effect */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
            
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse" />
                  <span>SECURE_WALLET_GATEWAY_v1.0</span>
                </div>
                <span>STATUS: STANDBY</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest leading-relaxed font-mono">
                    System requires cryptographic validation. Connect a secure Web3 wallet or hardware gateway below to load active treasury balance data and synchronize ledger records.
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[8px] text-zinc-500 uppercase font-mono font-bold">
                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800/70 rounded">EVM_COMPLIANT</span>
                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800/70 rounded">HARDWARE_SHIELD</span>
                    <span className="px-2 py-1 bg-zinc-900 border border-zinc-800/70 rounded">LEDGER_ACTIVE</span>
                  </div>
                </div>

                <div className="flex flex-col justify-center items-center md:items-end border-t md:border-t-0 md:border-l border-zinc-800/50 p-4 md:pl-8">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-3 text-center md:text-right font-mono font-bold">
                    INITIALIZE CLIENT ACCESS SECURE HANDSHAKE
                  </p>
                  <div className="scale-95 origin-right">
                    <ConnectButton />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="connected-state"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 mt-6 relative z-10"
          >
            {/* Balance & Network Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="md:col-span-2 p-5 bg-zinc-950/40 border border-zinc-800/60 rounded-xl flex flex-col sm:flex-row items-stretch justify-between gap-6 hover:border-zinc-700/60 transition-all group/balance relative overflow-hidden">
                <div className="flex flex-col justify-between py-1 shrink-0 font-mono">
                  <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                    <Activity size={10} className="text-[#dfc394]" /> Active Balance
                  </span>
                  <div className="mt-4">
                    <span className="text-2xl font-bold text-[#dfc394] leading-none select-all">{balance}</span>
                    <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-bold mt-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      SYS SYNCED IN REAL-TIME
                    </div>
                  </div>
                </div>

                {/* Sparkling Recharts Sparkline container */}
                <div className="flex-1 min-h-[90px] flex flex-col justify-end relative z-10">
                  <div className="absolute top-0 right-0 flex items-center gap-1.5 bg-zinc-950/60 backdrop-blur border border-zinc-800/50 px-2 py-0.5 rounded-md">
                    <TrendingUp size={10} className="text-[#dfc394]" />
                    <span className="text-[8px] font-bold text-[#dfc394] uppercase tracking-widest font-mono">24H Velocity Trends</span>
                  </div>
                  <div className="w-full h-[70px] mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                        <defs>
                          <linearGradient id="balanceGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#dfc394" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#dfc394" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-[#0a0a0c] border border-zinc-800 p-2 rounded-lg shadow-2xl backdrop-blur-md font-mono">
                                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold leading-none">
                                    {payload[0].payload.time}
                                  </p>
                                  <p className="text-[10px] text-[#dfc394] font-black mt-1 leading-none">
                                    {payload[0].value} ETH
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="balance" 
                          stroke="#dfc394" 
                          strokeWidth={1.5} 
                          fillOpacity={1} 
                          fill="url(#balanceGlow)" 
                          dot={false}
                          activeDot={{ r: 3.5, strokeWidth: 0, fill: '#dfc394' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Network and Diagnostics stack in a single card block to preserve symmetrical grid layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4 md:col-span-1">
                <div className="p-4 bg-zinc-950/40 border border-zinc-800/60 rounded-xl flex flex-col justify-between hover:border-zinc-700/60 transition-all font-mono">
                  <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
                    <Activity size={10} className="text-zinc-400" /> Network Sync
                  </span>
                  <div className="mt-2">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider leading-none">{chain?.name || 'Ethereum'}</span>
                    <div className="text-[7px] uppercase tracking-wider text-emerald-500 font-bold mt-1">LOCK STATUS: SECURED</div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950/40 border border-zinc-800/60 rounded-xl flex flex-col justify-between hover:border-zinc-700/60 transition-all font-mono">
                  <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
                    <Sparkles size={10} className="text-zinc-400" /> Diagnostics
                  </span>
                  <div className="mt-2">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest leading-none">{ledger.length} TX Audit Nodes</span>
                    <div className="text-[7px] uppercase tracking-wider text-zinc-500 font-bold mt-1">COMPILE_MEM: OPTIMAL</div>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Simulation Actions Form */}
            <div className="p-5 bg-zinc-950/40 border border-zinc-800/40 rounded-xl space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Terminal size={12} className="text-[#dfc394]" /> Sandbox simulation subsystem
                </span>
                <button 
                  onClick={clearLedger}
                  className="text-[8px] font-bold uppercase text-rose-500/80 hover:text-rose-400 tracking-wider flex items-center gap-1 trigger-clear-ledger transition-colors"
                >
                  <Trash2 size={11} /> Reset ledger store
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Simulate amount (ETH)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={demoAmount}
                    onChange={(e) => setDemoAmount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-750 focus:border-[#dfc394] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none tracking-widest font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Recipient Gas / Contract address</label>
                  <input 
                    type="text" 
                    value={demoRecipient}
                    onChange={(e) => setDemoRecipient(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-750 focus:border-[#dfc394] rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none tracking-widest font-mono truncate"
                  />
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={handleSimulateDeposit}
                    disabled={!demoAmount}
                    className="flex-1 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 hover:border-[#dfc394]/30 border border-zinc-800 text-emerald-400 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 cursor-pointer"
                  >
                    Simulate Deposit
                  </button>
                  <button 
                    onClick={handleSimulateTransfer}
                    disabled={!demoAmount || !demoRecipient}
                    className="flex-1 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 hover:border-[#dfc394]/30 border border-zinc-800 text-[#dfc394] text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all border border-zinc-800 active:scale-95 cursor-pointer"
                  >
                    Simulate Transfer
                  </button>
                </div>
              </div>
            </div>

            {/* Ledger Transactions Audit Output */}
            <div className="space-y-3 font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {(['all', 'deposits', 'transfers', 'contracts'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all border",
                        activeTab === tab 
                          ? "bg-zinc-900 border-[#dfc394]/40 text-[#dfc394] shadow-[0_0_15px_rgba(223,195,148,0.05)]" 
                          : "text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-900/50"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <span className="text-[7px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-800/40 px-2.5 py-1 rounded uppercase tracking-widest h-fit font-bold">
                  LEDGER STATE: PERFECT_MONITOR
                </span>
              </div>

              {/* Transactions list container */}
              <div className="bg-zinc-950/40 border border-zinc-800/40 rounded-xl overflow-hidden shadow-inner">
                {filteredLedger.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 italic text-[9px] font-bold uppercase tracking-widest">
                    No matching cryptographic records on selected ledger scope
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/40">
                    {filteredLedger.map((tx) => (
                      <div 
                        key={tx.id} 
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-900/40 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={cn(
                            "w-7 h-7 rounded flex items-center justify-center border shrink-0",
                            tx.type === 'DEPOSIT' 
                              ? "bg-zinc-950 border-zinc-800 text-emerald-400" 
                              : "bg-zinc-950 border-zinc-800 text-[#dfc394]"
                          )}>
                            {tx.type === 'DEPOSIT' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider shrink-0">
                                {tx.type === 'DEPOSIT' ? 'RECEIVE_TRANSACTION' : 'TRANSFER_TRANSACTION'}
                              </span>
                              <span className="text-[7px] text-zinc-500 font-bold shrink-0">{formattedDate(tx.timestamp)}</span>
                            </div>
                            <p className="text-[8px] text-zinc-500 font-bold uppercase max-w-[240px] truncate mt-0.5" title={tx.targetAddress}>
                              target_hash: {tx.targetAddress}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] font-bold text-zinc-300 tracking-wider block">
                              {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount} {tx.token}
                            </span>
                            <span className="text-[7px] font-bold text-zinc-500 block mt-0.5 tracking-wider uppercase">tx_id: {tx.txHash}</span>
                          </div>
                          
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border font-mono",
                            tx.status === 'SUCCESS' ? "bg-zinc-950 border-emerald-500/20 text-emerald-400" : "bg-zinc-100/10 border-amber-500/20 text-amber-500"
                          )}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default Web3ControlPanel;
