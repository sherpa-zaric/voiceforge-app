import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { findAITaskById, updateAITaskById } from '@/shared/models/ai_task';
import { callTTS, mergeWavBase64, splitText } from '@/shared/lib/tts';

const PROCESSING_TIME_BUDGET_MS = 240_000; // 4 minutes

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

    // Verify user owns this task
    if (task.userId !== user.id) {
      return respErr('Unauthorized');
    }

    // Only paused tasks can be continued
    if (task.status !== 'paused') {
      return respErr(`Task cannot be continued. Current status: ${task.status}`);
    }

    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';

    if (!apiKey || apiKey === 'your_api_key_here') {
      return respErr('MIMO_API_KEY is not configured');
    }

    // Parse task options
    const options = task.options ? JSON.parse(task.options) : {};
    const voice = options.voice || 'Mia';
    const style = options.style;

    // Get processed chunks
    const processedChunks: string[] = task.processedChunks
      ? JSON.parse(task.processedChunks)
      : [];

    // Split text and get remaining chunks
    const chunks = splitText(task.prompt).filter((c) => c.length > 0);
    const startIndex = processedChunks.length;

    // Update status to processing
    await updateAITaskById(taskId, { status: 'processing' });

    // Continue processing with time budget
    const startTime = Date.now();
    let status = 'processing';
    let audioData: string | null = null;

    for (let i = startIndex; i < chunks.length; i++) {
      // Check time budget
      if (Date.now() - startTime > PROCESSING_TIME_BUDGET_MS) {
        status = 'paused';
        break;
      }

      // Process chunk
      const audio = await callTTS(
        chunks[i],
        voice,
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
    });

    return respData({
      id: task.id,
      status,
      progress: {
        current: processedChunks.length,
        total: chunks.length,
      },
      audio: audioData,
    });
  } catch (err) {
    console.error('Continue task failed:', err);
    return respErr(`Request failed: ${err}`);
  }
}
