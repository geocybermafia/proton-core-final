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
  Bookmark,
  Store,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { chatWithPersona } from '../lib/gemini';
import { Persona } from '../types';
import { useToast } from './Toast';
import { useSeller } from '../contexts/SellerContext';
import { safeStorage } from '../lib/safeStorage';

export interface CreativeAdDraft {
  id: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  brandName: string;
  createdAt: number;
  exportedAt?: number;
  exportedListingId?: string;
  dismissed?: boolean;
}

function stripMarkdownCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed
    .replace(/^```(?:json|JSON)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function escapeControlCharsInJsonStrings(jsonStr: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      result += ch;
      if (inString) {
        escaped = true;
      }
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') {
        result += '\\n';
      } else if (ch === '\r') {
        result += '\\r';
      } else if (ch === '\t') {
        result += '\\t';
      } else if (ch.charCodeAt(0) < 0x20) {
        continue;
      } else {
        result += ch;
      }
    } else {
      result += ch;
    }
  }

  return result.replace(/,\s*([}\]])/g, '$1');
}

function normalizeAdCopyField(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAdCopyField(item)).filter(Boolean).join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.values(value)
      .map((val) => normalizeAdCopyField(val))
      .filter(Boolean)
      .join('\n');
  }
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function extractAdCopyFieldsByKey(text: string): { hook?: string; body?: string; cta?: string } | null {
  const keys = ['hook', 'body', 'cta'] as const;
  const positions: { key: typeof keys[number]; keyStart: number; valueStart: number }[] = [];

  for (const key of keys) {
    const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']`, 'i');
    const match = regex.exec(text);
    if (match) {
      positions.push({
        key,
        keyStart: match.index,
        valueStart: match.index + match[0].length,
      });
    }
  }

  if (positions.length === 0) return null;
  positions.sort((a, b) => a.keyStart - b.keyStart);

  const extracted: { hook?: string; body?: string; cta?: string } = {};
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    const closingBrace = text.lastIndexOf('}');
    const sliceEnd = next ? next.keyStart : (closingBrace > current.valueStart ? closingBrace : text.length);
    let rawVal = text.slice(current.valueStart, sliceEnd).trim();
    rawVal = rawVal.replace(/,\s*$/, '').replace(/["']\s*$/, '').trim();
    rawVal = rawVal
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, '  ')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    if (rawVal) {
      extracted[current.key] = rawVal;
    }
  }

  return extracted.hook || extracted.body || extracted.cta ? extracted : null;
}

