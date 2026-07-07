import React, { useState, useMemo } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWeb3Ledger, LedgerTransaction } from '../hooks/useWeb3Ledger';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Trash2, 
  Coins, 
  Activity, 
  TrendingUp, 
  Sparkles,
  Terminal,
  Lock,
  Globe,
  Database,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';

// Multi-language translation dictionary for professional user engagement
const translations = {
  ka: {
    title: "Web3 ფინანსების დაფა",
    subtitle: "დეცენტრალიზებული აქტივების მართვა და ტრანზაქციების რეალური მონიტორინგი.",
    gatewayTitle: "უსაფრთხო კავშირი",
    gatewaySubtitle: "PORTAL_GATEWAY_v1.0",
    statusStandalone: "სტატუსი: მოლოდინი",
    requiresValidation: "დასაწყებად დაუკავშირეთ თქვენი Web3 საფულე, რათა ჩატვირთოთ აქტიური ბალანსის მონაცემები და მოახდინოთ ტრანზაქციების ისტორიის სინქრონიზაცია.",
    initHandshake: "საფულის დაკავშირება",
    evmBadge: "EVM თავსებადი",
    shieldBadge: "დაცული კავშირი",
    activeLedgerBadge: "აქტიური რეესტრი",
    
    features: {
      f1_title: "EVM ინტეგრაცია",
      f1_desc: "EVM-თავსებად ქსელებთან კავშირი და ტრანზაქციების რეალურ დროში დაცული მონიტორინგი.",
      f2_title: "საფულეების მხარდაჭერა",
      f2_desc: "უსაფრთხო და მყისიერი კავშირი Metamask, Coinbase და სხვა პოპულარულ საფულეებთან.",
      f3_title: "ფინანსური ანალიტიკა",
      f3_desc: "ბალანსის ცვლილების დინამიკის, ტრენდებისა და ტრანზაქციების ავტომატური 24-საათიანი მონიტორინგი."
    },

    connected: {
      activeBalance: "აქტიური ბალანსი",
      syncedRealtime: "სინქრონიზებულია რეალურ დროში",
      velocityTrends: "24-საათიანი ბალანსის დინამიკა",
      networkSync: "ქსელის სტატუსი",
      lockSecured: "კავშირი: დაცული",
      diagnostics: "ინფორმაცია",
      auditNodes: "ტრანზაქცია რეესტრში",
      compileMem: "სტატუსი: აქტიური",
      sandboxTitle: "ტრანზაქციების სიმულატორი",
      resetLedger: "რეესტრის გასუფთავება",
      demoAmount: "სიმულაციური რაოდენობა (ETH)",
      recipientAddr: "მიმღების მისამართი",
      simulateDeposit: "შემოსულის სიმულაცია",
      simulateTransfer: "გადარიცხვის სიმულაცია",
      ledgerState: "სტატუსი: აქტიური მონიტორინგი",
      noRecords: "ტრანზაქციების ისტორია ცარიელია",
      receiveTx: "შემოსული ტრანზაქცია",
      transferTx: "გადარიცხვის ტრანზაქცია"
    }
  },
  en: {
    title: "Web3 Finance Manager",
    subtitle: "Decentralized assets management and real-time transaction monitoring.",
    gatewayTitle: "Secure Gateway",
    gatewaySubtitle: "PORTAL_GATEWAY_v1.0",
    statusStandalone: "STATUS: STANDBY",
    requiresValidation: "Connect your Web3 wallet below to load your active balance and synchronize your transaction history.",
    initHandshake: "Connect Wallet",
    evmBadge: "EVM COMPATIBLE",
    shieldBadge: "SECURE CONNECTION",
    activeLedgerBadge: "LEDGER ACTIVE",

    features: {
      f1_title: "EVM Integration",
      f1_desc: "EVM-compatible networks integration and secure real-time transaction tracking.",
      f2_title: "Wallet Support",
      f2_desc: "Instant secure connection with Metamask, Coinbase, WalletConnect, or decentralized hardware.",
      f3_title: "Financial Analytics",
      f3_desc: "Automated analysis of 24-hour balance dynamics and transactional timelines."
    },

    connected: {
      activeBalance: "Active Balance",
      syncedRealtime: "SYNCED IN REAL-TIME",
      velocityTrends: "24H Balance Dynamics",
      networkSync: "Network Sync",
      lockSecured: "CONNECTION: SECURED",
      diagnostics: "Info",
      auditNodes: "TX Records",
      compileMem: "STATUS: ACTIVE",
      sandboxTitle: "Transaction Simulator",
      resetLedger: "Reset ledger store",
      demoAmount: "Simulate amount (ETH)",
      recipientAddr: "Recipient wallet address",
      simulateDeposit: "Simulate Deposit",
      simulateTransfer: "Simulate Transfer",
      ledgerState: "STATUS: ACTIVE MONITOR",
      noRecords: "No transactions found in this ledger",
      receiveTx: "Received Transaction",
      transferTx: "Transferred Transaction"
    }
  }
};

