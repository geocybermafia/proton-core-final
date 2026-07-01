import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Sparkles, RefreshCw, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateOrEditImage } from '../lib/gemini';
import { translations } from '../translations';

interface AvatarEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar?: string;
  userName: string;
  lang: 'en' | 'ka';
  onSave: (newAvatarBase64: string) => Promise<void>;
}

const AI_SUGGESTIONS = {
  en: [
    { label: "Futuristic Cyber Hacker", prompt: "A sleek high-tech futuristic digital avatar of a cyber hacker with neon cyan accents, cyberpunk art style, 3D render, close-up portrait, dark background." },
    { label: "Minimalist Vector Specialist", prompt: "A minimalist flat vector avatar of a modern tech specialist, elegant gradient background, sleek geometric lines, professional and friendly." },
    { label: "Neon Cyborg Engineer", prompt: "An advanced neon cyborg developer avatar, sci-fi mechanical parts, glowing orange visor, cinematic lighting, conceptual digital art." },
    { label: "3D Glossy Hologram", prompt: "A glossy glass-morphism 3D render hologram of a smart assistant avatar, abstract spherical shapes, rich metallic blue colors." }
  ],
  ka: [
    { label: "კიბერ ჰაკერი", prompt: "A sleek high-tech futuristic digital avatar of a cyber hacker with neon cyan accents, cyberpunk art style, 3D render, close-up portrait, dark background." },
    { label: "მინიმალისტური ვექტორი", prompt: "A minimalist flat vector avatar of a modern tech specialist, elegant gradient background, sleek geometric lines, professional and friendly." },
    { label: "ნეონ კიბორგი", prompt: "An advanced neon cyborg developer avatar, sci-fi mechanical parts, glowing orange visor, cinematic lighting, conceptual digital art." },
    { label: "3D ჰოლოგრამა", prompt: "A glossy glass-morphism 3D render hologram of a smart assistant avatar, abstract spherical shapes, rich metallic blue colors." }
  ]
};

