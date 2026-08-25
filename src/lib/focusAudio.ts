/**
 * Audio synthesis & Voice notification engine for Proton Focus & Pomodoro sessions.
 * Generates harmonic chimes using Web Audio API without relying on external media files.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    console.warn('AudioContext initialization failed:', e);
    return null;
  }
}

/**
 * Plays rich harmonic tones (Chime / Bell / Zen gong)
 */
export function playFocusChime(type: 'start' | 'complete' | 'break' | 'click' = 'complete') {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
      return;
    }

    if (type === 'start') {
      // Ascending gentle double chime (440Hz -> 659Hz -> 880Hz)
      const freqs = [440, 659.25, 880];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.8);
      });
      return;
    }

    if (type === 'break') {
      // Relaxing low soothing bell (392Hz G4 -> 523.25Hz C5)
      const freqs = [392, 523.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.2);

        gain.gain.setValueAtTime(0, now + idx * 0.2);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.2 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.2 + 1.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.2);
        osc.stop(now + idx * 0.2 + 1.5);
      });
      return;
    }

    // Default: 'complete' -> Harmonic Zen Celebration Chime (Solfeggio 528Hz & 660Hz & 792Hz & 1056Hz)
    const chords = [528, 660, 792, 1056];
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      gain.gain.setValueAtTime(0, now + idx * 0.15);
      gain.gain.linearRampToValueAtTime(0.3 - idx * 0.05, now + idx * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.15 + 2.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 2.3);
    });
  } catch (e) {
    console.warn('Could not play focus chime:', e);
  }
}

/**
 * Speaks text using Web SpeechSynthesis API with Georgian / English language support
 */
export function speakFocusMessage(message: string, language: 'en' | 'ka' = 'ka') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel(); // Clear any queued speech

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = language === 'ka' ? 'ka-GE' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 0.9;

    // Try finding preferred voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      if (language === 'ka') {
        const kaVoice = voices.find(v => v.lang.startsWith('ka'));
        if (kaVoice) utterance.voice = kaVoice;
      } else {
        const enVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
        if (enVoice) utterance.voice = enVoice;
      }
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}

/**
 * High-level helper for timer notifications
 */
export function notifyFocusEvent(
  event: 'start' | 'complete' | 'break',
  mode: 'work' | 'break',
  language: 'en' | 'ka',
  soundEnabled: boolean = true,
  voiceEnabled: boolean = true,
  customMinutes?: number
) {
  if (soundEnabled) {
    playFocusChime(event === 'complete' ? (mode === 'work' ? 'complete' : 'break') : event);
  }

  if (voiceEnabled) {
    let msg = '';
    if (event === 'start') {
      if (language === 'ka') {
        msg = mode === 'work' 
          ? (customMinutes ? `${customMinutes} წუთიანი ფოკუს რეჟიმი დაიწყო. წარმატებულ მუშაობას გისურვებთ!` : 'ფოკუს რეჟიმი დაიწყო. წარმატებულ მუშაობას გისურვებთ!') 
          : 'შესვენების დრო დაიწყო. განიტვირთეთ!';
      } else {
        msg = mode === 'work' 
          ? (customMinutes ? `${customMinutes}-minute focus session started. Let's make it count!` : 'Focus session started. Enjoy your deep work!') 
          : 'Break session started. Time to recharge!';
      }
    } else if (event === 'complete') {
      if (language === 'ka') {
        msg = mode === 'work'
          ? 'ფოკუსის დრო ამოიწურა! შესანიშნავი ნამუშევარია, დროა დაისვენოთ.'
          : 'შესვენება დასრულდა. მზად ხართ ახალი ფოკუსისთვის?';
      } else {
        msg = mode === 'work'
          ? 'Focus session complete! Great job, time for a well-deserved break.'
          : 'Break time is over. Ready for your next focus session?';
      }
    }

    if (msg) {
      // Delay speech slightly after the chime sound
      setTimeout(() => {
        speakFocusMessage(msg, language);
      }, 700);
    }
  }
}
