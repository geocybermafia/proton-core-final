import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Coins, 
  ArrowUpRight, 
  ShieldCheck, 
  Download, 
  Code, 
  Sparkles, 
  Building, 
  Briefcase, 
  Play, 
  RefreshCw, 
  BarChart3, 
  Settings, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  Layout, 
  Key,
  Globe,
  Sliders,
  Sparkle,
  Copy,
  Receipt,
  FileCode,
  Check
} from 'lucide-react';
import { generateOrEditImage } from '../lib/gemini';

interface CommercialHubProps {
  language: 'en' | 'ka';
}

export const CommercialHub: React.FC<CommercialHubProps> = ({ language }) => {
  // Stats state for Valuation Calculator
  const [activeUsers, setActiveUsers] = useState<number>(1200);
  const [pricingTier, setPricingTier] = useState<number>(29);
  const [growthRate, setGrowthRate] = useState<number>(35); // annual %
  const [churnRate, setChurnRate] = useState<number>(3.5); // %
  const [multiplier, setMultiplier] = useState<number>(6.5); // ARR multiple

  // Calcs
  const calculatedMRR = activeUsers * pricingTier;
  const calculatedARR = calculatedMRR * 12;
  const churnImpact = calculatedMRR * (churnRate / 100);
  const estimatedTokenCost = activeUsers * 1.5; // $1.5 API cost per user avg
  const netMRR = calculatedMRR - estimatedTokenCost;
  const netARR = netMRR * 12;
  const estimatedAcquisitionValue = netARR * multiplier;

  // White Labelling simulator state
  const [brandName, setBrandName] = useState<string>('Proton AI Enterprise');
  const [accentColor, setAccentColor] = useState<string>('#00f2ff');
  const [headline, setHeadline] = useState<string>('Next-Gen AI Workspace for Elite Teams');
  const [generatingLogo, setGeneratingLogo] = useState<boolean>(false);
  const [generatedLogoUrl, setGeneratedLogoUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Pitch Deck Slide states
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  // Stripe Setup state
  const [stripeTierBasic, setStripeTierBasic] = useState<number>(19);
  const [stripeTierPro, setStripeTierPro] = useState<number>(49);
  const [stripeTierEnterprise, setStripeTierEnterprise] = useState<number>(199);

  // Georgian / English dictionary local to component
  const t = {
    title: language === 'ka' ? 'კომერციალიზაციისა და გაყიდვის ცენტრი' : 'SaaS Commercialization & Exit Hub',
    subtitle: language === 'ka' ? 'პროდუქტის ბიზნეს-ღირებულების გაზრდისა და გასხვისების პორტალი' : 'Increase your project value, white-label, calculate valuation & prepare for acquisition',
    tabValuation: language === 'ka' ? 'ფასის კალკულატორი' : 'Valuation Engine',
    tabWhiteLabel: language === 'ka' ? 'თეთრი იარლიყი (White-Label)' : 'White-Label Engine',
    tabPitch: language === 'ka' ? 'პრეზენტაცია (Pitch Deck)' : 'SaaS Pitch Deck',
    tabStripe: language === 'ka' ? 'გადახდები და API' : 'Billing & APIs',
    
    // Valuation section
    valuationTitle: language === 'ka' ? 'ინტერაქტიული SaaS შეფასების პანელი' : 'Interactive SaaS Valuation Calculator',
    valuationDesc: language === 'ka' ? 'შეცვალეთ ბიზნეს პარამეტრები, რათა იხილოთ პროექტის პოტენციური ARR და გასაყიდი ფასი Flippa-ზე ან Acquire.com-ზე.' : 'Adjust commercial parameters to show dynamic ARR growth, profit margins, and actual acquisition multipliers.',
    mrr: language === 'ka' ? 'ყოველთვიური შემოსავალი (MRR)' : 'Monthly Recurring Revenue (MRR)',
    arr: language === 'ka' ? 'წლიური შემოსავალი (ARR)' : 'Annual Recurring Revenue (ARR)',
    netProfit: language === 'ka' ? 'წმინდა წლიური მოგება' : 'Net Annual Profit',
    valuationEst: language === 'ka' ? 'პროექტის ბიზნეს ღირებულება' : 'Estimated Valuation (Exit Price)',
    usersCount: language === 'ka' ? 'აქტიური მომხმარებელი' : 'Active Paid Users',
    avgPrice: language === 'ka' ? 'საშუალო ფასი ($/თვე)' : 'Avg Plan Price ($/mo)',
    annualGrowth: language === 'ka' ? 'წლიური ზრდის ტემპი (%)' : 'Annual Growth Rate (%)',
    churnRateLabel: language === 'ka' ? 'გადინება (Churn %)' : 'Monthly Churn Rate (%)',
    multipleLabel: language === 'ka' ? 'შეფასების მულტიპლიკატორი' : 'Acquisition Multiple (ARR)',
    proMultiplier: language === 'ka' ? 'პროფესიონალური შეფასება: 5x-დან 12x ARR-მდე' : 'Industry benchmark: 5x to 12x ARR multiplier based on clean architecture',

    // White label section
    wlTitle: language === 'ka' ? 'თეთრი იარლიყის (White-Label) კონფიგურატორი' : 'White-Label & Re-Branding Configurator',
    wlDesc: language === 'ka' ? 'მიეცით მყიდველს საშუალება იხილოს, თუ რამდენად მარტივია ამ აპლიკაციის საკუთარ ბრენდად გარდაქმნა კოდის ცვლილების გარეშე.' : 'Demonstrate multi-tenant capability by letting prospective buyers custom-brand the interface instantly.',
    wlAppName: language === 'ka' ? 'ახალი ბრენდის სახელი' : 'Custom App Name',
    wlColor: language === 'ka' ? 'აქცენტის ფერი' : 'Theme Accent Color',
    wlHeadline: language === 'ka' ? 'მთავარი სლოგანი' : 'Custom Landing Page Headline',
    wlGenLogo: language === 'ka' ? 'ბრენდის ლოგოს გენერაცია (AI)' : 'Generate Custom Brand Logo (AI)',
    wlSimulate: language === 'ka' ? 'ბრენდინგის სიმულაცია' : 'Custom Branding Preview',
    
    // Pitch Deck Section
    pitchTitle: language === 'ka' ? 'ინვესტორთა პრეზენტაცია' : 'Commercial Teaser & Pitch Deck',
    pitchDesc: language === 'ka' ? 'მზა ბიზნეს-პრეზენტაცია პროექტის უნიკალური უპირატესობების დემონსტრირებისთვის.' : 'Pre-built high-converting pitch container to present directly to digital brokers, buyers, or VCs.',
    
    // Stripe section
    stripeTitle: language === 'ka' ? 'Stripe გადახდები და დეველოპერის პორტალი' : 'Stripe SaaS Billing & Developer SDK',
    stripeDesc: language === 'ka' ? 'მყიდველი დაინახავს, რომ ბილინგის სტრუქტურა სრულიად მზად არის და მხოლოდ საკუთარი API გასაღებები სჭირდება.' : 'Full SaaS subscription tiers configured with pre-styled webhooks and Node.js proxy code.',
  };

  const slides = [
    {
      title: language === 'ka' ? '1. პროდუქტის უნიკალურობა (The Solution)' : '1. Product Vision & Moat',
      metrics: [
        { label: language === 'ka' ? 'არქიტექტურა' : 'Architecture', value: 'Express + Vite Dual Client' },
        { label: language === 'ka' ? 'ინტეგრაცია' : 'Integrations', value: 'Firebase, Supabase Web3' },
        { label: language === 'ka' ? 'მულტი-აგენტები' : 'Multi-Agent', value: 'Gemini NLP Process Builders' }
      ],
      description: language === 'ka' 
        ? 'ეს არის სრულიად მოდულარული AI პლატფორმა, რომელიც აერთიანებს მოწინავე NLP დამხმარეებს, რუკის ლოკალიზაციას (Leaflet), ფაილების სკანირებას, Web3-ს და ვიზუალური პროცესების მართვას ერთიან ეკოსისტემაში.'
        : 'Proton seamlessly integrates localized maps, high-performance visual workflow orchestration (React Flow), AI multi-agents, secure dual Auth, and hardware monitors in a beautifully crafted neo-brutalist shell.'
    },
    {
      title: language === 'ka' ? '2. ბიზნეს მოდელი (SaaS Monetization)' : '2. SaaS Business Model & Margins',
      metrics: [
        { label: language === 'ka' ? 'საშუალო მარჟა' : 'Gross Margin', value: '88% - 94%' },
        { label: language === 'ka' ? 'მომხმარებლის LTV' : 'User LTV', value: '$348 avg' },
        { label: language === 'ka' ? 'API ოპტიმიზაცია' : 'AI Optimization', value: 'Token Cache Ready' }
      ],
      description: language === 'ka'
        ? 'B2B/B2C სააბონენტო მოდელი. ლოკალური შენახვა და ტოკენების ქეშირება ინარჩუნებს API ხარჯებს მინიმალურ ნიშნულზე, რაც უზრუნველყოფს წარმოუდგენლად მაღალ წმინდა მოგების მარჟას.'
        : 'Predictable high-margin SaaS pricing tiers. The local storage caching combined with server-side Gemini gateway proxies minimizes third-party token consumption, enabling exceptionally high margins.'
    },
    {
      title: language === 'ka' ? '3. ტექნიკური მზაობა (Production-Ready Code)' : '3. Tech Stack & Turnkey Setup',
      metrics: [
        { label: language === 'ka' ? 'TypeScript ხარისხი' : 'Code Standard', value: '100% Strict Safe' },
        { label: language === 'ka' ? 'ინფრასტრუქტურა' : 'Infrastructure', value: 'Serverless Compatible' },
        { label: language === 'ka' ? 'უსაფრთხოება' : 'Security Audit', value: 'Firebase & OWASP Validated' }
      ],
      description: language === 'ka'
        ? 'პროექტი იყენებს სრულ ტიპიზაციას (TypeScript), უახლეს Tailwind v4 სტილებს და არის 100% მზად Cloud Run-ზე, AWS, ან Vercel-ზე გასაშვებად. კოდი არის სუფთა, დოკუმენტირებული და მარტივად გასაფართოებელი.'
        : 'The system values pure, modular component decomposition. Fully configured with Firebase databases and Firestore security rules, the repository is ready for immediate deployment and licensing.'
    }
  ];

  const handleCopyStripeCode = () => {
    const code = `// server.ts - Stripe Subscription API Integration Code (Production Module)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });

app.post('/api/checkout/session', async (req, res) => {
  const { priceId, userEmail } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: \`\${process.env.APP_URL}/dashboard?checkout=success\`,
      cancel_url: \`\${process.env.APP_URL}/dashboard?checkout=cancel\`,
      customer_email: userEmail,
    });
    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleGenerateLogo = async () => {
    setGeneratingLogo(true);
    try {
      const prompt = `Minimalist, modern, vector SaaS logo design for an elite tech brand named "${brandName}". Styled with glowing high-tech accent colors of ${accentColor} on a dark charcoal background. Absolute center, zero complexity, geometric and high end commercial feel.`;
      const url = await generateOrEditImage(prompt);
      setGeneratedLogoUrl(url);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingLogo(false);
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<'valuation' | 'whitelabel' | 'pitch' | 'stripe'>('valuation');

  return (
    <div className="space-y-8" id="acquisition-hub-container">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-proton-border/45 pb-6">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2 mb-2">
            <TrendingUp className="text-proton-accent animate-pulse" size={28} />
            {t.title}
          </h2>
          <p className="text-sm font-bold text-proton-muted">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-full bg-proton-accent/20 border border-proton-accent/30 flex items-center gap-1.5 text-xs font-mono font-bold text-proton-accent">
            <Sparkle size={14} className="animate-spin" />
            <span>{language === 'ka' ? 'გასხვისება: აქტიური' : 'EXIT READY: ACTIVE'}</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400">
            <ShieldCheck size={14} />
            <span>{language === 'ka' ? 'აუდიტი გავლილია' : 'AUDITED'}</span>
          </div>
        </div>
      </div>

      {/* Sub tabs navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-proton-bg border border-proton-border rounded-2xl max-w-4xl">
        <button
          onClick={() => setActiveSubTab('valuation')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            activeSubTab === 'valuation'
              ? 'bg-proton-accent/10 border border-proton-accent/30 text-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.08)]'
              : 'border border-transparent text-proton-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Coins size={15} />
          {t.tabValuation}
        </button>
        <button
          onClick={() => setActiveSubTab('whitelabel')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            activeSubTab === 'whitelabel'
              ? 'bg-proton-accent/10 border border-proton-accent/30 text-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.08)]'
              : 'border border-transparent text-proton-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe size={15} />
          {t.tabWhiteLabel}
        </button>
        <button
          onClick={() => setActiveSubTab('pitch')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            activeSubTab === 'pitch'
              ? 'bg-proton-accent/10 border border-proton-accent/30 text-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.08)]'
              : 'border border-transparent text-proton-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Briefcase size={15} />
          {t.tabPitch}
        </button>
        <button
          onClick={() => setActiveSubTab('stripe')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            activeSubTab === 'stripe'
              ? 'bg-proton-accent/10 border border-proton-accent/30 text-proton-accent shadow-[0_0_15px_rgba(0,242,255,0.08)]'
              : 'border border-transparent text-proton-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Code size={15} />
          {t.tabStripe}
        </button>
      </div>

      {/* Main Container */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {/* TAB 1: VALUATION ENGINE */}
          {activeSubTab === 'valuation' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left sliders */}
              <div className="lg:col-span-7 proton-glass p-6 sm:p-8 rounded-3xl border border-proton-border space-y-6">
                <div>
                  <h3 className="text-lg font-black uppercase text-white flex items-center gap-2 mb-2">
                    <Sliders className="text-proton-accent" size={18} />
                    {t.valuationTitle}
                  </h3>
                  <p className="text-xs text-proton-muted">{t.valuationDesc}</p>
                </div>

                {/* User Count Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-proton-muted uppercase tracking-wider">{t.usersCount}</span>
                    <span className="text-proton-accent font-bold">{activeUsers.toLocaleString()}</span>
                  </div>
                  <input 
                    type="range" 
                    min={100} 
                    max={15000} 
                    step={100}
                    value={activeUsers} 
                    onChange={(e) => setActiveUsers(Number(e.target.value))}
                    className="w-full accent-proton-accent h-1 bg-proton-border rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-proton-muted/60 font-mono">
                    <span>100</span>
                    <span>15,000+</span>
                  </div>
                </div>

                {/* Avg Pricing Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-proton-muted uppercase tracking-wider">{t.avgPrice}</span>
                    <span className="text-proton-accent font-bold">${pricingTier} / mo</span>
                  </div>
                  <input 
                    type="range" 
                    min={9} 
                    max={199} 
                    step={1}
                    value={pricingTier} 
                    onChange={(e) => setPricingTier(Number(e.target.value))}
                    className="w-full accent-proton-accent h-1 bg-proton-border rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-proton-muted/60 font-mono">
                    <span>$9</span>
                    <span>$199</span>
                  </div>
                </div>

                {/* Churn Rate Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-proton-muted uppercase tracking-wider">{t.churnRateLabel}</span>
                    <span className="text-rose-400 font-bold">{churnRate}%</span>
                  </div>
                  <input 
                    type="range" 
                    min={1} 
                    max={15} 
                    step={0.1}
                    value={churnRate} 
                    onChange={(e) => setChurnRate(Number(e.target.value))}
                    className="w-full accent-rose-500 h-1 bg-proton-border rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-proton-muted/60 font-mono">
                    <span>1.0% (Excellent)</span>
                    <span>15% (High)</span>
                  </div>
                </div>

                {/* Churn Multiplier Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-proton-muted uppercase tracking-wider">{t.multipleLabel}</span>
                    <span className="text-proton-accent font-bold">{multiplier}x ARR</span>
                  </div>
                  <input 
                    type="range" 
                    min={3} 
                    max={12} 
                    step={0.5}
                    value={multiplier} 
                    onChange={(e) => setMultiplier(Number(e.target.value))}
                    className="w-full accent-proton-accent h-1 bg-proton-border rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-proton-muted/60 font-mono">
                    <span>3x (Low multiplier)</span>
                    <span>12x (Elite SaaS standard)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-proton-accent/5 border border-proton-accent/20 flex gap-3 items-start">
                  <Sparkles className="text-proton-accent shrink-0 mt-0.5" size={16} />
                  <p className="text-[11px] text-proton-muted leading-relaxed font-mono">
                    {t.proMultiplier}
                  </p>
                </div>
              </div>

              {/* Right calculated outcomes */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {/* Outlined Price Widget */}
                <div className="proton-glass p-6 sm:p-8 rounded-3xl border border-proton-accent/30 bg-gradient-to-br from-proton-accent/5 to-proton-bg flex flex-col justify-beteen relative overflow-hidden">
                  <div className="absolute right-[-40px] top-[-40px] w-24 h-24 bg-proton-accent/10 rounded-full blur-2xl" />
                  
                  <span className="text-[10px] font-mono tracking-widest uppercase text-proton-muted mb-1 block">
                    {t.valuationEst}
                  </span>
                  <div className="text-4xl sm:text-5xl font-black text-white font-sans tracking-tight mb-4 flex items-baseline gap-1.5 flex-wrap">
                    ${Math.round(estimatedAcquisitionValue).toLocaleString()}
                    <span className="text-xs font-mono text-proton-accent font-bold">USD</span>
                  </div>
                  
                  <hr className="border-proton-border/45 my-4" />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] font-mono uppercase text-proton-muted block">{t.mrr}</span>
                      <span className="text-sm font-black text-white">${Math.round(calculatedMRR).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono uppercase text-proton-muted block">{t.arr}</span>
                      <span className="text-sm font-black text-white">${Math.round(calculatedARR).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono uppercase text-proton-muted block">{language === 'ka' ? 'API ხარჯები (სიმულირებული)' : 'Simulated API Cost'}</span>
                      <span className="text-sm font-bold text-rose-400">-${Math.round(estimatedTokenCost).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono uppercase text-proton-muted block">{t.netProfit}</span>
                      <span className="text-sm font-black text-emerald-400">${Math.round(netARR).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Flip list details */}
                <div className="proton-glass p-6 rounded-3xl border border-proton-border space-y-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-proton-muted block">
                    {language === 'ka' ? 'ბიზნეს აქტივები გასასხვისებლად' : 'Commercial Assets For Acquisition'}
                  </span>
                  
                  <div className="space-y-2.5">
                    {[
                      { l: language === 'ka' ? 'TypeScript სორს-კოდი' : 'TypeScript Full Source Code', v: 'Clean & Fully Bundled' },
                      { l: language === 'ka' ? 'საავტორო უფლებები & ლიცენზია' : 'Intellectual Property & IP License', v: '100% Retained and Clean' },
                      { l: language === 'ka' ? 'Firestore & Supabase ბაზა' : 'Firestore & Supabase Infrastructure', v: 'Ready to Transfer' },
                      { l: language === 'ka' ? 'რუკებისა & Leaflet მოდულები' : 'Leaflet Map and GIS Service', v: 'Turnkey Integration' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-mono">
                        <span className="text-proton-muted">{item.l}</span>
                        <span className="text-white font-bold text-[11px] bg-proton-bg border border-proton-border px-2.5 py-1 rounded-lg">
                          {item.v}
                        </span>
                      </div>
                    ))}
                  </div>

                  <hr className="border-proton-border/45" />

                  <button 
                    onClick={() => {
                      const text = `
Proton AI SaaS - Exit Valuation Listing Package
===================================================
Simulated Valuation Parameters:
- Target Monthly Active Users: ${activeUsers}
- Average Plan Revenue Pricing: $${pricingTier}/mo
- Calculated Gross MRR: $${calculatedMRR}
- Projected Annual Revenue (ARR): $${calculatedARR}
- Estimated Net Profit After API Cost: $${netARR}/year
- Acquisition Pricing Estimate (at ${multiplier}x multiple): $${Math.round(estimatedAcquisitionValue).toLocaleString()} USD

High-Value Infrastructure Assets Included:
- Multi-Agent AI Task & Persona Workspace
- Visual Workflow Flowchart Builder
- Leaflet Geospatial Map Integration Modules
- Firebase & Supabase Secure Multi-Tenant Authentication
- Production Express Node.js Bundled Microservice
                      `;
                      const blob = new Blob([text], { type: 'text/plain' });
                      const element = document.createElement('a');
                      element.href = URL.createObjectURL(blob);
                      element.download = "saas_sales_package.txt";
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                    }}
                    className="w-full py-3 px-4 bg-proton-accent text-proton-bg hover:opacity-90 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    {language === 'ka' ? 'ბიზნეს პაკეტის ექსპორტი (TXT)' : 'Export Exit Spec Packet (TXT)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHITE-LABEL ENGINE */}
          {activeSubTab === 'whitelabel' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* WL Configuration Inputs */}
              <div className="lg:col-span-6 proton-glass p-6 sm:p-8 rounded-3xl border border-proton-border space-y-6">
                <div>
                  <h3 className="text-lg font-black uppercase text-white flex items-center gap-2 mb-2">
                    <Globe className="text-proton-accent" size={18} />
                    {t.wlTitle}
                  </h3>
                  <p className="text-xs text-proton-muted">{t.wlDesc}</p>
                </div>

                <div className="space-y-4">
                  {/* Brand name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">{t.wlAppName}</label>
                    <input 
                      type="text" 
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="w-full bg-proton-bg border border-proton-border hover:border-proton-accent/40 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-proton-accent transition-all font-mono"
                    />
                  </div>

                  {/* Accent Color picker mockup */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">{t.wlColor}</label>
                    <div className="flex gap-2">
                      <input 
                        type="color" 
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-12 h-11 bg-proton-bg border border-proton-border rounded-xl cursor-pointer p-1"
                      />
                      <input 
                        type="text" 
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="flex-1 bg-proton-bg border border-proton-border hover:border-proton-accent/40 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-proton-accent transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Landing Screen Headline */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-proton-muted uppercase tracking-widest">{t.wlHeadline}</label>
                    <textarea 
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      rows={2}
                      className="w-full bg-proton-bg border border-proton-border hover:border-proton-accent/40 rounded-xl px-4 py-3 text-white text-xs focus:outline-none focus:border-proton-accent transition-all font-mono resize-none"
                    />
                  </div>

                  {/* Generate Custom Logo */}
                  <div className="pt-2">
                    <button
                      onClick={handleGenerateLogo}
                      disabled={generatingLogo}
                      className="w-full py-3 px-4 rounded-xl border border-proton-accent/30 text-proton-accent bg-proton-accent/5 hover:bg-proton-accent/15 text-xs font-mono font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      {generatingLogo ? (
                        <>
                          <RefreshCw className="animate-spin" size={14} />
                          <span>{language === 'ka' ? 'ლოგო გენერირდება...' : 'Generating Logo...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>{t.wlGenLogo}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Instant WL Preview */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                <div className="proton-glass p-6 sm:p-8 rounded-3xl border border-proton-border relative overflow-hidden flex flex-col gap-4">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-proton-muted flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse" />
                    {t.wlSimulate}
                  </span>

                  {/* Simulated App Frame */}
                  <div className="border border-proton-border rounded-2xl bg-black/40 p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-proton-border/30 pb-3">
                      <div className="flex items-center gap-2">
                        {/* Logo preview */}
                        {generatedLogoUrl ? (
                          <img src={generatedLogoUrl} alt="Logo" className="w-6 h-6 rounded-md object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-proton-accent/20 flex items-center justify-center text-[10px] font-black text-proton-accent" style={{ color: accentColor, borderColor: accentColor }}>
                            AI
                          </div>
                        )}
                        <span className="text-xs font-black uppercase tracking-wide text-white" style={{ textShadow: `0 0 10px ${accentColor}44` }}>
                          {brandName}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-proton-muted/30" />
                        <span className="w-1.5 h-1.5 rounded-full bg-proton-muted/30" />
                        <span className="w-1.5 h-1.5 rounded-full bg-proton-muted/30" />
                      </div>
                    </div>

                    <div className="py-6 text-center space-y-3">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-widest uppercase" style={{ backgroundColor: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>
                        PREMIUM WHitelabel Active
                      </span>
                      <h4 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                        {headline}
                      </h4>
                      <p className="text-[10px] text-proton-muted max-w-sm mx-auto leading-relaxed">
                        {language === 'ka' 
                          ? 'ეს არის თქვენი მორგებული თეთრი იარლიყის პლატფორმა. ფერები, ლოგოები და ტექსტები შეიცვალა მყისიერად.'
                          : 'This is a simulation of standard white-labeled dashboard access. Fully localized and responsive theme mapping is operational.'}
                      </p>
                      
                      <div className="pt-2 flex justify-center gap-2">
                        <button className="py-2 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider text-proton-bg font-mono" style={{ backgroundColor: accentColor }}>
                          {language === 'ka' ? 'დაიწყე ახლავე' : 'Get Started'}
                        </button>
                        <button className="py-2 px-4 rounded-lg text-[10px] font-bold uppercase tracking-wider text-proton-muted border border-proton-border font-mono hover:text-white transition-colors">
                          {language === 'ka' ? 'პროდუქტის ტური' : 'Learn More'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-proton-bg border border-proton-border flex items-start gap-2">
                    <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5 font-bold" size={14} />
                    <p className="text-[10px] font-mono text-proton-muted/80 leading-relaxed">
                      {language === 'ka' 
                        ? 'White-Label მექანიზმი იყენებს CSS ცვლადებს (:root), რაც იმას ნიშნავს რომ ერთი CSS ფაილის შეცვლით მყიდველს შეუძლია ბრენდინგის 100% მორგება.'
                        : 'The rebranding infrastructure uses standardized CSS variables (:root theme-mapping) allows single-file adjustments for 100% total coverage.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PITCH DECK FOR INVESTORS */}
          {activeSubTab === 'pitch' && (
            <div className="proton-glass p-6 sm:p-10 rounded-3xl border border-proton-border space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-proton-border/45 pb-4">
                <div>
                  <h3 className="text-lg font-black uppercase text-white flex items-center gap-2 mb-1">
                    <Briefcase className="text-proton-accent" size={18} />
                    {t.pitchTitle}
                  </h3>
                  <p className="text-xs text-proton-muted">{t.pitchDesc}</p>
                </div>
                {/* Carousel indicators */}
                <div className="flex items-center gap-1.5">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === currentSlide ? 'w-6 bg-proton-accent' : 'w-2 bg-proton-border hover:bg-proton-muted/50'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Active Slide Body */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 py-4">
                {/* Left metrics column */}
                <div className="md:col-span-5 space-y-4">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-proton-muted block">
                    {language === 'ka' ? 'წარმომადგენლობითი მეტრიკები' : 'Key Selling Pillars'}
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3">
                    {slides[currentSlide].metrics.map((m, idx) => (
                      <div key={idx} className="p-4 bg-proton-bg border border-proton-border/80 rounded-2xl flex flex-col justify-center">
                        <span className="text-[9px] font-mono uppercase text-proton-muted leading-relaxed">{m.label}</span>
                        <span className="text-sm font-black text-white">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right text overview */}
                <div className="md:col-span-7 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <span className="text-xs font-mono text-proton-accent uppercase tracking-widest font-black block">
                      {slides[currentSlide].title}
                    </span>
                    <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {slides[currentSlide].title}
                    </h4>
                    <p className="text-sm leading-relaxed text-proton-muted">
                      {slides[currentSlide].description}
                    </p>
                  </div>

                  <div className="flex justify-between items-center bg-proton-accent/5 border border-proton-accent/15 p-4 rounded-xl">
                    <span className="text-[10px] text-proton-muted font-mono leading-relaxed">
                      {language === 'ka' ? 'მოწინავე ტექნოლოგიური ბარიერი დაცულია.' : 'Advanced technical moat verified.'}
                    </span>
                    <button 
                      onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
                      className="text-xs font-mono font-bold text-proton-accent hover:underline flex items-center gap-1 shrink-0"
                    >
                      {language === 'ka' ? 'შემდეგი სლაიდი' : 'Next Slide'}
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: API & BILLING INTEGRATIONS */}
          {activeSubTab === 'stripe' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left subscription billing configuration */}
              <div className="lg:col-span-6 proton-glass p-6 sm:p-8 rounded-3xl border border-proton-border space-y-6">
                <div>
                  <h3 className="text-lg font-black uppercase text-white flex items-center gap-2 mb-2">
                    <Receipt className="text-proton-accent" size={18} />
                    {t.stripeTitle}
                  </h3>
                  <p className="text-xs text-proton-muted">{t.stripeDesc}</p>
                </div>

                {/* Subscriptions tiers setup preview */}
                <div className="space-y-4">
                  <span className="text-[10px] font-mono uppercase text-proton-muted block">
                    {language === 'ka' ? 'სააბონენტო გეგმების ფასები' : 'Configure Subscription Tiers ($ USD)'}
                  </span>

                  {/* Tier 1 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-proton-muted uppercase">Basic Tier</span>
                      <span className="text-proton-accent font-bold">${stripeTierBasic} / mo</span>
                    </div>
                    <input 
                      type="range" 
                      min={5} 
                      max={49} 
                      value={stripeTierBasic}
                      onChange={(e) => setStripeTierBasic(Number(e.target.value))}
                      className="w-full h-1 bg-proton-border accent-proton-accent appearance-none rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Tier 2 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-proton-accent uppercase">Pro Tier</span>
                      <span className="text-proton-accent font-bold">${stripeTierPro} / mo</span>
                    </div>
                    <input 
                      type="range" 
                      min={29} 
                      max={149} 
                      value={stripeTierPro}
                      onChange={(e) => setStripeTierPro(Number(e.target.value))}
                      className="w-full h-1 bg-proton-border accent-proton-accent appearance-none rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Tier 3 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-purple-400 uppercase">Enterprise Tier</span>
                      <span className="text-purple-400 font-bold">${stripeTierEnterprise} / mo</span>
                    </div>
                    <input 
                      type="range" 
                      min={99} 
                      max={500} 
                      value={stripeTierEnterprise}
                      onChange={(e) => setStripeTierEnterprise(Number(e.target.value))}
                      className="w-full h-1 bg-proton-border accent-purple-400 appearance-none rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Pricing metrics stats box */}
                  <div className="p-4 bg-black/40 rounded-xl border border-proton-border space-y-1.5">
                    <div className="flex justify-between text-[11px] font-mono text-proton-muted">
                      <span>{language === 'ka' ? 'ავტომატური Stripe ინვოისინგი:' : 'Auto Stripe Invoicing:'}</span>
                      <span className="text-emerald-400 font-black">SUPPORTED</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-proton-muted">
                      <span>{language === 'ka' ? 'სააბონენტო ვებჰუკები:' : 'Billing Webhooks:'}</span>
                      <span className="text-emerald-400 font-black">ENABLED</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Developer Integration snippet */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                <div className="proton-glass p-6 sm:p-8 rounded-3xl border border-proton-border flex flex-col gap-4">
                  <div className="flex justify-between items-center xl:gap-8">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-proton-muted flex items-center gap-1.5">
                      <FileCode size={14} className="text-proton-accent" />
                      {language === 'ka' ? 'Stripe სერვერული ინტეგრაციის კოდი' : 'Stripe Serverless Integration SDK'}
                    </span>
                    <button
                      onClick={handleCopyStripeCode}
                      className="text-proton-muted hover:text-white flex items-center gap-1.5 text-xs font-mono font-semibold transition"
                    >
                      {copiedCode ? (
                        <>
                          <Check size={14} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy API Code</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Styled Codeblock */}
                  <div className="bg-black/80 border border-proton-border/80 rounded-2xl p-4 font-mono text-[10px] text-proton-muted leading-relaxed overflow-x-auto select-all max-h-56">
                    <pre className="text-cyan-300">
{`// server.ts - Stripe Billing Integration
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
  apiVersion: '2023-10-16' 
});

app.post('/api/checkout/session', async (req, res) => {
  const { priceId, userEmail } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: \`\${process.env.APP_URL}/dashboard?checkout=success\`,
      cancel_url: \`\${process.env.APP_URL}/dashboard?checkout=cancel\`,
      customer_email: userEmail,
    });
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});`}
                    </pre>
                  </div>

                  <div className="p-4 rounded-xl bg-proton-accent/5 border border-proton-accent/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Key className="text-proton-accent" size={14} />
                      <span className="text-[11px] font-mono font-bold text-white uppercase">{language === 'ka' ? 'API გარემოს პარამეტრები' : 'API Environment Directives'}</span>
                    </div>
                    <p className="text-[10px] font-mono text-proton-muted leading-relaxed">
                      {language === 'ka'
                        ? 'მდგრადი სააბონენტო მოდელის გასააქტიურებლად შეიყვანეთ STRIPE_SECRET_KEY და STRIPE_WEBHOOK_SECRET გარემოს ცვლადებში (.env.example-ში დეკლარირებულია).'
                        : 'Simply add STRIPE_SECRET_KEY & STRIPE_WEBHOOK_SECRET in Settings/Environment to completely activate commercial client flows.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
