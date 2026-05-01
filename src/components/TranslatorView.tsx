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
    { term: "ქვევრი", en: "Qvevri", desc: "Large clay vessel for wine" }
  ]
};

const SYSTEM_INSTRUCTION = `
You are a high-performance translation engine specialized for face-to-face communication between local Georgian artisans and tourists. 
Your goal is to provide seamless, culturally accurate translations.

Grounded Artisan Lexicon:
${ARTISAN_LEXICON.ka.map(i => `- ${i.term} (${i.en}): ${i.desc}`).join('\n')}

Guidelines:
1. Detect the language automatically.
2. If Georgian is detected, translate to the tourist's selected language (default English).
3. If the tourist's language is detected, translate to Georgian.
4. Use the Artisan Lexicon terms whenever contextually appropriate.
5. Keep translations concise and conversational.
6. If the input is ambiguous, provide the most likely cultural interpretation.
7. Return only the translated text.
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
  
  // Settings
  const [topLang, setTopLang] = useState('English');
  const [bottomLang, setBottomLang] = useState('Georgian');
  
  const ai = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }));
  const recognition = useRef<any>(null);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
          setPermissionError('Microphone access is blocked. Please enable it in your browser settings.');
        }
        setIsRecording(false);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleFinalTranscript = async (text: string) => {
    if (!text.trim() || !activeSide) return;

    setIsProcessing(true);
    try {
      const response = await ai.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: text,
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
      recognition.current.start();
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
        const audioBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
        if (!audioContext.current) {
          audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const buffer = await audioContext.current.decodeAudioData(audioBytes.buffer);
        const source = audioContext.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.current.destination);
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
    <div className="fixed inset-0 bg-[#0A0A0B] text-white flex flex-col font-sans overflow-hidden">
      {/* Top Section - Tourist */}
      <motion.div 
        className={cn(
          "flex-1 relative flex flex-col p-6 transition-colors duration-500",
          activeSide === 'top' ? "bg-blue-600/10" : "bg-transparent"
        )}
        style={{ transform: 'rotate(180deg)' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 rounded-full border border-white/10 text-white/50 hover:bg-white/5 transition-all"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <Globe size={16} className="text-blue-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{topLang}</span>
          </div>
          <button className="p-2 rounded-full border border-white/10 text-white/50 hover:bg-white/5 transition-all">
             <Settings size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
           <AnimatePresence mode="wait">
            {messages.length > 0 && messages[0].sender === 'bottom' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <p className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                  {messages[0].translatedText}
                </p>
                <p className="text-sm text-white/40 font-medium">
                  {messages[0].text}
                </p>
              </motion.div>
            ) : (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                className="text-2xl font-bold uppercase tracking-widest"
              >
                Tap and Speak
              </motion.p>
            )}
           </AnimatePresence>
        </div>

        <div className="mt-auto flex justify-center pb-4">
          <button 
            onClick={() => startRecording('top')}
            disabled={isProcessing}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative group border-4",
              activeSide === 'top' && isRecording 
                ? "bg-red-500 border-red-500/40 scale-110 shadow-[0_0_50px_rgba(239,68,68,0.5)]" 
                : "bg-blue-600 border-blue-600/20 hover:scale-105 active:scale-95"
            )}
          >
            {isRecording && activeSide === 'top' ? (
              <MicOff size={40} />
            ) : (
              <Mic size={40} />
            )}
            {isRecording && activeSide === 'top' && (
              <div className="absolute inset-[-12px] border-2 border-red-500 rounded-full animate-ping opacity-60" />
            )}
          </button>
        </div>
      </motion.div>

      {/* Center Divider / Controls */}
      <div className="h-px w-full bg-white/10 relative z-20">
        <AnimatePresence>
          {permissionError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 bg-red-500/90 text-white p-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-center shadow-xl backdrop-blur-md border border-white/20"
            >
              {permissionError}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
          <div className={cn(
            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border bg-black transition-all",
            isOnline ? "text-cyan-400 border-cyan-500/30" : "text-amber-400 border-amber-500/30"
          )}>
            {isOnline ? <Zap size={12} className="fill-current" /> : <WifiOff size={12} />}
            {isOnline ? "io.net GPU CLUSTER L-V3" : "Offline Mode"}
          </div>
          {isProcessing && (
             <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border bg-blue-600/20 text-blue-400 border-blue-500/30">
               <RotateCcw size={12} className="animate-spin" />
               Processing
             </div>
          )}
        </div>
      </div>

      {/* Bottom Section - Artisan */}
      <motion.div 
        className={cn(
          "flex-1 relative flex flex-col p-6 transition-colors duration-500",
          activeSide === 'bottom' ? "bg-amber-600/10" : "bg-transparent"
        )}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
              <Languages size={16} className="text-amber-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">{bottomLang}</span>
          </div>
          <button className="p-2 rounded-full border border-white/10 text-white/50 hover:bg-white/5 transition-all">
             <History size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
           <AnimatePresence mode="wait">
            {messages.length > 0 && messages[0].sender === 'top' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <p className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                  {messages[0].translatedText}
                </p>
                <p className="text-sm text-white/40 font-medium">
                  {messages[0].text}
                </p>
              </motion.div>
            ) : (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                className="text-2xl font-bold uppercase tracking-widest"
              >
                დააჭირეთ და ისაუბრეთ
              </motion.p>
            )}
           </AnimatePresence>
        </div>

        <div className="mt-auto flex justify-center pb-4">
          <button 
            onClick={() => startRecording('bottom')}
            disabled={isProcessing}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative group border-4",
              activeSide === 'bottom' && isRecording 
                ? "bg-red-500 border-red-500/40 scale-110 shadow-[0_0_50px_rgba(239,68,68,0.5)]" 
                : "bg-amber-600 border-amber-600/20 hover:scale-105 active:scale-95"
            )}
          >
            {isRecording && activeSide === 'bottom' ? (
              <MicOff size={40} />
            ) : (
              <Mic size={40} />
            )}
            {isRecording && activeSide === 'bottom' && (
              <div className="absolute inset-[-12px] border-2 border-red-500 rounded-full animate-ping opacity-60" />
            )}
          </button>
        </div>
      </motion.div>

      {/* Lexicon Tooltip */}
      <div className="absolute bottom-6 right-6 z-30">
        <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group">
          <Info size={20} className="text-white/40 group-hover:text-white" />
        </button>
      </div>
    </div>
  );
};
