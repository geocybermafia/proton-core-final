import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  RotateCcw, 
  Settings, 
  ChevronDown, 
  Globe, 
  Wifi, 
  WifiOff,
  History,
  Languages,
  Info,
  ArrowLeft,
  Zap
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { cn } from '../lib/utils';

// --- Artisan Lexicon Grounding ---
const ARTISAN_LEXICON = {
  ka: [
    { term: "კაკლის ხე", en: "Walnut wood", desc: "High-quality wood used for traditional carving" },
    { term: "მოჭიქვა", en: "Glazing", desc: "The process of applying a glass-like coating to ceramics" },
    { term: "ჭედვა", en: "Chasing/Repoussé", desc: "Metalworking technique for creating relief designs" },
    { term: "გამოწვა", en: "Firing", desc: "The process of heating clay in a kiln to harden it" },
    { term: "თიხა", en: "Clay", desc: "The raw material for pottery" },
    { term: "ნაქარგობა", en: "Embroidery", desc: "Traditional Georgian needlework" },
    { term: "ფერწერა", en: "Painting", desc: "Artistic painting" },
    { term: "ხარჩო", en: "Kharcho", desc: "Traditional Georgian soup (often discussed in workshops)" },
    { term: "მარანი", en: "Wine cellar", desc: "Place where qvevri are kept" },
    { term: "ქვევრი", en: "Qvevri", desc: "Large clay vessel for wine" },
    { term: "ჩუქურთმა", en: "Ornamental carving", desc: "Traditional Georgian decorative pattern" },
    { term: "ჭიქა", en: "Glass/Cup", desc: "Drinking vessel" },
    { term: "დაზგა", en: "Looms/Workbench", desc: "Artisan's workspace or tool" },
    { term: "ხელით ნაკეთი", en: "Handmade", desc: "Indicates artisanal production" }
  ]
};

const SYSTEM_INSTRUCTION = `
You are a high-performance translation engine specialized for face-to-face communication between local Georgian artisans and tourists. 
Your goal is to provide seamless, culturally accurate translations.

Grounded Artisan Lexicon:
${ARTISAN_LEXICON.ka.map(i => `- ${i.term} (${i.en}): ${i.desc}`).join('\n')}

Guidelines:
1. Detect the language and context (Tourist vs. Artisan).
2. If Source is Artisan (Georgian), translate to English.
3. If Source is Tourist (English), translate to Georgian.
4. Use the Artisan Lexicon terms whenever contextually appropriate.
5. Keep translations concise and conversational.
6. If the input is ambiguous, provide the most likely cultural interpretation.
7. CRITICAL: Return ONLY the translated text. Do not provide any explanations, meta-talk, or original text.
`;

interface Message {
  id: string;
  text: string;
  translatedText: string;
  sender: 'top' | 'bottom'; // top is usually the tourist, bottom is the artisan
  timestamp: Date;
}

