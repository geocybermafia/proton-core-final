import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, X, CheckCircle2, Eye, Play, Pause, RotateCcw } from 'lucide-react';
import { Clip, ClipIssue } from '../../types';
import { cn } from '../../lib/utils';

export interface IssuePreviewPlayerProps {
  clip: Clip;
  issue: ClipIssue;
  language: 'en' | 'ka';
}

export function IssuePreviewPlayer({ clip, issue, language }: IssuePreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(issue.startSec);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = issue.startSec;
    }
  }, [issue.startSec]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime >= issue.endSec) {
        videoRef.current.currentTime = issue.startSec;
      }
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);
    if (curr >= issue.endSec) {
      videoRef.current.pause();
      setIsPlaying(false);
      videoRef.current.currentTime = issue.startSec;
    }
  };

  return (
    <div className="mt-2.5 p-2 rounded-xl bg-black/80 border border-purple-500/30 overflow-hidden space-y-2">
      <div className="relative aspect-[16/9] sm:aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={clip.videoUrl}
          playsInline
          muted
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          className="w-full h-full object-contain"
        />
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-all cursor-pointer shadow-lg"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-purple-600/80 text-[8px] font-black uppercase tracking-wider text-white border border-purple-400/30">
          {language === 'ka' ? 'ხარვეზის მონაკვეთი' : 'Defect Segment'}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-proton-muted px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = issue.startSec;
                setCurrentTime(issue.startSec);
              }
            }}
            className="p-1 rounded hover:bg-white/10 text-purple-400"
            title="Reset to start"
          >
            <RotateCcw size={12} />
          </button>
          <span>{currentTime.toFixed(1)}s / {issue.endSec.toFixed(1)}s</span>
        </div>
        <span className="text-purple-300 font-bold">
          Δ {(issue.endSec - issue.startSec).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

export interface ClipAutoFixModalProps {
  isOpen: boolean;
  clip: Clip | null;
  isAnalyzing: boolean;
  detectedIssues: ClipIssue[];
  appliedFixes: { [clipId: string]: string[] };
  previewingIssueId: string | null;
  dynamicPlaceholderThumbnails: { [clipId: string]: string };
  language: 'en' | 'ka';
  onClose: () => void;
  onApplyFix: (clip: Clip, issue: ClipIssue) => void;
  onUndoFix: (clip: Clip, issue: ClipIssue) => void;
  onTogglePreviewIssue: (issueId: string) => void;
}

export function ClipAutoFixModal({
  isOpen,
  clip,
  isAnalyzing,
  detectedIssues,
  appliedFixes,
  previewingIssueId,
  dynamicPlaceholderThumbnails,
  language,
  onClose,
  onApplyFix,
  onUndoFix,
  onTogglePreviewIssue,
}: ClipAutoFixModalProps) {
  return (
    <AnimatePresence>
      {isOpen && clip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 pb-16 lg:pb-4 overflow-y-auto">
          <div className="absolute inset-0" onClick={onClose} />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-lg bg-proton-bg border border-proton-border/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10 max-h-[88dvh] sm:max-h-[85vh] my-auto"
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-proton-border/20 flex items-center justify-between bg-gradient-to-r from-purple-950/20 to-indigo-950/20 shrink-0">
              <div className="flex items-center gap-2">
                <Wand2 className="text-purple-400 animate-pulse" size={18} />
                <div>
                  <h3 className="font-black text-xs sm:text-sm text-white">
                    {language === 'ka' ? 'AI ვიდეო ოპტიმიზატორი' : 'Gemini Auto-Fix Video Co-Pilot'}
                  </h3>
                  <p className="text-[10px] text-proton-muted">
                    {language === 'ka' ? 'კადრებისა და აუდიოს ავტომატური გასწორება' : 'Automatic video, frame & audio corrections'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-proton-muted hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable Contents */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 max-h-[60vh] sm:max-h-[70vh] space-y-4 sm:space-y-5 custom-scrollbar">
              {isAnalyzing ? (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl animate-pulse" />
                    <div className="p-5 bg-gradient-to-tr from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 rounded-full animate-spin">
                      <Wand2 size={32} />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider animate-pulse">
                      {language === 'ka' ? 'Gemini აანალიზებს კლიპს...' : 'Gemini is analyzing video clip...'}
                    </h4>
                    <p className="text-[10px] text-proton-muted max-w-[280px] mt-1.5 leading-relaxed">
                      {language === 'ka' 
                        ? 'მიმდინარეობს კადრების პროგრამული დასკანერება, განათებისა და ხმის ხარვეზების დიაგნოსტიკა...' 
                        : 'Performing programmatic canvas frame scans, inspecting luminance levels & audio drops...'}
                    </p>
                  </div>
                  {/* Simulated loading bar */}
                  <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden mt-2">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Clip Preview Brief */}
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3">
                    <div className="w-12 h-16 rounded-lg bg-black/40 overflow-hidden border border-white/10 flex-shrink-0 relative flex items-center justify-center">
                      {clip.thumbnailUrl || dynamicPlaceholderThumbnails[clip.id] ? (
                        <img 
                          referrerPolicy="no-referrer"
                          src={clip.thumbnailUrl || dynamicPlaceholderThumbnails[clip.id]} 
                          className="w-full h-full object-cover" 
                          alt="" 
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xs text-white/50">Video</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[11px] font-bold text-white truncate">
                        {clip.caption}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-proton-muted">
                        <span className="font-mono">
                          {language === 'ka' ? 'ხანგრძლივობა:' : 'Duration:'} {clip.duration ? `${clip.duration.toFixed(1)}s` : 'Unknown'}
                        </span>
                        <span>•</span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-[9px]">
                          {language === 'ka' ? 'ავტორი:' : 'Creator:'} @{clip.creatorName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-black text-purple-400 tracking-wider">
                      {language === 'ka' ? `დაფიქსირებული ხარვეზები (${detectedIssues.length})` : `Detected Issues (${detectedIssues.length})`}
                    </h4>

                    {detectedIssues.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-proton-border/30 text-center text-proton-muted">
                        <CheckCircle2 size={18} className="mx-auto text-emerald-400 mb-2" />
                        <p className="text-xs">{language === 'ka' ? 'ვიდეოში ხარვეზები არ დაფიქსირებულა' : 'No quality issues detected!'}</p>
                        <p className="text-[10px] mt-1">{language === 'ka' ? 'თქვენი ვიდეო იდეალურ მდგომარეობაშია.' : 'Your clip meets pristine publishing standards.'}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detectedIssues.map((issue) => {
                          const isApplied = appliedFixes[clip.id]?.includes(issue.id);
                          const isPreviewing = previewingIssueId === issue.id;
                          
                          return (
                            <div 
                              key={issue.id} 
                              className={cn(
                                "p-4 rounded-xl border transition-all",
                                isApplied 
                                  ? "bg-emerald-950/10 border-emerald-500/30" 
                                  : "bg-white/5 border-proton-border/15 hover:border-proton-border/30"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase",
                                      issue.type === 'black_frame' && "bg-black text-gray-400 border border-gray-800",
                                      issue.type === 'silence' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                                      issue.type === 'shaky_cam' && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                                      issue.type === 'low_lighting' && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                                      issue.type === 'unwanted_intro' && "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                    )}>
                                      {issue.type.replace('_', ' ')}
                                    </span>
                                    <span className="text-[10px] font-mono text-proton-muted">
                                      ⏱️ {issue.startSec}s - {issue.endSec}s
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-bold text-white">
                                    {language === 'ka' ? issue.titleKa : issue.titleEn}
                                  </h5>
                                  <p className="text-[10px] text-proton-muted leading-relaxed">
                                    {language === 'ka' ? issue.descriptionKa : issue.descriptionEn}
                                  </p>
                                  <p className="text-[10px] font-bold text-purple-300 flex items-center gap-1.5 mt-2">
                                    <span className="text-purple-400">💡</span>
                                    <span>{language === 'ka' ? issue.suggestedActionKa : issue.suggestedActionEn}</span>
                                  </p>
                                </div>

                                <div className="flex flex-col gap-2 flex-shrink-0 w-24">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isApplied) {
                                        onUndoFix(clip, issue);
                                      } else {
                                        onApplyFix(clip, issue);
                                      }
                                    }}
                                    className={cn(
                                      "w-full py-1.5 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all border text-center shadow-sm",
                                      isApplied
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                        : "bg-purple-600/25 text-purple-300 border-purple-500/35 hover:bg-purple-600/40"
                                    )}
                                  >
                                    {isApplied 
                                      ? (language === 'ka' ? 'გაუქმება' : 'Undo') 
                                      : (language === 'ka' ? 'მოჭრა' : 'Trim')}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onTogglePreviewIssue(issue.id)}
                                    className={cn(
                                      "w-full py-1.5 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all border flex items-center justify-center gap-1.5 shadow-sm",
                                      isPreviewing
                                        ? "bg-purple-500/35 text-purple-200 border-purple-500 hover:bg-purple-500/45 text-white animate-pulse"
                                        : "bg-white/5 text-proton-muted border-proton-border/15 hover:border-proton-border/30 hover:text-white"
                                    )}
                                  >
                                    <Eye size={10} className={cn(isPreviewing && "text-purple-400")} />
                                    <span>{language === 'ka' ? 'პრევიუ' : 'Preview'}</span>
                                  </button>
                                </div>
                              </div>

                              <AnimatePresence initial={false}>
                                {isPreviewing && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                    animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <IssuePreviewPlayer 
                                      clip={clip} 
                                      issue={issue} 
                                      language={language} 
                                    />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Footer */}
            <div className="p-3.5 sm:p-4 border-t border-proton-border/20 bg-proton-bg/95 backdrop-blur-md flex items-center justify-end gap-3 shrink-0 sticky bottom-0 z-20 pb-safe">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-black transition-all shadow-md shadow-purple-500/5"
              >
                {language === 'ka' ? 'დახურვა' : 'Close Panel'}
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
