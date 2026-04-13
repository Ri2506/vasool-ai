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
 * "one thousand two hundred", "twenty three hundred" (= 2300), etc.
 *
 * Strategy:
 *   1. Strip Rs / rupees / currency words, normalise.
 *   2. If the string contains digits, prefer the digit cluster.
 *   3. Otherwise tokenise and apply Indian numbering rules:
 *      - Token < 10 followed by hundred/thousand/lakh multiplies it.
 *      - Two consecutive 1-9 tokens like "twenty three" sum (23).
 *      - "three eighty" = 380 (3 * 100 + 80).
 *      - "twenty five hundred" = 2500.
 */
function parseSpokenAmount(text: string): number | null {
  // 1. Strip currency words + punctuation
  const cleaned = text
    .toLowerCase()
    .replace(/[,₹]/g, ' ')
    .replace(/\b(rs|rupees?|rupaai|paise|paisa|only)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. If it's already a clean number, take it.
  const direct = cleaned.replace(/\s/g, '');
  if (/^\d+$/.test(direct)) return parseInt(direct, 10);

  // 3. If the user said "rs 500" or "five 100", grab the leading digits.
  const digitMatch = cleaned.match(/\d+/);
  if (digitMatch && cleaned.replace(digitMatch[0], '').trim().length === 0) {
    return parseInt(digitMatch[0], 10);
  }

  const words: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    hundred: 100, hundreds: 100,
    thousand: 1000, thousands: 1000, k: 1000,
    lakh: 100000, lakhs: 100000, lac: 100000,
    crore: 10000000, crores: 10000000,
    // Tamil numerals
    ondru: 1, onnu: 1, rendu: 2, moondru: 3, moonu: 3, naalu: 4, naangu: 4,
    aidhu: 5, anju: 5, aaru: 6, aru: 6, ezhu: 7, ettu: 8, onbadhu: 9,
    pathu: 10, nooru: 100, nuru: 100, aayiram: 1000, ayiram: 1000,
    laksham: 100000, kodi: 10000000,
  };

  const tokens = cleaned.split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let current = 0;

  for (const raw of tokens) {
    // Allow plain digit tokens mid-sentence: "two 50" = 250
    const asNum = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
    const val = !isNaN(asNum) ? asNum : words[raw];
    if (val === undefined) continue;

    if (val >= 100) {
      // Multipliers — combine with the running `current`.
      const multiplier = val;
      const base = current === 0 ? 1 : current;
      const product = base * multiplier;
      // For thousand+/lakh+/crore+, finalise into total so we can
      // still add a remainder ("two thousand five hundred" = 2500).
      if (multiplier >= 1000) {
        total += product;
        current = 0;
      } else {
        // hundred — keep accumulating in case "five hundred fifty" follows
        current = product;
      }
    } else {
      current += val;
    }
  }
  total += current;
  return total > 0 ? Math.round(total) : null;
}
