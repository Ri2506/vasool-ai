import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

interface VoiceResult {
  text: string;
  amount: number | null;
}

/**
 * Voice-to-amount hook. Uses Web Speech API on web (free, no API key).
 * Parses spoken numbers in English and Tamil.
 *
 * Usage:
 *   const { isListening, startListening, lastResult } = useVoice();
 *   // startListening() → user speaks "five hundred" → lastResult = { text: "five hundred", amount: 500 }
 *
 * Native support (Phase 3+): swap to @react-native-voice/voice or Whisper API.
 */
export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [lastResult, setLastResult] = useState<VoiceResult | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (Platform.OS !== 'web') {
      // Native: not wired yet — would use @react-native-voice/voice
      setLastResult({ text: '', amount: null });
      return;
    }

    const SpeechRecognition =
      (globalThis as any).webkitSpeechRecognition ??
      (globalThis as any).SpeechRecognition;

    if (!SpeechRecognition) {
      setLastResult({ text: 'Speech not supported in this browser', amount: null });
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN'; // Indian English, also picks up Tamil numbers
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase();
      const amount = parseSpokenAmount(transcript);
      setLastResult({ text: transcript, amount });
    };

    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening, lastResult };
}

/**
 * Parse a spoken string into a numeric amount.
 * Handles: "500", "five hundred", "three eighty", "aidhu nooru" (Tamil),
 * "one thousand two hundred", etc.
 */
function parseSpokenAmount(text: string): number | null {
  // 1. Direct number
  const direct = text.replace(/[₹,\s]/g, '');
  if (/^\d+$/.test(direct)) return parseInt(direct, 10);

  // 2. Word-to-number mapping
  const words: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000,
    // Tamil numbers
    ondru: 1, rendu: 2, moondru: 3, naalu: 4, aidhu: 5,
    aaru: 6, ezhu: 7, ettu: 8, onbadhu: 9, pathu: 10,
    nooru: 100, aayiram: 1000,
    // Common speech patterns
    half: 0.5, quarter: 0.25, double: 2,
  };

  const tokens = text.split(/[\s-]+/);
  let total = 0;
  let current = 0;

  for (const token of tokens) {
    const val = words[token];
    if (val === undefined) continue;

    if (val === 100) {
      current = current === 0 ? 100 : current * 100;
    } else if (val === 1000) {
      current = current === 0 ? 1000 : current * 1000;
    } else if (val === 100000) {
      current = current === 0 ? 100000 : current * 100000;
    } else if (val >= 100) {
      // "three eighty" = 380
      if (current > 0 && current < 10 && val >= 100) {
        current = current * val;
      } else {
        total += current;
        current = val;
      }
    } else {
      current += val;
    }
  }
  total += current;

  return total > 0 ? Math.round(total) : null;
}
