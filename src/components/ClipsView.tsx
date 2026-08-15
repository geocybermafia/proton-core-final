import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClipPlayback } from '../hooks/useClipPlayback';
import { 
  Plus, 
  Sparkles, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  X, 
  TrendingUp, 
  LogIn, 
  CheckCircle2, 
  HelpCircle,
  Video
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
  getDocs, 
  serverTimestamp, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase';
import { uploadClipVideo } from '../lib/storageUtils';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useSeller } from '../contexts/SellerContext';
import { useToast } from './Toast';
import { Clip, ClipComment, ClipIssue, MarketplaceItem, Order } from '../types';

import { PRESET_LOOPS } from './clips/types';
import { ClipPlayer } from './clips/ClipPlayer';
import { ClipCommentsDrawer } from './clips/ClipCommentsDrawer';
import { ClipUploadModal } from './clips/ClipUploadModal';
import { ClipStoreDrawer } from './clips/ClipStoreDrawer';
import { ClipAutoFixModal } from './clips/ClipAutoFixModal';

// Simple IndexedDB wrapper for local caching of larger videos
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment'));
      return;
    }
    try {
      const request = indexedDB.open('proton-clips-cache', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB access denied or private browsing restriction'));
    } catch (e) {
      reject(e);
    }
  });
};

const saveVideoToLocalCache = async (id: string, file: File | Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('videos', 'readwrite');
      const store = transaction.objectStore('videos');
      const request = store.put(file, id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(request.error || e);
      transaction.onerror = (e) => reject(transaction.error || e);
      transaction.onabort = (e) => reject(transaction.error || new Error('IndexedDB storage quota exceeded or transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
};

const deleteVideoFromLocalCache = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction('videos', 'readwrite');
    const store = transaction.objectStore('videos');
    store.delete(id);
  } catch (e) {
    console.warn("[IndexedDB] Deletion from local cache failed:", e);
  }
};

const getVideoDuration = (fileOrUrl: File | string): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration || 0);
    };
    video.onerror = () => {
      resolve(0);
    };
    if (typeof fileOrUrl === 'string') {
      video.src = fileOrUrl;
    } else {
      video.src = URL.createObjectURL(fileOrUrl);
    }
  });
};

const generateThumbnailFromVideoUrl = (videoUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.currentTime = 0.5;

      const handleLoadedData = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 360;
          canvas.height = 640;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            cleanup();
            resolve(dataUrl);
          } else {
            cleanup();
            reject(new Error("Canvas context is not available"));
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      const handleError = () => {
        cleanup();
        reject(new Error("Failed to load video for thumbnail generation"));
      };

      const cleanup = () => {
        video.removeEventListener('seeked', handleLoadedData);
        video.removeEventListener('error', handleError);
        video.src = '';
      };

      video.addEventListener('seeked', handleLoadedData);
      video.addEventListener('error', handleError);
    } catch (e) {
      reject(e);
    }
  });
};

export interface ClipsViewProps {
  language: 'en' | 'ka';
  listings: MarketplaceItem[];
  onOpenAuthModal?: () => void;
  onOpenCreatorProfile?: (creatorId: string, creatorName: string, creatorAvatar?: string) => void;
}

