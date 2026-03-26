// src/lib/transcribe-audio.ts
// Transcribe audio from Evolution API voice notes using OpenAI Whisper
import OpenAI from 'openai';

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
}

interface TranscribeFromEvolutionInput {
  /** Evolution API base URL for this instance */
  baseUrl: string;
  /** Evolution API key */
  apiKey: string;
  /** Evolution instance name */
  instanceName: string;
  /** The full message object from the webhook payload (data.message) */
  message: Record<string, unknown>;
  /** The message key object from the webhook payload (data.key) */
  messageKey: Record<string, unknown>;
}

/**
 * Download audio from Evolution API and transcribe with Whisper.
 * Returns the transcribed text, or null if transcription fails.
 */
export async function transcribeVoiceNote(input: TranscribeFromEvolutionInput): Promise<string | null> {
  const { baseUrl, apiKey, instanceName, message, messageKey } = input;

  try {
    // 1. Download audio as base64 via Evolution's media endpoint
    const url = `${baseUrl.replace(/\/$/, '')}/chat/getBase64FromMediaMessage/${instanceName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey, message } }),
    });

    if (!res.ok) {
      console.warn(`[transcribe] Evolution media download failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    const base64Audio = json.base64 || json.mediaBase64;
    if (!base64Audio) {
      console.warn('[transcribe] No base64 audio in Evolution response');
      return null;
    }

    // 2. Convert base64 to a File object for OpenAI
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const audioFile = new File([audioBuffer], 'voice.ogg', { type: 'audio/ogg' });

    // 3. Transcribe with Whisper
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
    });

    const text = transcription.text?.trim();
    if (!text) {
      console.warn('[transcribe] Whisper returned empty transcription');
      return null;
    }

    console.log(`[transcribe] Voice note transcribed (${audioBuffer.length} bytes): "${text.substring(0, 100)}"`);
    return text;
  } catch (err) {
    console.error('[transcribe] Failed to transcribe voice note:', err);
    return null;
  }
}