export const TranslatorView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [activeSide, setActiveSide] = useState<'top' | 'bottom' | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  const [faceToFace, setFaceToFace] = useState(true);
  
  // Settings
  const [topLang, setTopLang] = useState('English');
  const [bottomLang, setBottomLang] = useState('Georgian');
  
  const ai = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }));
  const recognition = useRef<any>(null);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Keyboard support for Desktop
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isRecording && !isProcessing) {
        e.preventDefault();
        startRecording('bottom');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = true;
      
      recognition.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
          
        if (event.results[0].isFinal) {
          handleFinalTranscript(transcript);
        }
      };

      recognition.current.onend = () => {
        setIsRecording(false);
      };

      recognition.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setPermissionError('Microphone access is blocked. Please enable it in browser settings.');
        }
        setIsRecording(false);
      };
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
      
      // Cleanup recognition
      if (recognition.current) {
        recognition.current.stop();
      }
      
      // Cleanup audio context if needed (optional, but good practice)
      // Note: closing AudioContext might prevent future use if re-mounted
      // but usually for a full view like this it's fine.
    };
  }, [isRecording, isProcessing]);

  const handleFinalTranscript = async (text: string) => {
    if (!text.trim() || !activeSide) return;

    setIsProcessing(true);
    try {
      const sourceRole = activeSide === 'top' ? 'Tourist' : 'Artisan';
      const targetLanguage = activeSide === 'top' ? 'Georgian' : 'English';
      
      const response = await ai.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate this for the ${targetLanguage} speaker. Input from ${sourceRole}: ${text}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });

      const translated = response.text || '';
      
      const newMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        text,
        translatedText: translated,
        sender: activeSide,
        timestamp: new Date()
      };

      setMessages(prev => [newMessage, ...prev]);
      
      // Auto TTS for the translated message
      playTTS(translated, activeSide === 'top' ? 'ka' : 'en');
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsProcessing(false);
      setActiveSide(null);
    }
  };

  const startRecording = (side: 'top' | 'bottom') => {
    setPermissionError(null);
    if (isRecording) {
      recognition.current?.stop();
      return;
    }

    setActiveSide(side);
    setIsRecording(true);
    
    // Set recognition language based on side
    if (recognition.current) {
      recognition.current.lang = side === 'top' ? 'en-US' : 'ka-GE';
      try {
        recognition.current.start();
      } catch (e) {
        console.error('Recognition start error:', e);
        setIsRecording(false);
      }
    }
  };

  const playTTS = async (text: string, lang: 'ka' | 'en') => {
    try {
      const response = await ai.current.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `Say in ${lang === 'ka' ? 'Georgian' : 'English'}: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: lang === 'ka' ? 'Kore' : 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        // Convert base64 to binary safely
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        if (!audioContext.current) {
          const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
          audioContext.current = new AudioContextClass({ sampleRate: 24000 });
        }
        
        const context = audioContext.current;
        if (context.state === 'suspended') {
          await context.resume();
        }

        // Manual decode 16-bit PCM to Float32
        // We use DataView to explicitly handle Little Endianness
        const pcmData = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          float32Data[i] = pcmData[i] / 32768.0; // Normalize Int16 to [-1, 1]
        }

        const audioBuffer = context.createBuffer(1, float32Data.length, 24000);
        audioBuffer.getChannelData(0).set(float32Data);

        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.start();
      }
    } catch (error) {
      console.error('TTS error:', error);
      // Fallback to browser TTS if Gemini TTS fails
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'ka' ? 'ka-GE' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0A0A0B] text-white flex flex-col lg:flex-row font-sans overflow-hidden">
      {/* Global Back Button */}
      {onBack && (
        <button 
          onClick={onBack}
          className="fixed top-6 left-6 z-[100] p-3 rounded-2xl bg-black/40 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all backdrop-blur-md shadow-2xl"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      {/* Top Section - Tourist */}
      <motion.div 
        className={cn(
          "flex-1 relative flex flex-col p-6 lg:p-12 transition-all duration-500",
          activeSide === 'top' ? "bg-blue-600/10 shadow-[inset_0_0_100px_rgba(37,99,235,0.1)]" : "bg-transparent",
          !isDesktop && faceToFace && "rotate-180"
        )}
      >
        <div className="flex justify-between items-center mb-4 lg:mb-8">
          <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full bg-blue-500/20 flex items-center gap-2 border border-blue-500/30">
              <Globe size={14} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">{topLang}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isDesktop && (
              <button 
                onClick={() => setFaceToFace(!faceToFace)}
                className={cn(
                  "p-2 rounded-xl border transition-all flex items-center justify-center",
                  faceToFace ? "bg-blue-500/20 border-blue-500/30 text-blue-400" : "bg-white/5 border-white/10 text-white/30"
                )}
              >
                <RotateCcw size={18} className={cn(faceToFace && "rotate-180")} />
              </button>
            )}
            <button className="w-10 h-10 rounded-full border border-white/10 text-white/40 hover:bg-white/5 transition-all flex items-center justify-center">
              <Settings size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 lg:space-y-10 max-w-2xl mx-auto">
           <AnimatePresence mode="wait">
            {messages.length > 0 && messages[0].sender === 'bottom' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="space-y-6"
              >
                <p className="text-3xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.1] text-blue-50">
                  {messages[0].translatedText}
                </p>
                <div className="flex flex-col items-center gap-2">
                   <div className="h-px w-12 bg-blue-500/30" />
                   <p className="text-sm md:text-base text-white/40 font-medium font-mono uppercase tracking-widest leading-relaxed">
                    {messages[0].text}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                className="flex flex-col items-center gap-4"
              >
                <p className="text-xl lg:text-3xl font-black uppercase tracking-[0.3em] font-mono">Ready for Input</p>
                <div className="flex gap-1">
                   {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
              </motion.div>
            )}
           </AnimatePresence>
        </div>

        <div className="mt-8 lg:mt-auto flex justify-center pb-4 lg:pb-12">
          <button 
            onClick={() => startRecording('top')}
            disabled={isProcessing}
            className={cn(
              "w-24 h-24 lg:w-32 lg:h-32 rounded-[40px] flex items-center justify-center transition-all duration-700 relative group border-[3px]",
              activeSide === 'top' && isRecording 
                ? "bg-red-500 border-red-500/40 scale-110 shadow-[0_0_60px_rgba(239,68,68,0.4)]" 
                : "bg-blue-600 border-blue-600/30 hover:bg-blue-500 hover:rotate-12 active:scale-90"
            )}
          >
            <AnimatePresence mode="wait">
              {isRecording && activeSide === 'top' ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <MicOff size={isDesktop ? 54 : 40} />
                </motion.div>
              ) : (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Mic size={isDesktop ? 54 : 40} />
                </motion.div>
              )}
            </AnimatePresence>
            {isRecording && activeSide === 'top' && (
              <>
                <div className="absolute inset-[-15px] border-2 border-red-500 rounded-[50px] animate-ping opacity-40" />
                <div className="absolute inset-[-30px] border border-red-500/30 rounded-[60px] animate-pulse opacity-20" />
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Center Divider / Controls */}
      <div className={cn(
        "relative z-20 flex items-center justify-center",
        isDesktop ? "w-px h-full" : "h-px w-full"
      )}>
        <div className={cn(
          "bg-white/10",
          isDesktop ? "w-full h-3/4" : "h-full w-3/4"
        )} />
        
        <div className={cn(
          "absolute flex gap-4",
          isDesktop ? "flex-col" : "flex-row"
        )}>
          <div className={cn(
            "px-5 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-3 border bg-[#050505] shadow-2xl transition-all",
            isOnline ? "text-cyan-400 border-cyan-500/30" : "text-amber-400 border-amber-500/30"
          )}>
            {isOnline ? <Zap size={14} className="fill-current animate-pulse text-cyan-400" /> : <WifiOff size={14} />}
            <span className={isDesktop ? "hidden" : "inline text-center"}>{isOnline ? "io.net GPU CLUSTER L-V3" : "Offline Mode"}</span>
          </div>
          
          {isProcessing && (
             <div className="px-5 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-3 border bg-blue-600/20 text-blue-400 border-blue-500/30 shadow-2xl">
               <RotateCcw size={14} className="animate-spin" />
               <span className={isDesktop ? "hidden" : "inline text-center"}>Processing</span>
             </div>
          )}
        </div>
      </div>

      {/* Bottom Section - Artisan */}
      <motion.div 
        className={cn(
          "flex-1 relative flex flex-col p-6 lg:p-12 transition-all duration-500",
          activeSide === 'bottom' ? "bg-amber-600/10 shadow-[inset_0_0_100px_rgba(217,119,6,0.1)]" : "bg-transparent"
        )}
      >
        <div className="flex justify-between items-center mb-4 lg:mb-8">
          <div className="flex items-center gap-3">
            <div className="px-4 py-1.5 rounded-full bg-amber-500/20 flex items-center gap-2 border border-amber-500/30">
              <Languages size={14} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">{bottomLang}</span>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full border border-white/10 text-white/40 hover:bg-white/5 transition-all flex items-center justify-center">
             <History size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 lg:space-y-10 max-w-2xl mx-auto">
           <AnimatePresence mode="wait">
            {messages.length > 0 && messages[0].sender === 'top' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="space-y-6"
              >
                <p className="text-3xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.1] text-amber-50">
                  {messages[0].translatedText}
                </p>
                <div className="flex flex-col items-center gap-2">
                   <div className="h-px w-12 bg-amber-500/30" />
                   <p className="text-sm md:text-base text-white/40 font-medium font-mono uppercase tracking-widest leading-relaxed">
                    {messages[0].text}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                className="flex flex-col items-center gap-4"
              >
                <p className="text-xl lg:text-3xl font-black uppercase tracking-[0.3em] font-sans">მზად არის</p>
                <div className="flex gap-1">
                   {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
              </motion.div>
            )}
           </AnimatePresence>
        </div>

        <div className="mt-8 lg:mt-auto flex flex-col items-center justify-center pb-4 lg:pb-12 space-y-4">
          <button 
            onClick={() => startRecording('bottom')}
            disabled={isProcessing}
            className={cn(
              "w-24 h-24 lg:w-32 lg:h-32 rounded-[40px] flex items-center justify-center transition-all duration-700 relative group border-[3px]",
              activeSide === 'bottom' && isRecording 
                ? "bg-red-500 border-red-500/40 scale-110 shadow-[0_0_60px_rgba(239,68,68,0.4)]" 
                : "bg-amber-600 border-amber-600/30 hover:bg-amber-500 hover:-rotate-12 active:scale-90"
            )}
          >
            <AnimatePresence mode="wait">
              {isRecording && activeSide === 'bottom' ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <MicOff size={isDesktop ? 54 : 40} />
                </motion.div>
              ) : (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Mic size={isDesktop ? 54 : 40} />
                </motion.div>
              )}
            </AnimatePresence>
            {isRecording && activeSide === 'bottom' && (
              <>
                <div className="absolute inset-[-15px] border-2 border-red-500 rounded-[50px] animate-ping opacity-40" />
                <div className="absolute inset-[-30px] border border-red-500/30 rounded-[60px] animate-pulse opacity-20" />
              </>
            )}
          </button>
          
          {isDesktop && !isRecording && (
            <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
               <span className="px-2 py-0.5 rounded border border-white/10 bg-white/5">SPACE</span>
               to Speak
            </div>
          )}
        </div>
      </motion.div>

      {/* Global Overlays */}
      <AnimatePresence>
        {permissionError && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-6"
          >
            <div className="bg-red-500 border border-white/20 p-4 rounded-3xl flex items-start gap-4 shadow-[0_20px_50px_rgba(239,68,68,0.3)] backdrop-blur-xl">
               <div className="bg-white/20 p-2 rounded-xl">
                 <Info size={20} className="text-white" />
               </div>
               <div className="flex-1">
                  <p className="text-[11px] font-black uppercase tracking-widest mb-1">Access Denied</p>
                  <p className="text-xs font-medium text-white/90 leading-relaxed">{permissionError}</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-4">
        <button className="w-12 h-12 rounded-2xl bg-[#0F0F10] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group shadow-2xl">
          <Info size={22} className="text-white/40 group-hover:text-white" />
        </button>
      </div>
    </div>
  );
};
