import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClipPlayback } from '../hooks/useClipPlayback';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Plus, 
  Trash2, 
  Music, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  ShoppingBag, 
  User as UserIcon, 
  X, 
  Send, 
  Search, 
  Sparkles,
  Wand2,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  Check,
  TrendingUp,
  AlertCircle,
  Video,
  Eye,
  CheckCircle2,
  Bookmark,
  Clock
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  limit,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { ClipIssue } from '../types';

// Simple IndexedDB wrapper for local caching of larger videos
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('proton-clips-cache', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveVideoToLocalCache = async (id: string, file: File | Blob): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction('videos', 'readwrite');
    const store = transaction.objectStore('videos');
    store.put(file, id);
  } catch (e) {
    console.warn("IndexedDB storage failed:", e);
  }
};

const getVideoFromLocalCache = async (id: string): Promise<Blob | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('videos', 'readonly');
      const store = transaction.objectStore('videos');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("IndexedDB retrieval failed:", e);
    return null;
  }
};

interface ClipsViewProps {
  language: 'en' | 'ka';
  setActiveView: (view: any) => void;
  user: any;
}

interface Clip {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  caption: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string;
  likes: string[];
  likesCount: number;
  soundName?: string;
  productId?: string;
  createdAt: any;
  productInfo?: any; // populated locally
  trimStart?: number;
  trimEnd?: number;
}

interface ClipComment {
  id: string;
  clipId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: any;
}

// Preset vertical video loops of stunning quality
const PRESET_LOOPS = [
  {
    id: 'potter-clay',
    nameGe: 'კერამიკა & თიხა',
    nameEn: 'Ceramic Shaping Clay',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    sound: 'Traditional Potter - Ambient Echoes'
  },
  {
    id: 'knitting-wool',
    nameGe: 'მატყლის ქსოვა',
    nameEn: 'Wool Knitting close-up',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    sound: 'Warm Fireplace Acoustics'
  },
  {
    id: 'misty-mountains',
    nameGe: 'ყაზბეგის ნისლიანი მთები',
    nameEn: 'Kazbegi Misty Mountains',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    sound: 'Caucasus Mountain Breeze'
  },
  {
    id: 'spring-gardens',
    nameGe: 'გაზაფხულის ეზო',
    nameEn: 'Spring Blossom Garden',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    sound: 'Nino - Spring Harmony'
  },
  {
    id: 'neon-city',
    nameGe: 'ღამის თბილისის ნეონები',
    nameEn: 'Night Tbilisi Lights',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    sound: 'Tbilisi Cyberpunk Synthwave'
  },
  {
    id: 'laser-abstract',
    nameGe: 'აბსტრაქტული ლაზერები',
    nameEn: 'Cosmic Laser Visualizer',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    sound: 'Synth Beats - Proton Matrix'
  }
];

const SEED_CLIPS = [
  {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    caption: 'საქართველოს თიხის ტრადიციული დამუშავება 🏺 საოცარი პროცესია, ჭედვისა და ფორმირების ხელოვნება. #clay #handmade #pottery #craft #georgia',
    creatorId: 'proton-system-clay',
    creatorName: 'ლუკა_Potter',
    creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&fit=crop&q=80',
    likes: [],
    likesCount: 142,
    soundName: 'Traditional Potter - Ambient Echoes',
    productId: ''
  },
  {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    caption: 'ნატურალური მთის მატყლის ძაფები ჩემს ახალ კოლექციაში 🧶 ხელით ნაქსოვი თბილი სვიტერები! #knitting #wool #handmade #fashion #cozy',
    creatorId: 'proton-system-wool',
    creatorName: 'ანნა_ნაქსოვი',
    creatorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&fit=crop&q=80',
    likes: [],
    likesCount: 89,
    soundName: 'Anna Knit - Cozy Evening Acoustics',
    productId: ''
  },
  {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    caption: 'ყაზბეგის ულამაზესი ნისლიანი ხედები დილით 🏔️ საქართველო სიყვარულია! #kazbegi #georgia #mountains #travel #nature #aerial',
    creatorId: 'proton-system-nature',
    creatorName: 'ირაკლი_Travels',
    creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&fit=crop&q=80',
    likes: [],
    likesCount: 312,
    soundName: 'Caucasus Mountain Breeze',
    productId: ''
  },
  {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    caption: 'გაზაფხულის ნაზი ყვავილები ჩემს ეზოში 🌸 სილამაზე დეტალებშია! #spring #flowers #nature #aesthetic #georgia',
    creatorId: 'proton-system-flowers',
    creatorName: 'ნინო_Garden',
    creatorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&fit=crop&q=80',
    likes: [],
    likesCount: 56,
    soundName: 'Nino - Spring Harmony',
    productId: ''
  }
];

const LOCAL_SEED_CLIPS: Clip[] = SEED_CLIPS.map((item, index) => ({
  ...item,
  id: `seed-clip-${index + 1}`,
  likes: item.likes as string[] || [],
  duration: [14.5, 12.0, 15.2, 9.8][index % 4],
  createdAt: { seconds: Date.now() / 1000 - (3600 * index), nanoseconds: 0 } as any
}));

const INITIAL_MOCK_COMMENTS: { [clipId: string]: ClipComment[] } = {
  'seed-clip-1': [
    {
      id: 'mock-c-1-1',
      clipId: 'seed-clip-1',
      userId: 'mock-u-1',
      userName: 'თამუნა_K',
      userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&fit=crop&q=80',
      text: 'საოცარი ხელოვნებაა! ძალიან მინდა შეძენა 🏺✨',
      createdAt: new Date(Date.now() - 1000 * 3600 * 2)
    },
    {
      id: 'mock-c-1-2',
      clipId: 'seed-clip-1',
      userId: 'mock-u-2',
      userName: 'გიორგი_G',
      userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&fit=crop&q=80',
      text: 'რა სინაზით და ფორმით მუშაობს! ბრავო 👏',
      createdAt: new Date(Date.now() - 1000 * 3600 * 1)
    }
  ],
  'seed-clip-2': [
    {
      id: 'mock-c-2-1',
      clipId: 'seed-clip-2',
      userId: 'mock-u-3',
      userName: 'მარი_M',
      userAvatar: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=100&fit=crop&q=80',
      text: 'ფერი უთბილესია! მატყლი მთისაა? 🧶',
      createdAt: new Date(Date.now() - 1000 * 3600 * 5)
    },
    {
      id: 'mock-c-2-2',
      clipId: 'seed-clip-2',
      userId: 'mock-u-4',
      userName: 'დათო_D',
      userAvatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&fit=crop&q=80',
      text: 'ძალიან მყუდრო ვიდეოა, ზამთარს მომანატრებს ❄️',
      createdAt: new Date(Date.now() - 1000 * 3600 * 3)
    }
  ],
  'seed-clip-3': [
    {
      id: 'mock-c-3-1',
      clipId: 'seed-clip-3',
      userId: 'mock-u-5',
      userName: 'სალომე_S',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80',
      text: 'ყაზბეგი მართლაც უნიკალური ადგილია, სული ისვენებს აქ... დრონით გადაღება საოცრებაა!',
      createdAt: new Date(Date.now() - 1000 * 3600 * 12)
    },
    {
      id: 'mock-c-3-2',
      clipId: 'seed-clip-3',
      userId: 'mock-u-6',
      userName: 'ნიკა_N',
      userAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&fit=crop&q=80',
      text: 'ნისლი მთებში ყოველთვის განსაკუთრებულ მისტიკას ქმნის 🏔️👌',
      createdAt: new Date(Date.now() - 1000 * 3600 * 8)
    }
  ],
  'seed-clip-4': [
    {
      id: 'mock-c-4-1',
      clipId: 'seed-clip-4',
      userId: 'mock-u-7',
      userName: 'ელენე_E',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&fit=crop&q=80',
      text: 'გაზაფხულის განწყობა შემოიტანეთ ჩემს სმარტფონში 🌸 დიდი მადლობა ასეთი მშვიდი ვიდეოსთვის!',
      createdAt: new Date(Date.now() - 1000 * 3600 * 4)
    }
  ]
};

const FILTER_OPTIONS = [
  { id: 'normal', labelKa: 'ორიგინალი', labelEn: 'Normal' },
  { id: 'noir', labelKa: 'ნუარი 🎬', labelEn: 'Noir 🎬' },
  { id: 'vintage', labelKa: 'ვინტაჟი 🎞️', labelEn: 'Vintage 🎞️' },
  { id: 'warm', labelKa: 'თბილი 🌅', labelEn: 'Sunset 🌅' },
  { id: 'glitch', labelKa: 'გლიჩი ⚡', labelEn: 'Glitch ⚡' }
];

const formatDuration = (secs: number | undefined): string => {
  if (secs === undefined || isNaN(secs)) return '0:00';
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const generateThumbnailFromVideoUrl = (videoUrl: string): Promise<{ thumbnailUrl: string; duration: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    
    // Seek to 0.5s to get a good first frame (avoiding any starting black screens)
    video.currentTime = 0.5;

    const timer = setTimeout(() => {
      video.remove();
      reject(new Error("Thumbnail generation timed out"));
    }, 6000);

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        // Keep thumbnail size compact to stay highly performant and under Firestore's 1MB limit
        const maxW = 240;
        const maxH = 426;
        
        let targetW = video.videoWidth || maxW;
        let targetH = video.videoHeight || maxH;
        
        const scale = Math.min(maxW / targetW, maxH / targetH);
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
        
        canvas.width = targetW;
        canvas.height = targetH;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65); // High compression to save Firestore space
          clearTimeout(timer);
          const duration = video.duration || 0;
          video.remove();
          resolve({ thumbnailUrl: dataUrl, duration });
        } else {
          clearTimeout(timer);
          video.remove();
          reject(new Error("Canvas context is null"));
        }
      } catch (err) {
        clearTimeout(timer);
        video.remove();
        reject(err);
      }
    };

    video.onerror = (err) => {
      clearTimeout(timer);
      video.remove();
      reject(err);
    };
  });
};

