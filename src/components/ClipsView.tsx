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
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  Check,
  TrendingUp,
  AlertCircle,
  Video,
  Eye,
  CheckCircle2,
  Bookmark
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

interface ClipsViewProps {
  language: 'en' | 'ka';
  setActiveView: (view: any) => void;
  user: any;
}

interface Clip {
  id: string;
  videoUrl: string;
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
    url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-potter-shaping-clay-on-a-wheel-41716-large.mp4',
    sound: 'Traditional Potter - Ambient Echoes'
  },
  {
    id: 'knitting-wool',
    nameGe: 'მატყლის ქსოვა',
    nameEn: 'Wool Knitting close-up',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-knitting-wool-with-needles-41584-large.mp4',
    sound: 'Warm Fireplace Acoustics'
  },
  {
    id: 'misty-mountains',
    nameGe: 'ყაზბეგის ნისლიანი მთები',
    nameEn: 'Kazbegi Misty Mountains',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-beautiful-aerial-view-of-misty-mountains-and-forests-42404-large.mp4',
    sound: 'Caucasus Mountain Breeze'
  },
  {
    id: 'spring-gardens',
    nameGe: 'გაზაფხულის ეზო',
    nameEn: 'Spring Blossom Garden',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-4048-large.mp4',
    sound: 'Nino - Spring Harmony'
  },
  {
    id: 'neon-city',
    nameGe: 'ღამის თბილისის ნეონები',
    nameEn: 'Night Tbilisi Lights',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-night-city-street-with-neon-lights-and-traffic-42283-large.mp4',
    sound: 'Tbilisi Cyberpunk Synthwave'
  },
  {
    id: 'laser-abstract',
    nameGe: 'აბსტრაქტული ლაზერები',
    nameEn: 'Cosmic Laser Visualizer',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-loop-41853-large.mp4',
    sound: 'Synth Beats - Proton Matrix'
  }
];

