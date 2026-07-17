import { useState, useEffect, useRef, useCallback } from 'react';

export function useClipPlayback(clipsLength: number, containerRef: React.RefObject<HTMLDivElement | null>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // Keep a mapping of index -> HTMLVideoElement
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});

  // Safely register video element references
  const registerVideoRef = useCallback((index: number, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current[index] = el;
    } else {
      delete videoRefs.current[index];
    }
  }, []);

  // Toggles play/pause for a specific index or currently active clip
  const togglePlay = useCallback((index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      if (!video.paused && index === currentIndex) {
        video.pause();
        setIsPlaying(false);
      } else {
        if (index !== currentIndex) {
          setCurrentIndex(index);
          setIsPlaying(true);
          if (containerRef.current) {
            containerRef.current.scrollTo({
              top: index * containerRef.current.clientHeight,
              behavior: 'smooth'
            });
          }
        } else {
          video.play()
            .then(() => {
              setIsPlaying(true);
            })
            .catch(err => {
              console.warn("Playback play request failed/blocked:", err);
              setIsPlaying(false);
            });
        }
      }
    }
  }, [currentIndex, containerRef]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Sync mute state changes to all video elements dynamically
  useEffect(() => {
    Object.values(videoRefs.current).forEach(video => {
      if (video) {
        video.muted = isMuted;
      }
    });
  }, [isMuted]);

  // Manage active index playback, pause inactive ones, and handle play-pause promise collisions safely
  useEffect(() => {
    const activeVideo = videoRefs.current[currentIndex];

    // Pause all non-active video elements
    Object.keys(videoRefs.current).forEach((key) => {
      const idx = parseInt(key, 10);
      const video = videoRefs.current[idx];
      if (video && idx !== currentIndex) {
        try {
          video.pause();
          video.currentTime = 0;
        } catch (e) {
          console.warn("Failed to pause or reset inactive video:", e);
        }
      }
    });

    if (activeVideo) {
      if (isPlaying) {
        activeVideo.play().catch(error => {
          console.warn("Playback play request failed/blocked by browser autoplay rules:", error);
          setIsPlaying(false);
        });
      } else {
        activeVideo.pause();
      }
    }
  }, [currentIndex, isPlaying, clipsLength]);

  // Handle active slide tracking via native element scrolls
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPosition = container.scrollTop;
    const height = container.clientHeight;
    if (height === 0) return;
    
    const newIndex = Math.round(scrollPosition / height);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < clipsLength) {
      setCurrentIndex(newIndex);
      setIsPlaying(true); // Automatically play the newly scrolled clip
    }
  }, [currentIndex, clipsLength]);

  // Reset states
  const resetPlayback = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(true);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    Object.values(videoRefs.current).forEach(video => {
      if (video) {
        try {
          video.pause();
          video.currentTime = 0;
        } catch (e) {
          console.warn(e);
        }
      }
    });
  }, [containerRef]);

  // Clean up and release decoding memory resources completely on unmount (extremely crucial for SPAs with heavy video streams)
  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach(video => {
        if (video) {
          try {
            video.pause();
            // Clear source and load to release browser media decoder allocations
            video.removeAttribute('src');
            video.load();
          } catch (err) {
            console.warn("Failed to clean up video resources on unmount:", err);
          }
        }
      });
      videoRefs.current = {};
    };
  }, []);

  return {
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
  };
}
