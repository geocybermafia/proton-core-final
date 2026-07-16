import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

export function ClipsView({ language, setActiveView, user }: ClipsViewProps) {
  const { showToast } = useToast();
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'forYou' | 'myClips' | 'productReels'>('forYou');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Video playback states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  
  // Modal / Sidebar overlays
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<ClipComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  
  // Profile Modal Overlay
  const [selectedCreator, setSelectedCreator] = useState<{ id: string, name: string, avatar?: string } | null>(null);
  const [creatorClips, setCreatorClips] = useState<Clip[]>([]);
  
  // Create / Upload modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClipCaption, setNewClipCaption] = useState('');
  const [newClipSound, setNewClipSound] = useState('');
  const [newClipVideoUrl, setNewClipVideoUrl] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('potter-clay');
  const [newClipProductId, setNewClipProductId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Marketplace Listings list for Tagging
  const [listings, setListings] = useState<any[]>([]);

  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

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
        // Automatically seed some initial clips so the video tab is instantly alive!
        setLoading(true);
        try {
          for (const item of SEED_CLIPS) {
            const docId = `seed-${Math.random().toString(36).substring(2, 11)}`;
            await setDoc(doc(db, 'clips', docId), {
              ...item,
              id: docId,
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error("Error seeding clips:", e);
        }
        setLoading(false);
        return;
      }

      const rawClips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Clip));
      
      // Resolve tagged product info locally for richer experience
      const populatedClips = await Promise.all(rawClips.map(async (clip) => {
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
    });

    return () => unsubscribe();
  }, []);

  // 3. Keep current video playing, pause others
  useEffect(() => {
    setIsPlaying(true);
    Object.keys(videoRefs.current).forEach((key) => {
      const video = videoRefs.current[key];
      if (video) {
        if (parseInt(key) === currentIndex) {
          video.play().catch(e => console.warn("Autoplay block:", e));
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });
  }, [currentIndex, clips]);

  // Handle intersection observer or scroll in desktop/mobile
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPosition = container.scrollTop;
    const height = container.clientHeight;
    const newIndex = Math.round(scrollPosition / height);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredClips.length) {
      setCurrentIndex(newIndex);
    }
  };

  // 4. Fetch comments for selected clip
  useEffect(() => {
    if (!isCommentsOpen || !filteredClips[currentIndex]) return;
    setCommentsLoading(true);
    const clipId = filteredClips[currentIndex].id;
    const q = query(
      collection(db, 'clips', clipId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClipComment));
      setComments(commList);
      setCommentsLoading(false);
    });

    return () => unsubscribe();
  }, [isCommentsOpen, currentIndex, clips]);

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

  // Toggle Like with Firestore
  const handleLikeToggle = async (clip: Clip) => {
    if (!user) {
      showToast(
        language === 'ka' ? 'ავტორიზაცია საჭიროა მოსაწონებლად' : 'Please sign in to like clips',
        'warning'
      );
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

    // If no custom URL, use selected preset
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
                  <div className="absolute inset-0 z-0 flex items-center justify-center">
                    <video
                      ref={el => { videoRefs.current[idx] = el; }}
                      src={clip.videoUrl}
                      loop
                      playsInline
                      muted={isMuted}
                      className="w-full h-full object-cover"
                      onClick={() => {
                        const video = videoRefs.current[idx];
                        if (video) {
                          if (isPlaying) {
                            video.pause();
                            setIsPlaying(false);
                          } else {
                            video.play().catch(err => console.log(err));
                            setIsPlaying(true);
                          }
                        }
                      }}
                    />
                    
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
                        setIsMuted(!isMuted);
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
                        {clip.id.startsWith('seed-') ? 14 : '...'}
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
                            {comm.createdAt ? new Date(comm.createdAt?.seconds * 1000).toLocaleDateString() : 'Just now'}
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
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-proton-bg border border-proton-border/30 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <button
                onClick={() => setIsCreateOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-proton-bg border border-proton-border/10 text-proton-muted hover:text-white transition-all"
              >
                <X size={15} />
              </button>

              <div className="flex items-center gap-2 pb-3 border-b border-proton-border/20">
                <Video className="text-purple-400 animate-pulse" size={18} />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  {language === 'ka' ? 'ახალი კლიპის დამატება' : 'Publish a Clip'}
                </h3>
              </div>

              <form onSubmit={handleCreateReel} className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
                
                {/* Visual Video preset choice */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-proton-muted mb-2">
                    {language === 'ka' ? '1. აირჩიე ვიდეო ნიმუში ან ჩასვი ბმული' : '1. Choose video template or paste link'}
                  </label>
                  
                  {/* Presets Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {PRESET_LOOPS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId(p.id);
                          setNewClipVideoUrl('');
                          setNewClipSound(p.sound);
                        }}
                        className={cn(
                          "p-2 text-left rounded-xl border text-xs font-semibold transition-all flex flex-col gap-1",
                          selectedPresetId === p.id && !newClipVideoUrl
                            ? "bg-purple-500/20 text-purple-400 border-purple-500/50 ring-1 ring-purple-500/20"
                            : "bg-proton-bg/40 border-proton-border/20 text-proton-muted hover:text-white hover:bg-proton-bg/60"
                        )}
                      >
                        <span className="font-bold block truncate">{language === 'ka' ? p.nameGe : p.nameEn}</span>
                        <span className="text-[10px] text-proton-muted opacity-80 truncate block">{p.sound}</span>
                      </button>
                    ))}
                  </div>

                  {/* Custom URL Input */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-proton-muted italic">
                      {language === 'ka' ? 'ან ჩასვი საკუთარი .mp4 ვიდეოს ბმული:' : 'Or paste a direct custom .mp4 video URL:'}
                    </span>
                    <input
                      type="url"
                      value={newClipVideoUrl}
                      onChange={(e) => {
                        setNewClipVideoUrl(e.target.value);
                        setSelectedPresetId('');
                      }}
                      placeholder="https://example.com/my-cool-video.mp4"
                      className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl py-2 px-3 text-xs text-proton-text placeholder:text-proton-muted/60 transition-all"
                    />
                  </div>
                </div>

                {/* Caption / description input */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-proton-muted">
                    {language === 'ka' ? '2. სათაური & ჰეშთეგები' : '2. Caption & Hashtags'}
                  </label>
                  <textarea
                    rows={3}
                    value={newClipCaption}
                    onChange={(e) => setNewClipCaption(e.target.value)}
                    placeholder={language === 'ka' ? 'აღწერე ვიდეო... გამოიყენე ჰეშთეგები (მაგ. #wool #pottery #tbilisi)' : 'Describe your reel... Use hashtags (e.g. #wool #pottery #handcrafted)'}
                    className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl py-2 px-3 text-xs text-proton-text placeholder:text-proton-muted/60 transition-all resize-none"
                  />
                </div>

                {/* Sound Name track */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-proton-muted">
                    {language === 'ka' ? '3. მუსიკა / აუდიო ბილიკი' : '3. Audio track / Music name'}
                  </label>
                  <div className="relative">
                    <Music size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-proton-muted" />
                    <input
                      type="text"
                      value={newClipSound}
                      onChange={(e) => setNewClipSound(e.target.value)}
                      placeholder={language === 'ka' ? 'ორიგინალი ხმა ან სიმღერის სახელი' : 'Original Audio or track name'}
                      className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl py-2 pl-9 pr-3 text-xs text-proton-text placeholder:text-proton-muted/60 transition-all"
                    />
                  </div>
                </div>

                {/* Tag Marketplace Product (Awesome connection) */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-proton-muted">
                    {language === 'ka' ? '4. მონიშნე პროდუქტი მარკეტიდან (არასავალდებულო)' : '4. Tag a marketplace product (Optional)'}
                  </label>
                  <div className="relative">
                    <ShoppingBag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-proton-muted" />
                    <select
                      value={newClipProductId}
                      onChange={(e) => setNewClipProductId(e.target.value)}
                      className="w-full bg-proton-bg/60 border border-proton-border/20 focus:border-purple-500/50 outline-none rounded-xl py-2 pl-9 pr-3 text-xs text-proton-text transition-all appearance-none cursor-pointer"
                    >
                      <option value="">
                        {language === 'ka' ? '-- არ მონიშნო --' : '-- Do not tag --'}
                      </option>
                      {listings.map((item) => (
                        <option key={item.id} value={item.id}>
                          [{item.category}] {item.title} - ${item.price}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-proton-muted italic leading-relaxed">
                    {language === 'ka' 
                      ? 'ვიდეოს მნახველებს შეეძლებათ პირდაპირ გადავიდნენ ამ პროდუქტის შესაძენად.' 
                      : 'Viewers will see a clickable tag on the video overlay directing them to checkout.'}
                  </p>
                </div>

                {/* Submit bar button */}
                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-xl bg-proton-bg/80 border border-proton-border/20 text-proton-muted hover:text-white transition-all text-xs font-bold"
                  >
                    {language === 'ka' ? 'გაუქმება' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-purple-500/10 hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isUploading ? (
                      <>
                        <svg className="animate-spin h-4 w-5 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{language === 'ka' ? 'იგზავნება...' : 'Publishing...'}</span>
                      </>
                    ) : (
                      <>
                        <Video size={14} />
                        <span>{language === 'ka' ? 'გამოქვეყნება' : 'Publish Reel'}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
