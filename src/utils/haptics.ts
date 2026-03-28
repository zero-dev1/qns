/**
 * Haptic + audio feedback utility
 * Silently does nothing if unsupported
 */

const isVibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function playChime(frequencies: number[], durations: number[]): void {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = durations.slice(0, i).reduce((a, b) => a + b, 0);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + durations[i]);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + durations[i]);
    });
  } catch {}
}

/**
 * QNS Sonic Identity — all based on a core motif in the key of C major.
 * Registration success: C5 → E5 → G5 (existing, the "triumph")
 * Gift delivered: G4 → C5 (warm handoff)
 * Burn reveal: C3 → G2 (low, warm, permanent)
 * Profile action: single E5 ping
 */
export function hapticGift(): void {
  if (isVibrationSupported) navigator.vibrate([30, 40, 30]);
  playChime([392.0, 523.25], [0.15, 0.25]);
}

export function hapticBurn(): void {
  if (isVibrationSupported) navigator.vibrate(80);
  playChime([130.81, 98.0], [0.2, 0.35]); // C3 → G2, deep
}

export function hapticProfileAction(): void {
  if (isVibrationSupported) navigator.vibrate(15);
  playChime([659.25], [0.1]); // single E5 ping
}

/**
 * Success: short pulse + ascending chime (C5 → E5 → G5)
 */
export function hapticSuccess(): void {
  if (isVibrationSupported) navigator.vibrate(50);
  playChime([523.25, 659.25, 783.99], [0.12, 0.12, 0.2]);
}

/**
 * Tap: very short pulse + subtle click
 */
export function hapticTap(): void {
  if (isVibrationSupported) navigator.vibrate(10);
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  } catch {}
}

/**
 * Error: two pulses + descending buzz
 */
export function hapticError(): void {
  if (isVibrationSupported) navigator.vibrate([50, 50, 50]);
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}
