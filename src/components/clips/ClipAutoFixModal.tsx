import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sliders, X, Play, Pause, RotateCcw, Check, Scissors } from 'lucide-react';
import { Clip } from '../../types';
import { cn } from '../../lib/utils';

export interface ClipAutoFixModalProps {
  isOpen: boolean;
  clip: Clip | null;
  language: 'en' | 'ka';
  onClose: () => void;
  onSaveTrim: (clip: Clip, trimStart: number, trimEnd: number) => Promise<void> | void;
}

export function ClipAutoFixModal({
  isOpen,
  clip,
  language,
  onClose,
  onSaveTrim,
}: ClipAutoFixModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(clip?.duration || 15);
  const [trimStart, setTrimStart] = useState<number>(clip?.trimStart || 0);
  const [trimEnd, setTrimEnd] = useState<number>(clip?.trimEnd || clip?.duration || 15);
  const [currentTime, setCurrentTime] = useState<number>(clip?.trimStart || 0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (clip) {
      const dur = clip.duration && clip.duration > 0 ? clip.duration : 15;
      setDuration(dur);
      setTrimStart(clip.trimStart || 0);
      setTrimEnd(clip.trimEnd && clip.trimEnd > 0 ? clip.trimEnd : dur);
      setCurrentTime(clip.trimStart || 0);
      setIsPlaying(false);
    }
  }, [clip]);

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (!clip?.trimEnd || clip.trimEnd > dur) {
        setTrimEnd(dur);
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);
    if (curr >= trimEnd) {
      videoRef.current.currentTime = trimStart;
      if (!isPlaying) {
        videoRef.current.pause();
      }
    }
  };

  const handleApplyPreset = (preset: 'full' | 'trim-intro' | 'trim-outro' | 'short-loop') => {
    if (preset === 'full') {
      setTrimStart(0);
      setTrimEnd(duration);
      if (videoRef.current) videoRef.current.currentTime = 0;
    } else if (preset === 'trim-intro') {
      const newStart = Math.min(1.0, duration - 1);
      setTrimStart(newStart);
      if (videoRef.current) videoRef.current.currentTime = newStart;
    } else if (preset === 'trim-outro') {
      const newEnd = Math.max(1.0, duration - 1.0);
      setTrimEnd(newEnd);
    } else if (preset === 'short-loop') {
      setTrimStart(0);
      setTrimEnd(Math.min(10, duration));
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  };

  const handleSave = async () => {
    if (!clip) return;
    setIsSaving(true);
    try {
      await onSaveTrim(clip, trimStart, trimEnd);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setTrimStart(0);
    setTrimEnd(duration);
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  return (
    <AnimatePresence>
      {isOpen && clip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 pb-16 lg:pb-4 overflow-y-auto">
          <div className="absolute inset-0" onClick={onClose} />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-lg bg-proton-bg border border-proton-border/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10 max-h-[90dvh] sm:max-h-[88vh] my-auto"
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-proton-border/20 flex items-center justify-between bg-gradient-to-r from-purple-950/20 to-indigo-950/20 shrink-0">
              <div className="flex items-center gap-2">
                <Scissors className="text-purple-400" size={18} />
                <div>
                  <h3 className="font-black text-xs sm:text-sm text-white">
                    {language === 'ka' ? 'ვიდეოს მოჭრა და მორგება' : 'Video Trim & Loop Controls'}
                  </h3>
                  <p className="text-[10px] text-proton-muted">
                    {language === 'ka' ? 'დააყენეთ საწყისი/საბოლოო წამები გლუვი ჩვენებისთვის' : 'Set precise start & end boundaries for seamless loop playback'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-proton-muted hover:text-white hover:bg-white/10 transition-all"
                aria-label="Close trim modal"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable Contents */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 max-h-[62vh] sm:max-h-[70vh] space-y-4 sm:space-y-5 custom-scrollbar">
              {/* Interactive Video Preview Player */}
              <div className="relative aspect-[16/9] sm:aspect-video rounded-xl overflow-hidden bg-black border border-white/10 flex items-center justify-center shadow-lg">
                <video
                  ref={videoRef}
                  src={clip.videoUrl}
                  playsInline
                  muted
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-all cursor-pointer shadow-lg z-10"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-purple-300 border border-white/10">
                  {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                </div>
                <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-purple-600/80 text-[10px] font-black uppercase tracking-wider text-white border border-purple-400/30">
                  Loop: {(trimEnd - trimStart).toFixed(1)}s
                </div>
              </div>

              {/* Sliders & Precision Controls */}
              <div className="space-y-4 bg-white/5 border border-proton-border/15 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sliders size={14} className="text-purple-400" />
                    {language === 'ka' ? 'მონაკვეთის პარამეტრები' : 'Boundary Markers'}
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[10px] text-proton-muted hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw size={10} />
                    <span>{language === 'ka' ? 'საწყისი' : 'Reset'}</span>
                  </button>
                </div>

                {/* Trim Start Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-proton-muted">{language === 'ka' ? 'საწყისი მარკერი (Start):' : 'Start Trim:'}</span>
                    <span className="font-mono text-purple-400 font-bold">{trimStart.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, trimEnd - 0.5)}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimStart(val);
                      if (videoRef.current) {
                        videoRef.current.currentTime = val;
                      }
                    }}
                    className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Trim End Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-proton-muted">{language === 'ka' ? 'საბოლოო მარკერი (End):' : 'End Trim:'}</span>
                    <span className="font-mono text-pink-400 font-bold">{trimEnd.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={Math.min(duration, trimStart + 0.5)}
                    max={duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimEnd(val);
                      if (videoRef.current) {
                        videoRef.current.currentTime = Math.max(trimStart, val - 0.5);
                      }
                    }}
                    className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                </div>

                {/* Quick Presets */}
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[10px] font-bold text-proton-muted uppercase tracking-wider block mb-2">
                    {language === 'ka' ? 'სწრაფი შაბლონები:' : 'Quick Presets:'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('full')}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white transition-all text-center"
                    >
                      {language === 'ka' ? 'მთლიანი ვიდეო' : 'Full Duration'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('trim-intro')}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-purple-300 transition-all text-center"
                    >
                      {language === 'ka' ? 'საწყისი -1s' : 'Trim Intro 1s'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('trim-outro')}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-pink-300 transition-all text-center"
                    >
                      {language === 'ka' ? 'ბოლო -1s' : 'Trim Outro 1s'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('short-loop')}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-amber-300 transition-all text-center"
                    >
                      {language === 'ka' ? '10s ციკლი' : '10s Loop'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-3.5 sm:p-4 border-t border-proton-border/20 bg-proton-bg/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 sticky bottom-0 z-20 pb-safe">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-proton-muted hover:text-white text-xs font-bold transition-all"
              >
                {language === 'ka' ? 'გაუქმება' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isSaving ? (language === 'ka' ? 'ინახება...' : 'Saving...') : (language === 'ka' ? 'შენახვა' : 'Apply & Save Trim')}</span>
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