export default function ClipsView({ language, setActiveView, user }: ClipsViewProps) {
  const { showToast } = useToast();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'forYou' | 'myClips' | 'productReels'>('forYou');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  
  // Real-time video filters
  const [activeFilter, setActiveFilter] = useState<'normal' | 'noir' | 'vintage' | 'warm' | 'glitch'>('normal');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  
  // Modal / Sidebar overlays
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<ClipComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [localComments, setLocalComments] = useState<{ [clipId: string]: ClipComment[] }>(INITIAL_MOCK_COMMENTS);
  
  // Profile Modal Overlay
  const [selectedCreator, setSelectedCreator] = useState<{ id: string, name: string, avatar?: string } | null>(null);
  const [creatorClips, setCreatorClips] = useState<Clip[]>([]);
  
  // Create / Upload modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(1);
  const [newClipCaption, setNewClipCaption] = useState('');
  const [newClipSound, setNewClipSound] = useState('');
  const [newClipVideoUrl, setNewClipVideoUrl] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('potter-clay');
  const [newClipProductId, setNewClipProductId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Custom thumbnail generated from <canvas>
  const [newClipThumbnail, setNewClipThumbnail] = useState<string>('');
  const [newClipDuration, setNewClipDuration] = useState<number>(0);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [failedVideoIds, setFailedVideoIds] = useState<Record<string, boolean>>({});
  const [videoMetadata, setVideoMetadata] = useState<Record<string, {
    resolution?: string;
    aspectRatio?: string;
    duration?: string;
    fps?: string;
  }>>({});
  const [dynamicPlaceholderThumbnails, setDynamicPlaceholderThumbnails] = useState<Record<string, string>>({});
  const [loadedVideoIds, setLoadedVideoIds] = useState<Record<string, boolean>>({});

  // Auto-Fix Feature States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedIssues, setDetectedIssues] = useState<ClipIssue[]>([]);
  const [showAutoFixDialog, setShowAutoFixDialog] = useState(false);
  const [selectedClipForFix, setSelectedClipForFix] = useState<Clip | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<Record<string, string[]>>({}); // mapping of clipId -> array of issueIds
  const [previewingIssueId, setPreviewingIssueId] = useState<string | null>(null);
  const [doubleTapHearts, setDoubleTapHearts] = useState<Record<string, boolean>>({});
  const [soundOverlay, setSoundOverlay] = useState<{ visible: boolean; muted: boolean }>({ visible: false, muted: false });

  // Analyze video frame brightness using hidden canvas for true programmatic diagnostics
  const analyzeVideoBrightness = (videoUrl: string, duration: number): Promise<number[]> => {
    return new Promise((resolve) => {
      if (!duration || duration <= 0) {
        resolve([120, 130, 110, 140, 130]); // Fallback neutral samples
        return;
      }

      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      const numSamples = 5;
      const samples: number[] = [];
      let currentSampleIdx = 0;

      const canvas = document.createElement('canvas');
      canvas.width = 80; // small size for fast processing
      canvas.height = 140;
      const ctx = canvas.getContext('2d');

      const cleanUp = () => {
        video.remove();
      };

      const timeoutId = setTimeout(() => {
        cleanUp();
        resolve(samples.length > 0 ? samples : [120, 130, 110, 140, 130]);
      }, 8000); // 8 seconds safety timeout

      const sampleNext = () => {
        if (currentSampleIdx >= numSamples) {
          clearTimeout(timeoutId);
          cleanUp();
          resolve(samples);
          return;
        }

        const percentage = (currentSampleIdx * 2 + 1) / (numSamples * 2);
        video.currentTime = percentage * duration;
      };

      video.onseeked = () => {
        try {
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            
            let totalBrightness = 0;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
              totalBrightness += brightness;
            }
            const avgBrightness = Math.round(totalBrightness / (data.length / 4));
            samples.push(avgBrightness);
          } else {
            samples.push(120);
          }
        } catch (err) {
          samples.push(120); // default fallback for CORS or other issues
        }

        currentSampleIdx++;
        sampleNext();
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        cleanUp();
        resolve([120, 130, 110, 140, 130]);
      };

      video.onloadedmetadata = () => {
        sampleNext();
      };
    });
  };

  const runAutoFixAnalysis = async (clip: Clip) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setSelectedClipForFix(clip);
    setDetectedIssues([]);
    setPreviewingIssueId(null);
    setShowAutoFixDialog(true);
    
    try {
      const duration = clip.duration || 10;
      const samples = await analyzeVideoBrightness(clip.videoUrl, duration);
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'detectClipIssues',
          args: [clip.caption, duration, samples, language]
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to contact video analysis engine");
      }
      
      const issues = await response.json();
      setDetectedIssues(issues);
    } catch (err) {
      console.error("Auto-Fix Analysis Error:", err);
      showToast(
        language === 'ka' 
          ? "შეცდომა ანალიზისას. გამოყენებული იქნება ლოკალური ფილტრი." 
          : "Analysis Error. Local fallback diagnostics loaded.",
        "error"
      );
      
      // Fallback local diagnostics
      const duration = clip.duration || 10;
      const fallbackIssues: ClipIssue[] = [
        {
          id: "fallback-intro",
          type: "unwanted_intro",
          titleEn: "Opening Silence / Black Frame",
          titleKa: "საწყისი სიჩუმე / შავი კადრი",
          descriptionEn: "Unproductive static frames or silent delay detected at the start of the video clip.",
          descriptionKa: "კლიპის დასაწყისში დაფიქსირდა ცარიელი კადრი ან აუდიო სიჩუმე.",
          suggestedActionEn: "Remove the first 0.6 seconds to start the action instantly.",
          suggestedActionKa: "მოჭერით პირველი 0.6 წამი კლიპის მყისიერი სტარტისთვის.",
          startSec: 0,
          endSec: 0.6
        },
        {
          id: "fallback-end",
          type: "silence",
          titleEn: "End Transition Sound Gap",
          titleKa: "დასასრულის ხმის წყვეტა",
          descriptionEn: "Detected a substantial drop in audio levels right before the loop transition point.",
          descriptionKa: "კლიპის ბოლო ნაწილში დაფიქსირდა აუდიო დონის უეცარი ვარდნა.",
          suggestedActionEn: `Trim the last ${(duration * 0.1).toFixed(1)} seconds of silence for a smooth loop.`,
          suggestedActionKa: `მოჭერით ბოლო ${(duration * 0.1).toFixed(1)} წამი სიჩუმე სუფთა ლუპისთვის.`,
          startSec: Math.max(0, parseFloat((duration * 0.9).toFixed(1))),
          endSec: duration
        }
      ];
      setDetectedIssues(fallbackIssues);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Refs for tracking mounted state and asynchronous processing clip IDs to avoid memory leaks and duplicate workers
  const isMounted = useRef<boolean>(true);
  const processingClipIds = useRef<Record<string, boolean>>({});

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Dynamic extraction of video frame at 0.1 seconds using hidden canvas as placeholder while loading
  const generate01sThumbnail = (clipId: string, videoUrl: string) => {
    if (dynamicPlaceholderThumbnails[clipId] || processingClipIds.current[clipId]) return;
    processingClipIds.current[clipId] = true;

    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.currentTime = 0.1; // Extract frame at 0.1 seconds

    const timeoutId = setTimeout(() => {
      video.remove();
      if (processingClipIds.current) {
        delete processingClipIds.current[clipId];
      }
    }, 8000);

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 180;
        canvas.height = video.videoHeight || 320;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          if (isMounted.current) {
            setDynamicPlaceholderThumbnails(prev => ({
              ...prev,
              [clipId]: dataUrl
            }));
          }
        }
        clearTimeout(timeoutId);
        video.remove();
        if (processingClipIds.current) {
          delete processingClipIds.current[clipId];
        }
      } catch (err) {
        console.error("Error drawing frame at 0.1s for clip:", clipId, err);
        clearTimeout(timeoutId);
        video.remove();
        if (processingClipIds.current) {
          delete processingClipIds.current[clipId];
        }
      }
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      video.remove();
      if (processingClipIds.current) {
        delete processingClipIds.current[clipId];
      }
    };
  };

  // Function to extract video metadata dynamically from loaded media element
  const handleVideoMetadataLoad = (clipId: string, e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;
    if (!videoEl) return;

    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    const dur = videoEl.duration;

    // 1. Extract Resolution
    const resolution = `${width}x${height}`;

    // 2. Extract Aspect Ratio using GCD
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const div = gcd(width, height);
    const aspectRatio = div > 0 ? `${width / div}:${height / div}` : '';

    // 3. Extract Duration
    const minutes = Math.floor(dur / 60);
    const seconds = Math.floor(dur % 60);
    const formattedDuration = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}s`;

    // Initialize or update metadata state for this clip
    if (isMounted.current) {
      setVideoMetadata(prev => ({
        ...prev,
        [clipId]: {
          ...prev[clipId],
          resolution,
          aspectRatio,
          duration: isNaN(dur) || dur === Infinity ? 'Unknown' : formattedDuration,
          fps: prev[clipId]?.fps || 'Detecting...'
        }
      }));
    }

    // 4. Extract/Measure Frame Rate (FPS) dynamically using requestVideoFrameCallback or requestAnimationFrame
    let frameCount = 0;
    let startTime = performance.now();
    let frameCallbackId: any;

    const checkFps = () => {
      if (!isMounted.current) return;
      if (videoEl.paused || videoEl.ended) return;
      frameCount++;
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed >= 1.0) {
        const currentFps = Math.round(frameCount / elapsed);
        let displayFps = `${currentFps} FPS`;
        
        // Snap to standard frame rates
        if (Math.abs(currentFps - 30) <= 2) displayFps = '30 FPS';
        else if (Math.abs(currentFps - 60) <= 2) displayFps = '60 FPS';
        else if (Math.abs(currentFps - 24) <= 2) displayFps = '24 FPS';
        else if (Math.abs(currentFps - 25) <= 2) displayFps = '25 FPS';

        if (isMounted.current) {
          setVideoMetadata(prev => ({
            ...prev,
            [clipId]: {
              ...(prev[clipId] || {}),
              fps: displayFps
            }
          }));
        }
        frameCount = 0;
        startTime = performance.now();
      }
      
      if ('requestVideoFrameCallback' in videoEl) {
        // @ts-ignore
        frameCallbackId = videoEl.requestVideoFrameCallback(checkFps);
      } else {
        frameCallbackId = requestAnimationFrame(checkFps);
      }
    };

    const handlePlay = () => {
      frameCount = 0;
      startTime = performance.now();
      if ('requestVideoFrameCallback' in videoEl) {
        // @ts-ignore
        frameCallbackId = videoEl.requestVideoFrameCallback(checkFps);
      } else {
        frameCallbackId = requestAnimationFrame(checkFps);
      }
    };

    const handlePause = () => {
      if ('requestVideoFrameCallback' in videoEl) {
        // @ts-ignore
        if (frameCallbackId) videoEl.cancelVideoFrameCallback(frameCallbackId);
      } else {
        if (frameCallbackId) cancelAnimationFrame(frameCallbackId);
      }
    };

    // Listen to play/pause events to resume/pause frame rate tracking
    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);

    if (!videoEl.paused) {
      handlePlay();
    }

    // Standard static estimation fallback if play event doesn't trigger soon
    setTimeout(() => {
      if (isMounted.current) {
        setVideoMetadata(prev => {
          const item = prev[clipId];
          if (!item || !item.fps || item.fps === 'Detecting...') {
            const estFps = width >= 1080 ? '60 FPS (est)' : '30 FPS (est)';
            return {
              ...prev,
              [clipId]: {
                ...(item || {}),
                fps: estFps
              }
            };
          }
          return prev;
        });
      }
    }, 1500);
  };

  // Set upload step back to 1 when modal opens
  useEffect(() => {
    if (isCreateOpen) {
      setUploadStep(1);
      setNewClipThumbnail('');
      setNewClipDuration(0);
    }
  }, [isCreateOpen]);

  // Dynamic automatic canvas-based thumbnail generation from video source
  useEffect(() => {
    if (!isCreateOpen) return;
    
    // Determine the active video source
    let urlToLoad = '';
    if (localVideoFile) {
      urlToLoad = newClipVideoUrl; // this is the local object URL
    } else if (newClipVideoUrl) {
      urlToLoad = newClipVideoUrl;
    } else {
      const preset = PRESET_LOOPS.find(p => p.id === selectedPresetId);
      if (preset) {
        urlToLoad = preset.url;
      }
    }
    
    if (!urlToLoad) {
      setNewClipThumbnail('');
      setNewClipDuration(0);
      return;
    }

    let active = true;
    setIsGeneratingThumbnail(true);
    
    generateThumbnailFromVideoUrl(urlToLoad)
      .then((res) => {
        if (active) {
          setNewClipThumbnail(res.thumbnailUrl);
          setNewClipDuration(res.duration);
        }
      })
      .catch((err) => {
        console.warn("Thumbnail generation failed, falling back to placeholder:", err);
        if (active) {
          setNewClipThumbnail('');
          setNewClipDuration(0);
        }
      })
      .finally(() => {
        if (active) {
          setIsGeneratingThumbnail(false);
        }
      });

    return () => {
      active = false;
    };
  }, [newClipVideoUrl, selectedPresetId, localVideoFile, isCreateOpen]);
  
  // Marketplace Listings list for Tagging
  const [listings, setListings] = useState<any[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter clips based on selected tab and search - wrapped in useMemo to optimize reference stability and prevent infinite rendering loops
  const filteredClips = React.useMemo(() => {
    return clips.filter(clip => {
      if (!clip) return false;
      // 1. Tab filters
      if (activeTab === 'myClips' && clip.creatorId !== user?.uid) return false;
      if (activeTab === 'productReels' && !clip.productId) return false;

      // 2. Search filters
      if (searchQuery.trim() === '') return true;
      const searchLower = searchQuery.toLowerCase();
      const hasTag = (clip.caption || '').toLowerCase().includes(searchLower);
      const hasCreator = (clip.creatorName || '').toLowerCase().includes(searchLower);
      return hasTag || hasCreator;
    });
  }, [clips, activeTab, user?.uid, searchQuery]);

  // Generate 0.1s placeholder thumbnail for filtered clips when list updates
  useEffect(() => {
    if (!filteredClips || filteredClips.length === 0) return;
    filteredClips.forEach(clip => {
      if (clip && clip.id && clip.videoUrl && !dynamicPlaceholderThumbnails[clip.id]) {
        generate01sThumbnail(clip.id, clip.videoUrl);
      }
    });
  }, [filteredClips]);

  // Use the custom playback hook to manage video instances robustly
  const {
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    isMuted,
    setIsMuted,
    videoRefs,
    registerVideoRef,
    togglePlay,
    toggleMute,
    handleScroll,
    resetPlayback
  } = useClipPlayback(filteredClips, containerRef);

  const handleToggleMute = () => {
    toggleMute();
    setSoundOverlay({ visible: true, muted: !isMuted });
  };

  useEffect(() => {
    if (soundOverlay.visible) {
      const timer = setTimeout(() => {
        setSoundOverlay(prev => ({ ...prev, visible: false }));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [soundOverlay.visible]);

  const handleScrollUp = () => {
    if (containerRef.current) {
      const height = containerRef.current.clientHeight;
      containerRef.current.scrollBy({
        top: -height,
        behavior: 'smooth'
      });
    }
  };

  const handleScrollDown = () => {
    if (containerRef.current) {
      const height = containerRef.current.clientHeight;
      containerRef.current.scrollBy({
        top: height,
        behavior: 'smooth'
      });
    }
  };

  // 1. Fetch Listings for Tagging
  useEffect(() => {
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(items);
    }, (err) => {
      console.error("Failed to load listings for tagging:", err);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch/Seed Clips
  useEffect(() => {
    const clipsCol = collection(db, 'clips');
    const q = query(clipsCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setClips([]);
        setLoading(false);
        return;
      }

      const rawClips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Clip));

      // Resolve tagged product info and local IndexedDB URLs
      const populatedClips = await Promise.all(rawClips.map(async (clip) => {
        let finalVideoUrl = clip.videoUrl;

        // 1. Resolve IndexedDB local video cache if needed
        if (clip.videoUrl && clip.videoUrl.startsWith('indexeddb://')) {
          const docId = clip.videoUrl.replace('indexeddb://', '');
          try {
            const localBlob = await getVideoFromLocalCache(docId);
            if (localBlob) {
              finalVideoUrl = URL.createObjectURL(localBlob);
            } else {
              // Fallback for other browsers/devices so they see a valid video
              finalVideoUrl = PRESET_LOOPS[0].url;
            }
          } catch (e) {
            console.warn("Failed to retrieve cached IndexedDB video:", e);
            finalVideoUrl = PRESET_LOOPS[0].url;
          }
        } else if (clip.videoUrl && clip.videoUrl.startsWith('data:video/')) {
          // 2. Convert base64 data to native Blob ObjectURLs to resolve loading & lagging bugs on browsers
          try {
            const parts = clip.videoUrl.split(';base64,');
            if (parts.length === 2) {
              const contentType = parts[0].split(':')[1];
              const raw = window.atob(parts[1]);
              const rawLength = raw.length;
              const uInt8Array = new Uint8Array(rawLength);
              for (let i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
              }
              const blob = new Blob([uInt8Array], { type: contentType });
              finalVideoUrl = URL.createObjectURL(blob);
            }
          } catch (e) {
            console.warn("Failed to parse base64 video in populatedClips:", e);
          }
        }

        const updatedClip = { ...clip, videoUrl: finalVideoUrl };

        if (clip.productId) {
          try {
            const productDoc = await getDoc(doc(db, 'listings', clip.productId));
            if (productDoc.exists()) {
              return { ...updatedClip, productInfo: productDoc.data() };
            }
          } catch (e) {
            console.error("Error resolving listing:", e);
          }
        }
        return updatedClip;
      }));

      setClips(populatedClips);
      setLoading(false);
    }, (error) => {
      console.warn("Clips Firestore access issue:", error);
      setClips([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Reset playback scroll and current index when tab or query updates
  useEffect(() => {
    resetPlayback();
  }, [activeTab, searchQuery, resetPlayback]);

  // Keep currentIndex clamped safely when filteredClips length changes
  useEffect(() => {
    if (filteredClips.length > 0 && currentIndex >= filteredClips.length) {
      setCurrentIndex(filteredClips.length - 1);
    }
  }, [filteredClips.length, currentIndex, setCurrentIndex]);

  // Keyboard controls for ArrowUp, ArrowDown, and Spacebar utilizing hook actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < filteredClips.length - 1) {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          if (containerRef.current) {
            containerRef.current.scrollTo({
              top: nextIndex * containerRef.current.clientHeight,
              behavior: 'smooth'
            });
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          setCurrentIndex(prevIndex);
          if (containerRef.current) {
            containerRef.current.scrollTo({
              top: prevIndex * containerRef.current.clientHeight,
              behavior: 'smooth'
            });
          }
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay(currentIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, filteredClips.length, togglePlay, setCurrentIndex]);

  // 4. Fetch comments for selected clip
  useEffect(() => {
    if (!isCommentsOpen || !filteredClips[currentIndex]) return;
    const clipId = filteredClips[currentIndex].id;

    if (clipId.startsWith('seed-')) {
      setComments(localComments[clipId] || []);
      setCommentsLoading(false);
      return;
    }

    setCommentsLoading(true);
    const q = query(
      collection(db, 'clips', clipId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClipComment));
      setComments(commList);
      setCommentsLoading(false);
    }, (error) => {
      console.warn("Comments Firestore subscription error, using local fallback:", error);
      setComments(localComments[clipId] || []);
      setCommentsLoading(false);
    });

    return () => unsubscribe();
  }, [isCommentsOpen, currentIndex, clips, localComments]);

  // Toggle Like with Firestore
  const handleLikeToggle = async (clip: Clip) => {
    if (!user) {
      showToast(
        language === 'ka' ? 'ავტორიზაცია საჭიროა მოსაწონებლად' : 'Please sign in to like clips',
        'warning'
      );
      return;
    }

    if (clip.id.startsWith('seed-')) {
      // Handle seed clip like locally
      setClips(prev => prev.map(c => {
        if (c.id === clip.id) {
          const likesList = c.likes || [];
          const isLiked = likesList.includes(user.uid);
          const newLikes = isLiked 
            ? likesList.filter(uid => uid !== user.uid)
            : [...likesList, user.uid];
          const newLikesCount = isLiked
            ? Math.max(0, (c.likesCount || 0) - 1)
            : (c.likesCount || 0) + 1;
          return { ...c, likes: newLikes, likesCount: newLikesCount };
        }
        return c;
      }));
      return;
    }

    const docRef = doc(db, 'clips', clip.id);
    const isLiked = clip.likes?.includes(user.uid);

    try {
      if (isLiked) {
        await updateDoc(docRef, {
          likes: arrayRemove(user.uid),
          likesCount: Math.max(0, (clip.likesCount || 0) - 1)
        });
      } else {
        await updateDoc(docRef, {
          likes: arrayUnion(user.uid),
          likesCount: (clip.likesCount || 0) + 1
        });
      }
    } catch (e) {
      console.error("Failed to toggle like:", e);
    }
  };

  const handleDoubleTap = (clip: Clip) => {
    setDoubleTapHearts(prev => ({ ...prev, [clip.id]: true }));
    setTimeout(() => {
      setDoubleTapHearts(prev => ({ ...prev, [clip.id]: false }));
    }, 1000);

    const isLikedByMe = clip.likes?.includes(user?.uid || '');
    if (!isLikedByMe) {
      handleLikeToggle(clip);
    }
  };

  // Post Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || !filteredClips[currentIndex]) return;

    const clipId = filteredClips[currentIndex].id;
    const commentData = {
      clipId,
      userId: user.uid,
      userName: user.displayName || user.email?.split('@')[0] || 'User',
      userAvatar: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&fit=crop&q=80',
      text: newComment.trim(),
      createdAt: serverTimestamp()
    };

    setNewComment('');

    if (clipId.startsWith('seed-')) {
      // Handle seed clip comment locally
      const mockCommentId = `comment-seed-${Math.random().toString(36).substring(2, 11)}`;
      const newCommentObj: ClipComment = {
        id: mockCommentId,
        clipId,
        userId: user.uid,
        userName: commentData.userName,
        userAvatar: commentData.userAvatar,
        text: commentData.text,
        createdAt: new Date()
      };
      setLocalComments(prev => ({
        ...prev,
        [clipId]: [...(prev[clipId] || []), newCommentObj]
      }));
      return;
    }

    try {
      await addDoc(collection(db, 'clips', clipId, 'comments'), commentData);
    } catch (e) {
      console.error("Failed to add comment:", e);
      showToast(
        language === 'ka' ? 'კომენტარის დამატება ვერ მოხერხდა' : 'Failed to post comment',
        'error'
      );
    }
  };

  // Delete Clip
  const handleDeleteClip = async (clip: Clip) => {
    if (window.confirm(language === 'ka' ? 'ნამდვილად გსურთ ამ კლიპის წაშლა?' : 'Are you sure you want to delete this clip?')) {
      try {
        await deleteDoc(doc(db, 'clips', clip.id));
        showToast(
          language === 'ka' ? 'კლიპი წარმატებით წაიშალა' : 'Clip deleted successfully',
          'success'
        );
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        }
      } catch (e) {
        console.error("Error deleting clip:", e);
        showToast(
          language === 'ka' ? 'წაშლა ვერ მოხერხდა' : 'Failed to delete clip',
          'error'
        );
      }
    }
  };

  // Share Clip Link
  const handleShareClip = (clip: Clip) => {
    const shareUrl = `${window.location.origin}/clips?id=${clip.id}`;
    navigator.clipboard.writeText(shareUrl);
    showToast(
      language === 'ka' ? 'ბმული კოპირებულია ბუფერში!' : 'Clip link copied to clipboard!',
      'success'
    );
  };

  // Open Creator Profile Overlay
  const handleOpenCreatorProfile = async (creatorId: string, creatorName: string, avatar?: string) => {
    setSelectedCreator({ id: creatorId, name: creatorName, avatar });
    const q = query(collection(db, 'clips'), where('creatorId', '==', creatorId));
    try {
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Clip));
      setCreatorClips(list);
    } catch (e) {
      console.error("Failed to load creator clips:", e);
    }
  };

  // Drag & Drop / Selection helpers for local video uploading
  const handleLocalFileSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      showToast(
        language === 'ka' ? 'გთხოვთ აირჩიოთ მხოლოდ ვიდეო ფაილი (.mp4)' : 'Please select a valid video file (.mp4)',
        'error'
      );
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setNewClipVideoUrl(localUrl);
    setLocalVideoFile(file);
    setSelectedPresetId('');
    showToast(
      language === 'ka' ? 'ვიდეო ფაილი წარმატებით ჩაიტვირთა!' : 'Video file loaded successfully!',
      'success'
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLocalFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleHashtagClick = (tag: string) => {
    if (newClipCaption.includes(tag)) {
      setNewClipCaption(prev => prev.replace(new RegExp(`\\s*${tag}`, 'g'), '').trim());
    } else {
      setNewClipCaption(prev => {
        const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
        return `${prev}${spacer}${tag}`;
      });
    }
  };

  // Create Reel Action
  const handleCreateReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast(
        language === 'ka' ? 'ვიდეოს დასადებად გაიარეთ ავტორიზაცია' : 'Please sign in to post reels',
        'warning'
      );
      return;
    }

    if (!newClipCaption.trim()) {
      showToast(
        language === 'ka' ? 'გთხოვთ შეიყვანოთ აღწერა' : 'Please enter a caption',
        'warning'
      );
      return;
    }

    setIsUploading(true);

    let finalVideoUrl = newClipVideoUrl.trim();
    let finalSound = newClipSound.trim() || 'Original Sound';

    const docId = `clip-${Math.random().toString(36).substring(2, 11)}`;

    // If there's a local video file, attempt to convert it to base64 if small enough.
    if (localVideoFile) {
      if (localVideoFile.size > 700 * 1024) { // 700 KB limit for safe Base64 Firestore storage
        try {
          await saveVideoToLocalCache(docId, localVideoFile);
          finalVideoUrl = `indexeddb://${docId}`;
          showToast(
            language === 'ka' 
              ? 'ვიდეო ფაილი დიდია (>700KB). ოპტიმალური სიჩქარისთვის ის შეინახება თქვენს ბრაუზერში!' 
              : 'Video file is large (>700KB). Saved to local browser cache for peak speed!',
            'info'
          );
        } catch (err) {
          console.error("Failed to save to local IndexedDB:", err);
        }
      } else {
        try {
          const base64String = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(localVideoFile);
          });
          finalVideoUrl = base64String;
        } catch (err) {
          console.error("Base64 video conversion error:", err);
        }
      }
    }

    // If no custom URL or local conversion, use selected preset
    if (!finalVideoUrl) {
      const preset = PRESET_LOOPS.find(p => p.id === selectedPresetId);
      if (preset) {
        finalVideoUrl = preset.url;
        if (!newClipSound.trim()) {
          finalSound = preset.sound;
        }
      }
    }

    const clipData = {
      id: docId,
      videoUrl: finalVideoUrl,
      thumbnailUrl: newClipThumbnail || '',
      duration: newClipDuration || 0,
      caption: newClipCaption,
      creatorId: user.uid,
      creatorName: user.displayName || user.email?.split('@')[0] || 'Ordinary Creator',
      creatorAvatar: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&fit=crop&q=80',
      likes: [],
      likesCount: 0,
      soundName: finalSound,
      productId: newClipProductId || '',
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'clips', docId), clipData);
      showToast(
        language === 'ka' ? 'კლიპი წარმატებით აიტვირთა!' : 'Clip uploaded successfully!',
        'success'
      );
      
      // Reset fields
      setNewClipCaption('');
      setNewClipSound('');
      setNewClipVideoUrl('');
      setNewClipThumbnail('');
      setNewClipDuration(0);
      setNewClipProductId('');
      setLocalVideoFile(null);
      setUploadStep(1);
      setIsCreateOpen(false);
      setActiveTab('myClips'); // Switch to My Clips to see the post!
      setCurrentIndex(0);
    } catch (error) {
      console.error("Failed to upload clip:", error);
      showToast(
        language === 'ka' ? 'ატვირთვისას მოხდა შეცდომა' : 'Failed to upload clip',
        'error'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div id="proton-clips-view" className="flex flex-col h-full w-full text-proton-text select-none">
      
      {/* Dynamic Keyframe Injection for Advanced Video Filters */}
      <style>{`
        @keyframes proton-glitch-skew {
          0% { transform: skew(0.5deg) scale(1.01); filter: hue-rotate(0deg) saturate(1.5); }
          15% { transform: skew(-0.8deg) scale(1); filter: hue-rotate(10deg) saturate(1.7); }
          30% { transform: skew(0.2deg) scale(1.02); filter: hue-rotate(0deg); }
          45% { transform: skew(-0.5deg) scale(0.99); filter: hue-rotate(-10deg) saturate(1.5); }
          60% { transform: skew(0.8deg) scale(1.01); filter: hue-rotate(5deg); }
          75% { transform: skew(-0.2deg) scale(1); filter: hue-rotate(-5deg) saturate(1.8); }
          90% { transform: skew(0.4deg) scale(1.03); filter: hue-rotate(20deg); }
          100% { transform: skew(0.1deg) scale(1.01); filter: hue-rotate(0deg) saturate(1.5); }
        }
        .animate-proton-glitch {
          animation: proton-glitch-skew 1.2s infinite steps(6) alternate-reverse;
        }
      `}</style>
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-proton-border/30 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-500/10 to-pink-500/10 border border-purple-500/20 text-purple-400">
            <Video size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Proton Clips</span>
              <span className="text-[10px] uppercase bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black px-1.5 py-0.5 rounded-full tracking-wider">
                Reels
              </span>
            </h1>
            <p className="text-xs text-proton-muted">
              {language === 'ka' ? 'გააზიარე მოკლე ვიდეოები, აღმოაჩინე ნიჭიერი ხალხი და ადგილობრივი ნაწარმი' : 'Explore vertical video stories from ordinary creators and marketplace makers'}
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFeaturesModal(true)}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-proton-card border border-proton-border/40 hover:bg-proton-accent/10 hover:text-proton-accent hover:border-proton-accent/30 text-proton-muted hover:text-proton-text font-bold text-xs transition-all cursor-pointer"
            title={language === 'ka' ? 'ფუნქციონალი და შესაძლებლობები' : 'Features & Capabilities'}
          >
            <Sparkles size={14} className="text-purple-400" />
            <span>{language === 'ka' ? 'ფუნქციონალი' : 'Features'}</span>
          </button>
          
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs tracking-wide shadow-md shadow-purple-500/10 hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>{language === 'ka' ? 'დადე კლიპი' : 'Share a Clip'}</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 py-3 px-2">
        
        {/* Navigation Tabs */}
        <div className="flex items-center bg-proton-bg/60 p-1 rounded-xl border border-proton-border/20 self-start">
          <button
            onClick={() => { setActiveTab('forYou'); setCurrentIndex(0); }}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === 'forYou' 
                ? "bg-purple-500/20 text-purple-400 shadow-sm font-semibold border border-purple-500/30" 
                : "text-proton-muted hover:text-white"
            )}
          >
            <TrendingUp size={13} />
            <span>{language === 'ka' ? 'ყველასთვის' : 'For You'}</span>
          </button>
          <button
            onClick={() => { setActiveTab('productReels'); setCurrentIndex(0); }}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === 'productReels' 
                ? "bg-pink-500/20 text-pink-400 shadow-sm font-semibold border border-pink-500/30" 
                : "text-proton-muted hover:text-white"
            )}
          >
            <ShoppingBag size={13} />
            <span>{language === 'ka' ? 'მარკეტ კლიპები' : 'Product Reels'}</span>
          </button>
          <button
            onClick={() => { setActiveTab('myClips'); setCurrentIndex(0); }}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === 'myClips' 
                ? "bg-amber-500/20 text-amber-400 shadow-sm font-semibold border border-amber-500/30" 
                : "text-proton-muted hover:text-white"
            )}
          >
            <UserIcon size={13} />
            <span>{language === 'ka' ? 'ჩემი კლიპები' : 'My Clips'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-proton-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentIndex(0); }}
            placeholder={language === 'ka' ? 'ძიება ჰეშთეგით (#tech) ან ავტორით...' : 'Search tags (#handmade) or creators...'}
            className="w-full pl-9 pr-4 py-1.5 bg-proton-bg/40 text-xs border border-proton-border/20 rounded-xl focus:border-purple-500/50 outline-none text-proton-text placeholder:text-proton-muted/60 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-proton-muted hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* REELS VIEWPORTS AREA */}
      <div className="flex-1 flex justify-center items-center overflow-hidden bg-black/40 rounded-2xl relative border border-proton-border/10">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 font-mono text-xs text-proton-muted">
            <svg className="animate-spin h-5 w-5 text-purple-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="uppercase tracking-widest text-[10px] font-black">{language === 'ka' ? 'კლიპები იტვირთება...' : 'Streaming Proton Feed...'}</span>
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-6 gap-3 max-w-sm">
            <div className="p-3.5 rounded-full bg-proton-bg/40 border border-proton-border/20 text-proton-muted">
              <Video size={32} className="opacity-40" />
            </div>
            <p className="text-xs font-semibold text-proton-text">
              {language === 'ka' ? 'კლიპები ვერ მოიძებნა' : 'No clips found'}
            </p>
            <p className="text-[11px] text-proton-muted leading-relaxed">
              {language === 'ka' 
                ? 'შენს კრიტერიუმებს არცერთი ვიდეო არ შეესაბამება. გახდი პირველი, ვინც ატვირთავს ამ კატეგორიაში!' 
                : 'No video clips match your current filters or search terms. Be the first to share one!'}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[11px] font-bold hover:bg-purple-500/30 transition-all mt-2"
            >
              {language === 'ka' ? 'კლიპის გამოქვეყნება' : 'Publish a Clip'}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Navigation buttons */}
            <div className="hidden lg:flex flex-col gap-3 absolute right-8 z-20">
              <button
                onClick={handleScrollUp}
                disabled={currentIndex === 0}
                className="p-3 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/10 transition-all shadow-xl hover:scale-110 disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                title="Previous Reel"
              >
                <ChevronUp size={20} />
              </button>
              <button
                onClick={handleScrollDown}
                disabled={currentIndex === filteredClips.length - 1}
                className="p-3 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/10 transition-all shadow-xl hover:scale-110 disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                title="Next Reel"
              >
                <ChevronDown size={20} />
              </button>
            </div>
            
            {/* VERTICAL TIKTOK GRID FEEDS */}
            <div 
              ref={containerRef}
              onScroll={handleScroll}
              className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth flex flex-col items-center"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filteredClips.map((clip, idx) => {
                const isLikedByMe = clip.likes?.includes(user?.uid || '');
                const hasProduct = !!clip.productId;

                return (
                  <div 
                    key={clip.id} 
                    className="w-full max-w-[450px] lg:max-w-[1240px] h-full min-h-full flex-shrink-0 snap-start snap-always relative overflow-hidden bg-black/95 lg:bg-transparent flex flex-col lg:flex-row items-center justify-center lg:gap-8 lg:px-4"
                  >
                    
                    {/* DESKTOP LEFT SIDE PANEL: ABOUT CREATOR, DETAILS, AND DIAGNOSTICS */}
                    <div className="hidden lg:flex flex-col gap-4 w-[320px] h-full max-h-full py-4 select-text text-left overflow-y-auto custom-scrollbar-minimal pr-1">
                      
                      {/* Creator Glass Card */}
                      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}
                            className="w-12 h-12 rounded-full border-2 border-purple-500 overflow-hidden bg-proton-bg hover:scale-105 transition-all shadow-md flex items-center justify-center text-white cursor-pointer"
                          >
                            {clip.creatorAvatar ? (
                              <img referrerPolicy="no-referrer" src={clip.creatorAvatar} alt={clip.creatorName} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={20} />
                            )}
                          </button>
                          
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p 
                                onClick={() => handleOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}
                                className="font-extrabold text-sm text-white hover:underline cursor-pointer truncate"
                              >
                                @{clip.creatorName}
                              </p>
                              {clip.creatorId.startsWith('proton-system') && (
                                <CheckCircle2 size={13} className="text-purple-400 fill-white stroke-[2.5]" />
                              )}
                            </div>
                            <span className="text-[10px] text-purple-400 font-mono tracking-widest uppercase">
                              {clip.creatorId.startsWith('proton-system') ? (language === 'ka' ? 'ოფიციალური' : 'Verified Creator') : (language === 'ka' ? 'მომხმარებელი' : 'Proton Member')}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Bio/Badge */}
                        <p className="text-[11px] text-gray-300 leading-relaxed font-normal bg-white/5 border border-white/5 rounded-xl px-2.5 py-1.5">
                          {language === 'ka' 
                            ? 'ამ ავტორის კრეატიული კონტენტი სპეციალურად Proton ეკოსისტემისთვის.' 
                            : 'Creative content stream custom-built and optimized for the Proton ecosystem.'}
                        </p>
                      </div>

                      {/* Description & Narrative Card */}
                      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-2.5 shadow-xl">
                        <h4 className="text-[10px] font-black text-purple-400 tracking-widest uppercase">{language === 'ka' ? 'აღწერა და ტეგები' : 'Description & Tags'}</h4>
                        <p className="text-xs font-normal text-gray-200 leading-relaxed">
                          {clip.caption.split(' ').map((word, i) => {
                            if (word.startsWith('#')) {
                              return (
                                <span 
                                  key={i} 
                                  onClick={() => setSearchQuery(word)}
                                  className="text-purple-400 font-bold hover:underline cursor-pointer mr-1"
                                >
                                  {word}{' '}
                                </span>
                              );
                            }
                            return word + ' ';
                          })}
                        </p>

                        {/* Sound track info */}
                        <div className="flex items-center gap-2 mt-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-gray-300">
                          <Music size={13} className="text-purple-400 animate-pulse" />
                          <div className="text-[11px] font-medium overflow-hidden relative h-4 flex-1">
                            <span className="font-mono text-white/90 truncate block">
                              {clip.soundName || 'Original Audio - Custom Record'}
                            </span>
                          </div>
                          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-gray-900 to-black border border-white/20 flex items-center justify-center animate-spin [animation-duration:6s]">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          </div>
                        </div>
                      </div>

                      {/* Tagged Product Box */}
                      {hasProduct && clip.productInfo && (
                        <div className="bg-zinc-900/50 backdrop-blur-xl border border-pink-500/30 rounded-2xl p-3.5 flex flex-col gap-3 shadow-xl">
                          <div className="flex items-center gap-2.5">
                            <ShoppingBag size={14} className="text-pink-400 animate-bounce" />
                            <span className="text-[10px] uppercase font-black tracking-widest text-pink-400">
                              {language === 'ka' ? 'მონიშნული პროდუქტი' : 'TAGGED PRODUCT'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
                            <div className="w-12 h-12 rounded-lg bg-pink-500/10 border border-pink-500/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {clip.productInfo.image ? (
                                <img referrerPolicy="no-referrer" src={clip.productInfo.image} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <ShoppingBag size={16} className="text-pink-400" />
                              )}
                            </div>
                            <div className="min-w-0 leading-tight flex-1">
                              <h4 className="text-xs font-bold text-white truncate">
                                {clip.productInfo.title}
                              </h4>
                              <p className="text-[11px] font-mono text-emerald-400 font-bold mt-1">
                                ${clip.productInfo.price}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setActiveView('market-hub');
                              showToast(
                                language === 'ka' 
                                  ? `გადამისამართება პროდუქტზე: ${clip.productInfo.title}` 
                                  : `Redirecting to tagged item: ${clip.productInfo.title}`,
                                'info'
                              );
                            }}
                            className="w-full py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                          >
                            <span>{language === 'ka' ? 'შეიძინე ახლავე' : 'Purchase Item'}</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      )}

                    </div>

                    {/* CENTER VIDEO SIMULATED PHONE BEZEL FRAME */}
                    <div className="relative h-[98%] max-h-[780px] aspect-[9/16] max-w-full rounded-[24px] sm:rounded-[38px] border-[3px] sm:border-[5px] border-zinc-800 shadow-2xl bg-black overflow-hidden flex flex-col justify-between pointer-events-auto">
                      
                      {/* SIMULATED PHONE NOTCH (Dynamic Island Indicator) */}
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-black rounded-full z-40 flex items-center justify-center border border-white/5">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-900/60 border border-zinc-800 flex items-center justify-center mr-1">
                          <div className="w-1 h-1 rounded-full bg-blue-500/80" />
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                      </div>

                      {/* VIDEO PLAYER ELEMENT */}
                      <div 
                        className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden cursor-pointer rounded-[32px]"
                        onDoubleClick={() => handleDoubleTap(clip)}
                        onClick={() => togglePlay(idx)}
                      >
                        <video
                          ref={el => registerVideoRef(idx, el)}
                          src={clip.videoUrl}
                          loop
                          playsInline
                          muted={isMuted}
                          preload="auto"
                          autoPlay={idx === currentIndex && isPlaying}
                          className={cn(
                            "w-full h-full object-contain transition-all duration-300",
                            activeFilter === 'noir' && "grayscale contrast-[1.25] brightness-95",
                            activeFilter === 'vintage' && "sepia brightness-[0.88] contrast-[1.05] saturate-[1.3]",
                            activeFilter === 'warm' && "saturate-[1.55] contrast-[1.05] brightness-[0.95] sepia-[0.12]",
                            activeFilter === 'glitch' && "animate-proton-glitch brightness-[1.05] contrast-[1.2] saturate-[1.5]"
                          )}
                          onPlay={() => {
                            if (idx === currentIndex) {
                              setIsPlaying(true);
                            }
                          }}
                          onPause={() => {
                            if (idx === currentIndex) {
                              setIsPlaying(false);
                            }
                          }}
                          onWaiting={() => {
                            if (idx === currentIndex) {
                              setIsBuffering(true);
                            }
                          }}
                          onPlaying={() => {
                            if (idx === currentIndex) {
                              setIsBuffering(false);
                            }
                          }}
                          onLoadedData={() => {
                            setLoadedVideoIds(prev => ({ ...prev, [clip.id]: true }));
                          }}
                          onError={() => {
                            console.error("Video play/decode error for ID", clip.id);
                            setFailedVideoIds(prev => ({ ...prev, [clip.id]: true }));
                          }}
                          onLoadedMetadata={(e) => handleVideoMetadataLoad(clip.id, e)}
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

                        {/* Double Tap Heart Overlay */}
                        {doubleTapHearts[clip.id] && (
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: [0.3, 1.3, 1.0, 1.2, 0], opacity: [0, 1, 1, 1, 0] }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="absolute pointer-events-none z-30 flex items-center justify-center bg-black/15 backdrop-blur-[1px] p-6 rounded-full"
                          >
                            <Heart className="text-rose-500 fill-rose-500 stroke-none drop-shadow-lg" size={80} />
                          </motion.div>
                        )}

                        {/* Sound mute state changed visual feedback overlay */}
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

                        {/* Dynamic 0.1s Extracted Frame Placeholder Thumbnail shown while video is loading */}
                        {!loadedVideoIds[clip.id] && (dynamicPlaceholderThumbnails[clip.id] || clip.thumbnailUrl) && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90">
                            <img
                              referrerPolicy="no-referrer"
                              src={dynamicPlaceholderThumbnails[clip.id] || clip.thumbnailUrl}
                              alt="Loading clip preview..."
                              className="w-full h-full object-contain pointer-events-none opacity-80"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
                              <svg className="animate-spin h-6 w-6 text-purple-500/80" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </div>
                          </div>
                        )}
                        
                        {/* Native Unsupported Codec/Format Overlay Fallback */}
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
                                ? 'ბრაუზერს არ აქვს ამ ვიდეოს კოდეკის მხარდაჭერა. გთხოვთ გამოიყენოთ MP4.' 
                                : 'This specific video codec is not supported by your browser.'}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                clip.videoUrl = PRESET_LOOPS[0].url;
                                setFailedVideoIds(prev => ({ ...prev, [clip.id]: false }));
                                showToast(
                                  language === 'ka' ? 'ჩაირთო სტანდარტული კლიპი' : 'Playing standard fallback loop',
                                  'info'
                                );
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold hover:bg-purple-500/30 transition-all cursor-pointer"
                            >
                              {language === 'ka' ? 'დემო ვიდეოს ჩართვა' : 'Play standard demo loop'}
                            </button>
                          </div>
                        )}
                        
                        {/* Real-time CRT scanlines overlay when Glitch effect is selected */}
                        {activeFilter === 'glitch' && (
                          <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,_rgba(255,0,0,0.06),_rgba(0,255,0,0.02),_rgba(0,0,255,0.06))] bg-[size:100%_4px,_3px_100%] opacity-75 mix-blend-overlay animate-pulse" />
                        )}
                        
                        {/* Buffering Loader overlay */}
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
                              className="absolute pointer-events-none z-10 bg-black/40 p-4 rounded-full"
                            >
                              <Play className="text-white fill-white" size={28} />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Custom Play Progress Bar Timeline */}
                        {idx === currentIndex && (
                          <ReelProgressBar 
                            videoElement={videoRefs.current[idx] || null} 
                            clip={clip} 
                          />
                        )}
                      </div>

                      {/* TOP OVERLAYS (VOLUME & TIMING RATIO INDICATOR) */}
                      <div className="absolute top-8 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                        <div className="px-2.5 py-1 rounded-md bg-black/60 text-[9px] font-mono font-black text-purple-300 uppercase tracking-widest border border-white/10">
                          Clips {idx + 1} / {filteredClips.length}
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMute();
                          }}
                          className="p-2 rounded-full bg-black/60 border border-white/10 text-white hover:bg-black/85 hover:scale-105 transition-all pointer-events-auto cursor-pointer"
                        >
                          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                      </div>

                      {/* MOBILE-ONLY RIGHT SIDEBAR ACTIONS (lg:hidden) */}
                      <div className="absolute right-3 bottom-24 z-10 flex lg:hidden flex-col items-center gap-5 pointer-events-none">
                        
                        {/* Creator avatar bubble */}
                        <div className="relative group pointer-events-auto">
                          <button
                            onClick={() => handleOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}
                            className="w-10 h-10 rounded-full border-2 border-purple-500 overflow-hidden bg-proton-bg hover:scale-105 transition-all shadow-md flex items-center justify-center text-white cursor-pointer"
                          >
                            {clip.creatorAvatar ? (
                              <img referrerPolicy="no-referrer" src={clip.creatorAvatar} alt={clip.creatorName} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={16} />
                            )}
                          </button>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-purple-500 text-white rounded-full p-0.5 hover:scale-115 transition-all">
                            <Plus size={8} className="stroke-[3]" />
                          </div>
                        </div>

                        {/* Like button */}
                        <div className="flex flex-col items-center gap-1 pointer-events-auto">
                          <motion.button
                            whileTap={{ scale: 0.8 }}
                            onClick={() => handleLikeToggle(clip)}
                            className={cn(
                              "p-2.5 rounded-full bg-black/40 border transition-all shadow-lg cursor-pointer",
                              isLikedByMe 
                                ? "border-red-500/40 text-red-500 bg-red-500/10" 
                                : "border-white/10 text-white hover:bg-black/60"
                            )}
                          >
                            <Heart className={cn("h-4.5 w-4.5", isLikedByMe && "fill-red-500")} />
                          </motion.button>
                          <span className="text-[10px] font-bold text-white drop-shadow-md">
                            {clip.likesCount || 0}
                          </span>
                        </div>

                        {/* Comments button */}
                        <div className="flex flex-col items-center gap-1 pointer-events-auto">
                          <button
                            onClick={() => setIsCommentsOpen(true)}
                            className="p-2.5 rounded-full bg-black/40 border border-white/10 text-white hover:bg-black/60 transition-all shadow-lg cursor-pointer"
                          >
                            <MessageSquare className="h-4.5 w-4.5" />
                          </button>
                          <span className="text-[10px] font-bold text-white drop-shadow-md">
                            {clip.id.startsWith('seed-') 
                              ? (localComments[clip.id]?.length || 0)
                              : (currentIndex === idx && comments.length > 0) ? comments.length : '0'}
                          </span>
                        </div>

                        {/* Share button */}
                        <div className="flex flex-col items-center gap-1 pointer-events-auto">
                          <button
                            onClick={() => handleShareClip(clip)}
                            className="p-2.5 rounded-full bg-black/40 border border-white/10 text-white hover:bg-black/60 transition-all shadow-lg cursor-pointer"
                          >
                            <Share2 className="h-4.5 w-4.5" />
                          </button>
                        </div>

                        {/* Filters and Auto-Fix on Mobile */}
                        <div className="flex flex-col items-center gap-1 pointer-events-auto">
                          <button
                            onClick={() => setShowFiltersPanel(prev => !prev)}
                            className={cn(
                              "p-2.5 rounded-full border transition-all shadow-lg cursor-pointer",
                              showFiltersPanel 
                                ? "bg-purple-600/35 border-purple-500 text-purple-300 shadow-purple-500/20" 
                                : "bg-black/40 border-white/10 text-white hover:bg-black/60"
                            )}
                          >
                            <Sparkles className="h-4.5 w-4.5" />
                          </button>
                        </div>

                        {/* Auto fix action */}
                        <div className="flex flex-col items-center gap-1 pointer-events-auto">
                          <button
                            onClick={() => runAutoFixAnalysis(clip)}
                            className={cn(
                              "p-2.5 rounded-full border transition-all shadow-lg cursor-pointer",
                              (appliedFixes[clip.id]?.length > 0)
                                ? "bg-emerald-600/30 border-emerald-500 text-emerald-300 shadow-emerald-500/20"
                                : "bg-black/40 border-white/10 text-white hover:bg-black/60"
                            )}
                          >
                            <Wand2 className="h-4.5 w-4.5 animate-pulse" />
                          </button>
                        </div>

                      </div>

                      {/* MOBILE-ONLY BOTTOM CAPTION & PRODUCTS INFO BLOCK (lg:hidden) */}
                      <div className="absolute bottom-4 left-4 right-14 z-10 pointer-events-none flex lg:hidden flex-col gap-3">
                        
                        {/* Tagged Product Box */}
                        {hasProduct && clip.productInfo && (
                          <motion.div 
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="bg-black/85 border border-pink-500/30 rounded-xl p-2 max-w-sm pointer-events-auto flex items-center justify-between gap-3 shadow-lg backdrop-blur-md"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded bg-pink-500/10 border border-pink-500/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {clip.productInfo.image ? (
                                  <img referrerPolicy="no-referrer" src={clip.productInfo.image} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <ShoppingBag size={12} className="text-pink-400" />
                                )}
                              </div>
                              <div className="min-w-0 leading-tight">
                                <h4 className="text-[10px] font-bold text-white truncate max-w-[120px]">
                                  {clip.productInfo.title}
                                </h4>
                                <p className="text-[9px] font-mono text-emerald-400 font-bold">
                                  ${clip.productInfo.price}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setActiveView('market-hub');
                              }}
                              className="px-2 py-0.5 rounded bg-pink-600 hover:bg-pink-500 text-[9px] font-bold text-white flex items-center gap-0.5 cursor-pointer pointer-events-auto"
                            >
                              <span>{language === 'ka' ? 'იყიდე' : 'Buy'}</span>
                              <ChevronRight size={9} />
                            </button>
                          </motion.div>
                        )}

                        {/* Caption text */}
                        <div className="text-white drop-shadow-lg leading-relaxed pointer-events-auto">
                          <p className="font-extrabold text-xs flex items-center gap-1 cursor-pointer" onClick={() => handleOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}>
                            <span>@{clip.creatorName}</span>
                            {clip.creatorId.startsWith('proton-system') && (
                              <CheckCircle2 size={11} className="text-purple-400 fill-white stroke-[2.5]" />
                            )}
                          </p>
                          <p className="text-[11px] font-normal mt-0.5 text-gray-200 select-text leading-relaxed line-clamp-2">
                            {clip.caption}
                          </p>
                        </div>

                        {/* Sound Track name */}
                        <div className="flex items-center gap-1 text-gray-300">
                          <Music size={11} className="text-purple-400 animate-bounce" />
                          <div className="text-[9px] font-medium overflow-hidden w-28 relative h-3.5">
                            <div className="absolute whitespace-nowrap animate-[marquee_12s_linear_infinite] font-mono text-white/80">
                              {clip.soundName || 'Original Audio'}
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* DESKTOP RIGHT SIDE PANEL: ENGAGEMENT CONTROLS & DYNAMIC DIAGNOSTICS HUD */}
                    <div className="hidden lg:flex flex-col gap-4 w-[280px] h-full max-h-full py-4 text-left select-none overflow-y-auto custom-scrollbar-minimal pr-1">
                      
                      {/* Social Interactions Header */}
                      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-4 shadow-xl text-center">
                        <h4 className="text-[10px] font-black text-purple-400 tracking-widest uppercase self-center">{language === 'ka' ? 'ინტერაქციები' : 'Clips Engagement'}</h4>
                        
                        <div className="grid grid-cols-2 gap-2.5">
                          
                          {/* Likes Button */}
                          <button
                            onClick={() => handleLikeToggle(clip)}
                            className={cn(
                              "flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer",
                              isLikedByMe 
                                ? "bg-red-500/10 border-red-500/30 text-red-400 shadow-lg shadow-red-500/5" 
                                : "bg-white/5 border-white/10 text-proton-muted hover:text-white hover:bg-white/10"
                            )}
                          >
                            <Heart size={18} className={cn(isLikedByMe && "fill-red-500 text-red-500")} />
                            <span className="text-[11px] font-black mt-1 text-white">{clip.likesCount || 0}</span>
                            <span className="text-[9px] text-proton-muted uppercase font-bold tracking-wider mt-0.5">{language === 'ka' ? 'მოწონება' : 'Likes'}</span>
                          </button>

                          {/* Comments Button */}
                          <button
                            onClick={() => setIsCommentsOpen(true)}
                            className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/5 border border-white/10 text-proton-muted hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                          >
                            <MessageSquare size={18} className="text-purple-400" />
                            <span className="text-[11px] font-black mt-1 text-white">
                              {clip.id.startsWith('seed-') 
                                ? (localComments[clip.id]?.length || 0)
                                : (currentIndex === idx && comments.length > 0) ? comments.length : '0'}
                            </span>
                            <span className="text-[9px] text-proton-muted uppercase font-bold tracking-wider mt-0.5">{language === 'ka' ? 'აზრი' : 'Discuss'}</span>
                          </button>

                        </div>

                        {/* Copy Deep Link share button */}
                        <button
                          onClick={() => handleShareClip(clip)}
                          className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <Share2 size={13} className="text-purple-400" />
                          <span>{language === 'ka' ? 'ბმულის კოპირება' : 'Copy Direct Link'}</span>
                        </button>

                        {/* Delete option if owner */}
                        {clip.creatorId === user?.uid && (
                          <button
                            onClick={() => handleDeleteClip(clip)}
                            className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>{language === 'ka' ? 'კლიპის წაშლა' : 'Delete Clip'}</span>
                          </button>
                        )}

                      </div>

                      {/* Video Effects Grid */}
                      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
                        <h4 className="text-[10px] font-black text-purple-400 tracking-widest uppercase">{language === 'ka' ? 'კინემატოგრაფიული ფილტრები' : 'KINETIC EFFECTS'}</h4>
                        
                        <div className="grid grid-cols-2 gap-1.5">
                          {FILTER_OPTIONS.map(opt => {
                            const isSelected = activeFilter === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  setActiveFilter(opt.id as any);
                                  showToast(
                                    language === 'ka' 
                                      ? `ფილტრი: ${opt.labelKa}` 
                                      : `Filter: ${opt.labelEn}`,
                                    'success'
                                  );
                                }}
                                className={cn(
                                  "py-1.5 px-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center transition-all border cursor-pointer",
                                  isSelected 
                                    ? "bg-purple-600/30 border-purple-500 text-purple-300 shadow-md shadow-purple-500/10" 
                                    : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                )}
                              >
                                {language === 'ka' ? opt.labelKa : opt.labelEn}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* AI Diagnostics & Metrics HUD */}
                      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-purple-400 tracking-widest uppercase">{language === 'ka' ? 'AI დიაგნოსტიკის HUD' : 'DIAGNOSTICS HUD'}</h4>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        {videoMetadata[clip.id] ? (
                          <div className="space-y-2 text-[10px] font-mono text-gray-400">
                            <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                              <span>RESOLUTION:</span>
                              <span className="text-purple-300 font-bold">{videoMetadata[clip.id].resolution || 'Detecting'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                              <span>RATIO:</span>
                              <span className="text-blue-300 font-bold">{videoMetadata[clip.id].aspectRatio || '16:9 vertical'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                              <span>FPS RATE:</span>
                              <span className="text-pink-300 font-bold">{videoMetadata[clip.id].fps || '30 FPS (est)'}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                              <span>DURATION:</span>
                              <span className="text-amber-300 font-bold">{videoMetadata[clip.id].duration || '0:15'}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-proton-muted italic">{language === 'ka' ? 'დეტექტორი იტვირთება...' : 'Streaming video analysis...'}</p>
                        )}

                        {/* Auto-Fix CTA */}
                        <button
                          onClick={() => runAutoFixAnalysis(clip)}
                          className={cn(
                            "w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer",
                            (appliedFixes[clip.id]?.length > 0)
                              ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/35"
                              : "bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
                          )}
                        >
                          <Wand2 size={13} className="animate-bounce" />
                          <span>
                            {appliedFixes[clip.id]?.length > 0 ? (language === 'ka' ? 'ვიდეო ოპტიმიზირებულია' : 'Video Optimized') : (language === 'ka' ? 'AI ავტო-გასწორება' : 'Magic AI Auto-Fix')}
                          </span>
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })}
          </div>
          </>
        )}
      </div>

      {/* COMMENTS BOTTOM/RIGHT DRAWER */}
      <AnimatePresence>
        {isCommentsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
            <div className="absolute inset-0" onClick={() => setIsCommentsOpen(false)} />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="relative w-full max-w-md h-full bg-proton-bg border-l border-proton-border/30 flex flex-col shadow-2xl z-10"
            >
              {/* Comment Drawer Header */}
              <div className="p-4 border-b border-proton-border/20 flex items-center justify-between bg-proton-bg/40 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <MessageSquare className="text-purple-400" size={16} />
                  <h3 className="font-bold text-sm">
                    {language === 'ka' ? 'კომენტარები' : 'Comments'} ({comments.length})
                  </h3>
                </div>
                <button
                  onClick={() => setIsCommentsOpen(false)}
                  className="p-1.5 rounded-lg bg-proton-bg/60 border border-proton-border/10 text-proton-muted hover:text-white hover:bg-proton-bg/80 transition-all"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable Feed Comments */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {commentsLoading ? (
                  <div className="h-32 flex items-center justify-center text-xs font-mono text-proton-muted animate-pulse uppercase tracking-wider">
                    {language === 'ka' ? 'კომენტარები იტვირთება...' : 'Streaming Comments...'}
                  </div>
                ) : comments.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-proton-muted gap-2 text-center p-4">
                    <MessageSquare size={20} className="opacity-30" />
                    <p className="text-xs">{language === 'ka' ? 'ჯერ კომენტარები არ არის' : 'No comments yet'}</p>
                    <p className="text-[10px] text-proton-muted/60">{language === 'ka' ? 'დაწერე პირველი კომენტარი კლიპზე!' : 'Be the first to share your thoughts!'}</p>
                  </div>
                ) : (
                  comments.map((comm) => (
                    <div key={comm.id} className="flex gap-3 leading-snug">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-proton-bg flex-shrink-0 flex items-center justify-center border border-proton-border/20 text-white">
                        {comm.userAvatar ? (
                          <img referrerPolicy="no-referrer" src={comm.userAvatar} alt={comm.userName} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={12} />
                        )}
                      </div>
                      <div className="flex-1 bg-proton-bg/50 p-2.5 rounded-xl border border-proton-border/10">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-black text-white">@{comm.userName}</p>
                          <span className="text-[9px] text-proton-muted font-mono">
                            {comm.createdAt ? (
                              comm.createdAt.seconds 
                                ? new Date(comm.createdAt.seconds * 1000).toLocaleDateString() 
                                : comm.createdAt instanceof Date 
                                  ? comm.createdAt.toLocaleDateString()
                                  : typeof comm.createdAt === 'string' || typeof comm.createdAt === 'number'
                                    ? new Date(comm.createdAt).toLocaleDateString()
                                    : 'Just now'
                            ) : 'Just now'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-200 mt-1 select-text break-words">
                          {comm.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Post Comment Input bar */}
              <form onSubmit={handlePostComment} className="p-4 border-t border-proton-border/20 bg-proton-bg/80 backdrop-blur-md">
                <div className="relative">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={user ? (language === 'ka' ? 'დაწერე კომენტარი...' : 'Add a comment...') : (language === 'ka' ? 'კომენტარისთვის გაიარეთ ავტორიზაცია' : 'Sign in to comment')}
                    disabled={!user}
                    className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl py-2 pl-4 pr-12 text-xs text-proton-text placeholder:text-proton-muted/60 transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!user || !newComment.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white disabled:opacity-40 disabled:pointer-events-none hover:scale-105 transition-all"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATOR OVERLAY / PROFILE MODAL */}
      <AnimatePresence>
        {selectedCreator && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-proton-bg border border-proton-border/30 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <button
                onClick={() => setSelectedCreator(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-proton-bg border border-proton-border/10 text-proton-muted hover:text-white transition-all"
              >
                <X size={15} />
              </button>

              {/* Creator Profile Summary */}
              <div className="flex items-center gap-4 pb-6 border-b border-proton-border/20">
                <div className="w-16 h-16 rounded-full border-2 border-purple-500 overflow-hidden bg-proton-bg flex items-center justify-center">
                  {selectedCreator.avatar ? (
                    <img referrerPolicy="no-referrer" src={selectedCreator.avatar} alt={selectedCreator.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={24} className="text-proton-muted" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white flex items-center gap-1.5">
                    <span>@{selectedCreator.name}</span>
                    {selectedCreator.id.startsWith('proton-system') && (
                      <CheckCircle2 size={14} className="text-purple-400 fill-white" />
                    )}
                  </h3>
                  <p className="text-xs text-proton-muted mt-1 leading-relaxed">
                    {language === 'ka' 
                      ? 'Proton-ის რეგისტრირებული იუზერი. მოკლე კლიპები და ისტორიები.' 
                      : 'Verified Proton story maker. Creator of fine-looking content.'}
                  </p>

                  <div className="flex gap-4 mt-3 text-[11px] font-mono">
                    <div>
                      <span className="text-white font-bold">{creatorClips.length} </span>
                      <span className="text-proton-muted">{language === 'ka' ? 'კლიპი' : 'clips'}</span>
                    </div>
                    <div>
                      <span className="text-white font-bold">
                        {creatorClips.reduce((sum, c) => sum + (c.likesCount || 0), 0)}
                      </span>
                      <span className="text-proton-muted"> {language === 'ka' ? 'მოწონება' : 'likes'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Gallery of Creator Clips */}
              <h4 className="font-bold text-xs uppercase tracking-wider text-proton-muted py-3">
                {language === 'ka' ? 'ვიდეოების გალერეა' : 'REELS GALLERY'}
              </h4>
              <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 pb-2">
                {creatorClips.length === 0 ? (
                  <div className="col-span-3 text-center py-8 text-xs text-proton-muted">
                    {language === 'ka' ? 'გალერეა ცარიელია' : 'No reels in gallery yet'}
                  </div>
                ) : (
                  creatorClips.map((c) => (
                    <div 
                      key={c.id} 
                      className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative cursor-pointer group border border-proton-border/10 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:border-purple-500/30"
                      onClick={() => {
                        // Switch to 'forYou' tab and clear search queries so that the item is guaranteed to be in the render list
                        setActiveTab('forYou');
                        setSearchQuery('');
                        
                        const targetIndex = clips.findIndex(x => x.id === c.id);
                        if (targetIndex !== -1) {
                          setCurrentIndex(targetIndex);
                          setSelectedCreator(null);
                          
                          // Scroll to the targeted item index inside the reels feed smoothly after a tiny render frame delay
                          setTimeout(() => {
                            if (containerRef.current) {
                              containerRef.current.scrollTo({
                                top: targetIndex * containerRef.current.clientHeight,
                                behavior: 'smooth'
                              });
                            }
                          }, 100);
                        }
                      }}
                    >
                      {/* Video Duration Badge */}
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] font-mono font-bold text-white/90 z-10 flex items-center gap-1 shadow-sm border border-white/5 pointer-events-none">
                        <Clock size={8} className="text-purple-400" />
                        <span>{formatDuration(c.duration)}</span>
                      </div>

                      {c.thumbnailUrl ? (
                        <img 
                          src={c.thumbnailUrl} 
                          alt={c.caption} 
                          className="w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105 group-hover:brightness-[1.12] group-hover:contrast-[1.02]" 
                        />
                      ) : (
                        <video 
                          src={c.videoUrl} 
                          className="w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105 group-hover:brightness-[1.12] group-hover:contrast-[1.02]" 
                          muted 
                          playsInline 
                        />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-white transform translate-y-1.5 group-hover:translate-y-0 transition-all duration-300">
                          <Heart size={10} className="fill-white text-pink-500" />
                          <span>{c.likesCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CLIPS FEATURES SUMMARY MODAL */}
      <AnimatePresence>
        {showFeaturesModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-3xl bg-proton-bg border border-proton-border/30 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto text-proton-text"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowFeaturesModal(false)}
                className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 border border-white/10 text-proton-muted hover:text-white hover:bg-white/10 transition-all z-10 cursor-pointer"
              >
                <X size={16} />
              </button>

              {/* Title Header */}
              <div className="flex items-center gap-3 pb-6 border-b border-proton-border/20">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-500/10 to-pink-500/10 border border-purple-500/20 text-purple-400">
                  <Sparkles className="animate-spin" style={{ animationDuration: '6s' }} size={24} />
                </div>
                <div>
                  <h3 className="font-black text-xl uppercase tracking-wider text-white">
                    {language === 'ka' ? 'მოკლე კლიპების სრული ფუნქციონალი' : 'Proton Clips Feature Suite'}
                  </h3>
                  <p className="text-xs text-proton-muted">
                    {language === 'ka' 
                      ? 'მიმოიხილეთ აპლიკაციის კლიპების პორტალის უახლესი შესაძლებლობები' 
                      : 'Overview of all advanced modules, filters, and diagnostics in the clips platform'}
                  </p>
                </div>
              </div>

              {/* Grid of Capabilities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
                
                {/* 1. Immersive Scrolling Feed */}
                <div className="p-4 rounded-2xl border border-proton-border/10 bg-proton-card/10 hover:bg-proton-card/30 transition-all space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                      <Video size={16} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                      {language === 'ka' ? '📱 ვერტიკალური სქროლვა' : '📱 VERTICAL SCROLL FEED'}
                    </h4>
                  </div>
                  <p className="text-[11px] leading-relaxed text-proton-muted">
                    {language === 'ka' 
                      ? 'ინსტაგრამის მსგავსი სრულეკრანიანი ინტერფეისი ვიდეოების სწრაფი და შეუფერხებელი გადაფურცვლისთვის. კლავიატურის ისრებითა და მაუსის სქროლით მართვა.'
                      : 'Instagram-like immersive vertical feed supporting arrow keys and mouse wheel scrolling for butter-smooth media progression.'}
                  </p>
                </div>

                {/* 2. Real-time Creative Filters */}
                <div className="p-4 rounded-2xl border border-proton-border/10 bg-proton-card/10 hover:bg-proton-card/30 transition-all space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                      <Wand2 size={16} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                      {language === 'ka' ? '🎨 კრეატიული ფილტრები' : '🎨 KINETIC VIDEO FILTERS'}
                    </h4>
                  </div>
                  <p className="text-[11px] leading-relaxed text-proton-muted">
                    {language === 'ka' 
                      ? 'შეცვალეთ ვიდეოების ატმოსფერო რეალურ დროში. აირჩიეთ ფილტრებიდან: Noir, Vintage, Warm, Glitch ან Normal უნიკალური ვიზუალური ეფექტისთვის.'
                      : 'Instantly transform video atmospheres using advanced live rendering filters. Choose between Noir, Vintage, Warm, or Glitch presets.'}
                  </p>
                </div>

                {/* 3. Social Interaction Suite */}
                <div className="p-4 rounded-2xl border border-proton-border/10 bg-proton-card/10 hover:bg-proton-card/30 transition-all space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <MessageSquare size={16} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                      {language === 'ka' ? '💬 ინტერაქტიული კომენტარები' : '💬 SOCIAL SUITE'}
                    </h4>
                  </div>
                  <p className="text-[11px] leading-relaxed text-proton-muted">
                    {language === 'ka' 
                      ? 'დააკომენტარეთ რეალურ დროში, მოიწონეთ კლიპები, დაათვალიერეთ ავტორების პროფილები და კოპირებით გააზიარეთ კლიპის პირდაპირი ბმული.'
                      : 'Comment feeds with real-time sync, dynamic likes, creator profiles, and shareable deep links targeting specific videos.'}
                  </p>
                </div>

                {/* 4. Canvas Diagnostics & Auto-Fix */}
                <div className="p-4 rounded-2xl border border-proton-border/10 bg-proton-card/10 hover:bg-proton-card/30 transition-all space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Sparkles size={16} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                      {language === 'ka' ? '🔬 AI ვიდეო დიაგნოსტიკა' : '🔬 LIVE CANVAS DIAGNOSTICS'}
                    </h4>
                  </div>
                  <p className="text-[11px] leading-relaxed text-proton-muted">
                    {language === 'ka' 
                      ? 'ავტომატური ტექნიკური დიაგნოსტიკა. Canvas-ის მეშვეობით აანალიზებს განათებას, გარჩევადობას, კადრების სიხშირეს (fps) და გთავაზობთ გამოსწორებას (Auto-Fix).'
                      : 'Programmatic assessment of video brightness, frame resolution, and ratios using a hidden canvas to trigger instant Auto-Fix patches.'}
                  </p>
                </div>

                {/* 5. Fast Caching with IndexedDB */}
                <div className="p-4 rounded-2xl border border-proton-border/10 bg-proton-card/10 hover:bg-proton-card/30 transition-all space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Clock size={16} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                      {language === 'ka' ? '⚡ სწრაფი ლოკალური ქეში' : '⚡ OFFLINE BUFFER CACHE'}
                    </h4>
                  </div>
                  <p className="text-[11px] leading-relaxed text-proton-muted">
                    {language === 'ka' 
                      ? 'ავტომატური IndexedDB მონაცემთა ბაზა, რომელიც ინახავს დიდ ვიდეოებს ლოკალურად შეუფერხებელი და დაუყოვნებლივი ჩატვირთვისთვის.'
                      : 'Uses an integrated browser IndexedDB store to cache large video files locally for lightning-fast loading and offline availability.'}
                  </p>
                </div>

                {/* 6. Product-Tagging Integration */}
                <div className="p-4 rounded-2xl border border-proton-border/10 bg-proton-card/10 hover:bg-proton-card/30 transition-all space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                      <ShoppingBag size={16} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                      {language === 'ka' ? '🛍️ პროდუქტების მიბმა' : '🛍️ PRODUCT TAGGING'}
                    </h4>
                  </div>
                  <p className="text-[11px] leading-relaxed text-proton-muted">
                    {language === 'ka' 
                      ? 'მიაბით კლიპებს კონკრეტული ნივთები პროტონ მარკეტიდან. მომხმარებლებს შეუძლიათ შეიძინონ პროდუქტი პირდაპირ ვიდეოს ყურებისას.'
                      : 'Link micro-video reels directly to your physical listings in the marketplace, allowing users to buy products while they watch.'}
                  </p>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-proton-border/20 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowFeaturesModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-proton-card border border-proton-border/40 hover:bg-zinc-800 text-proton-muted hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  {language === 'ka' ? 'დახურვა' : 'Close Overview'}
                </button>
                <button
                  onClick={() => { setShowFeaturesModal(false); setIsCreateOpen(true); }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
                >
                  {language === 'ka' ? 'ატვირთე კლიპი ახლავე' : 'Create a Clip Now'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE NEW REEL MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-2xl bg-proton-bg border border-proton-border/30 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-proton-text"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsCreateOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 border border-white/10 text-proton-muted hover:text-white hover:bg-white/10 transition-all z-10"
              >
                <X size={16} />
              </button>

              {/* Title Header */}
              <div className="flex items-center gap-2.5 pb-4 border-b border-proton-border/10">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Video className="animate-pulse" size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-white">
                    {language === 'ka' ? 'კრეატორთა სტუდია' : 'Creator Studio'}
                  </h3>
                  <p className="text-[10px] text-proton-muted">
                    {language === 'ka' ? 'გამოაქვეყნე მოკლე კლიპი YouTube Shorts-ის მსგავსად' : 'Publish a high-converting loop clip, YouTube-style'}
                  </p>
                </div>
              </div>

              {/* STEP PROGRESS WIZARD INDICATOR */}
              <div className="py-4 px-2 flex items-center justify-between gap-2 border-b border-proton-border/10">
                {[
                  { step: 1, labelKa: 'ვიდეო ფაილი', labelEn: 'Video File' },
                  { step: 2, labelKa: 'აღწერა & ტეგები', labelEn: 'Caption & Tags' },
                  { step: 3, labelKa: 'ხმა & პროდუქტი', labelEn: 'Sound & Shop' }
                ].map((s, index) => {
                  const isActive = uploadStep === s.step;
                  const isCompleted = uploadStep > s.step;
                  return (
                    <React.Fragment key={s.step}>
                      <div className="flex items-center gap-2 flex-1 md:flex-initial">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border transition-all duration-300",
                            isActive 
                              ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/30 scale-110" 
                              : isCompleted
                                ? "bg-emerald-600/30 border-emerald-500 text-emerald-300"
                                : "bg-white/5 border-white/10 text-proton-muted"
                          )}
                        >
                          {isCompleted ? <Check size={12} className="stroke-[3]" /> : s.step}
                        </div>
                        <span 
                          className={cn(
                            "text-[10px] font-extrabold tracking-tight transition-all duration-300 hidden sm:inline",
                            isActive ? "text-purple-400" : isCompleted ? "text-emerald-400" : "text-proton-muted"
                          )}
                        >
                          {language === 'ka' ? s.labelKa : s.labelEn}
                        </span>
                      </div>
                      {index < 2 && (
                        <div className="flex-1 h-[2px] bg-proton-border/20 relative rounded-full">
                          <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-500 rounded-full" 
                            style={{ width: uploadStep > s.step ? "100%" : "0%" }}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* MAIN CONTENT WORKSPACE */}
              <div className="flex-1 overflow-y-auto py-5 pr-1 space-y-6">
                
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
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
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
                                handleLocalFileSelect(e.target.files[0]);
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
                                  setLocalVideoFile(null);
                                  setNewClipVideoUrl('');
                                  setSelectedPresetId('potter-clay');
                                  showToast(
                                    language === 'ka' ? 'ატვირთული ფაილი წაიშალა' : 'Uploaded file removed',
                                    'info'
                                  );
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
                                  setLocalVideoFile(null);
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
                              onClick={() => handleHashtagClick(tag)}
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
              <div className="pt-4 border-t border-proton-border/10 flex items-center justify-between gap-3">
                
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
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-xl bg-proton-bg/80 border border-proton-border/20 text-proton-muted hover:text-white transition-all text-xs font-bold"
                  >
                    {language === 'ka' ? 'გაუქმება' : 'Cancel'}
                  </button>
                )}

                {/* Next / Submit Button */}
                {uploadStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (uploadStep === 1) {
                        const previewUrl = newClipVideoUrl || PRESET_LOOPS.find(p => p.id === selectedPresetId)?.url;
                        if (!previewUrl) {
                          showToast(
                            language === 'ka' ? 'გთხოვთ შეარჩიოთ ვიდეო ფაილი ან ნიმუში' : 'Please select a video template or upload a file first',
                            'warning'
                          );
                          return;
                        }
                      }
                      setUploadStep(prev => prev + 1);
                    }}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-purple-500/10 hover:shadow-lg transition-all"
                  >
                    <span>{language === 'ka' ? 'გაგრძელება' : 'Next'}</span>
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleCreateReel}
                    disabled={isUploading}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black shadow-lg shadow-purple-500/20 hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isUploading ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{language === 'ka' ? 'ქვეყნდება...' : 'Publishing...'}</span>
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

      {/* AI AUTO-FIX OVERLAY DIALOG */}
      <AnimatePresence>
        {showAutoFixDialog && selectedClipForFix && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setShowAutoFixDialog(false)} />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-proton-bg border border-proton-border/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-proton-border/20 flex items-center justify-between bg-gradient-to-r from-purple-950/20 to-indigo-950/20">
                <div className="flex items-center gap-2">
                  <Wand2 className="text-purple-400 animate-pulse" size={18} />
                  <div>
                    <h3 className="font-black text-sm text-white">
                      {language === 'ka' ? 'AI ვიდეო ოპტიმიზატორი' : 'Gemini Auto-Fix Video Co-Pilot'}
                    </h3>
                    <p className="text-[10px] text-proton-muted">
                      {language === 'ka' ? 'კადრებისა და აუდიოს ავტომატური გასწორება' : 'Automatic video, frame & audio corrections'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAutoFixDialog(false)}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-proton-muted hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Scrollable Contents */}
              <div className="p-5 overflow-y-auto max-h-[60vh] space-y-5">
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
                        {selectedClipForFix.thumbnailUrl || dynamicPlaceholderThumbnails[selectedClipForFix.id] ? (
                          <img 
                            referrerPolicy="no-referrer"
                            src={selectedClipForFix.thumbnailUrl || dynamicPlaceholderThumbnails[selectedClipForFix.id]} 
                            className="w-full h-full object-cover" 
                            alt="" 
                          />
                        ) : (
                          <Video size={16} className="text-proton-muted" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[11px] font-bold text-white truncate">
                          {selectedClipForFix.caption}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-proton-muted">
                          <span className="font-mono">
                            {language === 'ka' ? 'ხანგრძლივობა:' : 'Duration:'} {selectedClipForFix.duration ? `${selectedClipForFix.duration.toFixed(1)}s` : 'Unknown'}
                          </span>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-[9px]">
                            {language === 'ka' ? 'ავტორი:' : 'Creator:'} @{selectedClipForFix.creatorName}
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
                            const isApplied = appliedFixes[selectedClipForFix.id]?.includes(issue.id);
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
                                          // Undo fix
                                          const updatedApplied = (appliedFixes[selectedClipForFix.id] || []).filter(id => id !== issue.id);
                                          setAppliedFixes(prev => ({
                                            ...prev,
                                            [selectedClipForFix.id]: updatedApplied
                                          }));
                                          // Restore trim bounds
                                          selectedClipForFix.trimStart = 0;
                                          selectedClipForFix.trimEnd = selectedClipForFix.duration;
                                          showToast(
                                            language === 'ka' 
                                              ? "გასწორება გაუქმდა. კლიპის საწყისი საზღვრები აღდგენილია." 
                                              : "Fix Reverted. Original clip bounds restored.",
                                            "info"
                                          );
                                        } else {
                                          // Apply fix
                                          const updatedApplied = [...(appliedFixes[selectedClipForFix.id] || []), issue.id];
                                          setAppliedFixes(prev => ({
                                            ...prev,
                                            [selectedClipForFix.id]: updatedApplied
                                          }));
                                          // Set actual video trim ranges
                                          if (issue.startSec === 0) {
                                            selectedClipForFix.trimStart = issue.endSec;
                                          } else {
                                            selectedClipForFix.trimEnd = issue.startSec;
                                          }
                                          showToast(
                                            language === 'ka' 
                                              ? "გასწორება წარმატებით შესრულდა. კლიპი ავტომატურად მოიჭრა." 
                                              : "Auto-Fix Applied Successfully. Video has been trimmed.",
                                            "success"
                                          );
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
                                      onClick={() => {
                                        setPreviewingIssueId(isPreviewing ? null : issue.id);
                                      }}
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
                                        clip={selectedClipForFix} 
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
              <div className="p-4 border-t border-proton-border/20 bg-proton-bg/40 backdrop-blur-md flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAutoFixDialog(false)}
                  className="px-5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-black transition-all shadow-md shadow-purple-500/5"
                >
                  {language === 'ka' ? 'დახურვა' : 'Close Panel'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

interface IssuePreviewPlayerProps {
  clip: Clip;
  issue: ClipIssue;
  language: 'en' | 'ka';
}

export function IssuePreviewPlayer({ clip, issue, language }: IssuePreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [previewMode, setPreviewMode] = useState<'trimmed' | 'cut'>('trimmed');
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const duration = clip.duration || 10;

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Adjust starting seek position when mode changes
  useEffect(() => {
    if (videoRef.current) {
      if (previewMode === 'trimmed') {
        if (issue.startSec === 0) {
          videoRef.current.currentTime = issue.endSec;
        } else {
          videoRef.current.currentTime = 0;
        }
      } else {
        videoRef.current.currentTime = issue.startSec;
      }
      setCurrentTime(videoRef.current.currentTime);
    }
  }, [previewMode, issue]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const curr = video.currentTime;
    setCurrentTime(curr);

    if (previewMode === 'trimmed') {
      if (issue.startSec === 0) {
        if (curr < issue.endSec) {
          video.currentTime = issue.endSec;
        }
        if (curr >= duration - 0.1) {
          video.currentTime = issue.endSec;
        }
      } else if (Math.abs(issue.endSec - duration) < 0.5 || issue.endSec >= duration) {
        if (curr >= issue.startSec) {
          video.currentTime = 0;
        }
      } else {
        // mid-video cut
        if (curr >= issue.startSec && curr < issue.endSec) {
          video.currentTime = issue.endSec;
        }
        if (curr >= duration - 0.1) {
          video.currentTime = 0;
        }
      }
    } else {
      // cut portion only
      if (curr < issue.startSec) {
        video.currentTime = issue.startSec;
      }
      if (curr >= issue.endSec) {
        video.currentTime = issue.startSec;
      }
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Calculate timeline percentages for visualization
  const cutStartPercent = (issue.startSec / duration) * 100;
  const cutWidthPercent = ((issue.endSec - issue.startSec) / duration) * 100;
  const playheadPercent = (currentTime / duration) * 100;

  return (
    <div className="mt-3 p-3.5 bg-black/55 border border-purple-500/15 rounded-xl space-y-3 shadow-inner shadow-purple-500/5">
      <div className="flex gap-4">
        {/* Video Player */}
        <div className="relative w-24 aspect-[9/16] bg-black rounded-lg overflow-hidden border border-white/10 flex-shrink-0 group shadow-lg">
          <video
            ref={videoRef}
            src={clip.videoUrl}
            muted
            playsInline
            autoPlay
            className="w-full h-full object-cover cursor-pointer"
            onTimeUpdate={handleTimeUpdate}
            onClick={togglePlay}
          />
          {/* Overlay controls */}
          <div 
            onClick={togglePlay}
            className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
          >
            <div className="p-2 rounded-full bg-black/70 text-white border border-white/10 shadow-lg">
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </div>
          </div>
          <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded bg-black/70 text-[8px] font-mono font-black text-purple-300 border border-purple-500/20">
            {currentTime.toFixed(1)}s
          </div>
        </div>

        {/* Info & Mode Toggles */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-purple-300 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              <span>{language === 'ka' ? 'ვიდეო ჭრის პრევიუ' : 'Video Cut Preview'}</span>
            </div>

            {/* Selector buttons */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewMode('trimmed')}
                className={cn(
                  "py-1 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all text-center",
                  previewMode === 'trimmed'
                    ? "bg-purple-600/25 text-purple-200 border-purple-500/50 shadow-sm"
                    : "bg-white/5 text-proton-muted border-transparent hover:bg-white/10"
                )}
              >
                {language === 'ka' ? 'გასწორებული' : 'Trimmed Result'}
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('cut')}
                className={cn(
                  "py-1 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all text-center",
                  previewMode === 'cut'
                    ? "bg-amber-600/25 text-amber-200 border-amber-500/50 shadow-sm"
                    : "bg-white/5 text-proton-muted border-transparent hover:bg-white/10"
                )}
              >
                {language === 'ka' ? 'ამოსაჭრელი' : 'Cut Portion'}
              </button>
            </div>

            <p className="text-[10px] text-proton-muted leading-relaxed">
              {previewMode === 'trimmed'
                ? (language === 'ka' 
                    ? "ნაჩვენებია ვიდეო, სადაც წაშლილია ხარვეზის შემცველი მონაკვეთი." 
                    : "Simulating corrected video. The player skips the detected defect smoothly.")
                : (language === 'ka' 
                    ? "ნაჩვენებია მხოლოდ ის კონკრეტული მონაკვეთი, რომლის მოჭრაც იგეგმება." 
                    : "Looping only the defect segment to review precisely what is being discarded.")
              }
            </p>
          </div>

          {/* Timeline visualization */}
          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between text-[8px] font-mono font-bold text-proton-muted">
              <span>0.0s</span>
              <span>{duration.toFixed(1)}s</span>
            </div>
            
            {/* ProgressBar */}
            <div className="relative h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
              {/* Highlight cut portion */}
              <div
                className="absolute h-full bg-red-500/40 border-l border-r border-red-500/50"
                style={{
                  left: `${cutStartPercent}%`,
                  width: `${cutWidthPercent}%`,
                }}
              />
              {/* Active preview timeline highlight */}
              {previewMode === 'trimmed' ? (
                <>
                  <div 
                    className="absolute h-full bg-emerald-500/15" 
                    style={{ left: 0, width: `${cutStartPercent}%` }}
                  />
                  <div 
                    className="absolute h-full bg-emerald-500/15" 
                    style={{ left: `${cutStartPercent + cutWidthPercent}%`, right: 0 }}
                  />
                </>
              ) : (
                <div 
                  className="absolute h-full bg-amber-500/15" 
                  style={{ left: `${cutStartPercent}%`, width: `${cutWidthPercent}%` }}
                />
              )}
              {/* Playhead marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md transition-all duration-75"
                style={{ left: `${playheadPercent}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center text-[8px] font-mono">
              <span className="text-proton-muted">
                {language === 'ka' ? 'მიმდინარე:' : 'Current:'} {currentTime.toFixed(1)}s
              </span>
              <span className={cn(
                "font-black uppercase tracking-wider text-[7px] px-1.5 py-0.5 rounded border",
                previewMode === 'trimmed' 
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                  : "text-amber-400 bg-amber-500/10 border-amber-500/20"
              )}>
                {previewMode === 'trimmed' 
                  ? (language === 'ka' ? 'შესწორებული' : 'Trimmed Mode') 
                  : (language === 'ka' ? 'ამოსაჭრელი ხარვეზი' : 'Cut Portion Mode')
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReelProgressBarProps {
  videoElement: HTMLVideoElement | null;
  clip: Clip;
}

export function ReelProgressBar({ videoElement, clip }: ReelProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      const start = clip.trimStart || 0;
      const end = clip.trimEnd || videoElement.duration || 1;
      const total = end - start;
      const current = videoElement.currentTime - start;
      const percent = Math.min(100, Math.max(0, (current / (total || 1)) * 100));
      setProgress(percent);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoElement, clip.trimStart, clip.trimEnd]);

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoElement) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percent = Math.min(1, Math.max(0, clickX / (width || 1)));

    const start = clip.trimStart || 0;
    const end = clip.trimEnd || videoElement.duration || 1;
    const total = end - start;

    videoElement.currentTime = start + percent * total;
  };

  return (
    <div
      onClick={handleScrub}
      className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 hover:h-2 transition-all cursor-pointer z-30 group"
    >
      <div
        className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 group-hover:from-purple-400 group-hover:via-pink-400 group-hover:to-amber-400 transition-all rounded-r"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
