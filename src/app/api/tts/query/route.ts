import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { findAITaskById } from '@/shared/models/ai_task';

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

    return respData({
      id: task.id,
      status: task.status,
      audio: task.audioData,
      progress: {
        current: task.processedChunks
          ? JSON.parse(task.processedChunks).length
          : task.status === 'success'
          ? task.totalChunks
          : 0,
        total: task.totalChunks,
      },
      createdAt: task.createdAt,
    });
  } catch (err) {
    console.error('Query task failed:', err);
    return respErr('An error occurred. Please try again.');
  }
}