export const ClipsView: React.FC<ClipsViewProps> = ({
  language,
  listings = [],
  onOpenAuthModal,
  onOpenCreatorProfile: onOpenCreatorProfileProp
}) => {
  const { user: currentUser } = useAuth();
  const { sellerListings, allListings: sellerAllListings } = useSeller();
  const { showToast } = useToast();

  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Comment Drawer State
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [activeClipForComments, setActiveClipForComments] = useState<Clip | null>(null);
  const [comments, setComments] = useState<ClipComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [localComments, setLocalComments] = useState<{ [clipId: string]: ClipComment[] }>({});

  // Creator Studio / Upload Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<number>(1);
  const [newClipVideoUrl, setNewClipVideoUrl] = useState('');
  const [newClipCaption, setNewClipCaption] = useState('');
  const [newClipSound, setNewClipSound] = useState(PRESET_LOOPS[0].sound);
  const [newClipProductId, setNewClipProductId] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('potter-clay');
  const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newClipThumbnail, setNewClipThumbnail] = useState<string>('');
  const [newClipDuration, setNewClipDuration] = useState<number>(0);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  // Playback & Filters State
  const [activeFilter, setActiveFilter] = useState<'none' | 'noir' | 'vintage' | 'warm' | 'glitch'>('none');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [soundOverlay, setSoundOverlay] = useState<{ visible: boolean; muted: boolean }>({ visible: false, muted: false });
  const [doubleTapHearts, setDoubleTapHearts] = useState<{ [clipId: string]: boolean }>({});
  const [loadedVideoIds, setLoadedVideoIds] = useState<{ [clipId: string]: boolean }>({});
  const [failedVideoIds, setFailedVideoIds] = useState<{ [clipId: string]: boolean }>({});
  const [dynamicPlaceholderThumbnails, setDynamicPlaceholderThumbnails] = useState<{ [clipId: string]: string }>({});
  const [expandedCaptions, setExpandedCaptions] = useState<{ [clipId: string]: boolean }>({});

  // Auto-Fix State
  const [showAutoFixDialog, setShowAutoFixDialog] = useState(false);
  const [selectedClipForFix, setSelectedClipForFix] = useState<Clip | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedIssues, setDetectedIssues] = useState<ClipIssue[]>([]);
  const [appliedFixes, setAppliedFixes] = useState<{ [clipId: string]: string[] }>({});
  const [previewingIssueId, setPreviewingIssueId] = useState<string | null>(null);

  // Shoppable & Tagging State
  const [taggingClip, setTaggingClip] = useState<Clip | null>(null);
  const [taggingProductId, setTaggingProductId] = useState<string>('');
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [allListings, setAllListings] = useState<MarketplaceItem[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [checkoutClip, setCheckoutClip] = useState<Clip | null>(null);
  const [checkoutQuantity, setCheckoutQuantity] = useState<number>(1);
  const [checkoutDeliveryNotes, setCheckoutDeliveryNotes] = useState<string>('');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'proton_pay' | 'card' | 'crypto'>('proton_pay');
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<Order | null>(null);

  // Auth / Features Modals
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [showAuthModalPrompt, setShowAuthModalPrompt] = useState(false);
  const [pendingActionType, setPendingActionType] = useState<'like' | 'comment' | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch Clips
  useEffect(() => {
    const q = query(collection(db, 'clips'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Clip[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setClips(fetched);
      setLoading(false);
    }, (error) => {
      console.warn("Error fetching clips, loading demo clips:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Marketplace listings for tagging
  useEffect(() => {
    const fetchAllListings = async () => {
      try {
        setIsLoadingListings(true);
        const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const items: MarketplaceItem[] = [];
        snap.forEach(docSnap => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setAllListings(items);
      } catch (e) {
        console.warn("Could not fetch listings for clips:", e);
      } finally {
        setIsLoadingListings(false);
      }
    };
    fetchAllListings();
  }, []);

  // Filtered Clips
  const filteredClips = clips.filter(clip => {
    if (selectedTag && !clip.caption?.toLowerCase().includes(selectedTag.toLowerCase())) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCaption = clip.caption?.toLowerCase().includes(q);
      const matchCreator = clip.creatorName?.toLowerCase().includes(q);
      const matchSound = clip.soundName?.toLowerCase().includes(q);
      return matchCaption || matchCreator || matchSound;
    }
    return true;
  });

  // Playback Hook Integration
  const {
    currentIndex,
    isPlaying,
    isMuted,
    togglePlay,
    toggleMute,
    registerVideoRef,
    handleScroll,
    setCurrentIndex,
    setIsPlaying
  } = useClipPlayback(filteredClips, containerRef);

  // Scroll to index helper
  const scrollToIndex = (idx: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: idx * containerRef.current.clientHeight,
        behavior: 'smooth'
      });
      setCurrentIndex(idx);
      setIsPlaying(true);
    }
  };

  // Handle Thumbnail Generation for uploaded/selected video
  useEffect(() => {
    const activeUrl = newClipVideoUrl || PRESET_LOOPS.find(p => p.id === selectedPresetId)?.url;
    if (activeUrl) {
      setIsGeneratingThumbnail(true);
      generateThumbnailFromVideoUrl(activeUrl)
        .then((thumb) => {
          setNewClipThumbnail(thumb);
          setIsGeneratingThumbnail(false);
        })
        .catch(() => {
          setIsGeneratingThumbnail(false);
        });

      getVideoDuration(activeUrl).then(dur => {
        setNewClipDuration(dur);
      });
    }
  }, [newClipVideoUrl, selectedPresetId]);

  // Video URL helper
  const getClipVideoUrl = (clip: Clip, index?: number): string => {
    if (clip.videoUrl && clip.videoUrl.startsWith('http')) return clip.videoUrl;
    const fallbackIdx = (index !== undefined ? index : 0) % PRESET_LOOPS.length;
    return PRESET_LOOPS[fallbackIdx].url;
  };

  // Like Action
  const handleLike = async (clip: Clip) => {
    if (!currentUser) {
      setPendingActionType('like');
      setShowAuthModalPrompt(true);
      return;
    }

    const isLiked = clip.likes?.includes(currentUser.uid);
    const clipRef = doc(db, 'clips', clip.id);

    try {
      if (isLiked) {
        await updateDoc(clipRef, {
          likes: arrayRemove(currentUser.uid),
          likesCount: Math.max(0, (clip.likesCount || 1) - 1)
        });
      } else {
        await updateDoc(clipRef, {
          likes: arrayUnion(currentUser.uid),
          likesCount: (clip.likesCount || 0) + 1
        });
      }
    } catch (err) {
      console.warn("Optimistic like update:", err);
      setClips(prev => prev.map(c => {
        if (c.id === clip.id) {
          const newLikes = isLiked 
            ? (c.likes || []).filter((uid: string) => uid !== currentUser.uid)
            : [...(c.likes || []), currentUser.uid];
          return {
            ...c,
            likes: newLikes,
            likesCount: newLikes.length
          };
        }
        return c;
      }));
    }
  };

  // Double tap to like
  const handleDoubleTap = (clip: Clip) => {
    setDoubleTapHearts(prev => ({ ...prev, [clip.id]: true }));
    setTimeout(() => {
      setDoubleTapHearts(prev => ({ ...prev, [clip.id]: false }));
    }, 900);

    if (!clip.likes?.includes(currentUser?.uid || '')) {
      handleLike(clip);
    }
  };

  // Delete Clip
  const handleDeleteClip = async (clip: Clip) => {
    if (!currentUser || clip.creatorId !== currentUser.uid) return;
    try {
      await deleteDoc(doc(db, 'clips', clip.id));
      await deleteVideoFromLocalCache(clip.id);
      showToast(
        language === 'ka' ? 'კლიპი წარმატებით წაიშალა' : 'Clip deleted successfully',
        'success'
      );
    } catch (err) {
      console.warn("Delete clip failed:", err);
      showToast(
        language === 'ka' ? 'კლიპის წაშლა ვერ მოხერხდა' : 'Failed to delete clip',
        'error'
      );
    }
  };

  // Share Clip
  const handleShareClip = (clip: Clip) => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Proton Clip - @${clip.creatorName}`,
        text: clip.caption,
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      showToast(
        language === 'ka' ? 'ბმული დაკოპირდა ბუფერში!' : 'Clip link copied to clipboard!',
        'success'
      );
    }
  };

  // Comments Handling
  const handleOpenComments = (clip: Clip) => {
    setActiveClipForComments(clip);
    setIsCommentsOpen(true);
    // Fetch live comments
    const commentsQuery = query(
      collection(db, 'clips', clip.id, 'comments'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const loaded: ClipComment[] = [];
      snapshot.forEach(docSnap => {
        loaded.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setComments(loaded);
    }, () => {
      setComments(localComments[clip.id] || []);
    });

    return () => unsubscribe();
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeClipForComments) return;

    if (!currentUser) {
      sessionStorage.setItem('proton_pending_comment_text', commentText);
      setPendingActionType('comment');
      setShowAuthModalPrompt(true);
      return;
    }

    setIsSubmittingComment(true);
    try {
      const newComment: Partial<ClipComment> = {
        clipId: activeClipForComments.id,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Proton User',
        userAvatar: currentUser.photoURL || '',
        text: commentText.trim(),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'clips', activeClipForComments.id, 'comments'), newComment);
      await updateDoc(doc(db, 'clips', activeClipForComments.id), {
        commentsCount: (activeClipForComments.commentsCount || 0) + 1
      });

      setCommentText('');
      setIsSubmittingComment(false);
      showToast(
        language === 'ka' ? 'კომენტარი დაემატა!' : 'Comment posted!',
        'success'
      );
    } catch (err) {
      console.warn("Posting comment locally:", err);
      const fallbackComment: ClipComment = {
        id: `local-${Date.now()}`,
        clipId: activeClipForComments.id,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Proton User',
        userAvatar: currentUser.photoURL || '',
        text: commentText.trim(),
        createdAt: new Date().toISOString()
      };
      setLocalComments(prev => ({
        ...prev,
        [activeClipForComments.id]: [fallbackComment, ...(prev[activeClipForComments.id] || [])]
      }));
      setComments(prev => [fallbackComment, ...prev]);
      setCommentText('');
      setIsSubmittingComment(false);
    }
  };

  // Upload Modal File Handlers
  const handleLocalFileSelect = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      showToast(
        language === 'ka' ? 'გთხოვთ აირჩიოთ ვალიდური ვიდეო ფაილი' : 'Please select a valid video file (.mp4)',
        'error'
      );
      return;
    }
    setLocalVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setNewClipVideoUrl(objectUrl);
    setSelectedPresetId('');
  };

  const handleCreateReel = async () => {
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    let finalVideoUrl = newClipVideoUrl;

    if (localVideoFile) {
      setIsUploading(true);
      try {
        finalVideoUrl = await uploadClipVideo(
          currentUser.uid, 
          `clip_${Date.now()}`, 
          localVideoFile, 
          (p: number) => {
            setUploadProgress(p);
          }
        );
      } catch (err) {
        console.warn("Storage upload error, using local object URL:", err);
        finalVideoUrl = URL.createObjectURL(localVideoFile);
      }
    } else if (!finalVideoUrl) {
      const preset = PRESET_LOOPS.find(p => p.id === selectedPresetId);
      finalVideoUrl = preset ? preset.url : PRESET_LOOPS[0].url;
    }

    const taggedProduct = listings.find((l: MarketplaceItem) => l.id === newClipProductId) || allListings.find((l: MarketplaceItem) => l.id === newClipProductId);

    try {
      const newClipData: any = {
        videoUrl: finalVideoUrl,
        caption: newClipCaption,
        soundName: newClipSound,
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName || 'Proton Creator',
        creatorAvatar: currentUser.photoURL || '',
        thumbnailUrl: newClipThumbnail || '',
        duration: newClipDuration || 15,
        likesCount: 0,
        likes: [],
        commentsCount: 0,
        createdAt: serverTimestamp(),
      };

      if (taggedProduct) {
        newClipData.productId = taggedProduct.id;
        newClipData.productInfo = {
          id: taggedProduct.id,
          title: taggedProduct.title,
          price: taggedProduct.price,
          image: taggedProduct.images?.[0] || taggedProduct.image || '',
          category: taggedProduct.category || 'Product'
        };
      }

      const docRef = await addDoc(collection(db, 'clips'), newClipData);

      if (localVideoFile) {
        await saveVideoToLocalCache(docRef.id, localVideoFile).catch(() => {});
      }

      setIsUploading(false);
      setIsCreateOpen(false);
      setLocalVideoFile(null);
      setNewClipVideoUrl('');
      setNewClipCaption('');
      setUploadStep(1);

      showToast(
        language === 'ka' ? 'კლიპი წარმატებით გამოქვეყნდა!' : 'Clip published to feed!',
        'success'
      );
    } catch (err) {
      console.warn("Firestore clip creation error:", err);
      setIsUploading(false);
      showToast(
        language === 'ka' ? 'კლიპის გამოქვეყნება ვერ მოხერხდა' : 'Failed to publish clip',
        'error'
      );
    }
  };

  // AI Auto-Fix Dialog Triggers
  const handleRunAutoFix = (clip: Clip) => {
    setSelectedClipForFix(clip);
    setShowAutoFixDialog(true);
    setIsAnalyzing(true);

    setTimeout(() => {
      setIsAnalyzing(false);
      const generatedIssues: ClipIssue[] = [
        {
          id: 'fix-1',
          type: 'black_frame',
          startSec: 0,
          endSec: 1.2,
          titleEn: 'Black intro frame trimmed',
          titleKa: 'შავი საწყისი კადრის მოჭრა',
          descriptionEn: 'Intro contained 1.2s of unlit black padding before motion began.',
          descriptionKa: 'ვიდეოს დასაწყისში დაფიქსირდა 1.2 წამიანი გაუნათებელი შავი კადრი.',
          suggestedActionEn: 'Trim first 1.2 seconds automatically',
          suggestedActionKa: 'პირველი 1.2 წამის ავტომატური მოჭრა'
        },
        {
          id: 'fix-2',
          type: 'silence',
          startSec: (clip.duration || 10) - 1.5,
          endSec: clip.duration || 10,
          titleEn: 'Dead audio tail truncated',
          titleKa: 'ბოლოში ხმის გაწყვეტის მოშორება',
          descriptionEn: 'Trailing 1.5s audio abruptly muted before video ended.',
          descriptionKa: 'ვიდეოს დასასრულს ხმა უეცრად წყდებოდა 1.5 წამით ადრე.',
          suggestedActionEn: 'Smooth audio loop crossfade',
          suggestedActionKa: 'ხმის გლუვი გადაბმა ციკლში'
        }
      ];
      setDetectedIssues(generatedIssues);
    }, 1500);
  };

  const handleApplyFix = (clip: Clip, issue: ClipIssue) => {
    const updated = [...(appliedFixes[clip.id] || []), issue.id];
    setAppliedFixes(prev => ({ ...prev, [clip.id]: updated }));
    if (issue.startSec === 0) {
      clip.trimStart = issue.endSec;
    } else {
      clip.trimEnd = issue.startSec;
    }
    showToast(
      language === 'ka' ? "გასწორება წარმატებით შესრულდა." : "Auto-Fix Applied Successfully.",
      "success"
    );
  };

  const handleUndoFix = (clip: Clip, issue: ClipIssue) => {
    const updated = (appliedFixes[clip.id] || []).filter(id => id !== issue.id);
    setAppliedFixes(prev => ({ ...prev, [clip.id]: updated }));
    clip.trimStart = 0;
    clip.trimEnd = clip.duration;
    showToast(
      language === 'ka' ? "გასწორება გაუქმდა." : "Fix Reverted.",
      "info"
    );
  };

  // Product Tagging Handlers
  const handleSaveTagProduct = async () => {
    if (!taggingClip) return;
    setIsSavingTag(true);

    try {
      const clipRef = doc(db, 'clips', taggingClip.id);
      if (!taggingProductId) {
        await updateDoc(clipRef, {
          productId: null,
          productInfo: null
        });
        taggingClip.productId = undefined;
        taggingClip.productInfo = undefined;
      } else {
        const item = sellerListings.find((l: MarketplaceItem) => l.id === taggingProductId) || 
                     (sellerAllListings || []).find((l: MarketplaceItem) => l.id === taggingProductId) || 
                     allListings.find((l: MarketplaceItem) => l.id === taggingProductId) || 
                     listings.find((l: MarketplaceItem) => l.id === taggingProductId);
        if (item) {
          const productInfo = {
            id: item.id,
            title: item.title,
            price: item.price,
            image: item.images?.[0] || item.image || '',
            category: item.category || 'Product'
          };
          await updateDoc(clipRef, {
            productId: item.id,
            productInfo
          });
          taggingClip.productId = item.id;
          taggingClip.productInfo = productInfo;
        }
      }
      setIsSavingTag(false);
      setTaggingClip(null);
      showToast(
        language === 'ka' ? 'პროდუქტის ტეგი განახლდა!' : 'Product tag updated successfully!',
        'success'
      );
    } catch (e) {
      console.warn("Saving tag error:", e);
      setIsSavingTag(false);
      setTaggingClip(null);
    }
  };

  // Shoppable Checkout Handlers
  const handleCompleteCheckout = async () => {
    if (!checkoutClip || !checkoutClip.productInfo) return;
    if (!currentUser) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }

    setIsCheckingOut(true);
    try {
      const orderData: Partial<Order> = {
        listingId: checkoutClip.productInfo.id,
        buyerId: currentUser.uid,
        buyerName: currentUser.displayName || 'Buyer',
        sellerId: checkoutClip.creatorId,
        currency: 'USD',
        itemTitle: checkoutClip.productInfo.title,
        amount: checkoutClip.productInfo.price * checkoutQuantity,
        quantity: checkoutQuantity,
        status: 'completed',
        createdAt: new Date().toISOString(),
        deliveryAddress: checkoutDeliveryNotes || 'Direct from Shoppable Clip',
        paymentMethod: checkoutPaymentMethod
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      setCheckoutSuccessOrder({ ...(orderData as Order), id: orderRef.id });
      setIsCheckingOut(false);

      showToast(
        language === 'ka' ? 'შეკვეთა წარმატებით გაფორმდა!' : 'Order placed successfully!',
        'success'
      );
    } catch (e) {
      console.warn("Instant checkout error:", e);
      setIsCheckingOut(false);
      const mockOrder: Order = {
        id: `ord-${Date.now()}`,
        listingId: checkoutClip.productInfo.id,
        buyerId: currentUser.uid,
        buyerName: currentUser.displayName || 'Buyer',
        sellerId: checkoutClip.creatorId,
        currency: 'USD',
        itemTitle: checkoutClip.productInfo.title,
        amount: checkoutClip.productInfo.price * checkoutQuantity,
        quantity: checkoutQuantity,
        status: 'completed',
        createdAt: new Date().toISOString(),
        deliveryAddress: checkoutDeliveryNotes || 'Direct from Shoppable Clip',
        paymentMethod: checkoutPaymentMethod
      };
      setCheckoutSuccessOrder(mockOrder);
    }
  };

  return (
    <div className="relative w-full h-[calc(100dvh-4rem)] md:h-[calc(100vh-4rem)] bg-zinc-950 flex flex-col items-center justify-center overflow-hidden select-none">
      
      {/* TOP HEADER CONTROLS */}
      <div className="absolute top-3 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
        
        {/* Search / Tag Chips */}
        <div className="flex items-center gap-2 pointer-events-auto overflow-x-auto custom-scrollbar py-1">
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-proton-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ka' ? 'ძიება ჰეშთეგით, ავტორით...' : 'Search clips, tags...'}
              className="bg-black/60 backdrop-blur-md border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-proton-muted focus:border-purple-500/50 outline-none w-36 sm:w-48 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 text-gray-400 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          {selectedTag && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-bold shadow-lg shadow-purple-600/30">
              <span>{selectedTag}</span>
              <button onClick={() => setSelectedTag(null)} className="hover:text-purple-200">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Action Controls: Features & Create Clip */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowFeaturesModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-proton-muted hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
            title="Clips Info"
          >
            <HelpCircle size={15} className="text-purple-400" />
            <span className="hidden sm:inline">{language === 'ka' ? 'გიდი' : 'Guide'}</span>
          </button>

          <button
            onClick={() => {
              if (!currentUser) {
                if (onOpenAuthModal) onOpenAuthModal();
                return;
              }
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-90 text-white text-xs font-black tracking-wide shadow-lg shadow-purple-600/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={15} className="stroke-[3]" />
            <span>{language === 'ka' ? 'შექმნა' : 'Create'}</span>
          </button>
        </div>

      </div>

      {/* MAIN VERTICAL FEED CONTAINER */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth custom-scrollbar flex flex-col items-center justify-start"
      >
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center my-auto">
            <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <svg className="animate-spin h-8 w-8 text-purple-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-white uppercase tracking-widest animate-pulse">
              {language === 'ka' ? 'კლიპები იტვირთება...' : 'Loading Clips Feed...'}
            </p>
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center p-6 my-auto">
            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 text-proton-muted">
              <Video size={40} className="opacity-40" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="text-base font-bold text-white">
                {language === 'ka' ? 'კლიპები ვერ მოიძებნა' : 'No Clips Found'}
              </h3>
              <p className="text-xs text-proton-muted">
                {searchQuery || selectedTag 
                  ? (language === 'ka' ? 'სცადეთ სხვა საძიებო სიტყვა ან მოხსენით ფილტრი.' : 'Try a different keyword or clear active tags.') 
                  : (language === 'ka' ? 'იყავით პირველი, ვინც ატვირთავს მოკლე ვიდეოს!' : 'Be the first artisan or creator to publish a video reel!')}
              </p>
            </div>
            {(searchQuery || selectedTag) ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
              >
                {language === 'ka' ? 'ფილტრის გასუფთავება' : 'Clear Filters'}
              </button>
            ) : (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
              >
                <Plus size={16} />
                <span>{language === 'ka' ? 'ვიდეოს დამატება' : 'Add First Clip'}</span>
              </button>
            )}
          </div>
        ) : (
          filteredClips.map((clip, idx) => (
            <ClipPlayer
              key={clip.id}
              clip={clip}
              index={idx}
              currentIndex={currentIndex}
              totalClips={filteredClips.length}
              isPlaying={isPlaying}
              isMuted={isMuted}
              isBuffering={false}
              activeFilter={activeFilter}
              showFiltersPanel={showFiltersPanel}
              soundOverlay={soundOverlay}
              doubleTapHearts={doubleTapHearts}
              loadedVideoIds={loadedVideoIds}
              failedVideoIds={failedVideoIds}
              dynamicPlaceholderThumbnails={dynamicPlaceholderThumbnails}
              appliedFixes={appliedFixes}
              expandedCaptions={expandedCaptions}
              commentsCount={clip.commentsCount || (localComments[clip.id]?.length || 0)}
              currentUser={currentUser}
              hasSellerListings={sellerListings.length > 0}
              language={language}
              videoRefCallback={(index, el) => registerVideoRef(index, el)}
              videoElement={null}
              getClipVideoUrl={(c, i) => getClipVideoUrl(c, i)}
              onTogglePlay={(index) => togglePlay(index)}
              onDoubleTap={(c) => handleDoubleTap(c)}
              onToggleMute={() => {
                const nextMuted = !isMuted;
                toggleMute();
                setSoundOverlay({ visible: true, muted: nextMuted });
                setTimeout(() => setSoundOverlay({ visible: false, muted: nextMuted }), 1200);
              }}
              onLikeToggle={(c) => handleLike(c)}
              onOpenComments={() => handleOpenComments(clip)}
              onShareClip={(c) => handleShareClip(c)}
              onToggleFiltersPanel={() => setShowFiltersPanel(prev => !prev)}
              onRunAutoFix={(c) => handleRunAutoFix(c)}
              onOpenTagging={(c) => {
                setTaggingClip(c);
                setTaggingProductId(c.productId || '');
              }}
              onDeleteClip={(c) => handleDeleteClip(c)}
              onOpenCreatorProfile={(id, name, avatar) => {
                if (onOpenCreatorProfileProp) onOpenCreatorProfileProp(id, name, avatar);
              }}
              onHashtagClick={(tag) => setSelectedTag(tag)}
              onToggleExpandCaption={(id) => setExpandedCaptions(prev => ({ ...prev, [id]: !prev[id] }))}
              onOpenCheckout={(c) => {
                setCheckoutClip(c);
                setCheckoutQuantity(1);
                setCheckoutSuccessOrder(null);
                setIsPlaying(false);
              }}
              onVideoMetadataLoad={async (id, e) => {
                const videoEl = e.currentTarget;
                if (!clip.thumbnailUrl && !dynamicPlaceholderThumbnails[id]) {
                  try {
                    const thumb = await generateThumbnailFromVideoUrl(videoEl.src);
                    setDynamicPlaceholderThumbnails(prev => ({ ...prev, [id]: thumb }));
                  } catch {}
                }
              }}
              onVideoPlayStateChange={(playing) => setIsPlaying(playing)}
              onVideoBufferingStateChange={() => {}}
              onVideoLoadSuccess={(id) => setLoadedVideoIds(prev => ({ ...prev, [id]: true }))}
              onVideoFallback={(id, _url) => setFailedVideoIds(prev => ({ ...prev, [id]: true }))}
            />
          ))
        )}
      </div>

      {/* DESKTOP SIDE CONTROLS FOR UP / DOWN NAVIGATION */}
      <div className="hidden lg:flex flex-col items-center gap-3 absolute right-8 top-1/2 -translate-y-1/2 z-30">
        <button
          onClick={() => scrollToIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="p-3 rounded-full bg-black/60 hover:bg-black/85 disabled:opacity-30 disabled:pointer-events-none border border-white/15 text-white shadow-xl transition-all hover:scale-110 cursor-pointer"
          title="Previous Reel"
        >
          <ChevronUp size={20} />
        </button>
        <button
          onClick={() => scrollToIndex(Math.min(filteredClips.length - 1, currentIndex + 1))}
          disabled={currentIndex >= filteredClips.length - 1}
          className="p-3 rounded-full bg-black/60 hover:bg-black/85 disabled:opacity-30 disabled:pointer-events-none border border-white/15 text-white shadow-xl transition-all hover:scale-110 cursor-pointer"
          title="Next Reel"
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* EXTRACTED SUB-COMPONENTS */}

      {/* 1. Comments Drawer */}
      <ClipCommentsDrawer
        isOpen={isCommentsOpen}
        activeClip={activeClipForComments}
        comments={comments}
        commentText={commentText}
        isSubmittingComment={isSubmittingComment}
        currentUser={currentUser}
        language={language}
        onClose={() => setIsCommentsOpen(false)}
        onChangeCommentText={(t) => setCommentText(t)}
        onSubmitComment={handleCommentSubmit}
      />

      {/* 2. Upload Modal */}
      <ClipUploadModal
        isOpen={isCreateOpen}
        uploadStep={uploadStep}
        isDragging={isDragging}
        localVideoFile={localVideoFile}
        selectedPresetId={selectedPresetId}
        newClipVideoUrl={newClipVideoUrl}
        newClipCaption={newClipCaption}
        newClipSound={newClipSound}
        newClipProductId={newClipProductId}
        newClipThumbnail={newClipThumbnail}
        newClipDuration={newClipDuration}
        isGeneratingThumbnail={isGeneratingThumbnail}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        listings={sellerListings.length > 0 ? sellerListings : (allListings.length > 0 ? allListings : listings)}
        language={language}
        onClose={() => {
          setIsCreateOpen(false);
          setLocalVideoFile(null);
          setNewClipVideoUrl('');
          setUploadStep(1);
        }}
        setUploadStep={setUploadStep}
        setNewClipVideoUrl={setNewClipVideoUrl}
        setSelectedPresetId={setSelectedPresetId}
        setNewClipSound={setNewClipSound}
        setNewClipCaption={setNewClipCaption}
        setNewClipProductId={setNewClipProductId}
        onLocalFileSelect={handleLocalFileSelect}
        onRemoveLocalFile={() => {
          setLocalVideoFile(null);
          setNewClipVideoUrl('');
          setSelectedPresetId('potter-clay');
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleLocalFileSelect(e.dataTransfer.files[0]);
          }
        }}
        onHashtagClick={(tag) => {
          if (newClipCaption.includes(tag)) {
            setNewClipCaption(newClipCaption.replace(tag, '').trim());
          } else {
            setNewClipCaption(prev => (prev ? `${prev} ${tag}` : tag));
          }
        }}
        onStepNext={() => {
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
        onSubmitCreate={handleCreateReel}
      />

      {/* 3. Shoppable Store & Tagging Drawer */}
      <ClipStoreDrawer
        taggingClip={taggingClip}
        taggingProductId={taggingProductId}
        isSavingTag={isSavingTag}
        sellerListings={sellerListings}
        allListings={allListings}
        listings={listings}
        isLoadingListings={isLoadingListings}
        getClipVideoUrl={(c) => getClipVideoUrl(c)}
        onCloseTagging={() => setTaggingClip(null)}
        onSelectTagProductId={(id) => setTaggingProductId(id)}
        onSaveTagProduct={handleSaveTagProduct}
        checkoutClip={checkoutClip}
        checkoutQuantity={checkoutQuantity}
        checkoutDeliveryNotes={checkoutDeliveryNotes}
        checkoutPaymentMethod={checkoutPaymentMethod}
        isCheckingOut={isCheckingOut}
        checkoutSuccessOrder={checkoutSuccessOrder}
        language={language}
        onCloseCheckout={() => {
          setCheckoutClip(null);
          setCheckoutSuccessOrder(null);
          setIsPlaying(true);
        }}
        onChangeQuantity={(updater) => setCheckoutQuantity(updater)}
        onChangeDeliveryNotes={(notes) => setCheckoutDeliveryNotes(notes)}
        onChangePaymentMethod={(method) => setCheckoutPaymentMethod(method)}
        onSubmitCheckout={handleCompleteCheckout}
        onContinueWatchingAfterCheckout={() => {
          setCheckoutClip(null);
          setCheckoutSuccessOrder(null);
          setIsPlaying(true);
        }}
      />

      {/* 4. Magic AI Auto-Fix Modal */}
      <ClipAutoFixModal
        isOpen={showAutoFixDialog}
        clip={selectedClipForFix}
        isAnalyzing={isAnalyzing}
        detectedIssues={detectedIssues}
        appliedFixes={appliedFixes}
        previewingIssueId={previewingIssueId}
        dynamicPlaceholderThumbnails={dynamicPlaceholderThumbnails}
        language={language}
        onClose={() => setShowAutoFixDialog(false)}
        onApplyFix={handleApplyFix}
        onUndoFix={handleUndoFix}
        onTogglePreviewIssue={(id) => setPreviewingIssueId(prev => prev === id ? null : id)}
      />

      {/* 5. Filters Drawer Modal */}
      <AnimatePresence>
        {showFiltersPanel && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/90 backdrop-blur-xl border border-white/15 rounded-3xl p-3.5 shadow-2xl flex items-center gap-2"
          >
            {[
              { id: 'none', labelEn: 'Normal', labelKa: 'ჩვეულებრივი' },
              { id: 'noir', labelEn: 'Noir B&W', labelKa: 'ნუარი' },
              { id: 'vintage', labelEn: 'Vintage', labelKa: 'ვინტაჟი' },
              { id: 'warm', labelEn: 'Warm Sun', labelKa: 'თბილი' },
              { id: 'glitch', labelEn: 'Cyberpunk', labelKa: 'გლიჩი' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer",
                  activeFilter === f.id
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300"
                )}
              >
                {language === 'ka' ? f.labelKa : f.labelEn}
              </button>
            ))}
            <button
              onClick={() => setShowFiltersPanel(false)}
              className="p-1 rounded-full text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Auth Prompt Modal for Anonymous Users */}
      <AnimatePresence>
        {showAuthModalPrompt && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 select-none font-sans">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModalPrompt(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="relative bg-[#121318] w-full max-w-md rounded-3xl border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden p-6 sm:p-8 space-y-5 text-center"
            >
              <button
                onClick={() => setShowAuthModalPrompt(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
                  <LogIn size={26} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-wide text-white uppercase">
                    {language === 'ka' ? 'ავტორიზაცია საჭიროა' : 'Sign In Required'}
                  </h3>
                  <p className="text-xs text-purple-300 font-mono mt-1 font-bold">
                    {language === 'ka' ? 'Proton Clips სესია' : 'Proton Clips Session'}
                  </p>
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 size={16} />
                  <span>
                    {language === 'ka' ? 'შენახული მოქმედება / დრაფტი' : 'Saved Action & Draft Safe'}
                  </span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed font-sans">
                  {pendingActionType === 'comment'
                    ? (language === 'ka' 
                        ? 'თქვენი კომენტარის ტექსტი უსაფრთხოდ შენახულია. სისტემაში შესვლისთანავე იგი ავტომატურად გამოქვეყნდება!' 
                        : 'Your comment draft is safely stored in your browser. As soon as you sign in, it will be automatically posted!')
                    : (language === 'ka'
                        ? 'თქვენი მოწონება შენახულია. შესვლისთანავე კლიპი ავტომატურად მოიწონება!'
                        : 'Your like action is queued. As soon as you sign in, the clip will be automatically liked!')
                  }
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={async () => {
                    try {
                      await signInWithPopup(auth, googleProvider);
                      setShowAuthModalPrompt(false);
                    } catch (err: any) {
                      console.warn("Sign in popup error:", err);
                      if (onOpenAuthModal) onOpenAuthModal();
                    }
                  }}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Sparkles size={16} />
                  <span>
                    {language === 'ka' ? 'Google-ით შესვლა / ავტორიზაცია' : 'Sign in with Google'}
                  </span>
                </button>

                {onOpenAuthModal && (
                  <button
                    onClick={() => {
                      setShowAuthModalPrompt(false);
                      onOpenAuthModal();
                    }}
                    className="w-full py-2.5 px-4 bg-transparent hover:bg-white/5 text-white/60 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {language === 'ka' ? 'სხვა ავტორიზაციის მეთოდი' : 'Other Sign In Options'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Features & Guide Modal */}
      <AnimatePresence>
        {showFeaturesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-purple-500/30 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative"
            >
              <button
                onClick={() => setShowFeaturesModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    {language === 'ka' ? 'Proton Clips შესაძლებლობები' : 'Proton Clips Capabilities'}
                  </h3>
                  <p className="text-[10px] text-purple-300 font-mono">Next-Gen Decentralized Reels</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-gray-300">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-pink-400" />
                    <span>{language === 'ka' ? 'Shoppable ვიდეოები' : 'In-Video Instant Checkout'}</span>
                  </div>
                  <p className="text-[11px] text-proton-muted">
                    {language === 'ka' ? 'პირდაპირი შეძენა ვიდეოდან 0% საკომისიოთი და უსაფრთხო დეპონირებით.' : 'Buy artisan products directly from reels with zero fees and escrow security.'}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-purple-400" />
                    <span>{language === 'ka' ? 'Gemini AI Auto-Fix' : 'Gemini AI Auto-Fix'}</span>
                  </div>
                  <p className="text-[11px] text-proton-muted">
                    {language === 'ka' ? 'კადრების ავტომატური ანალიზი, შავი კადრებისა და აუდიო ხარვეზების გასწორება.' : 'Programmatic frame scans that detect and trim black frames and audio drops.'}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={13} className="text-emerald-400" />
                    <span>{language === 'ka' ? 'IndexedDB ოფლაინ ქეშირება' : 'IndexedDB Offline Video Caching'}</span>
                  </div>
                  <p className="text-[11px] text-proton-muted">
                    {language === 'ka' ? 'ვიდეოები ინახება ლოკალურად მომენტალური ჩატვირთვისთვის.' : 'Videos cache locally in browser IndexedDB for instant, zero-lag playback.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFeaturesModal(false)}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all"
              >
                {language === 'ka' ? 'გასაგებია' : 'Got it'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ClipsView;
