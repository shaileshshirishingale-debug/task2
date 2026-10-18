/**
 * Gentle dopamine-supportive audio & haptic feedback utilities.
 * Disabled by default; respect user preferences and avoid sensory overload.
 */

let audioCtx: AudioContext | null = null;

export function playGentleSuccessSound(enabled: boolean = false) {
  if (!enabled || typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 soft major chord

    notes.forEach((freq, idx) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.06, now + idx * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx!.destination);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.28);
    });
  } catch (err) {
    // Ignore audio context errors gracefully
  }
}

export function triggerGentleHaptic(enabled: boolean = false) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate([15, 25, 15]);
    }
  } catch (err) {
    // Ignore haptic failures gracefully
  }
}
