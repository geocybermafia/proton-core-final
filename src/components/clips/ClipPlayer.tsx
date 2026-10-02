import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Sparkles, 
  Wand2, 
  Tag, 
  Trash2, 
  User as UserIcon, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  ShoppingBag, 
  Music, 
  Volume2, 
  VolumeX, 
  Play, 
  AlertCircle, 
  Plus,
  Scissors,
  MoreVertical,
  X
} from 'lucide-react';
import { Clip } from '../../types';
import { cn } from '../../lib/utils';
import { PRESET_LOOPS } from './types';

interface ReelProgressBarProps {
  videoElement: HTMLVideoElement | null;
  clip: Clip;
}

export function ReelProgressBar({ videoElement, clip }: ReelProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      // Don't overwrite visual state while the user is actively scrubbing
      if (isDragging) return;

      const duration = videoElement.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      const start = Math.max(0, clip.trimStart || 0);
      const end = Math.min(duration, clip.trimEnd || duration);
      const total = Math.max(0.01, end - start);
      const current = Math.min(end, Math.max(start, videoElement.currentTime)) - start;
      const percent = Math.min(100, Math.max(0, (current / total) * 100));
      setProgress(percent);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoElement, clip.trimStart, clip.trimEnd, isDragging]);

  const calculateFractionFromPointer = (clientX: number): number => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const clickX = clientX - rect.left;
    return Math.min(1, Math.max(0, clickX / rect.width));
  };

  const applySeek = (fraction: number) => {
    if (!videoElement) return;
    const duration = videoElement.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const start = Math.max(0, clip.trimStart || 0);
    const end = Math.min(duration, clip.trimEnd || duration);
    const total = Math.max(0.01, end - start);

    const targetTime = start + fraction * total;
    if (Number.isFinite(targetTime)) {
      videoElement.currentTime = Math.min(end, Math.max(start, targetTime));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // Only respond to primary button
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const fraction = calculateFractionFromPointer(e.clientX);
    const percent = fraction * 100;

    setIsDragging(true);
    setDragProgress(percent);
    applySeek(fraction);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture unsupported
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();

    const fraction = calculateFractionFromPointer(e.clientX);
    const percent = fraction * 100;

    setDragProgress(percent);
    applySeek(fraction);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();

    const fraction = calculateFractionFromPointer(e.clientX);
    applySeek(fraction);
    setProgress(fraction * 100);
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!videoElement) return;
    const duration = videoElement.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const start = Math.max(0, clip.trimStart || 0);
    const end = Math.min(duration, clip.trimEnd || duration);
    const total = Math.max(0.01, end - start);

    let step = 0;
    if (e.key === 'ArrowLeft') step = -total * 0.05;
    else if (e.key === 'ArrowRight') step = total * 0.05;
    else if (e.key === 'Home') {
      videoElement.currentTime = start;
      return;
    } else if (e.key === 'End') {
      videoElement.currentTime = end;
      return;
    } else {
      return;
    }

    e.preventDefault();
    const newTime = Math.min(end, Math.max(start, videoElement.currentTime + step));
    videoElement.currentTime = newTime;
    const newPercent = Math.min(100, Math.max(0, ((newTime - start) / total) * 100));
    setProgress(newPercent);
  };

  const displayProgress = isDragging ? dragProgress : progress;

  return (
    <div
      ref={progressBarRef}
      role="slider"
      tabIndex={0}
      aria-label="Video playback scrub bar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(displayProgress)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      className="absolute bottom-0 left-0 right-0 h-11 flex items-end pb-0 cursor-pointer z-30 group touch-none select-none focus:outline-none"
      style={{ touchAction: 'none' }}
    >
      {/* Visual timeline bar: thin 4px baseline, expands to 10px on hover/drag with scrub thumb */}
      <div className={cn(
        "w-full bg-white/20 transition-all rounded-r relative overflow-visible",
        isDragging ? "h-2.5 bg-white/30" : "h-1 group-hover:h-2"
      )}>
        <div
          className={cn(
            "h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 transition-[width] rounded-r relative",
            isDragging ? "duration-0" : "duration-75"
          )}
          style={{ width: `${displayProgress}%` }}
        >
          {/* Tactile scrub thumb */}
          <div className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-lg border border-purple-500/40 pointer-events-none transition-all",
            isDragging 
              ? "w-3.5 h-3.5 opacity-100 scale-100" 
              : "w-2.5 h-2.5 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
          )} />
        </div>
      </div>
    </div>
  );
}