const SEED_CLIPS = [
  {
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-potter-shaping-clay-on-a-wheel-41716-large.mp4',
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
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-knitting-wool-with-needles-41584-large.mp4',
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
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-beautiful-aerial-view-of-misty-mountains-and-forests-42404-large.mp4',
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
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-4048-large.mp4',
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

export default function ClipsView({ language, setActiveView, user }: ClipsViewProps) {
  const { showToast } = useToast();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'forYou' | 'myClips' | 'productReels'>('forYou');
  const [searchQuery, setSearchQuery] = useState('');
  
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

  // Set upload step back to 1 when modal opens
  useEffect(() => {
    if (isCreateOpen) {
      setUploadStep(1);
    }
  }, [isCreateOpen]);
  
  // Marketplace Listings list for Tagging
  const [listings, setListings] = useState<any[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter clips based on selected tab and search
  const filteredClips = clips.filter(clip => {
    // 1. Tab filters
    if (activeTab === 'myClips' && clip.creatorId !== user?.uid) return false;
    if (activeTab === 'productReels' && !clip.productId) return false;

    // 2. Search filters
    if (searchQuery.trim() === '') return true;
    const searchLower = searchQuery.toLowerCase();
    const hasTag = clip.caption.toLowerCase().includes(searchLower);
    const hasCreator = clip.creatorName.toLowerCase().includes(searchLower);
    return hasTag || hasCreator;
  });

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
  } = useClipPlayback(filteredClips.length, containerRef);

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
        // If Firestore contains no clips, we use the default seed clips locally.
        // This is safe, performant, and avoids permission errors.
        setClips(LOCAL_SEED_CLIPS);
        setLoading(false);
        return;
      }

      const rawClips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Clip));
      
      // Merge with LOCAL_SEED_CLIPS so there are always initial high-quality reels,
      // but filter out any duplicates.
      const existingIds = new Set(rawClips.map(c => c.id));
      const filteredSeed = LOCAL_SEED_CLIPS.filter(c => !existingIds.has(c.id));
      const combinedClips = [...rawClips, ...filteredSeed];

      // Resolve tagged product info locally for richer experience
      const populatedClips = await Promise.all(combinedClips.map(async (clip) => {
        if (clip.productId) {
          try {
            const productDoc = await getDoc(doc(db, 'listings', clip.productId));
            if (productDoc.exists()) {
              return { ...clip, productInfo: productDoc.data() };
            }
          } catch (e) {
            console.error("Error resolving listing:", e);
          }
        }
        return clip;
      }));

      setClips(populatedClips);
      setLoading(false);
    }, (error) => {
      console.warn("Clips Firestore access issue, falling back to local seed data:", error);
      // Fallback to local high-quality seed clips
      setClips(LOCAL_SEED_CLIPS);
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

    // If there's a local video file, attempt to convert it to base64 if small enough.
    if (localVideoFile) {
      if (localVideoFile.size > 800 * 1024) { // 800 KB limit for safe Base64 Firestore storage
        showToast(
          language === 'ka' 
            ? 'ვიდეო ფაილი დიდია (>800KB). ოპტიმალური სიჩქარისთვის ის შეინახება თქვენს ბრაუზერში!' 
            : 'Video file is large (>800KB). Saved to local browser cache for peak speed!',
          'info'
        );
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

    const docId = `clip-${Math.random().toString(36).substring(2, 11)}`;
    const clipData = {
      id: docId,
      videoUrl: finalVideoUrl,
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
    <div id="proton-clips-view" className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] text-proton-text select-none">
      
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
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs tracking-wide shadow-md shadow-purple-500/10 hover:shadow-lg transition-all"
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
          
          /* VERTICAL TIKTOK GRID FEEDS */
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
                  className="w-full max-w-[450px] h-full flex-shrink-0 snap-start snap-always relative overflow-hidden bg-black/90 flex flex-col justify-between"
                >
                  
                  {/* VIDEO PLAYER ELEMENT */}
                  <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
                    <video
                      ref={el => registerVideoRef(idx, el)}
                      src={clip.videoUrl}
                      loop
                      playsInline
                      muted={isMuted}
                      className={cn(
                        "w-full h-full object-cover transition-all duration-300",
                        activeFilter === 'noir' && "grayscale contrast-[1.25] brightness-95",
                        activeFilter === 'vintage' && "sepia brightness-[0.88] contrast-[1.05] saturate-[1.3]",
                        activeFilter === 'warm' && "saturate-[1.55] contrast-[1.05] brightness-[0.95] sepia-[0.12]",
                        activeFilter === 'glitch' && "animate-proton-glitch brightness-[1.05] contrast-[1.2] saturate-[1.5]"
                      )}
                      onClick={() => togglePlay(idx)}
                    />
                    
                    {/* Real-time CRT scanlines overlay when Glitch effect is selected */}
                    {activeFilter === 'glitch' && (
                      <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,_rgba(0,0,0,0.25)_50%),_linear-gradient(90deg,_rgba(255,0,0,0.06),_rgba(0,255,0,0.02),_rgba(0,0,255,0.06))] bg-[size:100%_4px,_3px_100%] opacity-75 mix-blend-overlay animate-pulse" />
                    )}
                    
                    {/* Pause icon overlay */}
                    <AnimatePresence>
                      {!isPlaying && (
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
                  </div>

                  {/* TOP OVERLAYS (VOLUME & SEARCH TAGS ACCENT) */}
                  <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                    <div className="px-2 py-1 rounded-md bg-black/40 text-[10px] font-mono text-proton-muted uppercase tracking-widest border border-white/10">
                      Clips {idx + 1} / {filteredClips.length}
                    </div>
                    
                    {/* Volume toggle buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="p-2.5 rounded-full bg-black/40 border border-white/10 text-white hover:bg-black/60 transition-all pointer-events-auto"
                    >
                      {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                  </div>

                  {/* RIGHT SIDEBAR ACTIONS */}
                  <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-5">
                    
                    {/* Creator avatar bubble */}
                    <div className="relative group pointer-events-auto">
                      <button
                        onClick={() => handleOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}
                        className="w-11 h-11 rounded-full border-2 border-purple-500 overflow-hidden bg-proton-bg hover:scale-105 transition-all shadow-md flex items-center justify-center text-white"
                      >
                        {clip.creatorAvatar ? (
                          <img referrerPolicy="no-referrer" src={clip.creatorAvatar} alt={clip.creatorName} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={18} />
                        )}
                      </button>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-purple-500 text-white rounded-full p-0.5 hover:scale-115 transition-all">
                        <Plus size={10} className="stroke-[3]" />
                      </div>
                    </div>

                    {/* Like button */}
                    <div className="flex flex-col items-center gap-1 pointer-events-auto">
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => handleLikeToggle(clip)}
                        className={cn(
                          "p-3 rounded-full bg-black/40 border transition-all shadow-lg",
                          isLikedByMe 
                            ? "border-red-500/40 text-red-500 bg-red-500/10" 
                            : "border-white/10 text-white hover:bg-black/60"
                        )}
                      >
                        <Heart className={cn("h-5 w-5", isLikedByMe && "fill-red-500")} />
                      </motion.button>
                      <span className="text-[11px] font-bold text-white drop-shadow-md">
                        {clip.likesCount || 0}
                      </span>
                    </div>

                    {/* Comments button */}
                    <div className="flex flex-col items-center gap-1 pointer-events-auto">
                      <button
                        onClick={() => setIsCommentsOpen(true)}
                        className="p-3 rounded-full bg-black/40 border border-white/10 text-white hover:bg-black/60 transition-all shadow-lg"
                      >
                        <MessageSquare className="h-5 w-5" />
                      </button>
                      <span className="text-[11px] font-bold text-white drop-shadow-md">
                        {clip.id.startsWith('seed-') 
                          ? (localComments[clip.id]?.length || 0)
                          : (currentIndex === idx && comments.length > 0) ? comments.length : '0'}
                      </span>
                    </div>

                    {/* Share button */}
                    <div className="flex flex-col items-center gap-1 pointer-events-auto">
                      <button
                        onClick={() => handleShareClip(clip)}
                        className="p-3 rounded-full bg-black/40 border border-white/10 text-white hover:bg-black/60 transition-all shadow-lg"
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                      <span className="text-[10px] font-medium text-white drop-shadow-md">
                        {language === 'ka' ? 'გაზიარება' : 'Share'}
                      </span>
                    </div>

                    {/* Filters Toggle Button */}
                    <div className="flex flex-col items-center gap-1 pointer-events-auto">
                      <button
                        onClick={() => setShowFiltersPanel(prev => !prev)}
                        className={cn(
                          "p-3 rounded-full border transition-all shadow-lg",
                          showFiltersPanel 
                            ? "bg-purple-600/35 border-purple-500 text-purple-300 shadow-purple-500/20" 
                            : "bg-black/40 border-white/10 text-white hover:bg-black/60"
                        )}
                        title="Video filters"
                      >
                        <Sparkles className="h-5 w-5" />
                      </button>
                      <span className="text-[10px] font-medium text-white drop-shadow-md">
                        {language === 'ka' ? 'ფილტრები' : 'Filters'}
                      </span>
                    </div>

                    {/* Delete button (Owner only) */}
                    {clip.creatorId === user?.uid && (
                      <button
                        onClick={() => handleDeleteClip(clip)}
                        className="p-3 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/40 transition-all pointer-events-auto"
                        title="Delete clip"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {/* BOTTOM CAPTION & PRODUCTS INFO BLOCK */}
                  <div className="absolute bottom-4 left-4 right-16 z-10 pointer-events-none flex flex-col gap-3">
                    
                    {/* Tagged Product Box */}
                    {hasProduct && clip.productInfo && (
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="bg-black/75 border border-pink-500/30 rounded-xl p-2 max-w-sm pointer-events-auto flex items-center justify-between gap-3 shadow-lg backdrop-blur-md"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-pink-500/10 border border-pink-500/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {clip.productInfo.image ? (
                              <img referrerPolicy="no-referrer" src={clip.productInfo.image} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <ShoppingBag size={14} className="text-pink-400" />
                            )}
                          </div>
                          <div className="min-w-0 leading-tight">
                            <p className="text-[10px] uppercase font-black tracking-wider text-pink-400">
                              {language === 'ka' ? 'მონიშნული პროდუქტი' : 'TAGGED PRODUCT'}
                            </p>
                            <h4 className="text-[11px] font-bold text-white truncate">
                              {clip.productInfo.title}
                            </h4>
                            <p className="text-[10px] font-mono text-emerald-400 font-bold">
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
                          className="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-[10px] font-bold text-white flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer pointer-events-auto"
                        >
                          <span>{language === 'ka' ? 'იყიდე' : 'Buy'}</span>
                          <ChevronRight size={11} />
                        </button>
                      </motion.div>
                    )}

                    {/* Caption text */}
                    <div className="text-white drop-shadow-lg leading-relaxed pointer-events-auto">
                      <p className="font-extrabold text-[13px] hover:underline cursor-pointer flex items-center gap-1.5" onClick={() => handleOpenCreatorProfile(clip.creatorId, clip.creatorName, clip.creatorAvatar)}>
                        <span>@{clip.creatorName}</span>
                        {clip.creatorId.startsWith('proton-system') && (
                          <CheckCircle2 size={12} className="text-purple-400 fill-white stroke-[2.5]" />
                        )}
                      </p>
                      
                      {/* Caption with Highlighted Hashtags */}
                      <p className="text-xs font-normal mt-1 text-gray-100 select-text leading-relaxed">
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
                    </div>

                    {/* Sound Track name spinning */}
                    <div className="flex items-center gap-2 pointer-events-auto text-gray-300">
                      <Music size={12} className="text-purple-400 animate-bounce" />
                      <div className="text-[10px] font-medium overflow-hidden w-40 relative h-4">
                        <div className="absolute whitespace-nowrap animate-[marquee_12s_linear_infinite] font-mono text-white/80">
                          {clip.soundName || 'Original Audio - Custom Record'}
                        </div>
                      </div>

                      {/* Spinning Vinyl Vinyl disc indicator */}
                      <div className="absolute right-0 bottom-1">
                        <div className={cn(
                          "w-8 h-8 rounded-full bg-gradient-to-tr from-gray-900 to-black border-2 border-white/20 flex items-center justify-center",
                          isPlaying ? "animate-spin [animation-duration:5s]" : ""
                        )}>
                          <div className="w-3 h-3 rounded-full bg-purple-500 border border-black flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* REAL-TIME DYNAMIC FILTERS PANEL OVERLAY */}
                  <AnimatePresence>
                    {showFiltersPanel && (
                      <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        className="absolute bottom-0 left-0 right-0 z-20 bg-black/95 border-t border-white/10 p-4 pointer-events-auto flex flex-col gap-3 rounded-t-2xl shadow-2xl"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                            <Sparkles size={14} className="text-purple-400 animate-pulse" />
                            {language === 'ka' ? 'ვიდეო ფილტრები' : 'Real-time Filters'}
                          </span>
                          <button 
                            onClick={() => setShowFiltersPanel(false)}
                            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10">
                          {FILTER_OPTIONS.map(opt => {
                            const isSelected = activeFilter === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  setActiveFilter(opt.id as any);
                                  showToast(
                                    language === 'ka' 
                                      ? `ფილტრი შეიცვალა: ${opt.labelKa}` 
                                      : `Filter applied: ${opt.labelEn}`,
                                    'success'
                                  );
                                }}
                                className={cn(
                                  "flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition-all border",
                                  isSelected 
                                    ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20" 
                                    : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                                )}
                              >
                                <span>
                                  {language === 'ka' ? opt.labelKa : opt.labelEn}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              );
            })}
          </div>
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
                      className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative cursor-pointer group border border-proton-border/10"
                      onClick={() => {
                        const originalIndex = clips.findIndex(x => x.id === c.id);
                        if (originalIndex !== -1) {
                          setCurrentIndex(originalIndex);
                          setSelectedCreator(null);
                        }
                      }}
                    >
                      <video src={c.videoUrl} className="w-full h-full object-cover" muted playsInline />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-2">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-white">
                          <Heart size={10} className="fill-white" />
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

                    {/* Right Column: Dynamic Live Preview Player */}
                    <div className="md:col-span-5 flex flex-col items-center justify-start bg-white/5 border border-white/5 rounded-2xl p-4 self-stretch">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-proton-muted mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                        {language === 'ka' ? 'ცოცხალი პრევიუ' : 'Live Video Preview'}
                      </span>
                      
                      {(() => {
                        const previewUrl = newClipVideoUrl || PRESET_LOOPS.find(p => p.id === selectedPresetId)?.url;
                        if (previewUrl) {
                          return (
                            <div className="w-full aspect-[9/16] max-h-[290px] rounded-xl overflow-hidden relative border border-proton-border/20 bg-black shadow-lg">
                              <video
                                src={previewUrl}
                                controls
                                muted
                                playsInline
                                loop
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[8px] font-bold text-purple-300 uppercase tracking-widest border border-purple-500/20">
                                {language === 'ka' ? 'მზადაა' : 'Connected'}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="w-full aspect-[9/16] max-h-[290px] rounded-xl border border-dashed border-proton-border/20 flex flex-col items-center justify-center text-center p-4 bg-proton-bg/40">
                            <Video className="text-proton-muted opacity-25 mb-2" size={32} />
                            <p className="text-[10px] text-proton-muted leading-relaxed max-w-[120px]">
                              {language === 'ka' ? 'შეარჩიეთ მედია წყარო პრევიუსთვის' : 'Select a video source to load player preview'}
                            </p>
                          </div>
                        );
                      })()}
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

    </div>
  );
}