export default function AvatarEditorModal({
  isOpen,
  onClose,
  currentAvatar,
  userName,
  lang,
  onSave
}: AvatarEditorModalProps) {
  const t = translations[lang]?.cabinet || translations.en.cabinet;
  const [activeTab, setActiveTab] = useState<'ai' | 'camera' | 'upload'>('ai');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Camera States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // AI States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Upload States
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // Clean up camera stream on unmount or tab change
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    // When tab changes, stop camera if it's active
    if (activeTab !== 'camera') {
      stopCamera();
    }
  }, [activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: 'user', aspectRatio: 1 },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera activation failed:", err);
      const isPermissionErr = err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError' || (err.message && err.message.includes('Permission'));
      if (isPermissionErr) {
        setCameraError(
          lang === 'ka' 
            ? "კამერაზე წვდომა უარყოფილია ან დახურულია. გთხოვთ მიანიჭოთ ნებართვა ბრაუზერის მისამართების ზოლიდან ან გახსნათ აპლიკაცია ახალ ჩანართში."
            : "Camera access was dismissed or denied. Please grant permission in your browser settings or open this app in a new tab."
        );
      } else {
        setCameraError(
          lang === 'ka'
            ? "კამერა ვერ ჩაირთო. გთხოვთ, შეამოწმოთ მოწყობილობა ან გახსნათ აპლიკაცია ახალ ჩანართში."
            : "Camera activation failed. Please check your device or open this app in a new tab."
        );
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw square crop from video
        const size = Math.min(video.videoWidth, video.videoHeight);
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        
        canvas.width = 400;
        canvas.height = 400;
        ctx.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);
        
        const dataUrl = canvas.toDataURL('image/png');
        setPreviewImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const resultBase64 = await generateOrEditImage(aiPrompt);
      if (resultBase64) {
        setPreviewImage(resultBase64);
      } else {
        throw new Error("No image data returned");
      }
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      setAiError(lang === 'ka' ? "გამოსახულების გენერირება ვერ მოხერხდა. სცადეთ მოგვიანებით ან გამოიყენეთ სხვა მეთოდი." : "AI Image generation failed. Please try again or use another method.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleFileUpload = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError(lang === 'ka' ? "გთხოვთ აირჩიოთ მხოლოდ სურათის ფაილი" : "Please select an image file only");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError(lang === 'ka' ? "სურათის ზომა არ უნდა აღემატებოდეს 2MB-ს" : "Image size must be under 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        setPreviewImage(e.target.result);
      }
    };
    reader.onerror = () => {
      setUploadError(lang === 'ka' ? "ფაილის წაკითხვის შეცდომა" : "Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!previewImage) return;
    setSaving(true);
    try {
      await onSave(previewImage);
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewImage(null);
    if (activeTab === 'camera') {
      startCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg bg-proton-card border border-proton-border rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,242,255,0.15)] z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-proton-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-proton-accent/10 rounded-xl text-proton-accent">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-proton-text">
                  {t.update_avatar}
                </h3>
                <p className="text-[10px] text-proton-muted font-bold uppercase tracking-widest mt-0.5 opacity-60">
                  Profile Identity Node
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 hover:bg-white/5 rounded-xl text-proton-muted hover:text-proton-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Main Preview Container */}
            <div className="flex justify-center">
              <div className="relative w-44 h-44 rounded-3xl bg-gradient-to-br from-proton-accent via-blue-500 to-indigo-600 p-[2px] shadow-2xl">
                <div className="w-full h-full bg-proton-bg rounded-[22px] flex items-center justify-center overflow-hidden relative">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Avatar Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt={userName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-6xl font-black text-proton-accent uppercase">
                      {userName.charAt(0)}
                    </span>
                  )}

                  {/* Saving/Generating Overlays */}
                  {aiGenerating && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
                      <RefreshCw size={24} className="text-proton-accent animate-spin mb-2" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-proton-accent">
                        {t.generating_ai}
                      </span>
                    </div>
                  )}

                  {saving && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                      <RefreshCw size={24} className="text-proton-accent animate-spin mb-2" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-proton-text">
                        SYNCING IDENTITY...
                      </span>
                    </div>
                  )}
                </div>
                
                {previewImage && !saving && !aiGenerating && (
                  <button
                    onClick={handleCancelPreview}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500/20 hover:bg-red-500 border border-red-500/30 text-white rounded-lg transition-colors shadow-lg"
                    title={t.cancel}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Mode Selectors */}
            {!previewImage && !aiGenerating && (
              <div className="grid grid-cols-3 gap-2 bg-proton-bg/40 p-1 border border-proton-border/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                    activeTab === 'ai'
                      ? 'bg-proton-accent text-proton-bg shadow-md'
                      : 'text-proton-muted hover:text-proton-text hover:bg-white/5'
                  }`}
                >
                  <Sparkles size={12} />
                  AI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('camera');
                    startCamera();
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                    activeTab === 'camera'
                      ? 'bg-proton-accent text-proton-bg shadow-md'
                      : 'text-proton-muted hover:text-proton-text hover:bg-white/5'
                  }`}
                >
                  <Camera size={12} />
                  {lang === 'ka' ? "კამერა" : "Camera"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                    activeTab === 'upload'
                      ? 'bg-proton-accent text-proton-bg shadow-md'
                      : 'text-proton-muted hover:text-proton-text hover:bg-white/5'
                  }`}
                >
                  <Upload size={12} />
                  {lang === 'ka' ? "ატვირთვა" : "Upload"}
                </button>
              </div>
            )}

            {/* Tab Contents */}
            <div className="relative min-h-[160px] bg-proton-bg/20 border border-proton-border rounded-2xl p-4">
              {previewImage ? (
                // Image Acquired View
                <div className="h-full flex flex-col items-center justify-center text-center py-4 space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full">
                    <Check size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-proton-text tracking-widest">
                      {lang === 'ka' ? "გამოსახულება მიღებულია" : "Image Node Ready"}
                    </h4>
                    <p className="text-[10px] text-proton-muted font-bold uppercase tracking-widest mt-1">
                      {lang === 'ka' ? "დააჭირეთ შენახვას პროფილის გასაახლებლად" : "Apply avatar to sync changes"}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* AI TAB */}
                  {activeTab === 'ai' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder={t.prompt_placeholder}
                          className="w-full h-20 bg-proton-bg border border-proton-border/80 rounded-xl p-3 text-xs font-bold text-proton-text focus:outline-none focus:border-proton-accent placeholder:text-proton-muted/50 resize-none"
                        />
                        {aiError && (
                          <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                            <AlertCircle size={12} />
                            {aiError}
                          </div>
                        )}
                      </div>

                      {/* Prompt Suggestions */}
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-proton-muted opacity-80">
                          {lang === 'ka' ? "სტილის შაბლონები" : "Style Presets"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {AI_SUGGESTIONS[lang].map((sug, idx) => (
                            <button
                              key={idx}
                              onClick={() => setAiPrompt(sug.prompt)}
                              className="px-2.5 py-1 bg-white/5 hover:bg-proton-accent/10 border border-proton-border hover:border-proton-accent/20 text-[9px] font-bold text-proton-muted hover:text-proton-text rounded-lg transition-all"
                            >
                              {sug.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleAiGenerate}
                        disabled={!aiPrompt.trim() || aiGenerating}
                        className="w-full py-2.5 bg-gradient-to-r from-proton-accent to-blue-600 disabled:from-proton-border disabled:to-proton-border disabled:text-proton-muted text-proton-bg text-xs font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-proton-accent/10"
                      >
                        <Sparkles size={14} />
                        {t.generate_ai}
                      </button>
                    </div>
                  )}

                  {/* CAMERA TAB */}
                  {activeTab === 'camera' && (
                    <div className="flex flex-col items-center justify-center space-y-4">
                      {cameraError ? (
                        <div className="text-center py-6 space-y-3">
                          <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full inline-block">
                            <AlertCircle size={24} />
                          </div>
                          <p className="text-xs font-black text-red-400 uppercase tracking-widest">
                            {cameraError}
                          </p>
                          <button
                            onClick={startCamera}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-proton-border text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                          >
                            {lang === 'ka' ? "ხელახლა ცდა" : "Retry Connection"}
                          </button>
                        </div>
                      ) : (
                        <div className="w-full flex flex-col items-center space-y-3">
                          <div className="relative w-40 h-40 rounded-2xl overflow-hidden border border-proton-border bg-black">
                            {cameraActive ? (
                              <video
                                ref={videoRef}
                                className="w-full h-full object-cover scale-x-[-1]"
                                playsInline
                                muted
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <RefreshCw size={20} className="text-proton-accent animate-spin mb-2" />
                                <span className="text-[9px] font-black text-proton-muted uppercase tracking-widest">
                                  Initializing hardware...
                                </span>
                              </div>
                            )}
                          </div>

                          <canvas ref={canvasRef} className="hidden" />

                          {cameraActive && (
                            <button
                              onClick={capturePhoto}
                              className="px-6 py-2 bg-proton-accent text-proton-bg text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-lg"
                            >
                              {t.capture}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* UPLOAD TAB */}
                  {activeTab === 'upload' && (
                    <div className="space-y-4">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                        className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                          dragOver
                            ? 'border-proton-accent bg-proton-accent/5'
                            : 'border-proton-border hover:border-proton-accent/50 hover:bg-white/5'
                        }`}
                        onClick={() => document.getElementById('avatar-file-input')?.click()}
                      >
                        <Upload
                          size={28}
                          className={`mb-3 transition-colors ${
                            dragOver ? 'text-proton-accent' : 'text-proton-muted'
                          }`}
                        />
                        <p className="text-xs font-black text-proton-text uppercase tracking-widest">
                          {dragOver ? (lang === 'ka' ? "ჩააგდეთ ფაილი" : "Drop File Here") : t.upload_file}
                        </p>
                        <p className="text-[9px] text-proton-muted font-bold uppercase tracking-widest mt-1 opacity-70">
                          Supports PNG, JPG, WEBP (Max 2MB)
                        </p>

                        <input
                          id="avatar-file-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </div>

                      {uploadError && (
                        <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                          <AlertCircle size={12} />
                          {uploadError}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-6 border-t border-proton-border bg-proton-bg/40 flex items-center justify-between gap-4">
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              disabled={saving}
              className="px-5 py-2.5 text-proton-muted hover:text-proton-text border border-proton-border/80 hover:border-proton-text text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
            >
              {t.cancel}
            </button>

            {previewImage && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-proton-border text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-lg flex items-center gap-2"
              >
                <Check size={14} />
                {t.save_avatar}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