export interface ClipPlayerProps {
  clip: Clip;
  index: number;
  currentIndex: number;
  totalClips: number;
  isPlaying: boolean;
  isMuted: boolean;
  isBuffering: boolean;
  isMounted?: boolean;
  activeFilter: 'none' | 'noir' | 'vintage' | 'warm' | 'glitch';
  showFiltersPanel: boolean;
  soundOverlay: { visible: boolean; muted: boolean };
  doubleTapHearts: { [clipId: string]: boolean };
  loadedVideoIds: { [clipId: string]: boolean };
  failedVideoIds: { [clipId: string]: boolean };
  dynamicPlaceholderThumbnails: { [clipId: string]: string };
  appliedFixes: { [clipId: string]: string[] };
  expandedCaptions: { [clipId: string]: boolean };
  commentsCount: number;
  currentUser: any | null;
  hasSellerListings: boolean;
  language: 'en' | 'ka';
  videoRefCallback: (index: number, el: HTMLVideoElement | null) => void;
  videoElement: HTMLVideoElement | null;
  getClipVideoUrl: (clip: Clip, index: number) => string;
  onTogglePlay: (index: number) => void;
  onDoubleTap: (clip: Clip) => void;
  onToggleMute: () => void;
  onLikeToggle: (clip: Clip) => void;
  onOpenComments: () => void;
  onShareClip: (clip: Clip) => void;
  onToggleFiltersPanel: () => void;
  onRunAutoFix: (clip: Clip) => void;
  onOpenTagging: (clip: Clip) => void;
  onDeleteClip: (clip: Clip) => void;
  onOpenCreatorProfile: (creatorId: string, creatorName: string, creatorAvatar?: string) => void;
  onHashtagClick: (tag: string) => void;
  onToggleExpandCaption: (clipId: string) => void;
  onOpenCheckout: (clip: Clip) => void;
  onVideoMetadataLoad: (clipId: string, e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onVideoPlayStateChange: (isPlaying: boolean) => void;
  onVideoBufferingStateChange: (isBuffering: boolean) => void;
  onVideoLoadSuccess: (clipId: string) => void;
  onVideoFallback: (clipId: string, fallbackUrl: string) => void;
}

export function ClipPlayer({
  clip,
  index: idx,
  currentIndex,
  totalClips,
  isPlaying,
  isMuted,
  isBuffering,
  isMounted,
  activeFilter,
  showFiltersPanel,
  soundOverlay,
  doubleTapHearts,
  loadedVideoIds,
  failedVideoIds,
  dynamicPlaceholderThumbnails,
  appliedFixes,
  expandedCaptions,
  commentsCount,
  currentUser,
  hasSellerListings,
  language,
  videoRefCallback,
  videoElement,
  getClipVideoUrl,
  onTogglePlay,
  onDoubleTap,
  onToggleMute,
  onLikeToggle,
  onOpenComments,
  onShareClip,
  onToggleFiltersPanel,
  onRunAutoFix,
  onOpenTagging,
  onDeleteClip,
  onOpenCreatorProfile,
  onHashtagClick,
  onToggleExpandCaption,
  onOpenCheckout,
  onVideoMetadataLoad,
  onVideoPlayStateChange,
  onVideoBufferingStateChange,
  onVideoLoadSuccess,
  onVideoFallback
}: ClipPlayerProps) {
  const isLikedByMe = clip.likes?.includes(currentUser?.uid || '');
  const hasProduct = !!clip.productId;
  const isVirtualMounted = isMounted ?? (Math.abs(idx - currentIndex) <= 1);
  const isCurrentActive = idx === currentIndex;
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  const isTrimmed = Boolean(
    (clip.trimStart && clip.trimStart > 0) || 
    (clip.trimEnd && clip.trimEnd < (clip.duration || 100))
  );

  // Touch gesture & double-tap state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const lastDoubleTapFiredRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (idx !== currentIndex) {
      setIsMobileMoreOpen(false);
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = null;
      touchStartRef.current = null;
    }
  }, [idx, currentIndex]);

  const handleVideoTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    isSwipingRef.current = false;
    lastTouchTimeRef.current = Date.now();
  };

  const handleVideoTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);

    // If movement exceeds 12px in any direction, it's a drag/scroll, not a tap
    if (dx > 12 || dy > 12) {
      isSwipingRef.current = true;
    }
  };

  const handleVideoTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchTimeRef.current = Date.now();
    if (!touchStartRef.current) return;
    const now = Date.now();
    const duration = now - touchStartRef.current.time;
    const wasSwiping = isSwipingRef.current;
    const touchPoint = touchStartRef.current;
    touchStartRef.current = null;

    // If it was a swipe (reel scrolling) or a long press (> 450ms), ignore as a tap gesture
    if (wasSwiping || duration > 450) {
      lastTapRef.current = null;
      return;
    }

    // Check if this tap qualifies as a double-tap
    const prevTap = lastTapRef.current;
    if (prevTap) {
      const timeDiff = now - prevTap.time;
      const dist = Math.hypot(touchPoint.x - prevTap.x, touchPoint.y - prevTap.y);

      // Between 50ms and 350ms, within 40px radius
      if (timeDiff >= 50 && timeDiff <= 350 && dist < 40) {
        // QUALIFIED TOUCH DOUBLE-TAP!
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        lastTapRef.current = null;
        lastDoubleTapFiredRef.current = now;
        onDoubleTap(clip);
        return;
      }
    }

    // Otherwise, this is a first/single tap candidate
    lastTapRef.current = {
      x: touchPoint.x,
      y: touchPoint.y,
      time: now
    };

    // Schedule single-tap play/pause if no second tap follows within 280ms
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
    singleTapTimerRef.current = setTimeout(() => {
      onTogglePlay(idx);
      singleTapTimerRef.current = null;
      lastTapRef.current = null;
    }, 280);
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If this click was synthesized from a recent touch gesture (< 600ms ago), ignore it
    // because touch handlers already accurately processed single-tap or double-tap.
    if (Date.now() - lastTouchTimeRef.current < 600) {
      return;
    }
    // Desktop mouse click: toggle play/pause immediately
    onTogglePlay(idx);
  };

  const handleVideoDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent duplicate firing if a touch double-tap already fired within 600ms
    if (Date.now() - lastDoubleTapFiredRef.current < 600) {
      return;
    }
    lastDoubleTapFiredRef.current = Date.now();
    onDoubleTap(clip);
  };

  return (
    <div 
      className="w-full h-full min-h-full flex-shrink-0 snap-start snap-always relative flex items-center justify-center p-2 sm:p-4"
    >
      {/* VIEWPORT-CENTRIC 9:16 REELS PLAYER CONTAINER */}
      <div className="relative w-full max-w-[420px] sm:max-w-[440px] aspect-[9/16] h-[calc(100dvh-5rem)] md:h-full max-h-[calc(100dvh-5rem)] md:max-h-[calc(100vh-120px)] rounded-[28px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black overflow-hidden flex flex-col justify-between group pointer-events-auto select-none">
        
        {/* VIDEO PLAYER ELEMENT */}
        <div 
          className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden cursor-pointer bg-zinc-950"
          onTouchStart={handleVideoTouchStart}
          onTouchMove={handleVideoTouchMove}
          onTouchEnd={handleVideoTouchEnd}
          onClick={handleVideoClick}
          onDoubleClick={handleVideoDoubleClick}
        >
          {isVirtualMounted ? (
            <video
              ref={el => videoRefCallback(idx, el)}
              src={getClipVideoUrl(clip, idx)}
              loop
              playsInline
              muted={isMuted}
              preload={isCurrentActive ? "auto" : "none"}
              autoPlay={isCurrentActive && isPlaying}
              className={cn(
                "w-full h-full object-cover transition-all duration-300",
                activeFilter === 'noir' && "grayscale contrast-[1.25] brightness-95",
                activeFilter === 'vintage' && "sepia brightness-[0.88] contrast-[1.05] saturate-[1.3]",
                activeFilter === 'warm' && "saturate-[1.55] contrast-[1.05] brightness-[0.95] sepia-[0.12]",
                activeFilter === 'glitch' && "animate-proton-glitch brightness-[1.05] contrast-[1.2] saturate-[1.5]"
              )}
              onPlay={() => { if (isCurrentActive) onVideoPlayStateChange(true); }}
              onPause={() => { if (isCurrentActive) onVideoPlayStateChange(false); }}
              onWaiting={() => { if (isCurrentActive) onVideoBufferingStateChange(true); }}
              onStalled={() => { if (isCurrentActive) onVideoBufferingStateChange(true); }}
              onPlaying={() => { if (isCurrentActive) onVideoBufferingStateChange(false); }}
              onCanPlay={() => { if (isCurrentActive) onVideoBufferingStateChange(false); }}
              onLoadedData={() => { onVideoLoadSuccess(clip.id); }}
              onError={() => {
                console.warn("Video play/decode error for ID", clip.id);
                const fallbackUrl = PRESET_LOOPS[idx % PRESET_LOOPS.length].url;
                onVideoFallback(clip.id, fallbackUrl);
              }}
              onLoadedMetadata={(e) => onVideoMetadataLoad(clip.id, e)}
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                const tStart = clip.trimStart || 0;
                const tEnd = clip.trimEnd || video.duration || Infinity;
                
                if (video.currentTime < tStart) {
                  video.currentTime = tStart;
                }
                if (video.currentTime > tEnd) {
                  video.currentTime = tStart;
                  video.play().catch(() => {});
                }
              }}
            />
          ) : (
            <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
              {(clip.thumbnailUrl || dynamicPlaceholderThumbnails[clip.id]) ? (
                <img
                  src={clip.thumbnailUrl || dynamicPlaceholderThumbnails[clip.id]}
                  alt={clip.caption || 'Clip preview'}
                  className="w-full h-full object-cover opacity-60 filter blur-[1px]"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-950/40 via-zinc-900 to-black flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                    <Play size={20} className="ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Double Tap Heart Overlay */}
          {doubleTapHearts[clip.id] && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0.3, 1.3, 1.0, 1.2, 0], opacity: [0, 1, 1, 1, 0] }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute pointer-events-none z-30 flex items-center justify-center bg-black/15 backdrop-blur-[1px] p-6 rounded-full"
            >
              <Heart className="text-rose-500 fill-rose-500 stroke-none drop-shadow-xl" size={80} />
            </motion.div>
          )}

          {/* Sound mute state feedback */}
          {soundOverlay.visible && idx === currentIndex && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.8 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="absolute pointer-events-none z-30 bg-black/70 p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 border border-white/10 shadow-2xl backdrop-blur-md"
            >
              {soundOverlay.muted ? (
                <>
                  <VolumeX className="text-white fill-white/10" size={32} />
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">{language === 'ka' ? 'დამუტდა' : 'Muted'}</span>
                </>
              ) : (
                <>
                  <Volume2 className="text-white fill-white/10" size={32} />
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">{language === 'ka' ? 'ხმა ჩაირთო' : 'Unmuted'}</span>
                </>
              )}
            </motion.div>
          )}

          {/* Thumbnail or blurred skeleton overlay while initializing / loading */}
          {!loadedVideoIds[clip.id] && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950 overflow-hidden">
              {(dynamicPlaceholderThumbnails[clip.id] || clip.thumbnailUrl) ? (
                <img
                  referrerPolicy="no-referrer"
                  src={dynamicPlaceholderThumbnails[clip.id] || clip.thumbnailUrl}
                  alt="Loading clip preview..."
                  className="w-full h-full object-cover pointer-events-none opacity-60 blur-xs scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-purple-950/40 via-zinc-900/80 to-zinc-950 animate-pulse" />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-xs">
                <div className="p-3.5 rounded-full bg-purple-500/10 border border-purple-500/20 backdrop-blur-md shadow-2xl">
                  <svg className="animate-spin h-7 w-7 text-purple-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-purple-300 uppercase animate-pulse">
                  {language === 'ka' ? 'ვიდეო იტვირთება...' : 'Initializing Reel...'}
                </span>
              </div>
            </div>
          )}
          
          {/* Fallback player overlay */}
          {failedVideoIds[clip.id] && (
            <div className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center p-6 text-center gap-4 pointer-events-auto">
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full animate-pulse">
                <AlertCircle size={28} />
              </div>
              <h4 className="text-xs font-black uppercase text-red-400 tracking-wider">
                {language === 'ka' ? 'შეცდომა კლიპის ჩართვისას' : 'Decoder Error / Format Unsupported'}
              </h4>
              <p className="text-[10px] sm:text-[11px] text-proton-muted max-w-[280px] leading-relaxed">
                {language === 'ka' 
                  ? 'ბრაუზერს არ აქვს ამ ვიდეოს კოდეკის (მაგ. HEVC) მხარდაჭერა. გთხოვთ გამოიყენოთ MP4.' 
                  : 'This specific video codec (e.g. HEVC/QuickTime) is not supported by your browser.'}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const fallbackUrl = PRESET_LOOPS[idx % PRESET_LOOPS.length].url;
                  onVideoFallback(clip.id, fallbackUrl);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold hover:bg-purple-500/30 transition-all cursor-pointer"
              >
                {language === 'ka' ? 'დემო ვიდეოს ჩართვა' : 'Play standard demo loop'}
              </button>
            </div>
          )}
          
          {/* Glitch overlay */}
          {activeFilter === 'glitch' && (
            <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,_rgba(255,0,0,0.06),_rgba(0,255,0,0.02),_rgba(0,0,255,0.06))] bg-[size:100%_4px,_3px_100%] opacity-75 mix-blend-overlay animate-pulse" />
          )}
          
          {/* Buffering Loader */}
          <AnimatePresence>
            {isBuffering && idx === currentIndex && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute pointer-events-none z-10 bg-black/20 p-4 rounded-full flex items-center justify-center"
              >
                <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Pause icon overlay */}
          <AnimatePresence>
            {!isPlaying && idx === currentIndex && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.7 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="absolute pointer-events-none z-10 bg-black/40 p-4 rounded-full shadow-2xl backdrop-blur-sm"
              >
                <Play className="text-white fill-white ml-0.5" size={32} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Custom Play Progress Bar Timeline */}
          {idx === currentIndex && (
            <ReelProgressBar 
              videoElement={videoElement} 
              clip={clip} 
            />
          )}
        </div>

        {/* TOP OVERLAYS (RATIO INDICATOR & VOLUME TOGGLE) */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold text-white/90 border border-white/15 shadow-lg flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span>{idx + 1} / {totalClips}</span>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="p-2.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white hover:bg-black/85 hover:scale-105 transition-all pointer-events-auto cursor-pointer shadow-lg"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>

        {/* RIGHT-SIDE OVERLAY ACTION BAR */}
        <div className="absolute right-3.5 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] md:bottom-6 z-20 flex flex-col items-center gap-2.5 sm:gap-3.5 md:gap-4.5 pointer-events-none">
          
          {/* Creator avatar bubble */}
          <div className="relative group pointer-events-auto">
            <button
              onClick={() => onOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}
              className="w-11 h-11 rounded-full border-2 border-purple-500 overflow-hidden bg-zinc-900 hover:scale-105 transition-all shadow-xl flex items-center justify-center text-white cursor-pointer"
            >
              {clip.creatorAvatar ? (
                <img referrerPolicy="no-referrer" src={clip.creatorAvatar} alt={clip.creatorName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={18} />
              )}
            </button>
            <button 
              onClick={() => onOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-purple-500 hover:bg-purple-400 text-white rounded-full p-0.5 hover:scale-110 transition-all shadow-md cursor-pointer"
            >
              <Plus size={10} className="stroke-[3]" />
            </button>
          </div>

          {/* Like button */}
          <div className="flex flex-col items-center gap-1 pointer-events-auto">
            <motion.button
              whileTap={{ scale: 0.75 }}
              onClick={() => onLikeToggle(clip)}
              className={cn(
                "min-w-[44px] min-h-[44px] p-3 rounded-full bg-black/50 backdrop-blur-md border transition-all shadow-xl cursor-pointer hover:scale-110 flex items-center justify-center",
                isLikedByMe 
                  ? "border-red-500/50 text-red-500 bg-red-500/20 shadow-red-500/20" 
                  : "border-white/15 text-white hover:bg-black/75"
              )}
            >
              <Heart className={cn("h-5 w-5", isLikedByMe && "fill-red-500")} />
            </motion.button>
            <span className="text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {clip.likesCount || 0}
            </span>
          </div>

          {/* Comments button */}
          <div className="flex flex-col items-center gap-1 pointer-events-auto">
            <button
              onClick={onOpenComments}
              className="min-w-[44px] min-h-[44px] p-3 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white hover:bg-black/75 hover:scale-110 transition-all shadow-xl cursor-pointer flex items-center justify-center"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <span className="text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {commentsCount}
            </span>
          </div>

          {/* Share button */}
          <div className="flex flex-col items-center gap-1 pointer-events-auto">
            <button
              onClick={() => onShareClip(clip)}
              className="min-w-[44px] min-h-[44px] p-3 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white hover:bg-black/75 hover:scale-110 transition-all shadow-xl cursor-pointer flex items-center justify-center"
              title="Share Reel"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile "More Tools" button (compact toggle for small screens) */}
          <div className="flex md:hidden flex-col items-center gap-1 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileMoreOpen((prev) => !prev);
              }}
              className={cn(
                "min-w-[44px] min-h-[44px] p-3 rounded-full border backdrop-blur-md transition-all shadow-xl cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center relative",
                isMobileMoreOpen 
                  ? "bg-purple-600/60 border-purple-400 text-white shadow-purple-500/30" 
                  : "bg-black/50 border-white/15 text-white hover:bg-black/75"
              )}
              title={language === 'ka' ? 'მეტი ხელსაწყო' : 'More actions'}
              aria-label="More actions"
              aria-expanded={isMobileMoreOpen}
            >
              <MoreVertical className="h-5 w-5" />
              {/* Active indicator dot if secondary feature is currently engaged */}
              {(showFiltersPanel || isTrimmed || clip.productId) && !isMobileMoreOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-400 border border-black" />
              )}
            </button>
            <span className="text-[9px] font-bold text-white/90 drop-shadow">
              {language === 'ka' ? 'მეტი' : 'More'}
            </span>
          </div>

          {/* Filters toggle button (Desktop only - in rail) */}
          <div className="hidden md:flex flex-col items-center gap-1 pointer-events-auto">
            <button
              onClick={onToggleFiltersPanel}
              className={cn(
                "p-3 rounded-full border backdrop-blur-md transition-all shadow-xl cursor-pointer hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center",
                showFiltersPanel 
                  ? "bg-purple-600/50 border-purple-400 text-purple-200 shadow-purple-500/30" 
                  : "bg-black/50 border-white/15 text-white hover:bg-black/75"
              )}
              title="Filters"
            >
              <Sparkles className="h-5 w-5" />
            </button>
          </div>

          {/* Video Trim & Precision Controls button (Desktop only - in rail) */}
          <div className="hidden md:flex flex-col items-center gap-1 pointer-events-auto">
            <button
              onClick={() => onRunAutoFix(clip)}
              className={cn(
                "p-3 rounded-full border backdrop-blur-md transition-all shadow-xl cursor-pointer hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center",
                isTrimmed
                  ? "bg-purple-600/50 border-purple-400 text-purple-200 shadow-purple-500/30"
                  : "bg-black/50 border-white/15 text-white hover:bg-black/75"
              )}
              title={language === 'ka' ? 'ვიდეოს მოჭრა და მორგება' : 'Trim & Adjust Video'}
              aria-label="Trim and adjust video"
            >
              <Scissors className="h-5 w-5 text-purple-300" />
            </button>
            <span className="text-[9px] font-bold text-white/90 drop-shadow">
              {language === 'ka' ? 'მოჭრა' : 'Trim'}
            </span>
          </div>

          {/* Tag Product Button (Creator / Merchant) (Desktop only - in rail) */}
          {(clip.creatorId === currentUser?.uid || (currentUser && hasSellerListings)) && (
            <div className="hidden md:flex flex-col items-center gap-1 pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTagging(clip);
                }}
                className={cn(
                  "p-3 rounded-full border backdrop-blur-md transition-all shadow-xl cursor-pointer hover:scale-110 min-w-[44px] min-h-[44px] flex items-center justify-center",
                  clip.productId 
                    ? "bg-pink-600/50 border-pink-400 text-pink-200 shadow-pink-500/30" 
                    : "bg-black/50 border-white/15 text-white hover:bg-black/75"
                )}
                title={language === 'ka' ? 'პროდუქტის მიბმა' : 'Tag Product'}
              >
                <Tag className="h-5 w-5 text-pink-300" />
              </button>
              <span className="text-[9px] font-bold text-white/90 drop-shadow">
                {clip.productId ? (language === 'ka' ? 'მიბმულია' : 'Tagged') : (language === 'ka' ? 'მიბმა' : 'Tag')}
              </span>
            </div>
          )}

          {/* Delete button (owner only) (Desktop only - in rail) */}
          {clip.creatorId === currentUser?.uid && (
            <div className="hidden md:flex flex-col items-center gap-1 pointer-events-auto">
              <button
                onClick={() => onDeleteClip(clip)}
                className="p-3 rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/40 text-red-400 hover:bg-red-500/40 hover:scale-110 transition-all shadow-xl cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Delete Clip"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Spinning Audio Track Vinyl/Disc Icon */}
          <div className="mt-1 pointer-events-auto">
            <div className={cn(
              "w-9 h-9 rounded-full bg-gradient-to-tr from-zinc-900 via-zinc-800 to-black border-2 border-white/20 p-1 flex items-center justify-center shadow-2xl overflow-hidden",
              isPlaying && idx === currentIndex && "animate-spin [animation-duration:5s]"
            )}>
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-black border border-white/30" />
              </div>
            </div>
          </div>

        </div>

        {/* MOBILE "MORE TOOLS" POPOVER MENU */}
        <AnimatePresence>
          {isMobileMoreOpen && (
            <>
              {/* Tap backdrop to dismiss */}
              <div 
                className="absolute inset-0 z-30 pointer-events-auto bg-black/30 backdrop-blur-[2px] transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileMoreOpen(false);
                }}
              />
              {/* Menu Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                transition={{ duration: 0.15 }}
                className="absolute right-16 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-40 w-48 max-w-[calc(100vw-5rem)] rounded-2xl bg-zinc-950/95 border border-white/20 shadow-2xl backdrop-blur-xl p-1.5 flex flex-col gap-1 pointer-events-auto select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-3 py-1.5 flex items-center justify-between border-b border-white/10 text-white/50">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                    {language === 'ka' ? 'ხელსაწყოები' : 'Clip Tools'}
                  </span>
                  <button
                    onClick={() => setIsMobileMoreOpen(false)}
                    className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Filters */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFiltersPanel();
                    setIsMobileMoreOpen(false);
                  }}
                  className={cn(
                    "w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between text-left text-xs font-semibold transition-all cursor-pointer",
                    showFiltersPanel 
                      ? "bg-purple-600/30 text-purple-200 border border-purple-500/40" 
                      : "text-white/90 hover:bg-white/10 active:bg-white/15"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={16} className={showFiltersPanel ? "text-purple-300" : "text-purple-400"} />
                    <span>{language === 'ka' ? 'ფილტრები' : 'Filters'}</span>
                  </div>
                  {showFiltersPanel && (
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  )}
                </button>

                {/* Trim & Adjust */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRunAutoFix(clip);
                    setIsMobileMoreOpen(false);
                  }}
                  className={cn(
                    "w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between text-left text-xs font-semibold transition-all cursor-pointer",
                    isTrimmed
                      ? "bg-purple-600/30 text-purple-200 border border-purple-500/40"
                      : "text-white/90 hover:bg-white/10 active:bg-white/15"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Scissors size={16} className="text-purple-300" />
                    <span>{language === 'ka' ? 'ვიდეოს მოჭრა' : 'Trim & Adjust'}</span>
                  </div>
                  {isTrimmed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 font-mono font-bold">
                      {language === 'ka' ? 'მოჭრილია' : 'Trimmed'}
                    </span>
                  )}
                </button>

                {/* Tag Product (Creator / Merchant) */}
                {(clip.creatorId === currentUser?.uid || (currentUser && hasSellerListings)) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTagging(clip);
                      setIsMobileMoreOpen(false);
                    }}
                    className={cn(
                      "w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-between text-left text-xs font-semibold transition-all cursor-pointer",
                      clip.productId
                        ? "bg-pink-600/30 text-pink-200 border border-pink-500/40"
                        : "text-white/90 hover:bg-white/10 active:bg-white/15"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Tag size={16} className="text-pink-300" />
                      <span>{clip.productId ? (language === 'ka' ? 'პროდუქტი მიბმულია' : 'Tagged') : (language === 'ka' ? 'პროდუქტის მიბმა' : 'Tag Product')}</span>
                    </div>
                    {clip.productId && (
                      <span className="w-2 h-2 rounded-full bg-pink-400" />
                    )}
                  </button>
                )}

                {/* Delete button (owner only) */}
                {clip.creatorId === currentUser?.uid && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClip(clip);
                      setIsMobileMoreOpen(false);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-2.5 text-left text-xs font-semibold text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-all cursor-pointer"
                  >
                    <Trash2 size={16} className="text-red-400" />
                    <span>{language === 'ka' ? 'კლიპის წაშლა' : 'Delete Clip'}</span>
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* BOTTOM-LEFT OVERLAY: CREATOR PROFILE, CAPTION, TAGS & AUDIO TRACK */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-5 pr-16 md:pr-20 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-5 bg-gradient-to-t from-black/95 via-black/80 to-transparent pointer-events-none flex flex-col gap-2.5 text-left">
          
          {/* Creator Row */}
          <div className="flex items-center gap-2 pointer-events-auto min-w-0 max-w-[calc(100%-4rem)]">
            <button
              onClick={() => onOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}
              className="font-black text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] hover:underline flex items-center gap-1.5 cursor-pointer truncate shrink min-w-0"
            >
              <span className="truncate">@{clip.creatorName}</span>
              {clip.creatorId.startsWith('proton-system') && (
                <CheckCircle2 size={14} className="text-purple-400 fill-white stroke-[2.5] shrink-0" />
              )}
            </button>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono font-bold uppercase tracking-wider shrink-0">
              {clip.creatorId.startsWith('proton-system') ? 'Official' : 'Creator'}
            </span>
          </div>

          {/* Caption & Hashtags */}
          {(() => {
            const isExpanded = !!expandedCaptions[clip.id];
            const rawCaption = clip.caption || '';
            const isLongCaption = rawCaption.length > 70 || rawCaption.split('\n').length > 3;

            return (
              <div className="pointer-events-auto w-full">
                <div className={cn(
                  "transition-all duration-300",
                  isExpanded 
                    ? "max-h-40 overflow-y-auto pr-2 bg-black/60 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 shadow-xl custom-scrollbar" 
                    : "max-h-none overflow-hidden"
                )}>
                  <p className={cn(
                    "text-xs font-normal text-white/95 leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] select-text",
                    !isExpanded && "line-clamp-3"
                  )}>
                    {rawCaption.split(' ').map((word: string, i: number) => {
                      if (word.startsWith('#')) {
                        return (
                          <span 
                            key={i} 
                            onClick={(e) => {
                              e.stopPropagation();
                              onHashtagClick(word);
                            }}
                            className="text-purple-300 font-bold hover:underline cursor-pointer mr-1"
                          >
                            {word}{' '}
                          </span>
                        );
                      }
                      return word + ' ';
                    })}
                  </p>
                </div>

                {isLongCaption && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpandCaption(clip.id);
                    }}
                    className="mt-1 text-[11px] font-bold text-purple-300 hover:text-purple-200 hover:underline cursor-pointer flex items-center gap-1 focus:outline-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                  >
                    <span>
                      {isExpanded 
                        ? (language === 'ka' ? 'ნაკლების ჩვენება' : 'Show less') 
                        : (language === 'ka' ? '...მეტი' : '...more')}
                    </span>
                    <ChevronDown size={12} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                  </button>
                )}
              </div>
            );
          })()}

          {/* Tagged Product Interactive Overlay Widget */}
          {hasProduct && clip.productInfo && (() => {
            const isSoldOut = (clip.productInfo as any).status === 'sold' || (clip.productInfo as any).isSold || (clip.productInfo as any).quantity === 0;

            if (isSoldOut) {
              return (
                <div 
                  className="bg-black/80 border border-gray-600/40 rounded-xl p-2 max-w-xs pointer-events-auto flex items-center justify-between gap-2.5 shadow-xl backdrop-blur-md opacity-80"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gray-500/10 border border-gray-500/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {clip.productInfo.image ? (
                        <img referrerPolicy="no-referrer" src={clip.productInfo.image} className="w-full h-full object-cover grayscale" alt="" />
                      ) : (
                        <ShoppingBag size={13} className="text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 leading-tight">
                      <h4 className="text-[10px] font-bold text-gray-300 truncate max-w-[120px]">
                        {clip.productInfo.title}
                      </h4>
                      <p className="text-[9px] font-mono text-gray-400 line-through font-bold">
                        ${clip.productInfo.price}
                      </p>
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded-lg bg-gray-700 text-[9px] font-bold text-gray-300 flex items-center gap-0.5">
                    <span>{language === 'ka' ? 'ამოსყიდულია' : 'Sold Out'}</span>
                  </div>
                </div>
              );
            }

            return (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCheckout(clip);
                }}
                className="bg-black/85 hover:bg-black border border-pink-500/50 rounded-xl p-2 max-w-xs pointer-events-auto flex items-center justify-between gap-2.5 shadow-2xl shadow-pink-500/10 backdrop-blur-md transition-all cursor-pointer group hover:scale-[1.02]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/30 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                    {clip.productInfo.image ? (
                      <img referrerPolicy="no-referrer" src={clip.productInfo.image} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <ShoppingBag size={13} className="text-pink-400" />
                    )}
                    <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-black animate-ping" />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <h4 className="text-[10px] font-bold text-white truncate max-w-[125px]">
                      {clip.productInfo.title}
                    </h4>
                    <p className="text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                      ${clip.productInfo.price}
                      <span className="text-[7px] text-pink-300 font-sans uppercase font-extrabold bg-pink-500/20 px-1 rounded">
                        {language === 'ka' ? 'კლიპიდან' : 'Clip Tag'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 group-hover:from-pink-500 group-hover:to-purple-500 text-[9px] font-extrabold text-white flex items-center gap-1 shadow-md transition-all">
                  <ShoppingBag size={10} />
                  <span>{language === 'ka' ? 'ყიდვა' : 'Buy Now'}</span>
                  <ChevronRight size={10} />
                </div>
              </div>
            );
          })()}

          {/* Sound track info marquee */}
          <div className="flex items-center gap-2 pt-0.5 text-gray-200 pointer-events-auto">
            <div className="p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
              <Music size={12} className="text-purple-300 animate-pulse" />
            </div>
            <div className="text-[10px] font-medium overflow-hidden max-w-[180px] relative h-4 flex items-center">
              <div className="whitespace-nowrap animate-[marquee_12s_linear_infinite] font-mono text-white/90 drop-shadow">
                {clip.soundName || `Original Audio - @${clip.creatorName}`}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
