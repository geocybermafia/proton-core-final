import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  X, 
  UploadCloud, 
  Check, 
  Video, 
  Music, 
  ShoppingBag, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { MarketplaceItem } from '../../types';
import { cn } from '../../lib/utils';
import { PRESET_LOOPS, formatDuration } from './types';

export interface ClipUploadModalProps {
  isOpen: boolean;
  uploadStep: number;
  isDragging: boolean;
  localVideoFile: File | null;
  selectedPresetId: string;
  newClipVideoUrl: string;
  newClipCaption: string;
  newClipSound: string;
  newClipProductId: string;
  newClipThumbnail: string;
  newClipDuration: number;
  isGeneratingThumbnail: boolean;
  isUploading: boolean;
  uploadProgress: number;
  listings: MarketplaceItem[];
  language: 'en' | 'ka';
  onClose: () => void;
  setUploadStep: React.Dispatch<React.SetStateAction<number>>;
  setNewClipVideoUrl: (url: string) => void;
  setSelectedPresetId: (id: string) => void;
  setNewClipSound: (sound: string) => void;
  setNewClipCaption: (caption: string) => void;
  setNewClipProductId: (id: string) => void;
  onLocalFileSelect: (file: File) => void;
  onRemoveLocalFile: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onHashtagClick: (tag: string) => void;
  onStepNext: () => void;
  onSubmitCreate: () => void;
}

