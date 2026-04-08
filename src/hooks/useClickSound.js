import { useCallback, useRef, useEffect } from 'react';

/**
 * Hook to play a click sound effect.
 * Uses Web Audio API to generate a short, subtle click sound.
 * No external audio files required.
 */
export function useClickSound() {
  const audioContextRef = useRef(null);
  const isEnabledRef = useRef(true); // Allow users to disable sounds via preference

  // Initialize audio context on first user interaction (required by browsers)
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  const playClickSound = useCallback((type = 'button') => {
    if (!isEnabledRef.current) return;

    try {
      initAudioContext();

      const audioContext = audioContextRef.current;

      // Create oscillator for click sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Different sounds for different interactions
      const now = audioContext.currentTime;

      if (type === 'button') {
        // Short, high-pitched click (like a mechanical button)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.03);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.05);
      } else if (type === 'success') {
        // Success chime (higher, brighter)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
      } else if (type === 'error') {
        // Error buzz (low, dull)
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.linearRampToValueAtTime(150, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
      }

      // Clean up nodes after sound finishes
      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    } catch (err) {
      // Silently fail if audio not supported or blocked
      console.warn('Click sound failed:', err.message);
    }
  }, [initAudioContext]);

  // Create a wrapper function for use in onClick handlers
  const handleClick = useCallback((type = 'button') => (e) => {
    // Initialize audio on first click if needed
    initAudioContext();
    playClickSound(type);
  }, [initAudioContext, playClickSound]);

  // Global click listener for all buttons (automatic mode)
  useEffect(() => {
    if (!isEnabledRef.current) return;

    const handleGlobalClick = (e) => {
      // Check if clicked element is a button or has role="button"
      const target = e.target;
      if (
        target.tagName === 'BUTTON' ||
        target.getAttribute('role') === 'button' ||
        target.closest('button') ||
        target.closest('[role="button"]')
      ) {
        initAudioContext();
        // Small delay to not interfere with click action
        requestAnimationFrame(() => {
          playClickSound('button');
        });
      }
    };

    // Add click listener to document
    document.addEventListener('click', handleGlobalClick, true); // Capture phase to get early

    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [initAudioContext, playClickSound]);

  // Allow disabling sounds programmatically
  const enable = useCallback(() => { isEnabledRef.current = true; }, []);
  const disable = useCallback(() => { isEnabledRef.current = false; }, []);

  return {
    playClickSound,
    handleClick,
    enable,
    disable,
    isEnabled: () => isEnabledRef.current
  };
}

export default useClickSound;