function parseAdCopyResponse(
  rawText: string,
  brandName: string,
  isKa: boolean
): { hook: string; body: string; cta: string; parsedFromJson: boolean } {
  const withoutFences = stripMarkdownCodeFences(rawText);
  const firstBrace = withoutFences.indexOf('{');
  const lastBrace = withoutFences.lastIndexOf('}');
  const jsonCandidate =
    firstBrace !== -1 && lastBrace > firstBrace
      ? withoutFences.substring(firstBrace, lastBrace + 1)
      : withoutFences;

  const tryParse = (candidate: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore and try next parser
    }
    return null;
  };

  const parsedObj =
    tryParse(jsonCandidate) ||
    tryParse(escapeControlCharsInJsonStrings(jsonCandidate));

  if (parsedObj) {
    let hook = normalizeAdCopyField(parsedObj.hook ?? parsedObj.headline ?? parsedObj.title);
    let body = normalizeAdCopyField(parsedObj.body ?? parsedObj.copy ?? parsedObj.description ?? parsedObj.text);
    let cta = normalizeAdCopyField(parsedObj.cta ?? parsedObj.callToAction ?? parsedObj.hashtags);

    // Handle rare double-encoded JSON inside body
    if (body && (body.startsWith('{') || body.includes('```json'))) {
      const nested = parseAdCopyResponse(body, brandName, isKa);
      if (nested.parsedFromJson) {
        hook = hook || nested.hook;
        body = nested.body;
        cta = cta || nested.cta;
      }
    }

    if (hook || body || cta) {
      return {
        hook: hook || `${brandName || 'Ad'} - ${isKa ? 'ახალი შეთავაზება' : 'Special Offer'}`,
        body: body || withoutFences,
        cta: cta || '',
        parsedFromJson: true,
      };
    }
  }

  const keyExtracted = extractAdCopyFieldsByKey(jsonCandidate);
  if (keyExtracted && (keyExtracted.hook || keyExtracted.body || keyExtracted.cta)) {
    return {
      hook: keyExtracted.hook || `${brandName || 'Ad'} - ${isKa ? 'ახალი შეთავაზება' : 'Special Offer'}`,
      body: keyExtracted.body || withoutFences,
      cta: keyExtracted.cta || '',
      parsedFromJson: true,
    };
  }

  return {
    hook: `${brandName || 'Ad'} - ${isKa ? 'ახალი შეთავაზება' : 'Special Offer'}`,
    body: withoutFences,
    cta: '',
    parsedFromJson: false,
  };
}

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
        ? 'პროფესიონალური სარეკლამო ტექსტების, ლოზუნგებისა და პოსტების გენერაცია მორგებული ტონით, პლატფორმებითა და სოციალური მედიის მაკეტებით.'
        : 'Generate persuasive marketing copy, slogans, and social media captions with customizable tones, platforms, and interactive previews.',
      icon: FileText,
      color: 'purple',
      badge: isKa ? 'ახალი' : 'New Tool',
      action: () => {
        setActiveView('copywriting');
      }
    }
  ];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      {/* Top Welcome / Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-proton-border bg-gradient-to-br from-proton-card to-proton-bg p-8 md:p-12 shadow-xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-gradient-to-br from-proton-accent/20 to-purple-500/5 blur-3xl opacity-60 pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-proton-accent/10 border border-proton-accent/20 rounded-full text-[10px] font-black uppercase tracking-widest text-proton-accent">
            <Sparkles size={12} />
            {isKa ? 'კრეატიული სტუდია' : 'CREATIVE STUDIO'}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-proton-text">
            {isKa ? 'გამოავლინეთ თქვენი შემოქმედებითი პოტენციალი' : 'Unleash Your Creative Power'}
          </h1>
          <p className="text-proton-muted text-base font-medium leading-relaxed">
            {isKa 
              ? 'გამოიყენეთ პროტონის მოწინავე ხელოვნური ინტელექტი ილუსტრაციების შესაქმნელად, მყისიერი ორენოვანი თარგმანისთვის ან გაყიდვებზე ორიენტირებული სარეკლამო ტექსტების დასაწერად.'
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
                "group relative p-4 sm:p-6 md:p-8 rounded-xl border border-proton-border bg-gradient-to-b from-proton-card/50 to-proton-bg hover:bg-proton-card/80 cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm",
                "hover:shadow-lg hover:-translate-y-1",
                card.color === 'cyan' && 'hover:border-proton-accent/40',
                card.color === 'amber' && 'hover:border-amber-500/40',
                card.color === 'purple' && 'hover:border-purple-400/40'
              )}
            >
              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "p-3.5 rounded-lg bg-proton-bg border border-proton-border transition-transform group-hover:scale-110 duration-300",
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

export const CopywritingView: React.FC<{ 
  language: 'en' | 'ka'; 
  onBack: () => void; 
  checkAndIncrementAiQuota: () => Promise<boolean>;
  setActiveView?: (view: any) => void;
  setUiMode?: (mode: any, view?: any) => void;
}> = ({ 
  language, 
  onBack,
  checkAndIncrementAiQuota,
  setActiveView,
  setUiMode
}) => {
  const isKa = language === 'ka';
  const { showToast } = useToast();
  const { createDraftListing } = useSeller();

  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('facebook');
  const [tone, setTone] = useState('creative');
  const [targetLang, setTargetLang] = useState('both');
  const [loading, setLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [exportingDraft, setExportingDraft] = useState(false);
  const [lastCreatedListingId, setLastCreatedListingId] = useState<string | null>(null);

  // Result state - restored from safeStorage if an unexported ad copy exists
  const [result, setResult] = useState<{ hook: string; body: string; cta: string } | null>(() => {
    try {
      const stored = safeStorage.getJSON<CreativeAdDraft | null>('proton_creative_ad_draft', null);
      if (stored && !stored.exportedAt && stored.hook && stored.body) {
        if (stored.body.trim().startsWith('{') || stored.body.includes('```')) {
          const reparsed = parseAdCopyResponse(stored.body, stored.brandName || '', isKa);
          if (reparsed.parsedFromJson) {
            return { hook: reparsed.hook, body: reparsed.body, cta: reparsed.cta };
          }
        }
        return { hook: stored.hook, body: stored.body, cta: stored.cta || '' };
      }
    } catch {
      // Ignore parse failure
    }
    return null;
  });
  const [showAllHashtags, setShowAllHashtags] = useState(false);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleExportToMarket = async () => {
    if (!result) return;
    setExportingDraft(true);
    try {
      const title = result.hook || `${brandName || 'Proton'} - Ad Copy`;
      const fullDesc = [result.body, result.cta].filter(Boolean).join('\n\n');
      const newListing = await createDraftListing({
        title,
        description: fullDesc,
        status: 'draft',
        price: 0,
        category: 'Marketing & Copywriting',
        listingType: 'service'
      });
      setLastCreatedListingId(newListing.id);

      // Record export in safeStorage so Opportunity #2 ceases to qualify
      try {
        const stored = safeStorage.getJSON<CreativeAdDraft | null>('proton_creative_ad_draft', null);
        if (stored) {
          safeStorage.set('proton_creative_ad_draft', JSON.stringify({
            ...stored,
            exportedAt: Date.now(),
            exportedListingId: newListing?.id || undefined
          }));
          window.dispatchEvent(new CustomEvent('proton-creative-ad-updated'));
        }
      } catch (storageErr) {
        console.warn("[CopywritingView] Failed to record export in safeStorage:", storageErr);
      }

      showToast(
        isKa ? 'მონახაზი წარმატებით შეიქმნა მარკეტის მართვის ცენტრში!' : 'Draft listing created in Seller Control Center',
        'success'
      );
    } catch (err) {
      console.error("Failed to export listing draft:", err);
      showToast(isKa ? 'შეცდომა მონახაზის შექმნისას' : 'Failed to create listing draft', 'error');
    } finally {
      setExportingDraft(false);
    }
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
      const languageGuidance =
        targetLang === 'ka'
          ? `LANGUAGE REQUIREMENT (GEORGIAN ONLY):
- Write 100% of the ad copy ("hook", "body", and "cta") in natural, idiomatic, contemporary Georgian (Mkhedruli script).
- Think and compose directly in Georgian like a senior creative copywriter in Tbilisi — NEVER translate word-for-word from English or use awkward English-to-Georgian calques.
- Use authentic Georgian phrasing, persuasive rhythm, natural Georgian word order, and locally resonant hashtags.`
          : targetLang === 'both'
          ? `LANGUAGE REQUIREMENT (BILINGUAL — ENGLISH + GEORGIAN):
- Include BOTH English and Georgian in each JSON field ("hook", "body", and "cta"), separated clearly by a blank line (\\n\\n).
- Write the English version first, then write an independently crafted, culturally adapted, natural, idiomatic Georgian (Mkhedruli) version for a Georgian audience.
- CRITICAL: NEVER perform a literal word-for-word translation from English into Georgian. Adapt idioms, tone, and phrasing so the Georgian reads naturally as native marketing copy.`
          : `LANGUAGE REQUIREMENT (ENGLISH ONLY):
- Write 100% of the ad copy ("hook", "body", and "cta") in crisp, persuasive, native-level English.`;

      const copywritingPersona: Persona = {
        id: 'copywriter',
        name: 'Creative Copywriter',
        nameGe: 'სარეკლამო კოპირაიტერი',
        role: 'Advertising & Marketing Specialist',
        description: 'AI Copywriter',
        descriptionGe: 'AI კოპირაიტერი',
        avatar: '✍️',
        language: targetLang === 'en' ? 'English' : targetLang === 'ka' ? 'Georgian' : 'Mixed',
        systemInstruction: `You are an elite digital advertising copywriter and brand strategist specializing in both English and Georgian (Mkhedruli) markets.
Your goal is to generate high-converting, emotionally resonant, platform-tailored ad copy, headlines, and calls-to-action.

${languageGuidance}

STRICT JSON OUTPUT REQUIREMENTS:
Respond ONLY with a single valid raw JSON object matching this exact schema:
{
  "hook": "Punchy hook, headline, or slogan",
  "body": "Engaging description with bullet points and appropriate emojis",
  "cta": "Clear call to action and suggested hashtags"
}
- Output MUST be strictly valid JSON.
- Escape every newline inside JSON string values as \\n (never emit raw literal newlines inside string values).
- Escape any double quotes inside string values as \\".
- Do NOT include any introduction, conversational text, or markdown code fences (\`\`\`json or \`\`\`) before or after the JSON.`
      };

      const promptMessage = `Please generate ad copy for:
Brand Name: ${brandName.trim()}
Product/Service Details: ${description.trim()}
Target Platform: ${platform.toUpperCase()}
Tone of Voice: ${tone.toUpperCase()}
Requested Language: ${targetLang === 'both' ? 'Bilingual (English + natural, idiomatic Georgian copy adapted natively — not a literal translation)' : targetLang === 'ka' ? 'Purely Georgian (natural, idiomatic Georgian marketing copy)' : 'Purely English'}

Return strictly valid JSON matching { "hook": "...", "body": "...", "cta": "..." }.`;

      const aiResponse = await chatWithPersona(
        copywritingPersona,
        promptMessage,
        [],
        'gemini-3.5-flash',
        false,
        false,
        0.85,
        undefined,
        language
      );

      const parsedCopy = parseAdCopyResponse(aiResponse.text, brandName.trim(), isKa);
      const finalHook = parsedCopy.hook;
      const finalBody = parsedCopy.body;
      const finalCta = parsedCopy.cta;

      setResult({
        hook: finalHook,
        body: finalBody,
        cta: finalCta
      });

      // Persist generated ad copy in safeStorage (Opportunity #2 active state)
      try {
        const newRecord: CreativeAdDraft = {
          id: `ad-copy-${Date.now()}`,
          title: finalHook,
          hook: finalHook,
          body: finalBody,
          cta: finalCta,
          brandName: brandName.trim(),
          createdAt: Date.now()
        };
        safeStorage.set('proton_creative_ad_draft', JSON.stringify(newRecord));
        window.dispatchEvent(new CustomEvent('proton-creative-ad-updated'));
      } catch (storageErr) {
        console.warn("[CopywritingView] Failed to save creative ad draft to safeStorage:", storageErr);
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
              {isKa ? 'შექმენით გაყიდვებზე ორიენტირებული ტექსტები და სარეკლამო მასალები' : 'Generate persuasive, high-converting copy in seconds'}
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
              placeholder={isKa ? 'აღწერეთ რა არის თქვენი პროდუქტი, რა უპირატესობები აქვს ან რა აქციას სთავაზობთ მომხმარებელს...' : 'Describe what you offer, its key advantages, or specific special discounts...'}
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
                {isKa ? 'სარეკლამო ტექსტის გენერაცია' : 'Generate Ad Copies'}
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
                <div className="flex justify-between items-center pb-4 border-b border-proton-border/50 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-proton-text">
                      {isKa ? 'გენერირებული ასლი' : 'GENERATED COPY SUCCESS'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleExportToMarket}
                      disabled={exportingDraft}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold text-xs hover:bg-purple-500 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                      title={isKa ? 'ექსპორტი მარკეტზე (მონახაზის შექმნა)' : 'Export to Market as Listing Draft'}
                    >
                      {exportingDraft ? <Loader2 size={13} className="animate-spin" /> : <Store size={13} />}
                      <span>{isKa ? 'ექსპორტი მარკეტზე' : 'Export to Market'}</span>
                    </button>
                    {lastCreatedListingId && (
                      <button
                        onClick={() => {
                          if (setUiMode) setUiMode('market', 'market-hub');
                          if (setActiveView) setActiveView('market-hub');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer animate-in fade-in slide-in-from-right-2"
                        title={isKa ? 'გადასვლა მარკეტის მართვის ცენტრში' : 'View in Market Control Center'}
                      >
                        <ShoppingBag size={13} />
                        <span>{isKa ? 'ნახვა მარკეტზე →' : 'View in Market →'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Section 1: Hook */}
                <div className="bg-proton-bg/80 p-4 rounded-2xl border border-proton-border/80 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                      {isKa ? 'სათაური / ჰუკი' : 'HEADLINE / HOOK'}
                    </span>
                    <button
                      onClick={() => handleCopy(result.hook, 'hook')}
                      className="text-[10px] font-black text-proton-accent uppercase tracking-widest hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSection === 'hook' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      {copiedSection === 'hook' ? (isKa ? 'კოპირებულია!' : 'Copied!') : (isKa ? 'კოპირება' : 'Copy')}
                    </button>
                  </div>
                  <div className="text-sm font-bold text-proton-text whitespace-pre-wrap leading-snug">
                    {result.hook}
                  </div>
                </div>

                {/* Section 2: Body */}
                <div className="bg-proton-bg/80 p-4 rounded-2xl border border-proton-border/80 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                      {isKa ? 'სარეკლამო ტექსტი' : 'PRIMARY AD COPY'}
                    </span>
                    <button
                      onClick={() => handleCopy(result.body, 'body')}
                      className="text-[10px] font-black text-proton-accent uppercase tracking-widest hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSection === 'body' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      {copiedSection === 'body' ? (isKa ? 'კოპირებულია!' : 'Copied!') : (isKa ? 'კოპირება' : 'Copy')}
                    </button>
                  </div>
                  <div className="text-xs leading-relaxed text-proton-text/90 whitespace-pre-wrap font-medium">
                    {result.body}
                  </div>
                </div>

                {/* Section 3: CTA */}
                {result.cta && (
                  <div className="bg-proton-bg/80 p-4 rounded-2xl border border-proton-border/80 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                        {isKa ? 'მოწოდება მოქმედებისკენ & ჰეშთეგები' : 'CTA & HASHTAGS'}
                      </span>
                      <button
                        onClick={() => handleCopy(result.cta, 'cta')}
                        className="text-[10px] font-black text-proton-accent uppercase tracking-widest hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSection === 'cta' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                        {copiedSection === 'cta' ? (isKa ? 'კოპირებულია!' : 'Copied!') : (isKa ? 'კოპირება' : 'Copy')}
                      </button>
                    </div>
                    <div className="text-xs font-medium text-purple-300 break-words [word-break:break-word] whitespace-pre-wrap leading-relaxed">
                      {result.cta}
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Mockup Social Card */}
              <div className="bg-[#0f1423] p-5 sm:p-6 rounded-3xl border border-white/5 space-y-4 shadow-xl min-h-[380px] sm:min-h-[420px] flex flex-col justify-between w-full overflow-hidden transition-all">
                <div className="flex justify-between items-center border-b border-white/5 pb-3 shrink-0">
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
                  <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5 font-sans break-words [word-break:break-word] max-h-64 overflow-y-auto">
                    <div className="text-[11px] text-[#8ab4f8] flex items-center gap-1">
                      <span>Sponsored • www.{brandName.toLowerCase().replace(/\s+/g, '')}.com</span>
                    </div>
                    <h4 className="text-lg font-medium text-[#c58af9] hover:underline cursor-pointer leading-tight break-words">
                      {result.hook}
                    </h4>
                    <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-3 break-words">
                      {result.body.substring(0, 160)}... {result.cta}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 space-y-4 font-sans flex flex-col justify-between min-h-0">
                    {/* Mock Profile */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {brandName.substring(0, 2).toUpperCase() || 'AD'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white tracking-wide truncate">{brandName || 'Brand Name'}</h4>
                        <p className="text-[9px] text-white/40">Sponsored • Just now</p>
                      </div>
                    </div>

                    {/* Post Text Container: Step 1 (Max height + scroll), Step 2 (Word break defense), Step 3 (Hashtag drawer) */}
                    <div className="max-h-64 sm:max-h-72 overflow-y-auto pr-2 space-y-3 font-sans break-words [word-break:break-word] whitespace-pre-wrap scrollbar-thin scrollbar-thumb-white/10">
                      <p className="text-xs text-white/90 font-bold leading-snug break-words [word-break:break-word]">{result.hook}</p>
                      <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap break-words [word-break:break-word]">{result.body}</p>
                      
                      {/* Hashtag & CTA Drawer Block */}
                      {(() => {
                        const hashtagRegex = /(#[\w\u10A0-\u10FF\u1C90-\u1CBF_-]+)/g;
                        const matches = result.cta.match(hashtagRegex) || [];

                        if (matches.length <= 10) {
                          return (
                            <p className="text-xs text-purple-400 font-mono break-words [word-break:break-word] whitespace-pre-wrap leading-relaxed pt-1">
                              {result.cta}
                            </p>
                          );
                        }

                        const nonHashtagText = result.cta.replace(hashtagRegex, '').trim();
                        const visibleTags = showAllHashtags ? matches : matches.slice(0, 10);

                        return (
                          <div className="space-y-2 pt-2 border-t border-white/5">
                            <div className="text-xs text-purple-400 font-mono break-words [word-break:break-word] whitespace-pre-wrap leading-relaxed flex flex-wrap gap-1">
                              {nonHashtagText && (
                                <span className="text-white/80 font-sans font-medium block w-full mb-1">
                                  {nonHashtagText}
                                </span>
                              )}
                              {visibleTags.map((tag, idx) => (
                                <span key={idx} className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 transition-all inline-block text-[11px]">
                                  {tag}
                                </span>
                              ))}
                              {!showAllHashtags && (
                                <span className="text-white/40 font-sans text-[11px] self-center">...</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowAllHashtags(!showAllHashtags)}
                              className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1 rounded-full border border-purple-500/20 transition-all cursor-pointer"
                            >
                              {showAllHashtags ? (
                                <span>{isKa ? '▲ შეკეცვა' : '▲ Show less'}</span>
                              ) : (
                                <span>{isKa ? `▼ ყველა ჰეშთეგის გამოჩენა (${matches.length})` : `▼ Show all hashtags (${matches.length})`}</span>
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Interactive buttons */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-3 text-white/40 text-xs shrink-0 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <button className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                          <Bookmark size={14} />
                          <span>Save Ad</span>
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                          <Share2 size={14} />
                          <span>Share</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={handleExportToMarket}
                          disabled={exportingDraft}
                          className="flex items-center gap-1.5 text-purple-300 font-bold hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {exportingDraft ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
                          <span>{isKa ? 'ექსპორტი მარკეტზე' : 'Export to Market'}</span>
                        </button>
                        <button 
                          onClick={() => handleCopy([result.hook, result.body, result.cta].filter(Boolean).join('\n\n'), 'all')}
                          className="flex items-center gap-1.5 text-purple-400 font-bold hover:text-purple-300 transition-colors cursor-pointer"
                        >
                          <Copy size={14} />
                          <span>Copy Entire Ad</span>
                        </button>
                      </div>
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
                  ? 'შეიყვანეთ ბრენდის სახელი და სასურველი პროდუქტის აღწერა მარცხნივ, რათა მიიღოთ პროფესიონალური სარეკლამო ტექსტები.'
                  : 'Enter your brand details and product description on the left parameters drawer to let AI render optimized social copy and visual previews.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