export function ClipUploadModal({
  isOpen,
  uploadStep,
  isDragging,
  localVideoFile,
  selectedPresetId,
  newClipVideoUrl,
  newClipCaption,
  newClipSound,
  newClipProductId,
  newClipThumbnail,
  newClipDuration,
  isGeneratingThumbnail,
  isUploading,
  uploadProgress,
  listings,
  language,
  onClose,
  setUploadStep,
  setNewClipVideoUrl,
  setSelectedPresetId,
  setNewClipSound,
  setNewClipCaption,
  setNewClipProductId,
  onLocalFileSelect,
  onRemoveLocalFile,
  onDragOver,
  onDragLeave,
  onDrop,
  onHashtagClick,
  onStepNext,
  onSubmitCreate,
}: ClipUploadModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 pb-16 lg:pb-4 overflow-y-auto">
          <div className="absolute inset-0" onClick={onClose} />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-2xl bg-proton-bg border border-proton-border/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10 max-h-[88dvh] sm:max-h-[85vh] my-auto"
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-proton-border/20 flex items-center justify-between bg-gradient-to-r from-purple-950/20 to-pink-950/20 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="text-purple-400" size={18} />
                <h3 className="font-black text-xs sm:text-sm text-white">
                  {language === 'ka' ? 'კლიპის ატვირთვა & შექმნა' : 'Proton Creator Studio • New Clip'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-proton-muted hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* Stepper indicator */}
            <div className="px-4 sm:px-6 pt-3 sm:pt-4 pb-2 border-b border-proton-border/10 bg-proton-bg/60 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold text-proton-muted">
                <div className={cn("flex items-center gap-1.5 sm:gap-2", uploadStep >= 1 ? "text-purple-400" : "")}>
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] border", uploadStep >= 1 ? "border-purple-500 bg-purple-500/10" : "border-proton-border/40")}>1</span>
                  <span>{language === 'ka' ? 'ვიდეო' : 'Media'}</span>
                </div>
                <div className="h-[1px] flex-1 bg-proton-border/20 mx-2 sm:mx-3" />
                <div className={cn("flex items-center gap-1.5 sm:gap-2", uploadStep >= 2 ? "text-purple-400" : "")}>
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] border", uploadStep >= 2 ? "border-purple-500 bg-purple-500/10" : "border-proton-border/40")}>2</span>
                  <span>{language === 'ka' ? 'აღწერა' : 'Caption'}</span>
                </div>
                <div className="h-[1px] flex-1 bg-proton-border/20 mx-2 sm:mx-3" />
                <div className={cn("flex items-center gap-1.5 sm:gap-2", uploadStep >= 3 ? "text-purple-400" : "")}>
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] border", uploadStep >= 3 ? "border-purple-500 bg-purple-500/10" : "border-proton-border/40")}>3</span>
                  <span>{language === 'ka' ? 'ხმა & შოპი' : 'Audio & Shop'}</span>
                </div>
              </div>
            </div>

            {/* Modal Body with Custom Scrollbar */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 max-h-[60vh] sm:max-h-[70vh] space-y-4 sm:space-y-5 custom-scrollbar">
              
              {/* STEP 1: VIDEO MEDIA SOURCE SELECTION */}
              {uploadStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-5"
                >
                  {/* Left/Main Column: Source Options */}
                  <div className="md:col-span-7 space-y-5">
                    
                    {/* DRAG AND DROP ZONE */}
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-widest text-proton-muted mb-2">
                        {language === 'ka' ? 'ვარიანტი ა: ატვირთე ვიდეო' : 'Option A: Upload local video'}
                      </span>
                      
                      <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => document.getElementById('proton-upload-file-input')?.click()}
                        className={cn(
                          "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-white/5",
                          isDragging 
                            ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10 scale-[0.99]" 
                            : localVideoFile 
                              ? "border-emerald-500/50 bg-emerald-500/5" 
                              : "border-proton-border/30 bg-proton-bg/40 hover:border-purple-500/40"
                        )}
                      >
                        <input 
                          id="proton-upload-file-input"
                          type="file"
                          accept="video/mp4,video/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              onLocalFileSelect(e.target.files[0]);
                            }
                          }}
                        />
                        
                        {localVideoFile ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              <Check size={28} className="stroke-[3] animate-bounce" />
                            </div>
                            <p className="text-xs font-bold text-white max-w-[200px] truncate">
                              {localVideoFile.name}
                            </p>
                            <p className="text-[10px] text-proton-muted font-mono uppercase tracking-widest">
                              {(localVideoFile.size / (1024 * 1024)).toFixed(2)} MB • MP4 Video
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveLocalFile();
                              }}
                              className="mt-2 px-3 py-1 rounded-lg bg-red-600/25 hover:bg-red-600/40 text-red-300 text-[10px] font-bold border border-red-500/30 transition-all"
                            >
                              {language === 'ka' ? 'ფაილის წაშლა' : 'Remove File'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="p-3 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-1">
                              <UploadCloud size={28} className="animate-pulse" />
                            </div>
                            <p className="text-xs font-black text-white">
                              {language === 'ka' ? 'ჩააგდე ვიდეო აქ ან დააჭირე ასარჩევად' : 'Drag & drop file here or click to browse'}
                            </p>
                            <p className="text-[10px] text-proton-muted leading-relaxed max-w-[240px]">
                              {language === 'ka' ? 'რეკომენდირებულია ვერტიკალური .mp4 ფორმატი' : 'Vertical aspect ratio recommended (.mp4 format, max 50MB)'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CINEMATOGRAPHIC TEMPLATES */}
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-widest text-proton-muted mb-2">
                        {language === 'ka' ? 'ვარიანტი ბ: აირჩიე მაღალი ხარისხის ვიდეო ნიმუში' : 'Option B: Choose cinematographic loop'}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {PRESET_LOOPS.map((p) => {
                          const isSelected = selectedPresetId === p.id && !localVideoFile && !newClipVideoUrl.startsWith('http');
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPresetId(p.id);
                                setNewClipVideoUrl('');
                                setNewClipSound(p.sound);
                              }}
                              className={cn(
                                "p-2.5 text-left rounded-xl border text-xs font-bold transition-all flex flex-col gap-1 relative overflow-hidden group",
                                isSelected
                                  ? "bg-purple-600/20 text-purple-400 border-purple-500 ring-1 ring-purple-500/20"
                                  : "bg-proton-bg/40 border-proton-border/20 text-proton-muted hover:text-white hover:bg-proton-bg/60"
                              )}
                            >
                              <span className="font-extrabold block truncate z-10">
                                {language === 'ka' ? p.nameGe : p.nameEn}
                              </span>
                              <span className="text-[9px] text-proton-muted opacity-85 truncate block font-mono z-10">
                                🎵 {p.sound}
                              </span>
                              {isSelected && (
                                <div className="absolute right-1 top-1 text-purple-400 bg-purple-500/10 rounded-full p-0.5 border border-purple-500/20">
                                  <Check size={8} className="stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* CUSTOM PASTE URL */}
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-widest text-proton-muted mb-1.5">
                        {language === 'ka' ? 'ვარიანტი გ: პირდაპირი ბმული' : 'Option C: Paste custom MP4 link'}
                      </span>
                      <div className="relative">
                        <input
                          type="url"
                          value={localVideoFile ? '' : newClipVideoUrl}
                          disabled={!!localVideoFile}
                          onChange={(e) => {
                            setNewClipVideoUrl(e.target.value);
                            setSelectedPresetId('');
                          }}
                          placeholder="https://example.com/cinematic-reel.mp4"
                          className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl py-2 px-3 text-xs text-proton-text placeholder:text-proton-muted/60 transition-all disabled:opacity-40"
                        />
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Dynamic Live Preview Player & Captured Thumbnail */}
                  <div className="md:col-span-5 flex flex-col items-stretch justify-start bg-white/5 border border-white/5 rounded-2xl p-4 self-stretch space-y-4">
                    
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-proton-muted mb-1 flex items-center gap-1.5 border-b border-white/5 pb-2">
                      <Sparkles size={11} className="text-purple-400 animate-pulse" />
                      {language === 'ka' ? 'მედია პანელი' : 'Media Preview Hub'}
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Left half: Live Video Preview */}
                      <div className="flex flex-col space-y-2">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-proton-muted truncate flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                          {language === 'ka' ? 'პრევიუ' : 'Live Player'}
                        </span>
                        
                        {(() => {
                          const previewUrl = newClipVideoUrl || PRESET_LOOPS.find(p => p.id === selectedPresetId)?.url;
                          if (previewUrl) {
                            return (
                              <div className="w-full aspect-[9/16] rounded-xl overflow-hidden relative border border-proton-border/20 bg-black shadow-lg">
                                <video
                                  src={previewUrl}
                                  controls
                                  muted
                                  playsInline
                                  loop
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-[7px] font-bold text-purple-300 uppercase tracking-widest border border-purple-500/20">
                                  {language === 'ka' ? 'აქტიური' : 'Live'}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="w-full aspect-[9/16] rounded-xl border border-dashed border-proton-border/20 flex flex-col items-center justify-center text-center p-2 bg-proton-bg/40">
                              <Video className="text-proton-muted opacity-25 mb-1" size={16} />
                              <p className="text-[8px] text-proton-muted leading-relaxed">
                                {language === 'ka' ? 'აირჩიეთ წყარო' : 'Select source'}
                              </p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right half: Captured Cover */}
                      <div className="flex flex-col space-y-2">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-proton-muted truncate flex items-center gap-1">
                          <Sparkles size={9} className="text-pink-400" />
                          {language === 'ka' ? 'გარეკანი' : 'Cover'}
                        </span>

                        {isGeneratingThumbnail ? (
                          <div className="w-full aspect-[9/16] rounded-xl border border-dashed border-proton-border/20 flex flex-col items-center justify-center bg-proton-bg/20 text-center gap-1.5 p-2">
                            <svg className="animate-spin h-3 w-3 text-pink-500" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="text-[7px] uppercase tracking-wider text-proton-muted font-bold">
                              {language === 'ka' ? 'იჭრება...' : 'Capturing...'}
                            </span>
                          </div>
                        ) : newClipThumbnail ? (
                          <div className="w-full aspect-[9/16] rounded-xl overflow-hidden relative border border-pink-500/30 bg-black shadow-lg">
                            <img
                              src={newClipThumbnail}
                              alt="Canvas Cover"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-pink-500/80 text-[6px] font-black text-white uppercase tracking-widest border border-pink-400/20 shadow-md">
                              {language === 'ka' ? 'გარეკანი' : 'Cover'}
                            </div>
                            <div className="absolute bottom-1.5 left-1 right-1 bg-black/60 backdrop-blur-xs py-0.5 rounded border border-white/5 text-[7px] text-gray-300 font-mono text-center truncate">
                              {newClipDuration > 0 ? formatDuration(newClipDuration) : 'Auto'}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full aspect-[9/16] rounded-xl border border-dashed border-proton-border/20 flex flex-col items-center justify-center text-center p-2 bg-proton-bg/40">
                            <Sparkles className="text-proton-muted opacity-25 mb-1" size={14} />
                            <p className="text-[8px] text-proton-muted leading-relaxed">
                              {language === 'ka' ? 'ავტო გარეკანი' : 'Auto cover'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: DETAILS & HASHTAGS */}
              {uploadStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-5"
                >
                  {/* Caption Input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-extrabold uppercase tracking-widest text-proton-muted">
                        {language === 'ka' ? 'ვიდეოს სათაური & აღწერა' : 'Video Caption & Description'}
                      </label>
                      <span className="text-[10px] font-mono text-proton-muted">
                        {newClipCaption.length}/300
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      maxLength={300}
                      value={newClipCaption}
                      onChange={(e) => setNewClipCaption(e.target.value)}
                      placeholder={language === 'ka' ? 'აღწერე შენი მოკლე ვიდეო... გამოიყენე ჰეშთეგები (მაგ. #wool #handmade #tbilisi)' : 'Describe your story... Use hashtags to get discovered (e.g. #wool #handmade #handcrafted)'}
                      className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl p-3 text-xs text-proton-text placeholder:text-proton-muted/60 transition-all resize-none font-sans leading-relaxed"
                    />
                  </div>

                  {/* Interactive Suggested Hashtags Row */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-extrabold uppercase tracking-widest text-proton-muted">
                      {language === 'ka' ? 'ინტერაქტიული ჰეშთეგები (დააკლიკე დასამატებლად)' : 'Quick Tags Assistant (tap to toggle)'}
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pb-1 p-0.5 font-sans">
                      {['#handmade', '#craft', '#pottery', '#wool', '#თბილისი', '#clay', '#georgian', '#art', '#knitting', '#cozy', '#travel'].map((tag) => {
                        const isUsed = newClipCaption.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => onHashtagClick(tag)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[10px] font-extrabold transition-all border",
                              isUsed
                                ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-500/20 scale-105"
                                : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-proton-muted italic">
                      {language === 'ka' 
                        ? '💡 სწორი ჰეშთეგები ეხმარება ადგილობრივ მყიდველებს თქვენი ვიდეოების პოვნაში.' 
                        : '💡 High-impact hashtags index your products inside search feeds for marketplace shoppers.'}
                    </p>
                  </div>

                  {/* Live preview caption snippet box */}
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-proton-muted block">
                      {language === 'ka' ? 'როგორ გამოჩნდება კლიპის აღწერა' : 'How it will display'}
                    </span>
                    <p className="text-xs text-white/90 line-clamp-2 leading-relaxed">
                      {newClipCaption.trim() 
                        ? newClipCaption 
                        : (language === 'ka' ? 'ჯერ არაფერია დაწერილი...' : 'Your caption will show up here...')}
                    </p>
                  </div>

                </motion.div>
              )}

              {/* STEP 3: SOUND & PRODUCTS */}
              {uploadStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-5"
                >
                  {/* Selectors Column */}
                  <div className="md:col-span-7 space-y-5">
                    
                    {/* Audio/Music selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-extrabold uppercase tracking-widest text-proton-muted">
                        {language === 'ka' ? 'მუსიკა ან აუდიო ფონი' : 'Audio track / Music name'}
                      </label>
                      <div className="relative">
                        <Music size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-proton-muted" />
                        <input
                          type="text"
                          value={newClipSound}
                          onChange={(e) => setNewClipSound(e.target.value)}
                          placeholder={language === 'ka' ? 'ორიგინალი ხმა ან სიმღერის სახელი' : 'Original Sound or custom music track'}
                          className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl py-2 pl-9 pr-3 text-xs text-proton-text placeholder:text-proton-muted/60 transition-all"
                        />
                      </div>
                    </div>

                    {/* Product Tag dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-extrabold uppercase tracking-widest text-proton-muted">
                        {language === 'ka' ? 'მონიშნე პროდუქტი მარკეტიდან' : 'Tag marketplace product'}
                      </label>
                      <div className="relative">
                        <ShoppingBag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-proton-muted" />
                        <select
                          value={newClipProductId}
                          onChange={(e) => setNewClipProductId(e.target.value)}
                          className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl py-2 pl-9 pr-3 text-xs text-proton-text transition-all appearance-none cursor-pointer"
                        >
                          <option value="">
                            {language === 'ka' ? '-- არ მონიშნო პროდუქტი --' : '-- Do not tag any product --'}
                          </option>
                          {listings.map((item) => (
                            <option key={item.id} value={item.id}>
                              [{item.category}] {item.title} - ${item.price}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[10px] text-proton-muted italic font-sans">
                        {language === 'ka' 
                          ? 'ამით ვიდეოზე გამოჩნდება პირდაპირი ბმული, რომლის მეშვეობითაც მნახველი მომენტალურად იყიდის პროდუქტს.' 
                          : 'This overlays a high-impact clickable checkout card directly on top of the video loops.'}
                      </p>
                    </div>

                  </div>

                  {/* Live Mock Overlay Column */}
                  <div className="md:col-span-5 bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-start self-stretch">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-proton-muted mb-3 flex items-center gap-1.5">
                      <ShoppingBag size={10} className="text-purple-400" />
                      {language === 'ka' ? 'პროდუქტის ბანერის პრევიუ' : 'Live Shop Tag Preview'}
                    </span>

                    {(() => {
                      const selectedProduct = listings.find(l => l.id === newClipProductId);
                      if (selectedProduct) {
                        return (
                          <div className="w-full p-3 bg-black/90 border border-purple-500/30 rounded-xl space-y-2 relative shadow-lg">
                            <span className="absolute top-1.5 right-1.5 text-[7px] font-black uppercase text-purple-400 tracking-wider animate-pulse bg-purple-500/10 px-1 py-0.5 rounded border border-purple-500/20">
                              {language === 'ka' ? 'აქტიურია' : 'LIVE TAG'}
                            </span>
                            
                            <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">
                              {selectedProduct.category}
                            </p>
                            <h5 className="text-xs font-black text-white line-clamp-1">
                              {selectedProduct.title}
                            </h5>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                ${selectedProduct.price}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-purple-600 text-white font-extrabold tracking-wide uppercase">
                                {language === 'ka' ? 'ყიდვა' : 'Shop Now'}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-proton-border/20 rounded-xl bg-proton-bg/20 min-h-[110px]">
                          <ShoppingBag className="text-proton-muted opacity-25 mb-1" size={24} />
                          <p className="text-[10px] text-proton-muted leading-relaxed">
                            {language === 'ka' ? 'მონიშნე პროდუქტი ბანერის სანახავად' : 'Tag a product to preview the shop card overlay'}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                </motion.div>
              )}

            </div>

            {/* ACTION FOOTER */}
            <div className="sticky bottom-0 z-20 shrink-0 pt-3 sm:pt-4 pb-1 sm:pb-0 bg-proton-bg border-t border-proton-border/10 flex items-center justify-between gap-2 sm:gap-3 mt-auto pb-safe">
              
              {/* Back Button */}
              {uploadStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setUploadStep(prev => prev - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-proton-muted hover:text-white transition-all text-xs font-bold"
                >
                  <ChevronLeft size={14} />
                  <span>{language === 'ka' ? 'უკან' : 'Back'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-proton-bg/80 border border-proton-border/20 text-proton-muted hover:text-white transition-all text-xs font-bold"
                >
                  {language === 'ka' ? 'გაუქმება' : 'Cancel'}
                </button>
              )}

              {/* Next / Submit Button */}
              {uploadStep < 3 ? (
                <button
                  type="button"
                  onClick={onStepNext}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-purple-500/10 hover:shadow-lg transition-all"
                >
                  <span>{language === 'ka' ? 'გაგრძელება' : 'Next'}</span>
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={onSubmitCreate}
                  disabled={isUploading}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black shadow-lg shadow-purple-500/20 hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>
                        {uploadProgress > 0 
                          ? `${language === 'ka' ? 'იტვირთება' : 'Uploading'} ${uploadProgress}%`
                          : (language === 'ka' ? 'ქვეყნდება...' : 'Publishing...')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Check size={14} className="stroke-[3]" />
                      <span>{language === 'ka' ? 'გამოქვეყნება კედელზე' : 'Publish to Feed'}</span>
                    </>
                  )}
                </button>
              )}

            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
