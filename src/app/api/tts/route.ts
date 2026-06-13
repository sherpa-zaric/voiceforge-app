import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUuid } from '@/shared/lib/hash';
import { callTTS, mergeWavBase64, splitText } from '@/shared/lib/tts';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import { createAITask, updateAITaskById } from '@/shared/models/ai_task';

const CREDITS_PER_CHAR = 1;
const PROCESSING_TIME_BUDGET_MS = 240_000; // 4 minutes

export async function POST(request: NextRequest) {
  let taskId: string | undefined;
  let createdTask: any;

  try {
    const { text, voice, style, scene } = await request.json();

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

    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in to generate speech');
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
    const newAITask = {
      id: taskId,
      userId: user.id,
      mediaType: 'audio',
      provider: 'mimo',
      model: 'mimo-v2.5-tts',
      prompt: text,
      options: JSON.stringify({ voice: voice || 'Mia', style }),
      status: 'processing',
      costCredits: creditsNeeded,
      scene: scene || 'preset',
    };

    const createdTask = await createAITask(newAITask);

    // Start TTS processing with time budget
    const startTime = Date.now();
    const chunks = splitText(text).filter((c) => c.length > 0);
    const processedChunks: string[] = [];

    let status = 'processing';
    let audioData: string | null = null;

    for (let i = 0; i < chunks.length; i++) {
      // Check time budget
      if (Date.now() - startTime > PROCESSING_TIME_BUDGET_MS) {
        status = 'paused';
        break;
      }

      // Process chunk
      const audio = await callTTS(
        chunks[i],
        voice || 'Mia',
        style,
        apiKey,
        baseUrl
      );
      processedChunks.push(audio);

      // Save progress every 3 chunks
      if ((i + 1) % 3 === 0 || i === chunks.length - 1) {
        await updateAITaskById(taskId, {
          processedChunks: JSON.stringify(processedChunks),
          totalChunks: chunks.length,
        });
      }
    }

    // If completed, merge audio
    if (status === 'processing' && processedChunks.length === chunks.length) {
      audioData = mergeWavBase64(processedChunks);
      status = 'success';
    }

    // Update task status
    await updateAITaskById(taskId, {
      status,
      audioData,
      processedChunks: status === 'paused' ? JSON.stringify(processedChunks) : null,
      totalChunks: chunks.length,
      taskResult: JSON.stringify({
        duration: chunks.length * 2, // estimated duration
      }),
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
    console.error('TTS generation failed:', err);

    // Update task status to failed so it doesn't stay stuck in "processing"
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

    // Handle content filter rejection
    if (err.message === 'CONTENT_FILTERED') {
      return respErr('Content moderation failed. Please modify your text and try again.');
    }

    return respErr('An error occurred. Please try again.');
  }
}
