import { NextRequest } from 'next/server';

import { getUuid } from '@/shared/lib/hash';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { respData, respErr } from '@/shared/lib/resp';
import { createAITask } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';

// Vercel Functions have a ~4.5MB body limit; keep headroom
const MAX_AUDIO_SIZE = 4 * 1024 * 1024;
const SUPPORTED_TYPES: Record<string, string> = {
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/mp4': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/webm': 'audio/webm',
  'audio/ogg': 'audio/ogg',
};

export async function POST(request: NextRequest) {
  const rateLimited = enforceMinIntervalRateLimit(request, {
    intervalMs: 5_000,
    keyPrefix: 'fieldbrief-transcribe',
  });
  if (rateLimited) return rateLimited;

  try {
    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in to transcribe audio');
    }

    const formData = await request.formData();
    const file = formData.get('audio') as File | null;

    if (!file) {
      return respErr('No audio file provided');
    }

    const mimeType = SUPPORTED_TYPES[file.type];
    if (!mimeType) {
      return respErr(
        `Unsupported audio format: ${file.type}. Please upload mp3, wav, m4a, webm, or ogg.`
      );
    }

    if (file.size > MAX_AUDIO_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      return respErr(
        `Audio file too large (${sizeMB}MB). Maximum is 4MB. Please use a shorter recording or compress the file.`
      );
    }

    if (file.size < 100) {
      return respErr('Audio file is too small or empty');
    }

    // Convert file to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Call MiMo ASR API
    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';

    if (!apiKey) {
      return respErr('Transcription service is not configured');
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-asr',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: dataUrl,
                },
              },
            ],
          },
        ],
        asr_options: {
          language: 'auto',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MiMo ASR error:', response.status, errorText);
      return respErr(
        `Transcription failed (${response.status}). Please paste your transcript manually.`
      );
    }

    const result = await response.json();
    const text = result?.choices?.[0]?.message?.content || '';

    if (!text.trim()) {
      return respErr(
        'No speech detected in the audio. Please try a different file or paste your transcript.'
      );
    }

    // Track the transcription task (no credit charge)
    const taskId = getUuid();
    await createAITask({
      id: taskId,
      userId: user.id,
      userEmail: user.email,
      mediaType: 'audio',
      provider: 'mimo',
      model: 'mimo-v2.5-asr',
      prompt: `[Audio transcription] ${file.name}`,
      options: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType,
      }),
      status: 'success',
      costCredits: 0,
      scene: 'fieldbrief-transcribe',
      taskId,
      taskResult: JSON.stringify({ text }),
    });

    return respData({ text });
  } catch (error: any) {
    console.error('Transcription failed:', error);
    return respErr(
      error.message ||
        'Transcription failed. Please paste your transcript manually.'
    );
  }
}
