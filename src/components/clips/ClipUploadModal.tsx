import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  UploadCloud, 
  Trash2, 
  RefreshCw, 
  AlertCircle
} from 'lucide-react';
import { MarketplaceItem } from '../../types';
import { cn } from '../../lib/utils';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface VideoQualityWarning {
  sizeMB: number;
  width: number;
  height: number;
  isHighRes: boolean;
  isLargeFile: boolean;
  isMovOrQuickTime?: boolean;
  isDecodeWarning?: boolean;
  acknowledged: boolean;
}

export interface ClipUploadModalProps {
  isOpen: boolean;
  isDragging?: boolean;
  localVideoFile: File | null;
  newClipVideoUrl: string;
  newClipCaption: string;
  isUploading: boolean;
  uploadProgress: number;
  language: 'en' | 'ka';
  onClose: () => void;
  setNewClipCaption: (caption: string) => void;
  onLocalFileSelect: (file: File) => void;
  onRemoveLocalFile: () => void;
  onSubmitCreate: () => void;
  // Optional compatibility props
  uploadStep?: number;
  selectedPresetId?: string;
  newClipSound?: string;
  newClipProductId?: string;
  newClipThumbnail?: string;
  newClipDuration?: number;
  isGeneratingThumbnail?: boolean;
  listings?: MarketplaceItem[];
  videoQualityWarning?: VideoQualityWarning | null;
  onAcknowledgeQualityWarning?: () => void;
  setUploadStep?: React.Dispatch<React.SetStateAction<number>>;
  setNewClipVideoUrl?: (url: string) => void;
  setSelectedPresetId?: (id: string) => void;
  setNewClipSound?: (sound: string) => void;
  setNewClipProductId?: (id: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onHashtagClick?: (tag: string) => void;
  onStepNext?: () => void;
}

export function ClipUploadModal({
  isOpen,
  localVideoFile,
  newClipVideoUrl,
  newClipCaption,
  isUploading,
  uploadProgress,
  language,
  onClose,
  setNewClipCaption,
  onLocalFileSelect,
  onRemoveLocalFile,
  onSubmitCreate,
}: ClipUploadModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>({
    isOpen,
    onClose: () => !isUploading && onClose(),
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

  const validateAndSelectFile = (file: File) => {
    setErrorMessage(null);

    // Validate type
    const validExtensions = ['.mp4', '.mov', '.webm'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => fileNameLower.endsWith(ext));
    const isValidType = file.type.startsWith('video/') || hasValidExt;

    if (!isValidType) {
      setErrorMessage(
        language === 'ka' 
          ? 'მხარდაჭერილია მხოლოდ MP4, MOV და WEBM ვიდეო ფაილები.' 
          : 'Only MP4, MOV, and WEBM video formats are supported.'
      );
      return;
    }

    // Validate size (max 50 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(
        language === 'ka' 
          ? `ვიდეოს ზომაა ${sizeMB} MB. მაქსიმალური დაშვებული ზომაა 50 MB.` 
          : `File size is ${sizeMB} MB. Maximum allowed size is 50 MB.`
      );
      return;
    }

    onLocalFileSelect(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemoveLocalFile();
  };

  const handleChangeFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 pb-16 lg:pb-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={language === 'ka' ? 'ვიდეოს დამატება' : 'Add Video'}
        >
          {/* Backdrop click to dismiss */}
          <div className="absolute inset-0" onClick={() => !isUploading && onClose()} />
          
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-lg bg-proton-bg border border-proton-border/30 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10 max-h-[92dvh] sm:max-h-[88vh] my-auto"
          >
            {/* Hidden native file input */}
            <input 
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* 1. Header: სათაური — „ვიდეოს დამატება“ */}
            <div className="p-4 border-b border-proton-border/20 flex items-center justify-between shrink-0 bg-white/[0.02]">
              <h3 className="font-black text-sm sm:text-base text-white tracking-wide">
                {language === 'ka' ? 'ვიდეოს დამატება' : 'Add Video'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                aria-label={language === 'ka' ? 'დახურვა' : 'Close'}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-proton-muted hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              
              {/* Error Alert Message if file validation fails */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              )}

              {/* 2 & 3. ვიდეოს არჩევა / ვიდეოს Preview */}
              {!localVideoFile ? (
                /* STATE A: NO VIDEO SELECTED YET -> დიდი ღილაკი „აირჩიე ვიდეო“ */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
                    dragActive
                      ? "border-purple-500 bg-purple-500/10 scale-[0.99] shadow-lg shadow-purple-500/10"
                      : "border-proton-border/40 bg-proton-bg/40 hover:border-purple-500/50 hover:bg-white/[0.02]"
                  )}
                >
                  <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-3 shadow-inner">
                    <UploadCloud size={36} className="animate-pulse" />
                  </div>
                  
                  {/* დიდი ღილაკი: „აირჩიე ვიდეო“ */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-500/20 transition-all cursor-pointer mb-2"
                  >
                    {language === 'ka' ? 'აირჩიე ვიდეო' : 'Choose Video'}
                  </button>

                  <p className="text-[11px] text-proton-muted mt-1 font-mono uppercase tracking-wider">
                    MP4, MOV, WEBM • {language === 'ka' ? 'მაქს. 50 MB' : 'Max 50 MB'}
                  </p>
                </div>
              ) : (
                /* STATE B: VIDEO SELECTED -> Preview + ფაილის სახელი + შეცვლა + წაშლა */
                <div className="space-y-3">
                  {/* Video Preview */}
                  <div className="w-full max-h-72 sm:max-h-80 aspect-[9/16] mx-auto rounded-2xl overflow-hidden bg-black border border-proton-border/30 shadow-xl relative flex items-center justify-center">
                    <video
                      src={newClipVideoUrl}
                      controls
                      muted
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  </div>

                  {/* File info & action buttons */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate" title={localVideoFile.name}>
                        {localVideoFile.name}
                      </p>
                      <p className="text-[10px] text-proton-muted font-mono">
                        {(localVideoFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* შეცვლა */}
                      <button
                        type="button"
                        onClick={handleChangeFile}
                        disabled={isUploading}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        <RefreshCw size={12} />
                        <span>{language === 'ka' ? 'შეცვლა' : 'Change'}</span>
                      </button>

                      {/* წაშლა */}
                      <button
                        type="button"
                        onClick={handleRemove}
                        disabled={isUploading}
                        className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-[11px] font-bold border border-red-500/25 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                        <span>{language === 'ka' ? 'წაშლა' : 'Remove'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. აღწერის ველი: Placeholder: „დაწერე ვიდეოს აღწერა...“ */}
              <div className="space-y-1.5 pt-1">
                <textarea
                  rows={3}
                  maxLength={300}
                  value={newClipCaption}
                  onChange={(e) => setNewClipCaption(e.target.value)}
                  placeholder={language === 'ka' ? 'დაწერე ვიდეოს აღწერა...' : 'Write a video description...'}
                  disabled={isUploading}
                  className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl p-3 text-xs text-proton-text placeholder:text-proton-muted/60 transition-all resize-none leading-relaxed"
                />
              </div>

            </div>

            {/* 5. გამოქვეყნება: ფანჯრის ბოლოში ერთი მთავარი ღილაკი */}
            <div className="p-3.5 sm:p-4 bg-proton-bg border-t border-proton-border/20 flex items-center justify-between gap-3 shrink-0">
              {/* გაუქმება */}
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-proton-muted hover:text-white transition-all text-xs font-bold cursor-pointer disabled:opacity-40"
              >
                {language === 'ka' ? 'გაუქმება' : 'Cancel'}
              </button>

              <div className="flex items-center gap-3">
                {/* Upload progress indicator */}
                {isUploading && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono">
                    <svg className="animate-spin h-3.5 w-3.5 text-purple-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>
                      {uploadProgress > 0 
                        ? `${language === 'ka' ? 'იტვირთება' : 'Uploading'} ${uploadProgress}%`
                        : (language === 'ka' ? 'ქვეყნდება...' : 'Publishing...')}
                    </span>
                  </div>
                )}

                {/* მთავარი ღილაკი: „გამოქვეყნება“ */}
                <button
                  type="button"
                  onClick={onSubmitCreate}
                  disabled={!localVideoFile || isUploading}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shadow-lg",
                    localVideoFile && !isUploading
                      ? "bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-95 text-white shadow-purple-500/20 active:scale-95"
                      : "bg-white/10 text-proton-muted opacity-40 cursor-not-allowed"
                  )}
                >
                  {language === 'ka' ? 'გამოქვეყნება' : 'Publish'}
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
