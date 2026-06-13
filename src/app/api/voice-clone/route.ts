import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUuid } from '@/shared/lib/hash';
import { callVoiceClone } from '@/shared/lib/tts';
import { consumeCredits, getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import { createAITask, updateAITaskById } from '@/shared/models/ai_task';

const CREDITS_PER_CHAR = 3;

export async function POST(request: NextRequest) {
  let taskId: string | undefined;

  try {
    const { text, audioBase64, mimeType, style } = await request.json();

    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';

    if (!apiKey || apiKey === 'your_api_key_here') {
      return respErr('MIMO_API_KEY is not configured');
    }

    if (!text || typeof text !== 'string') {
      return respErr('No text provided');
    }

    if (!audioBase64) {
      return respErr('Voice sample audio is required');
    }

    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in to clone a voice');
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
    await createAITask({
      id: taskId,
      userId: user.id,
      mediaType: 'audio',
      provider: 'mimo',
      model: 'mimo-v2.5-tts-voiceclone',
      prompt: text,
      options: JSON.stringify({ style }),
      status: 'processing',
      costCredits: creditsNeeded,
      scene: 'voice_clone',
    });

    const audio = await callVoiceClone(
      text,
      audioBase64,
      mimeType || 'audio/wav',
      style,
      apiKey,
      baseUrl
    );

    // Update task status to success
    await updateAITaskById(taskId, {
      status: 'success',
      audioData: audio,
      taskResult: JSON.stringify({}),
    });

    // Consume credits
    await consumeCredits({
      userId: user.id,
      userEmail: user.email,
      credits: creditsNeeded,
      scene: 'voice_clone',
      description: `Voice Clone: ${charCount} chars`,
    });

    return respData({ audio });
  } catch (err: any) {
    console.error('Voice clone failed:', err);

    // Update task status to failed
    if (taskId) {
      try {
        await updateAITaskById(taskId, {
          status: 'failed',
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

    return respErr(`Request failed: ${err}`);
  }
}
