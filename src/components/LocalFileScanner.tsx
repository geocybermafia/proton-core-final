import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { 
  FolderOpen, 
  File, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  AlertCircle,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileInfo {
  name: string;
  size: number;
  type: string;
  kind: 'file' | 'directory';
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext!)) return <FileImage className="text-pink-400" size={18} />;
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext!)) return <FileVideo className="text-purple-400" size={18} />;
  if (['mp3', 'wav', 'ogg'].includes(ext!)) return <FileAudio className="text-blue-400" size={18} />;
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext!)) return <FileText className="text-green-400" size={18} />;
  return <File className="text-gray-400" size={18} />;
};

export const LocalFileScanner: React.FC<{ t: any }> = ({ t }) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  const scanDirectory = async () => {
    setError(null);
    setIsScanning(true);
    setFiles([]);

    try {
      if ('showDirectoryPicker' in window) {
        if (window.self !== window.top) {
           throw new Error('FRAME_RESTRICTION');
        }
        // Chromium-based browser
        const dirHandle = await (window as any).showDirectoryPicker();
        const scannedFiles: FileInfo[] = [];

        async function readDir(handle: any) {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              scannedFiles.push({
                name: entry.name,
                size: file.size,
                type: file.type || 'unknown',
                kind: 'file'
              });
            } else if (entry.kind === 'directory') {
              scannedFiles.push({
                name: entry.name,
                size: 0,
                type: 'directory',
                kind: 'directory'
              });
            }
          }
        }

        await readDir(dirHandle);
        setFiles(scannedFiles.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        }));
      } else {
        throw new Error('FileSystemAccess API not supported');
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        setError(null);
      } else if (err.message === 'FRAME_RESTRICTION' || err.message?.includes('Cross origin sub frames')) {
        setError(t.frame_restriction_error || 'Preview restriction: File system access is blocked in preview frames.');
        setIsSupported(false);
      } else if (err.message === 'FileSystemAccess API not supported' || !('showDirectoryPicker' in window)) {
        setError(t.file_picker_unsupported || 'Folder selection is unavailable in this browser or context.');
        setIsSupported(false);
      } else {
        setError(t.file_picker_failed || 'Failed to inspect selected directory.');
        setIsSupported(false);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const scannedFiles: FileInfo[] = [];
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        scannedFiles.push({
            name: file.name,
            size: file.size,
            type: file.type || 'unknown',
            kind: 'file'
        });
    }
    setFiles(scannedFiles.sort((a, b) => a.name.localeCompare(b.name)));
    setError(null);
  };

  return (
    <div aria-live="polite" className="bg-proton-card border border-proton-border rounded-[32px] md:rounded-[40px] p-6 md:p-8 h-full flex flex-col gap-6 relative overflow-hidden group shadow-sm">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-proton-accent/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="space-y-1">
          <h3 className="text-xl font-black tracking-tighter text-proton-text uppercase flex items-center gap-3">
            <HardDrive className="text-proton-accent" size={24} />
            {t.workspace}
          </h3>
          <p className="text-[10px] font-bold text-proton-muted uppercase tracking-widest">{t.local_mount}</p>
        </div>
        
        {files.length > 0 && (
          <div className="px-3.5 py-1.5 bg-proton-accent/10 border border-proton-accent/20 rounded-2xl flex items-center gap-2.5 animate-in fade-in zoom-in duration-300">
            <div className="w-2 h-2 rounded-full bg-proton-accent animate-pulse" />
            <span className="text-[10px] font-black text-proton-accent uppercase tracking-widest">
              {t.total_files}: {files.length}
            </span>
          </div>
        )}
      </div>

      {!isSupported && (
        <div className="flex flex-col gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-2 relative z-10">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-500 shrink-0" size={18} />
            <p className="text-[10px] font-bold text-amber-500 uppercase leading-relaxed">
              {t.restriction}
            </p>
          </div>
          {isIframe && (
            <p className="text-[9px] font-medium text-amber-500/80 border-t border-amber-500/10 pt-2">
              {t.frame_note || 'Note: Preview frames block directory pickers. Open the application in a new tab for native OS file system interaction.'}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl relative z-10">
          <AlertCircle className="text-red-500 shrink-0" size={18} />
          <p className="text-[10px] font-bold text-red-500 uppercase leading-relaxed">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-hidden min-h-[300px] flex flex-col relative z-10">
        <AnimatePresence mode="wait">
          {files.length > 0 ? (
            <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar-minimal"
            >
              {files.map((file, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.005, 0.15), duration: 0.2 }}
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between p-3.5 md:p-4 rounded-2xl bg-proton-bg/60 border border-proton-border hover:border-proton-accent/40 hover:bg-proton-bg transition-all group/item"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-proton-card border border-proton-border flex items-center justify-center shrink-0 group-hover/item:border-proton-accent/50 transition-colors">
                      {getFileIcon(file.name)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-proton-text truncate group-hover/item:text-proton-accent transition-colors">
                        {file.name}
                      </span>
                      <span className="text-[9px] font-bold text-proton-muted uppercase tracking-widest">
                          {file.kind === 'directory' ? (t.folder || 'Folder') : `${t.type || 'Type'}: ${file.type.split('/')[1] || t.unknown || 'Unknown'}`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-proton-muted group-hover/item:text-proton-text transition-colors">
                      {file.kind === 'directory' ? '--' : formatBytes(file.size)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-proton-border rounded-[28px] md:rounded-[36px] bg-proton-bg/40"
            >
              <FolderOpen className="text-proton-muted mb-4 opacity-50" size={56} />
              <p className="text-xs font-black text-proton-muted uppercase tracking-[0.2em] text-center">
                {t.no_mount}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-4 border-t border-proton-border/40 relative z-10">
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFallbackChange} 
            {...({ webkitdirectory: "", directory: "" } as any)} 
            className="hidden" 
        />
        
        <button
          onClick={isSupported ? scanDirectory : () => fileInputRef.current?.click()}
          disabled={isScanning}
          aria-label={isScanning ? (t.scanning || 'Scanning...') : (t.mount_btn || 'Select Directory')}
          className="w-full min-h-[48px] py-4 md:py-5 bg-proton-accent text-proton-on-accent rounded-[20px] md:rounded-[24px] font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-proton-accent/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 group/btn relative overflow-hidden cursor-pointer focus-visible:ring-2 focus-visible:ring-proton-accent focus-visible:ring-offset-2 focus-visible:ring-offset-proton-bg focus-visible:outline-none"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
          <div className="relative z-10 flex items-center gap-3">
             {isScanning ? (
                 <RefreshCw className="animate-spin" size={18} />
             ) : (
                 <FolderOpen size={18} />
             )}
             {isScanning ? t.scanning : t.mount_btn}
          </div>
        </button>
      </div>
    </div>
  );
};
