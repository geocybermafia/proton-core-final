import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Cpu, 
  Database, 
  Network, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  Briefcase, 
  Coins, 
  Plus, 
  Minus, 
  Sparkles,
  DollarSign
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface TechPortfolioProps {
  language: 'en' | 'ka';
  t: any;
  currentTheme: {
    card: string;
    cardAlt: string;
    accent: string;
    accentBg: string;
    muted: string;
    text: string;
    subtext: string;
    badgeBg: string; // Add base styles matching theme configs
  };
}

interface PortfolioHistoryPoint {
  day: string;
  value: number;
}

interface MarketAsset {
  id: string;
  ticker: string;
  name: string;
  nameGe: string;
  category: 'server' | 'compute' | 'storage' | 'network' | 'accelerator';
  description: string;
  descriptionGe: string;
  price: number;
  prevPrice: number;
  history: number[];
  volatility: number; // 0.1 to 0.5
}

interface UserAssetSelection {
  assetId: string;
  quantity: number;
  avgBuyPrice: number;
}

export function TechPortfolio({ language, t, currentTheme }: TechPortfolioProps) {
  // Simulator Local Storage keys
  const USER_ASSETS_KEY = 'proton_tech_portfolio_assets';
  const CASH_BALANCE_KEY = 'proton_tech_portfolio_cash';
  const HISTORY_KEY = 'proton_tech_portfolio_history';
  const MARKET_ASSETS_KEY = 'proton_tech_portfolio_market_assets';
  const DAY_COUNT_KEY = 'proton_tech_portfolio_day_count';

  // Seed Data for Market Assets
  const defaultMarketAssets: MarketAsset[] = [
    {
      id: 'as-1',
      ticker: 'PRTN-Q',
      name: 'Proton Quantum Core Server v2',
      nameGe: 'პროტონ კვანტური სერვერი v2',
      category: 'server',
      description: 'Decentralized high-performance quantum processing server cluster.',
      descriptionGe: 'დესენტრალიზებული მაღალკავშირიანი კვანტური პროცესორების კლასტერი.',
      price: 14500,
      prevPrice: 13900,
      volatility: 0.15,
      history: [11200, 12000, 11800, 13100, 13900, 14500]
    },
    {
      id: 'as-2',
      ticker: 'COMP-NM',
      name: 'Neuromorphic Synaptic Blade',
      nameGe: 'ნეირომორფული სინაფსური ბლეიდი',
      category: 'compute',
      description: 'Physical neuromorphic hardware simulating brain-like cognitive nodes.',
      descriptionGe: 'ფიზიკური ნეირომორფული პროცესორი ჰუმანოიდური კოგნიტური კვანძებისთვის.',
      price: 3200,
      prevPrice: 3450,
      volatility: 0.28,
      history: [2500, 2750, 3100, 3300, 3450, 3200]
    },
    {
      id: 'as-3',
      ticker: 'STOR-DE',
      name: 'Decentralized Holographic Storage',
      nameGe: 'ჰოლოგრაფიული დეცენტრალიზებული საცავი',
      category: 'storage',
      description: 'Distributed cold storage blocks secured with quantum encryption.',
      descriptionGe: 'განაწილებული ჰოლოგრაფიული საცავები კვანტური კრიპტოდაცვით.',
      price: 850,
      prevPrice: 830,
      volatility: 0.08,
      history: [790, 810, 805, 820, 830, 850]
    },
    {
      id: 'as-4',
      ticker: 'GATE-AI',
      name: 'Secure AI Edge Gateway G1',
      nameGe: 'უსაფრთხო ხელოვნური ინტელექტის როუტერი',
      category: 'network',
      description: 'Intelligent network defender with hardware-level firewall blocks.',
      descriptionGe: 'ჭკვიანი ქსელის როუტერი აპარატურულ დონეზე ჩაშენებული კედლით.',
      price: 1250,
      prevPrice: 1100,
      volatility: 0.12,
      history: [950, 1020, 990, 1050, 1100, 1250]
    },
    {
      id: 'as-5',
      ticker: 'ACC-HVD',
      name: 'Hyperdimensional Vector Processor',
      nameGe: 'VECT-HVD ვექტორული ამაჩქარებელი',
      category: 'accelerator',
      description: 'Silicon accelerator specifically engineered for multi-dimensional vector math.',
      descriptionGe: 'სილიკონის ამაჩქარებელი, შექმნილი ვექტორული გამოთვლებისთვის.',
      price: 6300,
      prevPrice: 5800,
      volatility: 0.22,
      history: [4800, 5100, 5450, 5700, 5800, 6300]
    }
  ];

  // Default User Owned Assets Seed
  const defaultUserAssets: UserAssetSelection[] = [
    { assetId: 'as-1', quantity: 2, avgBuyPrice: 12000 },
    { assetId: 'as-4', quantity: 4, avgBuyPrice: 1000 }
  ];

  // Default value history values
  const defaultHistory: PortfolioHistoryPoint[] = [
    { day: 'Day 1', value: 75000 },
    { day: 'Day 2', value: 78500 },
    { day: 'Day 3', value: 77200 },
    { day: 'Day 4', value: 81400 },
    { day: 'Day 5', value: 83200 },
    { day: 'Day 6', value: 89000 }
  ];

  // Component States
  const [cashBalance, setCashBalance] = useState<number>(100000);
  const [userAssets, setUserAssets] = useState<UserAssetSelection[]>([]);
  const [marketAssets, setMarketAssets] = useState<MarketAsset[]>([]);
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [dayCount, setDayCount] = useState<number>(6);
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});
  
  const [actionAlert, setActionAlert] = useState<{ message: string; messageGe: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Initialize
  useEffect(() => {
    // Load Cash
    const savedCash = localStorage.getItem(CASH_BALANCE_KEY);
    if (savedCash) {
      setCashBalance(parseFloat(savedCash));
    } else {
      setCashBalance(25000); // Give user $25,000 cash starting capital
      localStorage.setItem(CASH_BALANCE_KEY, '25000');
    }

    // Load User Owned Assets
    const savedUserAssets = localStorage.getItem(USER_ASSETS_KEY);
    if (savedUserAssets) {
      setUserAssets(JSON.parse(savedUserAssets));
    } else {
      setUserAssets(defaultUserAssets);
      localStorage.setItem(USER_ASSETS_KEY, JSON.stringify(defaultUserAssets));
    }

    // Load Market Assets list
    const savedMarketAssets = localStorage.getItem(MARKET_ASSETS_KEY);
    if (savedMarketAssets) {
      setMarketAssets(JSON.parse(savedMarketAssets));
    } else {
      setMarketAssets(defaultMarketAssets);
      localStorage.setItem(MARKET_ASSETS_KEY, JSON.stringify(defaultMarketAssets));
    }

    // Load Day Count
    const savedDay = localStorage.getItem(DAY_COUNT_KEY);
    if (savedDay) {
      setDayCount(parseInt(savedDay));
    } else {
      setDayCount(6);
      localStorage.setItem(DAY_COUNT_KEY, '6');
    }

    // Load History list
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    } else {
      setHistory(defaultHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(defaultHistory));
    }
  }, []);

  // Save states helper
  const saveStateToStorage = (newCash: number, newAssets: UserAssetSelection[], newMarket: MarketAsset[], newHistory: PortfolioHistoryPoint[], newDay: number) => {
    setCashBalance(newCash);
    setUserAssets(newAssets);
    setMarketAssets(newMarket);
    setHistory(newHistory);
    setDayCount(newDay);

    localStorage.setItem(CASH_BALANCE_KEY, newCash.toString());
    localStorage.setItem(USER_ASSETS_KEY, JSON.stringify(newAssets));
    localStorage.setItem(MARKET_ASSETS_KEY, JSON.stringify(newMarket));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    localStorage.setItem(DAY_COUNT_KEY, newDay.toString());
  };

  // Safe Total Portfolio Value Calculation
  const getAssetCurrentPrice = (id: string): number => {
    const asset = marketAssets.find(a => a.id === id);
    return asset ? asset.price : 0;
  };

  const currentTotalAssetsValue = userAssets.reduce((sum, item) => {
    return sum + (item.quantity * getAssetCurrentPrice(item.assetId));
  }, 0);

  const totalPortfolioValue = cashBalance + currentTotalAssetsValue;

  // Percentage dynamic performance since start of history
  const startPortfolioValue = history.length > 0 ? history[0].value : 75000;
  const portfolioPerformancePct = startPortfolioValue > 0 
    ? ((totalPortfolioValue - startPortfolioValue) / startPortfolioValue) * 100 
    : 0;

  // Reset Engine Action
  const handleResetSimulation = () => {
    saveStateToStorage(40000, defaultUserAssets, defaultMarketAssets, defaultHistory, 6);
    showAlert('Simulation parameters reset completely.', 'სიმულაციის პარამეტრები აღდგა საწყის მდგომარეობაში.', 'info');
  };

  // Showing trigger alerts
  const showAlert = (en: string, ka: string, type: 'success' | 'error' | 'info') => {
    setActionAlert({ message: en, messageGe: ka, type });
    setTimeout(() => {
      setActionAlert(null);
    }, 4500);
  };

  // Buy Asset Simulation
  const handleBuyAsset = (assetId: string) => {
    const qty = buyQuantities[assetId] || 1;
    const asset = marketAssets.find(a => a.id === assetId);
    if (!asset) return;

    const totalCost = qty * asset.price;
    if (cashBalance < totalCost) {
      showAlert(
        `Insufficient cash balance! Need $${totalCost.toLocaleString()} but only have $${cashBalance.toLocaleString()}`,
        `არასაკმარისი ბალანსი! საჭიროა $${totalCost.toLocaleString()}, გაქვთ მხოლოდ $${cashBalance.toLocaleString()}`,
        'error'
      );
      return;
    }

    // Process transaction
    const newCash = cashBalance - totalCost;
    const existingAssetIdx = userAssets.findIndex(a => a.assetId === assetId);
    let newAssets = [...userAssets];

    if (existingAssetIdx !== -1) {
      const current = newAssets[existingAssetIdx];
      const newQty = current.quantity + qty;
      const newAvg = ((current.quantity * current.avgBuyPrice) + totalCost) / newQty;
      newAssets[existingAssetIdx] = {
        ...current,
        quantity: newQty,
        avgBuyPrice: Math.round(newAvg)
      };
    } else {
      newAssets.push({
        assetId,
        quantity: qty,
        avgBuyPrice: asset.price
      });
    }

    // Update state & storage
    const updatedHistory = [...history];
    if (updatedHistory.length > 0) {
      updatedHistory[updatedHistory.length - 1].value = Number((newCash + newAssets.reduce((sum, item) => sum + (item.quantity * getAssetCurrentPrice(item.assetId)), 0)).toFixed(1));
    }

    saveStateToStorage(newCash, newAssets, marketAssets, updatedHistory, dayCount);
    setBuyQuantities({ ...buyQuantities, [assetId]: 1 }); // reset input counter
    showAlert(
      `Successfully acquired ${qty} unit(s) of ${asset.ticker}!`,
      `წარმატებით შეიძინეთ ${qty} ცალი ${asset.ticker}!`,
      'success'
    );
  };

  // Sell Asset Simulation
  const handleSellAsset = (assetId: string) => {
    const qty = sellQuantities[assetId] || 1;
    const userAsset = userAssets.find(a => a.assetId === assetId);
    const asset = marketAssets.find(a => a.id === assetId);

    if (!userAsset || !asset || userAsset.quantity < qty) {
      showAlert(
        "You do not possess sufficient asset quantities to liquidate this amount!",
        "თქვენ არ გაქვთ საკმარისი რაოდენობის აქტივი გასაყიდად!",
        'error'
      );
      return;
    }

    const valueRealized = qty * asset.price;
    const newCash = cashBalance + valueRealized;
    
    let newAssets = userAssets.map(a => {
      if (a.assetId === assetId) {
        return { ...a, quantity: a.quantity - qty };
      }
      return a;
    }).filter(a => a.quantity > 0);

    // Update history
    const updatedHistory = [...history];
    if (updatedHistory.length > 0) {
      updatedHistory[updatedHistory.length - 1].value = Number((newCash + newAssets.reduce((sum, item) => sum + (item.quantity * getAssetCurrentPrice(item.assetId)), 0)).toFixed(1));
    }

    saveStateToStorage(newCash, newAssets, marketAssets, updatedHistory, dayCount);
    setSellQuantities({ ...sellQuantities, [assetId]: 1 }); // reset input counter
    showAlert(
      `Liquidated ${qty} units of ${asset.ticker} for $${valueRealized.toLocaleString()}`,
      `წარმატებით გაყიდეთ ${qty} ცალი ${asset.ticker} ჯამში $${valueRealized.toLocaleString()}-ად.`,
      'success'
    );
  };

  // Simulate Market fluctuation for 1 New Day!
  const handleSimulateNextDay = () => {
    const nextDayNum = dayCount + 1;
    
    // Mutate and fluctuate prices for all market assets
    const updatedMarketAssets = marketAssets.map(asset => {
      const randomShift = (Math.random() * (asset.volatility * 2)) - (asset.volatility * 0.85); // optimistic float bias
      const percentageChange = Number((randomShift * 100).toFixed(1));
      
      const prevPrice = asset.price;
      const calculatedPrice = asset.price * (1 + randomShift);
      const roundedPrice = Math.max(10, Math.round(calculatedPrice)); // do not let go to zero or negative

      const updatedHistoryArray = [...asset.history, roundedPrice];
      if (updatedHistoryArray.length > 10) updatedHistoryArray.shift(); // keep last 10 ticks

      return {
        ...asset,
        prevPrice,
        price: roundedPrice,
        history: updatedHistoryArray
      };
    });

    // Recalculate sum of new asset value + current cash
    const nextAssetsValue = userAssets.reduce((sum, item) => {
      const livePrice = updatedMarketAssets.find(u => u.id === item.assetId)?.price || 0;
      return sum + (item.quantity * livePrice);
    }, 0);

    const nextTotalPortfolio = Number((cashBalance + nextAssetsValue).toFixed(0));

    // Append new history coordinate
    const label = `Day ${nextDayNum}`;
    const newHistoryPoint: PortfolioHistoryPoint = {
      day: label,
      value: nextTotalPortfolio
    };

    const nextHistory = [...history, newHistoryPoint];
    if (nextHistory.length > 15) nextHistory.shift(); // keep 15-day slider window

    // Save
    saveStateToStorage(cashBalance, userAssets, updatedMarketAssets, nextHistory, nextDayNum);
    
    const absoluteDelta = nextTotalPortfolio - totalPortfolioValue;
    const isGain = absoluteDelta >= 0;

    showAlert(
      `Market cycle simulated! Portfolio Value: $${nextTotalPortfolio.toLocaleString()} (${isGain ? '+' : ''}$${absoluteDelta.toLocaleString()} 24h delta)`,
      `საბაზრო ციკლი განახლდა! პორტფელის ღირებულება: $${nextTotalPortfolio.toLocaleString()} (${isGain ? '+' : ''}$${absoluteDelta.toLocaleString()})`,
      isGain ? 'success' : 'info'
    );
  };

  // Helper quantities adjustment
  const updateQuantityInput = (assetId: string, delta: number, type: 'buy' | 'sell') => {
    if (type === 'buy') {
      const current = buyQuantities[assetId] || 1;
      setBuyQuantities({ ...buyQuantities, [assetId]: Math.max(1, current + delta) });
    } else {
      const current = sellQuantities[assetId] || 1;
      setSellQuantities({ ...sellQuantities, [assetId]: Math.max(1, current + delta) });
    }
  };

  return (
    <div id="tech-portfolio-root" className="w-full text-zinc-100 animate-in fade-in duration-600 space-y-8 pb-12">
      
      {/* Dynamic Pop notification alerting transactions */}
      <AnimatePresence>
        {actionAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-20 right-6 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 border ${
              actionAlert.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-800 text-emerald-300' 
                : actionAlert.type === 'error'
                  ? 'bg-rose-950/90 border-rose-900 text-rose-300'
                  : 'bg-zinc-900/90 border-zinc-800 text-amber-300'
            } max-w-sm`}
          >
            <div className="p-2 bg-white/5 rounded-xl shrink-0">
              <Sparkles size={16} className="animate-spin" />
            </div>
            <p className="text-xs font-semibold leading-relaxed">
              {language === 'ka' ? actionAlert.messageGe : actionAlert.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Widget */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-zinc-800 w-full pb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase font-sans">
            {language === 'ka' ? 'ტექნოლოგიური აქტივების პორტფელი' : 'Tech Portfolio Terminal'}
          </h2>
          <p className={`${currentTheme.muted} text-xs mt-1`}>
            {language === 'ka' 
              ? 'მართეთ თქვენი შეიძენილი ტექნიკური მოწყობილობები, სერვერები და თვალი ადევნეთ მათ სიმულირებულ ღირებულებას.'
              : 'Execute acquisition orders and monitor calculated valuations on custom deployment assets.'}
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          {/* Simulation controller */}
          <button
            type="button"
            id="simulate-market-cycle-btn"
            onClick={handleSimulateNextDay}
            className="flex items-center gap-2 bg-[#dfb257] hover:bg-[#cda14b] active:scale-[0.97] transition-all text-neutral-950 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md select-none cursor-pointer"
            title="Fluctuate assets and append simulated history coordinates"
          >
            <RefreshCw size={14} className="animate-spin shrink-0 text-neutral-900" style={{ animationDuration: '4s' }} />
            <span>{language === 'ka' ? 'საბაზრო ციკლის გაშვება' : 'Simulate Market Shift'}</span>
          </button>

          {/* Reset button */}
          <button
            type="button"
            id="reset-simulation-btn"
            onClick={handleResetSimulation}
            className="p-2.5 hover:bg-zinc-900 hover:text-white border border-zinc-800 text-zinc-400 hover:border-zinc-700 rounded-xl transition-all cursor-pointer"
            title="Reset simulation parameters"
          >
            <span>🔄</span>
          </button>
        </div>
      </div>

      {/* Primary Key Metrics & Chart Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Value Metrics Left Column */}
        <div className="space-y-4 lg:col-span-1 flex flex-col justify-between">
          
          {/* Total Net Worth Card */}
          <div className={`${currentTheme.card} p-6 rounded-[28px] relative overflow-hidden flex-1 flex flex-col justify-between min-h-[160px]`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#dfb257]/5 blur-3xl rounded-full -mr-12 -mt-12" />
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                  <Briefcase size={12} className="text-[#dfb257]" />
                  {language === 'ka' ? 'ჯამური კაპიტალი' : 'Estimated Net Capital'}
                </span>
                <span className="text-[10px] font-mono tracking-widest bg-zinc-800 border border-zinc-800 rounded px-2 py-0.5 text-zinc-400">
                  DAY {dayCount}
                </span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3 text-white font-mono shrink-0">
                ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </h1>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800/60">
              <div className={`flex items-center gap-1 text-xs font-bold font-mono ${portfolioPerformancePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {portfolioPerformancePct >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                <span>{portfolioPerformancePct >= 0 ? '+' : ''}{portfolioPerformancePct.toFixed(1)}%</span>
              </div>
              <span className="text-[10px] font-medium text-zinc-400">
                {language === 'ka' ? 'ყველა დროის ნამატი' : 'since initiation benchmark'}
              </span>
            </div>
          </div>

          {/* Cash Balance Available Card */}
          <div className={`${currentTheme.cardAlt} p-6 rounded-[28px] relative overflow-hidden`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <Coins size={13} className="text-amber-500" />
              {language === 'ka' ? 'ხელმისაწვდომი თანხა' : 'Available Liquid Cash'}
            </span>
            <h2 className="text-2xl font-bold font-mono text-zinc-200 mt-2">
              ${cashBalance.toLocaleString()}
            </h2>
            <p className="text-[10px] text-zinc-500 mt-1">
              {language === 'ka' ? 'დახარჯეთ თანხა ახალი ტექნიკის აქტივების შესაძენად.' : 'Deploy funds safely to secure simulated high-tech components.'}
            </p>
          </div>

          {/* Acquired Inventory Count Card */}
          <div className={`${currentTheme.cardAlt} p-6 rounded-[28px] relative overflow-hidden`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <Cpu size={13} className="text-blue-400" />
              {language === 'ka' ? 'აქტივების რაოდენობა' : 'Deployed Hardware Units'}
            </span>
            <div className="flex justify-between items-end mt-2">
              <h2 className="text-2xl font-bold font-mono text-zinc-200">
                {userAssets.reduce((sum, item) => sum + item.quantity, 0)} <span className="text-xs text-zinc-500 font-sans font-medium">units</span>
              </h2>
              <span className="text-[10px] font-mono font-bold text-zinc-400">
                {userAssets.length} distinct types
              </span>
            </div>
          </div>

        </div>

        {/* Interactive Simulated Valuation AreaChart Panel */}
        <div className={`${currentTheme.card} p-6 rounded-[32px] lg:col-span-2 flex flex-col justify-between space-y-4`}>
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#dfb257] animate-pulse" />
                {language === 'ka' ? 'პორტფელის ღირებულება დროში' : 'Valuation Projection Timeline (Simulated)'}
              </h4>
              <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1 bg-zinc-800/40 p-1 px-2.5 rounded-xl border border-zinc-800/30">
                <TrendingUp size={11} className="text-emerald-400" /> Real-time tracking
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              {language === 'ka' ? 'სათვალთვალო გრაფიკი სადაც ჩანს კაპიტალის დინამიკა ყოველი საბაზრო ციკლის შემდეგ.' : 'This interactive timeline tracks total capital value through standard market shift operations.'}
            </p>
          </div>

          {/* Recharts Live Node */}
          <div className="h-[220px] w-full pt-4">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dfb257" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#dfb257" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="day" 
                    stroke="#52525b" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                    fontFamily="monospace"
                  />
                  <YAxis 
                    stroke="#52525b" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                    fontFamily="monospace"
                    tickFormatter={(val) => `$${Math.round(val/1000)}k`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#121215', 
                      borderColor: '#27272a', 
                      borderRadius: '16px',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontFamily: 'monospace'
                    }}
                    formatter={(value: any) => [`$${value.toLocaleString()}`, (language === 'ka' ? 'ღირებულება' : 'Total Capital')]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#dfb257" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-zinc-500 font-mono text-[9px] uppercase tracking-widest">
                Generating projections data...
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Grid: 2 Column Asset manager & Store options */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Owned Assets detailed ledger */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#dfb257]/80 flex items-center gap-1.5">
            <span>📦</span> {language === 'ka' ? 'ჩემი დაdeployებული მოწყობილობები' : 'Deployed Tech Inventory'}
          </h3>

          {userAssets.length === 0 ? (
            <div className="bg-zinc-900 w-full border border-zinc-800 p-12 rounded-[28px] text-center space-y-4">
              <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center mx-auto border border-zinc-805 text-zinc-500">
                ⚙️
              </div>
              <div>
                <p className="text-xs uppercase font-extrabold tracking-wider text-zinc-300">
                  {language === 'ka' ? 'ინვენტარი ცარიელია' : 'Inventory Core is Offline'}
                </p>
                <p className={`${currentTheme.muted} text-[10px] mt-1`}>
                  {language === 'ka' 
                    ? 'ყველა მოწყობილობა განაღდებულია. შეიძინეთ ახალი ლიცენზიები ან ბლეიდ-სერვერები მარჯვენა პანელში.' 
                    : 'No deployable tech units currently loaded in user storage profile.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {userAssets.map((assetItem) => {
                const asset = marketAssets.find(a => a.id === assetItem.assetId);
                if (!asset) return null;

                const currentPrice = asset.price;
                const totalAssetCostBasis = assetItem.quantity * assetItem.avgBuyPrice;
                const currentAssetValuation = assetItem.quantity * currentPrice;
                const absoluteReturn = currentAssetValuation - totalAssetCostBasis;
                const returnPercentage = assetItem.avgBuyPrice > 0 ? (absoluteReturn / totalAssetCostBasis) * 100 : 0;
                
                const sellQty = sellQuantities[assetItem.assetId] || 1;

                return (
                  <div key={assetItem.assetId} className={`${currentTheme.cardAlt} p-5 rounded-[24px] flex flex-col md:flex-row md:items-center justify-between gap-4 border border-zinc-800 hover:border-zinc-700 transition-all`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-black font-mono bg-zinc-900 border border-zinc-800 text-amber-400 px-2 py-0.5 rounded-md">
                          {asset.ticker}
                        </span>
                        <h4 className="text-xs sm:text-sm font-black text-white">{language === 'ka' ? asset.nameGe : asset.name}</h4>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px] font-mono text-zinc-400">
                        <div>
                          {language === 'ka' ? 'რაოდენობა:' : 'Qty:'} <span className="text-white font-bold">{assetItem.quantity} units</span>
                        </div>
                        <div className="text-zinc-500">•</div>
                        <div>
                          {language === 'ka' ? 'საშ. ყიდვის ფასი:' : 'Avg Buy:'} <span className="text-white">${assetItem.avgBuyPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-end justify-between md:justify-center border-t border-zinc-800/40 md:border-t-0 pt-3 md:pt-0 gap-3">
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-white block">
                          ${currentAssetValuation.toLocaleString()}
                        </span>
                        
                        {/* profit margin badge */}
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold font-mono ${absoluteReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {absoluteReturn >= 0 ? '+' : ''}{returnPercentage.toFixed(1)}% 
                          ({absoluteReturn >= 0 ? 'gain' : 'loss'})
                        </span>
                      </div>

                      {/* Sell Liquidation micro form */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center bg-zinc-900 w-24 h-8 rounded-lg overflow-hidden border border-zinc-850 px-1 bg-zinc-950">
                          <button
                            type="button"
                            onClick={() => updateQuantityInput(assetItem.assetId, -1, 'sell')}
                            className="w-6 h-6 flex items-center justify-center text-zinc-404 hover:text-white rounded animate-pulse"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="flex-1 text-center text-xs font-bold font-mono text-zinc-200">
                            {sellQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantityInput(assetItem.assetId, 1, 'sell')}
                            className="w-6 h-6 flex items-center justify-center text-[#dfb257] hover:text-white rounded animate-pulse"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                        <button
                          type="button"
                          id={`sell-asset-${assetItem.assetId}-btn`}
                          onClick={() => handleSellAsset(assetItem.assetId)}
                          disabled={sellQty > assetItem.quantity}
                          className="bg-rose-500/10 hover:bg-rose-500/20 active:scale-[0.96] border border-rose-500/20 text-rose-400 font-black uppercase text-[9px] tracking-widest px-3.5 h-8 rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer select-none"
                        >
                          {language === 'ka' ? 'გაყიდვა' : 'Liquidate'}
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Tech Hardware Market Acquisition */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#dfb257]/80 flex items-center gap-1.5">
            <span>🛒</span> {language === 'ka' ? 'ტექნიკური მოწყობილობების შესყიდვა' : 'Tech Procurement Market'}
          </h3>

          <div className="space-y-4">
            {marketAssets.map((asset) => {
              const buyQty = buyQuantities[asset.id] || 1;
              const priceDelta = asset.price - asset.prevPrice;
              const absolutePercentage = asset.prevPrice > 0 ? (priceDelta / asset.prevPrice) * 105 : 0;
              const isGain = priceDelta >= 0;

              return (
                <div key={asset.id} className={`${currentTheme.card} p-5 rounded-[24px] flex flex-col md:flex-row justify-between md:items-center gap-4 border border-zinc-800 hover:shadow-[#dfb257]/5 transition-all`}>
                  
                  {/* Info column */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black font-mono bg-[#dfb257]/10 border border-[#dfb257]/20 text-[#dfb257] px-2 py-0.5 rounded-md">
                        {asset.ticker}
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-zinc-50">{language === 'ka' ? asset.nameGe : asset.name}</h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                      {language === 'ka' ? asset.descriptionGe : asset.description}
                    </p>
                  </div>

                  {/* Market control column */}
                  <div className="flex flex-row md:flex-col items-end justify-between md:justify-center border-t border-zinc-808 md:border-t-0 pt-3 md:pt-0 gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-zinc-50 block">
                        ${asset.price.toLocaleString()}
                      </span>
                      {/* Price fluctuation delta */}
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold font-mono ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isGain ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {isGain ? '+' : ''}{absolutePercentage.toFixed(1)}% ({language === 'ka' ? 'ამ ციკლში' : '24h'})
                      </span>
                    </div>

                    {/* Acquisition buy controls */}
                    <div className="flex items-center gap-1.5 leading-relaxed">
                      <div className="flex items-center bg-zinc-900 w-24 h-8 rounded-lg overflow-hidden border border-zinc-800 px-1 bg-zinc-950">
                        <button
                          type="button"
                          onClick={() => updateQuantityInput(asset.id, -1, 'buy')}
                          className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white rounded"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="flex-1 text-center text-xs font-bold font-mono text-zinc-200">
                          {buyQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantityInput(asset.id, 1, 'buy')}
                          className="w-6 h-6 flex items-center justify-center text-[#dfb257] hover:text-white rounded"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      
                      <button
                        type="button"
                        id={`buy-asset-${asset.id}-btn`}
                        onClick={() => handleBuyAsset(asset.id)}
                        disabled={cashBalance < (buyQty * asset.price)}
                        className="bg-[#dfb257] hover:bg-[#cda14b] active:scale-[0.96] text-neutral-950 font-black uppercase text-[9px] tracking-widest px-3.5 h-8 rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer select-none font-sans"
                      >
                        {language === 'ka' ? 'ყიდვა' : 'Deploy'}
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
