// Whisper API integration for better Tamil + English speech-to-text.
// Sends audio to OpenAI's Whisper endpoint, returns transcript.
//
// Used as an upgrade from device speech recognition (useVoice.ts).
// Requires EXPO_PUBLIC_OPENAI_KEY in .env.
//
// Recording: on native, use expo-av to record a short audio clip.
// On web, use MediaRecorder API. Both produce a blob → send to Whisper.

import { Platform } from 'react-native';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

interface WhisperResult {
  text: string;
  amount: number | null;
}

/**
 * Record audio and transcribe via Whisper API.
 * Returns the transcript + parsed amount.
 */
export async function transcribeWithWhisper(): Promise<WhisperResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_KEY;
  if (!apiKey) {
    return { text: 'Whisper API key not configured', amount: null };
  }

  const audioBlob = await recordShortAudio();
  if (!audioBlob) {
    return { text: 'Recording failed', amount: null };
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', 'ta'); // Tamil primary, Whisper auto-detects English too
  formData.append('response_format', 'text');

  const resp = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { text: `Whisper error: ${err}`, amount: null };
  }

  const text = (await resp.text()).trim();
  const amount = parseAmount(text);
  return { text, amount };
}

/**
 * Record 3 seconds of audio using the browser's MediaRecorder API.
 * Returns a Blob. On native, would use expo-av.
 */
async function recordShortAudio(): Promise<Blob | null> {
  if (Platform.OS !== 'web') {
    // Native recording via expo-av — implement when needed.
    // For now, fall back to device speech recognition (useVoice.ts).
    return null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    const chunks: BlobPart[] = [];

    return new Promise((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: 'audio/webm' }));
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 3000); // Record for 3 seconds
    });
  } catch {
    return null;
  }
}

function parseAmount(text: string): number | null {
  // Extract numbers from the transcript
  const match = text.match(/\d[\d,]*/);
  if (match) {
    return parseInt(match[0].replace(/,/g, ''), 10);
  }
  return null;
}
