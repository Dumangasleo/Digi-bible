import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useState } from 'react';

export interface VoiceDictationOptions {
  /** BCP-47 language tag: 'en-US' (KJV) | 'tl-PH' (ADB) | 'ceb-PH' (CEB). */
  lang?: string;
}

export interface VoiceDictation {
  transcript: string;
  recognizing: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * UI-agnostic wrapper over expo-speech-recognition for note dictation.
 * Requests permission on start and streams interim + final transcripts.
 * The note editor consumes `transcript` to auto-type as the user speaks.
 */
export function useVoiceDictation({ lang = 'en-US' }: VoiceDictationOptions = {}): VoiceDictation {
  const [transcript, setTranscript] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent('start', () => setRecognizing(true));
  useSpeechRecognitionEvent('end', () => setRecognizing(false));
  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results[0]?.transcript ?? '');
  });
  useSpeechRecognitionEvent('error', (event) => {
    setError(event.message ?? String(event.error));
  });

  async function start(): Promise<void> {
    setError(null);
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone / speech-recognition permission denied.');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: true,
    });
  }

  function stop(): void {
    ExpoSpeechRecognitionModule.stop();
  }

  function reset(): void {
    setTranscript('');
  }

  return { transcript, recognizing, error, start, stop, reset };
}
