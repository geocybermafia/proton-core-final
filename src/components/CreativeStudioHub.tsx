import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Languages, 
  FileText, 
  ArrowLeft, 
  Copy, 
  Check, 
  Loader2, 
  Send,
  Zap,
  Volume2,
  Share2,
  Bookmark
} from 'lucide-react';
import { cn } from '../lib/utils';
import { chatWithPersona } from '../lib/gemini';
import { Persona } from '../types';
import { useToast } from './Toast';

interface CreativeStudioHubProps {
  language: 'en' | 'ka';
  setActiveView: (view: any) => void;
  setUiMode: (mode: any, view?: any) => void;
}

export const CreativeStudioHub: React.FC<CreativeStudioHubProps> = ({ 
  language, 
  setActiveView,
  setUiMode
}) => {
  const isKa = language === 'ka';

  const cards = [
    {
      id: 'image',
      title: isKa ? 'სურათების გენერატორი' : 'Image Generator',
      subtitle: isKa ? 'ვიზუალური სტუდია' : 'Visual Art Studio',
      desc: isKa 
        ? 'მაღალი ხარისხის ილუსტრაციების, გრაფიკისა და დიზაინის გენერაცია AI ასპექტის ფორმატებით, სტილებითა და გაუმჯობესების ხელსაწყოებით.'
        : 'Generate high-quality illustrations, graphics, and art with custom aspect ratios, style presets, and magic prompt enhancers.',
      icon: ImageIcon,
      color: 'cyan',
      bgGlow: 'from-cyan-500/20 to-blue-500/10 hover:border-cyan-500/40 shadow-cyan-500/5',
      badge: isKa ? 'ახალი ფუნქციები' : 'Enhanced',
      action: () => {
        setActiveView('image');
      }
    },
    {
      id: 'translator',
      title: isKa ? 'ორენოვანი მთარგმნელი' : 'Bilingual Translator',
      subtitle: isKa ? 'სათარჯიმნო კაბინეტი' : 'Translation Cabinet',
      desc: isKa 
        ? 'ხმოვანი და ტექსტური სინქრონული თარგმანი ინგლისურ და ქართულ ენებს შორის, ინტეგრირებული ადგილობრივი ხელოსნობის გლოსარიუმით.'
        : 'Real-time face-to-face vocal and text translation between English and Georgian with built-in creative industry glossary terms.',
      icon: Languages,
      color: 'amber',
      bgGlow: 'from-amber-500/20 to-orange-500/10 hover:border-amber-500/40 shadow-amber-500/5',
      badge: isKa ? 'სინქრონული ხმა' : 'Real-Time Voice',
      action: () => {
        setActiveView('translator');
      }
    },
    {
      id: 'copywriting',
      title: isKa ? 'სარეკლამო კოპირაიტინგი' : 'Advertising Copywriting',
      subtitle: isKa ? 'მარკეტინგული გენერატორი' : 'Marketing Ad Writer',
      desc: isKa 
        ? 'პროფესიონალური სარეკლამო ასლების, ლოზუნგებისა და პოსტების გენერაცია მორგებული ტონით, პლატფორმებითა და სოციალური მედიის მოკაპებით.'
        : 'Generate persuasive marketing copy, slogans, and social media captions with customizable tones, platforms, and interactive previews.',
      icon: FileText,
      color: 'purple',
      bgGlow: 'from-purple-500/20 to-pink-500/10 hover:border-purple-500/40 shadow-purple-500/5',
      badge: isKa ? 'ახალი' : 'New Tool',
      action: () => {
        setActiveView('copywriting');
      }
    }
  ];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      {/* Top Welcome / Banner */}
      <div className="relative overflow-hidden rounded-[32px] border border-proton-border bg-gradient-to-br from-proton-card to-proton-bg p-8 md:p-12 shadow-xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-gradient-to-br from-proton-accent/20 to-purple-500/5 blur-3xl opacity-60 pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-proton-accent/10 border border-proton-accent/20 rounded-full text-[10px] font-black uppercase tracking-widest text-proton-accent">
            <Sparkles size={12} />
            {isKa ? 'კრეატიული სტუდია' : 'CREATIVE STUDIO HUB'}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-proton-text">
            {isKa ? 'გამოავლინე შენი შემოქმედებითი პოტენციალი' : 'Unleash Your Creative Power'}
          </h1>
          <p className="text-proton-muted text-base font-medium leading-relaxed">
            {isKa 
              ? 'გამოიყენე პროტონის მოწინავე ხელოვნური ინტელექტი ილუსტრაციების შესაქმნელად, მყისიერი ორენოვანი თარგმანისთვის ან გაყიდვების გამზომი სარეკლამო კამპანიების დასაწერად.'
              : 'Utilize advanced Proton computing systems to render custom graphics, perform synchronous speech translation, or generate highly engaging marketing content.'}
          </p>
        </div>
      </div>

      {/* Grid of Tools */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-proton-muted">
            {isKa ? 'ხელმისაწვდომი კრეატიული ინსტრუმენტები' : 'AVAILABLE CREATIVE SUITES'}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, idx) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              onClick={card.action}
              className={cn(
                "group relative p-6 md:p-8 rounded-[32px] border border-proton-border bg-gradient-to-b from-proton-card/50 to-proton-bg hover:bg-proton-card/80 cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm",
                "hover:shadow-lg hover:-translate-y-1"
              )}
            >
              {/* Card background glow */}
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none", card.bgGlow)} />

              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "p-4 rounded-2xl bg-proton-bg border border-proton-border transition-transform group-hover:scale-110 duration-300",
                    card.color === 'cyan' && 'text-proton-accent group-hover:border-proton-accent/40',
                    card.color === 'amber' && 'text-amber-500 group-hover:border-amber-500/40',
                    card.color === 'purple' && 'text-purple-400 group-hover:border-purple-400/40'
                  )}>
                    <card.icon size={24} />
                  </div>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                    card.color === 'cyan' && 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                    card.color === 'amber' && 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                    card.color === 'purple' && 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  )}>
                    {card.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-proton-muted">
                    {card.subtitle}
                  </p>
                  <h3 className="text-xl font-bold tracking-tight text-proton-text group-hover:text-proton-accent transition-colors duration-300">
                    {card.title}
                  </h3>
                  <p className="text-xs text-proton-muted leading-relaxed font-medium">
                    {card.desc}
                  </p>
                </div>
              </div>

              <div className="pt-6 relative z-10 flex items-center justify-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-proton-accent group-hover:underline flex items-center gap-1.5">
                  {isKa ? 'გახსნა' : 'Launch Tool'}
                  <span className="transition-transform group-hover:translate-x-1 duration-300">→</span>
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const CopywritingView: React.FC<{ language: 'en' | 'ka'; onBack: () => void; checkAndIncrementAiQuota: () => Promise<boolean> }> = ({ 
  language, 
  onBack,
  checkAndIncrementAiQuota
}) => {
  const isKa = language === 'ka';
  const { showToast } = useToast();

  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('facebook');
  const [tone, setTone] = useState('creative');
  const [targetLang, setTargetLang] = useState('both');
  const [loading, setLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<{ hook: string; body: string; cta: string } | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleGenerate = async () => {
    if (!brandName.trim() || !description.trim()) {
      showToast(isKa ? 'გთხოვთ შეავსოთ ბრენდის სახელი და აღწერა' : 'Please fill in both the brand name and description', 'warning');
      return;
    }

    const permitted = await checkAndIncrementAiQuota();
    if (!permitted) return;

    setLoading(true);
    try {
      const copywritingPersona: Persona = {
        id: 'copywriter',
        name: 'Creative Copywriter',
        nameGe: 'სარეკლამო კოპირაიტერი',
        role: 'Advertising & Marketing Specialist',
        description: 'AI Copywriter',
        descriptionGe: 'AI კოპირაიტერი',
        avatar: '✍️',
        language: 'Mixed',
        systemInstruction: `You are an elite dual-language digital advertising copywriter and marketing strategist. 
Your goal is to generate exceptionally engaging, high-converting ad copy, captions, headlines, and calls-to-action.
You write in Georgian (using modern natural style), English, or both, as requested.
CRITICAL: Respond ONLY with a valid raw JSON object matching this structure:
{
  "hook": "Punchy hook, headline, or slogan",
  "body": "Engaging description with bullet points and appropriate emojis",
  "cta": "Clear call to action and suggested hashtags"
}
Do NOT include any introduction, conversational text, or markdown codeblocks before or after the JSON.`
      };

      const promptMessage = `Please generate ad copy for:
Brand Name: ${brandName}
Product/Service Details: ${description}
Target Platform: ${platform.toUpperCase()}
Tone of Voice: ${tone.toUpperCase()}
Requested Language: ${targetLang === 'both' ? 'Both English and Georgian (write English first, then Georgian translation clearly)' : targetLang === 'ka' ? 'Purely Georgian' : 'Purely English'}`;

      const aiResponse = await chatWithPersona(
        copywritingPersona,
        promptMessage,
        [],
        'gemini-3.5-flash',
        false,
        true,
        0.85,
        undefined,
        language
      );

      // Clean response text to ensure it's parseable JSON
      let cleanedText = aiResponse.text.trim();
      
      // Extract JSON substring if wrapped in markdown or extraneous text
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
      }

      try {
        const parsed = JSON.parse(cleanedText);
        setResult({
          hook: parsed.hook || 'Ad Copy Headline',
          body: parsed.body || 'Ad content was generated successfully.',
          cta: parsed.cta || '#marketing #leads'
        });
      } catch (parseError) {
        console.warn("Could not parse JSON directly, setting raw fallback", parseError);
        setResult({
          hook: `${brandName} - ${isKa ? 'ახალი შეთავაზება' : 'Special Offer'}`,
          body: aiResponse.text.trim(),
          cta: '#marketing #business'
        });
      }

    } catch (err) {
      console.error(err);
      showToast(isKa ? 'კოპირაიტინგის გენერაცია ვერ მოხერხდა. გთხოვთ სცადოთ მოგვიანებით.' : 'Ad generation node failure. Please try again later.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header with Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 rounded-xl border border-proton-border bg-proton-card hover:bg-proton-bg text-proton-text transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="text-purple-400" size={24} />
              {isKa ? 'სარეკლამო კოპირაიტინგი' : 'Ad Copywriting Studio'}
            </h2>
            <p className="text-proton-muted text-sm mt-1">
              {isKa ? 'შექმენი გაყიდვებზე ორიენტირებული ტექსტები და სარეკლამო ასლები' : 'Generate persuasive, high-converting copy in seconds'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Form Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6 bg-proton-card/30 p-6 rounded-3xl border border-proton-border">
          <h3 className="text-xs font-black uppercase tracking-widest text-proton-text flex items-center gap-1.5 pb-2 border-b border-proton-border/50">
            <Zap size={14} className="text-purple-400" />
            {isKa ? 'მარკეტინგის პარამეტრები' : 'AD PARAMETERS'}
          </h3>

          {/* Brand Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">
              {isKa ? 'ბრენდის / პროდუქტის სახელი' : 'BRAND / PRODUCT NAME'}
            </label>
            <input 
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={isKa ? 'მაგ: ფლიპა / Proton AI' : 'e.g. Proton AI'}
              className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-purple-400 transition-all text-sm shadow-inner"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">
              {isKa ? 'პროდუქტის აღწერა ან უპირატესობები' : 'PRODUCT DETAILS & ADVANTAGES'}
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isKa ? 'აღწერე რა არის შენი პროდუქტი, რა უპირატესობები აქვს ან რა აქციას სთავაზობ მომხმარებელს...' : 'Describe what you offer, its key advantages, or specific special discounts...'}
              className="w-full bg-proton-bg border border-proton-border rounded-xl px-4 py-3 focus:outline-none focus:border-purple-400 transition-all h-32 text-sm resize-none shadow-inner"
            />
          </div>

          {/* Platform & Tone Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">
                {isKa ? 'პლატფორმა' : 'PLATFORM'}
              </label>
              <select 
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-proton-bg border border-proton-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-400 transition-all text-xs cursor-pointer"
              >
                <option value="facebook">Facebook Post</option>
                <option value="instagram">Instagram Caption</option>
                <option value="linkedin">LinkedIn Update</option>
                <option value="google">Google Ads</option>
                <option value="tiktok">TikTok Video Hook</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">
                {isKa ? 'ტონი' : 'TONE OF VOICE'}
              </label>
              <select 
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-proton-bg border border-proton-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-400 transition-all text-xs cursor-pointer"
              >
                <option value="creative">{isKa ? 'კრეატიული' : 'Creative / Bold'}</option>
                <option value="professional">{isKa ? 'პროფესიონალური' : 'Professional'}</option>
                <option value="energetic">{isKa ? 'ენერგიული' : 'Energetic'}</option>
                <option value="elegant">{isKa ? 'ელეგანტური' : 'Elegant'}</option>
                <option value="friendly">{isKa ? 'მეგობრული' : 'Friendly'}</option>
              </select>
            </div>
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">
              {isKa ? 'სარეკლამო ენა' : 'AD LANGUAGE'}
            </label>
            <div className="grid grid-cols-3 gap-2 bg-proton-bg p-1 rounded-xl border border-proton-border">
              <button
                type="button"
                onClick={() => setTargetLang('both')}
                className={cn(
                  "py-2 text-[10px] font-bold rounded-lg transition-all",
                  targetLang === 'both' ? "bg-purple-500 text-white shadow-sm" : "text-proton-muted hover:text-proton-text"
                )}
              >
                {isKa ? 'ორენოვანი' : 'Both'}
              </button>
              <button
                type="button"
                onClick={() => setTargetLang('ka')}
                className={cn(
                  "py-2 text-[10px] font-bold rounded-lg transition-all",
                  targetLang === 'ka' ? "bg-purple-500 text-white shadow-sm" : "text-proton-muted hover:text-proton-text"
                )}
              >
                ქართული
              </button>
              <button
                type="button"
                onClick={() => setTargetLang('en')}
                className={cn(
                  "py-2 text-[10px] font-bold rounded-lg transition-all",
                  targetLang === 'en' ? "bg-purple-500 text-white shadow-sm" : "text-proton-muted hover:text-proton-text"
                )}
              >
                English
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-600 transition-all disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-purple-500/10 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {isKa ? 'კოპირაიტინგი იწერება...' : 'Generating Copies...'}
              </>
            ) : (
              <>
                <FileText size={18} />
                {isKa ? 'სარეკლამო ასლის გენერაცია' : 'Generate Ad Copies'}
              </>
            )}
          </button>
        </div>

        {/* Output Mockup Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {result ? (
            <div className="space-y-6">
              {/* Tool Output Container */}
              <div className="bg-proton-card p-6 rounded-3xl border border-proton-border space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-proton-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-proton-text">
                      {isKa ? 'გენერირებული ასლი' : 'GENERATED COPY SUCCESS'}
                    </span>
                  </div>
                </div>

                {/* Section 1: Hook */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">
                      {isKa ? 'სათაური / ჰუკი' : 'HEADLINE / HOOK'}
                    </span>
                    <button
                      onClick={() => handleCopy(result.hook, 'hook')}
                      className="text-[10px] font-black text-proton-accent uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      {copiedSection === 'hook' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      {copiedSection === 'hook' ? (isKa ? 'კოპირებულია!' : 'Copied!') : (isKa ? 'კოპირება' : 'Copy')}
                    </button>
                  </div>
                  <div className="bg-proton-bg p-4 rounded-xl border border-proton-border text-sm font-bold text-proton-text">
                    {result.hook}
                  </div>
                </div>

                {/* Section 2: Body */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">
                      {isKa ? 'სარეკლამო ტექსტი' : 'PRIMARY AD COPY'}
                    </span>
                    <button
                      onClick={() => handleCopy(result.body, 'body')}
                      className="text-[10px] font-black text-proton-accent uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      {copiedSection === 'body' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      {copiedSection === 'body' ? (isKa ? 'კოპირებულია!' : 'Copied!') : (isKa ? 'კოპირება' : 'Copy')}
                    </button>
                  </div>
                  <div className="bg-proton-bg p-4 rounded-xl border border-proton-border text-xs leading-relaxed text-proton-muted whitespace-pre-wrap font-medium">
                    {result.body}
                  </div>
                </div>

                {/* Section 3: CTA */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">
                      {isKa ? 'მოწოდება მოქმედებისკენ & ჰეშთეგები' : 'CTA & HASHTAGS'}
                    </span>
                    <button
                      onClick={() => handleCopy(result.cta, 'cta')}
                      className="text-[10px] font-black text-proton-accent uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      {copiedSection === 'cta' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      {copiedSection === 'cta' ? (isKa ? 'კოპირებულია!' : 'Copied!') : (isKa ? 'კოპირება' : 'Copy')}
                    </button>
                  </div>
                  <div className="bg-proton-bg p-4 rounded-xl border border-proton-border text-xs font-mono text-purple-400">
                    {result.cta}
                  </div>
                </div>
              </div>

              {/* Interactive Mockup Social Card */}
              <div className="bg-[#0f1423] p-6 rounded-3xl border border-white/5 space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    {platform === 'facebook' ? 'Facebook Mockup' : platform === 'instagram' ? 'Instagram Mockup' : platform === 'linkedin' ? 'LinkedIn Mockup' : platform === 'google' ? 'Google Search Mockup' : 'TikTok Mockup'}
                  </span>
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                </div>

                {platform === 'google' ? (
                  <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5 font-sans">
                    <div className="text-[11px] text-[#8ab4f8] flex items-center gap-1">
                      <span>Sponsored • www.${brandName.toLowerCase().replace(/\s+/g, '')}.com</span>
                    </div>
                    <h4 className="text-lg font-medium text-[#c58af9] hover:underline cursor-pointer leading-tight">
                      {result.hook}
                    </h4>
                    <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-3">
                      {result.body.substring(0, 160)}... {result.cta}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 font-sans">
                    {/* Mock Profile */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {brandName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white tracking-wide">{brandName}</h4>
                        <p className="text-[9px] text-white/40">Sponsored • Just now</p>
                      </div>
                    </div>

                    {/* Post Text */}
                    <div className="space-y-2">
                      <p className="text-xs text-white/90 font-bold leading-snug">{result.hook}</p>
                      <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">{result.body}</p>
                      <p className="text-xs text-purple-400 font-mono">{result.cta}</p>
                    </div>

                    {/* Interactive buttons */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-3 text-white/40 text-xs">
                      <button className="flex items-center gap-1.5 hover:text-white transition-colors">
                        <Bookmark size={14} />
                        <span>Save Ad</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-white transition-colors">
                        <Share2 size={14} />
                        <span>Share</span>
                      </button>
                      <button 
                        onClick={() => handleCopy(`${result.hook}\n\n${result.body}\n\n${result.cta}`, 'all')}
                        className="flex items-center gap-1.5 text-purple-400 font-bold hover:text-purple-300 transition-colors"
                      >
                        <Copy size={14} />
                        <span>Copy Entire Ad</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-proton-border/60 rounded-[32px] p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px] bg-proton-card/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl opacity-30 pointer-events-none" />
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 border border-purple-500/20">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-proton-text mb-1">
                {isKa ? 'სარეკლამო კამპანია ცარიელია' : 'Ad Studio Sandbox'}
              </h3>
              <p className="text-xs text-proton-muted max-w-sm font-medium leading-relaxed">
                {isKa 
                  ? 'შეიყვანე ბრენდის სახელი და სასურველი პროდუქტის აღწერა მარცხნივ, რათა მიიღო პროფესიონალური და კონვერტირებადი სარეკლამო ასლები.'
                  : 'Enter your brand details and product description on the left parameters drawer to let AI render optimized social copy and visual previews.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
