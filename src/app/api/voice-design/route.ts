import { NextRequest } from 'next/server';

import { getUuid } from '@/shared/lib/hash';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { respData, respErr } from '@/shared/lib/resp';
import { callVoiceDesign, mergeWavBase64, splitText } from '@/shared/lib/tts';
import { createAITask, updateAITaskById } from '@/shared/models/ai_task';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

const CREDITS_PER_CHAR = 2;
const PROCESSING_TIME_BUDGET_MS = 50_000; // 50s — stay under typical 60s proxy timeout

export async function POST(request: NextRequest) {
  const rateLimited = enforceMinIntervalRateLimit(request, {
    intervalMs: 10_000,
    keyPrefix: 'voice-design',
  });
  if (rateLimited) return rateLimited;

  let taskId: string | undefined;
  let createdTask: any;

  try {
    const { text, voiceDescription, style } = await request.json();

    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';

    if (!apiKey || apiKey === 'your_api_key_here') {
      return respErr('MIMO_API_KEY is not configured');
    }

    if (!text || typeof text !== 'string') {
      return respErr('No text provided');
    }

    if (text.length > 50000) {
      return respErr('Text too long. Maximum 50,000 characters allowed.');
    }

    if (!voiceDescription || typeof voiceDescription !== 'string') {
      return respErr('Voice description is required');
    }

    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in to design a voice');
    }

    const charCount = text.length;
    const creditsNeeded = charCount * CREDITS_PER_CHAR;

    const remaining = await getRemainingCredits(user.id);
    if (remaining < creditsNeeded) {
      return respErr(
        `Insufficient credits. Need ${creditsNeeded}, have ${remaining}. Each character costs ${CREDITS_PER_CHAR} credit.`
      );
    }

    // Create AI task record
    taskId = getUuid();
    createdTask = await createAITask({
      id: taskId,
      userId: user.id,
      mediaType: 'audio',
      provider: 'mimo',
      model: 'mimo-v2.5-tts-voicedesign',
      prompt: text,
      options: JSON.stringify({ voiceDescription, style }),
      status: 'processing',
      costCredits: creditsNeeded,
      scene: 'voice_design',
    });

    // Process chunks with time budget to avoid proxy timeout
    const startTime = Date.now();
    const chunks = splitText(text).filter((c) => c.length > 0);
    const processedChunks: string[] = [];

    let status = 'processing';
    let audioData: string | null = null;

    for (let i = 0; i < chunks.length; i++) {
      if (Date.now() - startTime > PROCESSING_TIME_BUDGET_MS) {
        status = 'paused';
        break;
      }

      const audio = await callVoiceDesign(
        chunks[i],
        voiceDescription,
        style,
        apiKey,
        baseUrl
      );
      processedChunks.push(audio);

      // Save progress periodically
      if ((i + 1) % 2 === 0 || i === chunks.length - 1) {
        await updateAITaskById(taskId, {
          processedChunks: JSON.stringify(processedChunks),
          totalChunks: chunks.length,
        });
      }
    }

    // If all chunks processed, merge audio
    if (status === 'processing' && processedChunks.length === chunks.length) {
      audioData = mergeWavBase64(processedChunks);
      status = 'success';
    }

    // Update task status
    await updateAITaskById(taskId, {
      status,
      audioData,
      processedChunks:
        status === 'paused' ? JSON.stringify(processedChunks) : null,
      totalChunks: chunks.length,
      taskResult: JSON.stringify({}),
    });

    return respData({
      taskId,
      status,
      progress: {
        current: processedChunks.length,
        total: chunks.length,
      },
      audio: audioData,
    });
  } catch (err: any) {
    console.error('Voice design failed:', err);

    if (taskId) {
      try {
        await updateAITaskById(taskId, {
          status: 'failed',
          creditId: createdTask?.creditId,
          taskInfo: JSON.stringify({ errorMessage: err.message }),
        });
      } catch (updateErr) {
        console.error('Failed to update task status:', updateErr);
      }
    }

    if (err.message === 'CONTENT_FILTERED') {
      return respErr(
        'Content moderation failed. Please modify your text and try again.'
      );
    }

    return respErr(err?.message || 'An error occurred. Please try again.');
  }
}
