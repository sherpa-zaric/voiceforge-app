import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import {
  callTTS,
  callVoiceDesign,
  mergeWavBase64,
  splitText,
} from '@/shared/lib/tts';
import {
  VOICE_DESCRIPTIONS,
  type VoiceSegment,
} from '@/shared/lib/voice-segments';
import { findAITaskById, updateAITaskById } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';

const PROCESSING_TIME_BUDGET_MS = 110_000; // 110s — under Vercel's 120s maxDuration

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return respErr('Task ID is required');
    }

    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in');
    }

    const task = await findAITaskById(taskId);
    if (!task) {
      return respErr('Task not found');
    }

    if (task.userId !== user.id) {
      return respErr('Unauthorized');
    }

    if (task.status !== 'paused') {
      return respErr(
        `Task cannot be continued. Current status: ${task.status}`
      );
    }

    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';

    if (!apiKey || apiKey === 'your_api_key_here') {
      return respErr('MIMO_API_KEY is not configured');
    }

    const options = task.options ? JSON.parse(task.options) : {};
    const style = options.style;

    // Get processed chunks
    const processedChunks: string[] = task.processedChunks
      ? JSON.parse(task.processedChunks)
      : [];

    // Determine task type: voice-design (segments) vs plain TTS
    const segments: VoiceSegment[] | null = options.segments || null;
    let items: { text: string; voice: string }[];
    let totalChunks: number;

    if (segments) {
      // Voice-design: each segment has its own voice
      items = segments.map((s) => ({ text: s.text, voice: s.voice }));
      totalChunks = segments.length;
    } else {
      // Plain TTS: split text, all same voice
      const voice = options.voice || 'Mia';
      const chunks = splitText(task.prompt).filter((c) => c.length > 0);
      items = chunks.map((c) => ({ text: c, voice }));
      totalChunks = chunks.length;
    }

    const startIndex = processedChunks.length;

    await updateAITaskById(taskId, { status: 'processing' });

    const startTime = Date.now();
    let status = 'processing';
    let audioData: string | null = null;

    for (let i = startIndex; i < items.length; i++) {
      if (Date.now() - startTime > PROCESSING_TIME_BUDGET_MS) {
        status = 'paused';
        break;
      }

      const { text, voice } = items[i];
      let audio: string;
      if (segments) {
        // Voice-design: use voicedesign model with description
        const voiceDesc = VOICE_DESCRIPTIONS[voice] || VOICE_DESCRIPTIONS.Mia;
        audio = await callVoiceDesign(text, voiceDesc, style, apiKey, baseUrl);
      } else {
        // Plain TTS: use standard model
        audio = await callTTS(text, voice, style, apiKey, baseUrl);
      }
      processedChunks.push(audio);

      if ((i + 1) % 3 === 0 || i === items.length - 1) {
        await updateAITaskById(taskId, {
          processedChunks: JSON.stringify(processedChunks),
          totalChunks,
        });
      }
    }

    if (status === 'processing' && processedChunks.length === items.length) {
      audioData = mergeWavBase64(processedChunks);
      status = 'success';
    }

    await updateAITaskById(taskId, {
      status,
      audioData,
      processedChunks:
        status === 'paused' ? JSON.stringify(processedChunks) : null,
      totalChunks,
    });

    return respData({
      id: task.id,
      status,
      progress: {
        current: processedChunks.length,
        total: totalChunks,
      },
      audio: audioData,
    });
  } catch (err) {
    console.error('Continue task failed:', err);
    return respErr('An error occurred. Please try again.');
  }
}
