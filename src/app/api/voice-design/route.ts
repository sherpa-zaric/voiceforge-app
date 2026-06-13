import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUuid } from '@/shared/lib/hash';
import { callVoiceDesign, mergeWavBase64, splitText } from '@/shared/lib/tts';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import { createAITask, updateAITaskById } from '@/shared/models/ai_task';

const CREDITS_PER_CHAR = 2;

export async function POST(request: NextRequest) {
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

    const chunks = splitText(text).filter((c) => c.length > 0);
    const audioChunks: string[] = [];
    for (const chunk of chunks) {
      const audio = await callVoiceDesign(
        chunk,
        voiceDescription,
        style,
        apiKey,
        baseUrl
      );
      audioChunks.push(audio);
    }
    const merged = mergeWavBase64(audioChunks);

    // Update task status to success
    await updateAITaskById(taskId, {
      status: 'success',
      audioData: merged,
      taskResult: JSON.stringify({}),
    });

    return respData({ audio: merged });
  } catch (err: any) {
    console.error('Voice design failed:', err);

    // Update task status to failed
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
