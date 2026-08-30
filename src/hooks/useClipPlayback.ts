import React, { useState, useEffect, useRef, useCallback } from 'react';

export function useClipPlayback(clips: any[], containerRef: React.RefObject<HTMLDivElement | null>) {
  const clipsLength = clips.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // Keep a mapping of index -> HTMLVideoElement
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  // Keep track of active play promises to avoid AbortError interruptions
  const playPromises = useRef<{ [key: number]: Promise<void> | null }>({});

  const serializedUrls = clips.map(c => c ? `${c.id || ''}:${c.videoUrl || ''}` : '').join(',');

  // Safely register video element references
  const registerVideoRef = useCallback((index: number, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current[index] = el;
    } else {
      delete videoRefs.current[index];
      delete playPromises.current[index];
    }
  }, []);

  const safePlay = useCallback(async (video: HTMLVideoElement, idx: number) => {
    try {
      const promise = video.play();
      playPromises.current[idx] = promise;
      await promise;
      playPromises.current[idx] = null;
      if (idx === currentIndex) {
        setIsPlaying(true);
      }
    } catch (error: any) {
      playPromises.current[idx] = null;
      if (error?.name === 'AbortError') {
        // Interrupted by pause or fast scrolling; expected browser behavior
        return;
      }
      console.warn("Playback play request failed/blocked by browser autoplay rules:", error);
      if (!video.muted) {
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
          if (idx === currentIndex) setIsPlaying(true);
        } catch {
          if (idx === currentIndex) setIsPlaying(false);
        }
      } else {
        if (idx === currentIndex) setIsPlaying(false);
      }
    }
  }, [currentIndex]);

  const safePause = useCallback(async (video: HTMLVideoElement, idx: number) => {
    const pending = playPromises.current[idx];
    if (pending) {
      try {
        await pending;
      } catch {
        // ignore
      }
    }
    try {
      video.pause();
    } catch (e) {
      console.warn("Failed to pause video:", e);
    }
  }, []);

  // Toggles play/pause for a specific index or currently active clip
  const togglePlay = useCallback((index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      if (!video.paused && index === currentIndex) {
        safePause(video, index);
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
          safePlay(video, index);
        }
      }
    }
  }, [currentIndex, containerRef, safePause, safePlay]);

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
        safePause(video, idx);
        try {
          video.currentTime = 0;
        } catch (e) {
          // ignore
        }
      }
    });

    if (activeVideo) {
      if (isPlaying) {
        if (activeVideo.paused) {
          safePlay(activeVideo, currentIndex);
        }
      } else {
        if (!activeVideo.paused) {
          safePause(activeVideo, currentIndex);
        }
      }
    }
  }, [currentIndex, isPlaying, clipsLength, serializedUrls, safePause, safePlay]);

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
    Object.keys(videoRefs.current).forEach(key => {
      const idx = parseInt(key, 10);
      const video = videoRefs.current[idx];
      if (video) {
        safePause(video, idx);
        try {
          video.currentTime = 0;
        } catch (e) {
          console.warn(e);
        }
      }
    });
  }, [containerRef, safePause]);

  // Clean up and release decoding memory resources completely on unmount (extremely crucial for SPAs with heavy video streams)
  useEffect(() => {
    return () => {
      Object.keys(videoRefs.current).forEach(key => {
        const idx = parseInt(key, 10);
        const video = videoRefs.current[idx];
        if (video) {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
          } catch (err) {
            console.warn("Failed to clean up video resources on unmount:", err);
          }
        }
      });
      videoRefs.current = {};
      playPromises.current = {};
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
