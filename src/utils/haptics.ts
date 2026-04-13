// Lightweight haptic feedback. Uses RN's built-in Vibration API so we
// don't pull in expo-haptics for ~5 line-items. iOS produces a soft
// short pulse for short durations; Android vibrates the same.
//
// Use on:
//   - Successful payment record
//   - EOD submit confirmed
//   - Loan request approved/rejected
//   - Button press in critical flows (collect, handover)

import { Platform, Vibration } from 'react-native';

type Kind = 'tap' | 'success' | 'warn' | 'error';

const PATTERNS: Record<Kind, number | number[]> = {
  // Single short pulse — like a tap acknowledgment.
  tap: 10,
  // Double pulse — confirmed action.
  success: Platform.OS === 'ios' ? [0, 12, 50, 12] : [0, 30, 50, 30],
  // Short-long — heads up.
  warn: Platform.OS === 'ios' ? [0, 15, 80, 40] : [0, 40, 80, 80],
  // Triple pulse — error / dispute.
  error: Platform.OS === 'ios' ? [0, 20, 60, 20, 60, 20] : [0, 50, 60, 50, 60, 50],
};

export function haptic(kind: Kind = 'tap'): void {
  try {
    // Web has no vibration API in our environment — guard.
    if (Platform.OS === 'web') return;
    const pattern = PATTERNS[kind];
    if (Array.isArray(pattern)) {
      Vibration.vibrate(pattern);
    } else {
      Vibration.vibrate(pattern);
    }
  } catch {
    // never throw from haptic
  }
}