export function Web3ControlPanel({ language = 'ka' }: { language?: string }) {
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
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const cur = useMemo(() => {
    return translations[language === 'ka' ? 'ka' : 'en'];
  }, [language]);

  const getNumericBalance = () => {
    const match = balance.match(/^([0-9.]+)/);
    return match ? parseFloat(match[1]) : 1.25;
  };

  const sparklineData = useMemo(() => {
    const currentVal = getNumericBalance();
    const data = [];
    const hours = 24;
    
    const sortedTx = [...ledger]
      .filter(tx => tx.status === 'SUCCESS')
      .sort((a, b) => a.timestamp - b.timestamp);
      
    for (let i = hours; i >= 0; i--) {
      const timeThreshold = Date.now() - i * 3600000;
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
    <div id="web3_financial_ledger_panel" className="bg-[#0b0c0f] border border-zinc-900 rounded-[28px] p-8 shadow-2xl relative overflow-hidden transition-all duration-300">
      {/* Dynamic Ambient Background Highlights */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[250px] bg-[#dfc394]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293706_1px,transparent_1px),linear-gradient(to_bottom,#1f293706_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {!isConnected ? (
          /* Disconnected State: Premium Wallet Connection Gateway Interface (No Repeating Header, Grid/Bento Layout) */
          <motion.div
            key="disconnected-gateway"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 flex flex-col items-center"
          >
            {/* Top Security Handshake Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-zinc-950 border border-zinc-900 rounded-full text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-[#dfc394] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#dfc394] animate-pulse" />
              {cur.gatewayTitle} • {cur.gatewaySubtitle}
            </div>

            {/* Main Visual Header Typography */}
            <div className="text-center max-w-2xl mb-10">
              <h2 className="text-3xl font-black text-white tracking-tight uppercase sm:text-4xl mb-3 leading-none bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                {cur.title}
              </h2>
              <p className="text-xs text-zinc-400 font-mono tracking-wide">
                {cur.subtitle}
              </p>
            </div>

            {/* Balanced Desktop Bento Layout (L/R Structure for ultimate legibility) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-5xl items-stretch">
              
              {/* Left Column: Direct Action Handshake Entrance (Primary Focal Point) */}
              <div className="lg:col-span-7 p-8 bg-zinc-950/70 border border-zinc-900 rounded-[24px] text-center font-mono relative overflow-hidden flex flex-col items-center justify-between">
                <div className="absolute inset-0 bg-gradient-to-b from-[#dfc394]/2 to-transparent pointer-events-none" />
                
                <div className="w-full flex flex-col items-center mt-2">
                  <div className="inline-flex items-center gap-2 text-[9px] text-amber-500 bg-amber-500/5 px-3.5 py-1.5 border border-amber-500/10 rounded-full font-bold uppercase tracking-widest mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {cur.statusStandalone}
                  </div>

                  <p className="text-[12px] text-zinc-300 leading-relaxed max-w-md mb-8">
                    {cur.requiresValidation}
                  </p>
                </div>

                {/* Highly prominent custom Connect Wallet container with outer ambient glow */}
                <div className="relative group my-4">
                  <div className="absolute -inset-2 bg-gradient-to-r from-[#dfc394]/25 to-[#dfc394]/0 rounded-xl blur-md opacity-75 group-hover:opacity-100 transition duration-300 pointer-events-none" />
                  <div className="relative z-10 scale-105">
                    <ConnectButton />
                  </div>
                </div>
                
                {/* Security badges list - bottom aligned */}
                <div className="flex flex-wrap gap-2.5 justify-center mt-8 pt-6 border-t border-zinc-900/55 text-[8px] text-zinc-500 uppercase font-mono tracking-widest font-bold w-full">
                  <span className="px-2.5 py-1 bg-zinc-900/40 rounded-md border border-zinc-900/40">{cur.evmBadge}</span>
                  <span className="px-2.5 py-1 bg-zinc-900/40 rounded-md border border-zinc-900/40">{cur.shieldBadge}</span>
                  <span className="px-2.5 py-1 bg-zinc-900/40 rounded-md border border-zinc-900/40">{cur.activeLedgerBadge}</span>
                </div>
              </div>

              {/* Right Column: Key Technical Specification Pillars (Support Info) */}
              <div className="lg:col-span-5 flex flex-col gap-4 justify-between">
                {/* Feature 1 */}
                <div className="p-5.5 bg-zinc-950/45 border border-zinc-900 hover:border-zinc-800 rounded-2xl flex gap-4 group/card transition-all duration-200 h-full flex-col sm:flex-row items-start sm:items-center">
                  <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-[#dfc394] shrink-0 group-hover/card:scale-105 transition-transform">
                    <Lock size={18} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-200 mb-1 font-mono">
                      {cur.features.f1_title}
                    </h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                      {cur.features.f1_desc}
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="p-5.5 bg-zinc-950/45 border border-zinc-900 hover:border-zinc-800 rounded-2xl flex gap-4 group/card transition-all duration-200 h-full flex-col sm:flex-row items-start sm:items-center">
                  <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-[#dfc394] shrink-0 group-hover/card:scale-105 transition-transform">
                    <Globe size={18} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-200 mb-1 font-mono">
                      {cur.features.f2_title}
                    </h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                      {cur.features.f2_desc}
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="p-5.5 bg-zinc-950/45 border border-zinc-900 hover:border-zinc-800 rounded-2xl flex gap-4 group/card transition-all duration-200 h-full flex-col sm:flex-row items-start sm:items-center">
                  <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-[#dfc394] shrink-0 group-hover/card:scale-105 transition-transform">
                    <Database size={18} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-200 mb-1 font-mono">
                      {cur.features.f3_title}
                    </h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                      {cur.features.f3_desc}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        ) : (
          /* Connected State: Advanced Cryptographic Treasury Ledger Dashboard */
          <motion.div
            key="connected-dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="space-y-6 relative z-10"
          >
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-950 border border-zinc-900 text-[#dfc394] rounded-xl shadow-lg">
                  <Coins size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#dfc394] font-mono">
                      {cur.title}
                    </h3>
                    <span className="text-[7px] bg-zinc-950 border border-zinc-900 text-zinc-500 font-mono px-2 py-0.5 rounded uppercase tracking-[0.2em] font-black">
                      v1.0
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 font-mono">
                    {cur.subtitle}
                  </p>
                </div>
              </div>

              {/* Top controls: Network Sync Indicator, refresh controls and disconnect wallet trigger */}
              <div className="flex items-center gap-3.5 self-end md:self-center">
                {address && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border border-zinc-900 rounded-xl text-[10px] font-mono hover:border-zinc-800 transition-all duration-150 group">
                    <span className="text-[#dfc394] font-bold uppercase text-[9px] tracking-wider hidden sm:inline">Address:</span>
                    <span className="text-zinc-300 font-bold">{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
                    <button
                      onClick={handleCopyAddress}
                      className="p-1 text-zinc-500 hover:text-[#dfc394] transition-colors focus:outline-none"
                      title={language === 'ka' ? 'მისამართის კოპირება' : 'Copy Address'}
                    >
                      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    </button>
                  </div>
                )}

                <div className="scale-95">
                  <ConnectButton />
                </div>
                
                <button 
                  id="ledger_refresh_btn"
                  onClick={() => refetchBalance()}
                  title="Refetch system treasury balance"
                  className="p-3 bg-zinc-950 border border-zinc-900 hover:border-[#dfc394]/30 text-zinc-500 hover:text-[#dfc394] rounded-xl transition-all duration-200 relative"
                >
                  <RefreshCw size={12} className={cn(isBalanceLoading && "animate-spin text-[#dfc394]")} />
                </button>
              </div>
            </div>

            {/* Symmetrical Grid: Balance Chart & Network Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1 & 2: Active Balance Graph */}
              <div className="lg:col-span-2 p-6 bg-zinc-950/50 border border-zinc-900 rounded-2xl flex flex-col sm:flex-row items-stretch justify-between gap-6 hover:border-zinc-800/80 transition-all relative overflow-hidden duration-300">
                <div className="flex flex-col justify-between py-1 shrink-0 font-mono">
                  <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                    <Activity size={10} className="text-[#dfc394]" /> {cur.connected.activeBalance}
                  </span>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-[#dfc394] leading-none select-all tracking-tight">
                      {balance}
                    </span>
                    <div className="text-[8px] uppercase tracking-[0.15em] text-emerald-400 font-black mt-3.5 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/10 px-2 py-1 rounded w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {cur.connected.syncedRealtime}
                    </div>
                  </div>
                </div>

                {/* Animated Recharts Sparkline */}
                <div className="flex-1 min-h-[110px] flex flex-col justify-end relative z-10">
                  <div className="absolute top-0 right-0 flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-900 px-2.5 py-1 rounded-lg">
                    <TrendingUp size={10} className="text-[#dfc394]" />
                    <span className="text-[8px] font-bold text-[#dfc394] uppercase tracking-widest font-mono">
                      {cur.connected.velocityTrends}
                    </span>
                  </div>
                  <div className="w-full h-[85px] mt-8">
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
                                <div className="bg-[#0b0c0f] border border-zinc-900 p-2.5 rounded-xl shadow-2xl font-mono text-left">
                                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black leading-none">
                                    {payload[0].payload.time}
                                  </p>
                                  <p className="text-[11px] text-[#dfc394] font-black mt-1 leading-none">
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
                          activeDot={{ r: 4, strokeWidth: 0, fill: '#dfc394' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Column 3: Diagnostic and Network Status stack */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:col-span-1">
                <div className="p-5 bg-zinc-950/50 border border-zinc-900 rounded-2xl flex flex-col justify-between hover:border-zinc-800 transition-all font-mono duration-300">
                  <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
                    <Activity size={10} className="text-zinc-400" /> {cur.connected.networkSync}
                  </span>
                  <div className="mt-2 text-left">
                    <span className="text-xs font-black text-white uppercase tracking-wider block">
                      {chain?.name || 'Ethereum'}
                    </span>
                    <span className="text-[7px] font-black uppercase tracking-wider text-emerald-400 mt-1 block">
                      {cur.connected.lockSecured}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-zinc-950/50 border border-zinc-900 rounded-2xl flex flex-col justify-between hover:border-zinc-800 transition-all font-mono duration-300">
                  <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
                    <Sparkles size={10} className="text-zinc-400" /> {cur.connected.diagnostics}
                  </span>
                  <div className="mt-2 text-left">
                    <span className="text-xs font-black text-white block">
                      {ledger.length} {cur.connected.auditNodes}
                    </span>
                    <span className="text-[7px] font-black text-zinc-500 uppercase tracking-wider mt-1 block">
                      {cur.connected.compileMem}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sandbox simulation tools */}
            <div className="p-6 bg-zinc-950/40 border border-zinc-900 rounded-2xl space-y-4 font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Terminal size={12} className="text-[#dfc394]" /> {cur.connected.sandboxTitle}
                </span>
                <button 
                  onClick={clearLedger}
                  className="text-[8px] font-bold uppercase text-rose-500 hover:text-rose-400 tracking-widest flex items-center gap-1 transition-colors leading-none"
                >
                  <Trash2 size={11} /> {cur.connected.resetLedger}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest text-[#dfc394] mb-2">
                    {cur.connected.demoAmount}
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={demoAmount}
                    onChange={(e) => setDemoAmount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-[#dfc394] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none tracking-widest font-mono text-center sm:text-left"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    {cur.connected.recipientAddr}
                  </label>
                  <input 
                    type="text" 
                    value={demoRecipient}
                    onChange={(e) => setDemoRecipient(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-900 hover:border-zinc-800 focus:border-[#dfc394] rounded-xl px-3 py-2.5 text-xs text-zinc-350 focus:outline-none tracking-widest font-mono truncate"
                  />
                </div>

                <div className="flex gap-2.5">
                  <button 
                    onClick={handleSimulateDeposit}
                    disabled={!demoAmount}
                    className="flex-1 px-4 py-2.5 bg-[#dfc394]/10 hover:bg-[#dfc394]/20 border border-[#dfc394]/20 text-[#dfc394] text-[9px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    {cur.connected.simulateDeposit}
                  </button>
                  <button 
                    onClick={handleSimulateTransfer}
                    disabled={!demoAmount || !demoRecipient}
                    className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    {cur.connected.simulateTransfer}
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="space-y-3.5 font-mono text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {(['all', 'deposits', 'transfers', 'contracts'] as const).map((tab) => (
                    <button
                       key={tab}
                       onClick={() => setActiveTab(tab)}
                       className={cn(
                         "px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all border",
                         activeTab === tab 
                           ? "bg-[#dfc394]/10 border-[#dfc394]/30 text-[#dfc394] shadow-[0_0_15px_rgba(223,195,148,0.03)]" 
                           : "text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-900/50"
                       )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <span className="text-[7px] font-black text-zinc-500 bg-zinc-950 border border-zinc-900 px-3 py-1.5 rounded-lg uppercase tracking-widest h-fit">
                  {cur.connected.ledgerState}
                </span>
              </div>

              {/* Live list block */}
              <div className="bg-zinc-950/65 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
                {filteredLedger.length === 0 ? (
                  <div className="py-14 text-center text-zinc-500 italic text-[9px] font-bold uppercase tracking-widest">
                    {cur.connected.noRecords}
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-900/60">
                    {filteredLedger.map((tx) => (
                      <div 
                        key={tx.id} 
                        className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-950/90 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0",
                            tx.type === 'DEPOSIT' 
                              ? "bg-zinc-950 border-emerald-500/10 text-emerald-400" 
                              : "bg-zinc-950 border-[#dfc394]/10 text-[#dfc394]"
                          )}>
                            {tx.type === 'DEPOSIT' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest shrink-0">
                                {tx.type === 'DEPOSIT' ? cur.connected.receiveTx : cur.connected.transferTx}
                              </span>
                              <span className="text-[7px] text-zinc-500 font-bold shrink-0">
                                {formattedDate(tx.timestamp)}
                              </span>
                            </div>
                            <p className="text-[8px] text-zinc-500 font-bold uppercase max-w-[320px] truncate mt-1" title={tx.targetAddress}>
                              target_hash: {tx.targetAddress}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] font-black text-white tracking-wider block">
                              {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount} {tx.token}
                            </span>
                            <span className="text-[7px] font-bold text-zinc-500 block mt-1 tracking-wider uppercase">
                              tx_id: {tx.txHash}
                            </span>
                          </div>
                          
                          <span className={cn(
                            "px-2.5 py-1 rounded text-[7px] font-black uppercase tracking-widest border font-mono shrink-0",
                            tx.status === 'SUCCESS' 
                              ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-400" 
                              : "bg-amber-500/5 border-amber-500/15 text-amber-400"
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
