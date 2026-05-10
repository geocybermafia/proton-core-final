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
        setError('Security restriction: File system access is blocked in preview frames. Please open the app in a new tab to use this feature.');
        setIsSupported(false);
      } else {
        setError(err.message || 'Failed to scan directory');
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
    <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-[32px] p-8 h-full flex flex-col gap-6 relative overflow-hidden group">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="space-y-1">
          <h3 className="text-xl font-black tracking-tighter text-white uppercase flex items-center gap-3">
            <HardDrive className="text-cyan-400" size={24} />
            {t.workspace}
          </h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.local_mount}</p>
        </div>
        
        {files.length > 0 && (
          <div className="px-4 py-2 bg-cyan-400/10 border border-cyan-400/20 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-500">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
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
            <p className="text-[9px] font-medium text-amber-500/70 border-t border-amber-500/10 pt-2">
              Note: Preview frames block directory pickers. Open the application in a new tab for native OS file system interaction.
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
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.01 }}
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-400/30 transition-all group/item"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center shrink-0 group-hover/item:border-cyan-400/50 transition-colors">
                      {getFileIcon(file.name)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-gray-200 truncate group-hover/item:text-cyan-400 transition-colors">
                        {file.name}
                      </span>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                          {file.kind === 'directory' ? 'Folder' : `Type: ${file.type.split('/')[1] || 'Unknown'}`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-gray-400 group-hover/item:text-white transition-colors">
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
                className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-[40px] bg-white/[0.02]"
            >
              <FolderOpen className="text-gray-600 mb-4 animate-pulse" size={64} />
              <p className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] text-center">
                {t.no_mount}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pt-4 border-t border-white/5 relative z-10">
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
          className="w-full py-5 bg-cyan-400 text-black rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-cyan-400/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 group/btn relative overflow-hidden"
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
