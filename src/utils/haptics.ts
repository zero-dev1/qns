/**
 * Haptic feedback utility using the Vibration API
 * Silently does nothing if the device doesn't support vibration
 */

const isVibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

/**
 * Success pattern: single short pulse (50ms)
 */
export function hapticSuccess(): void {
  if (isVibrationSupported) {
    navigator.vibrate(50);
  }
}

/**
 * Tap pattern: very short pulse (10ms)
 */
export function hapticTap(): void {
  if (isVibrationSupported) {
    navigator.vibrate(10);
  }
}

/**
 * Error pattern: two short pulses (50ms - 50ms pause - 50ms)
 */
export function hapticError(): void {
  if (isVibrationSupported) {
    navigator.vibrate([50, 50, 50]);
  }
}
