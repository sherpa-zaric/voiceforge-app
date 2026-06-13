import { getTranslations } from 'next-intl/server';

import { AudioPlayer, Empty } from '@/shared/blocks/common';
import { ContinueButton } from './continue-button';
import { AITask, getAITasks, getAITasksCount } from '@/shared/models/ai_task';
import { getUserInfo } from '@/shared/models/user';

function safeJsonParse(str: string | null | undefined): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    processing: 'bg-blue-50 text-blue-700 border border-blue-200',
    paused: 'bg-orange-50 text-orange-700 border border-orange-200',
    success: 'bg-green-50 text-green-700 border border-green-200',
    failed: 'bg-red-50 text-red-700 border border-red-200',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
      {status}
    </span>
  );
}

// Task Card Component
function TaskCard({ task }: { task: AITask }) {
  const formatDate = (date: Date | number | string) => {
    const d = date instanceof Date ? date : new Date(typeof date === 'number' ? date : String(date));
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  return (
    <div className="bg-card border-border rounded-lg border p-4 transition-shadow hover:shadow-md">
      {/* Task Info */}
      <div className="mb-3">
        <p className="text-foreground truncate text-sm font-medium">
          {task.prompt.length > 100 ? task.prompt.slice(0, 100) + '...' : task.prompt}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {task.model} • {task.costCredits} credits
        </p>
      </div>

      {/* Audio Player for TTS tasks */}
      {task.mediaType === 'audio' && task.audioData && (
        <div className="mb-3">
          <AudioPlayer
            src={task.audioData.startsWith('data:') ? task.audioData : `data:audio/wav;base64,${task.audioData}`}
            title="TTS Audio"
            className="w-full"
          />
          <a
            href={task.audioData.startsWith('data:') ? task.audioData : `data:audio/wav;base64,${task.audioData}`}
            download={`tts-audio-${task.id}.wav`}
            className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1.5 text-xs transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download WAV
          </a>
        </div>
      )}

      {/* Error message for failed tasks */}
      {task.status === 'failed' && task.taskInfo && (
        <div className="mb-3 rounded-md bg-red-50 p-3">
          <p className="text-red-600 text-xs">
            {safeJsonParse(task.taskInfo)?.errorMessage || 'Generation failed'}
          </p>
        </div>
      )}

      {/* Images for image tasks */}
      {task.mediaType === 'image' && task.taskInfo && (
        <div className="mb-3">
          {(() => {
            const taskInfo = safeJsonParse(task.taskInfo);
            if (taskInfo.images && taskInfo.images.length > 0) {
              return (
                <div className="flex gap-2 overflow-x-auto">
                  {taskInfo.images.map((image: any, index: number) => (
                    <img
                      key={index}
                      src={image.imageUrl}
                      alt="Generated image"
                      className="h-24 w-auto flex-shrink-0 rounded"
                    />
                  ))}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Music for audio tasks */}
      {task.mediaType === 'music' && task.taskInfo && (
        <div className="mb-3">
          {(() => {
            const taskInfo = safeJsonParse(task.taskInfo);
            if (taskInfo.songs && taskInfo.songs.length > 0) {
              return (
                <div className="space-y-2">
                  {taskInfo.songs.filter((s: any) => s.audioUrl).map((song: any) => (
                    <div key={song.id}>
                      <AudioPlayer
                        src={song.audioUrl}
                        title={song.title}
                        className="w-full"
                      />
                      <a
                        href={song.audioUrl}
                        download={`${song.title || 'audio'}.mp3`}
                        className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1.5 text-xs transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Status, Time and Action */}
      <div className="flex items-center justify-between">
        <StatusBadge status={task.status} />
        <div className="flex items-center gap-2">
          {task.status === 'paused' && (
            <ContinueButton taskId={task.id} />
          )}
          <span className="text-muted-foreground text-xs">
            {formatDate(task.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default async function AiTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: number; pageSize?: number; type?: string }>;
}) {
  const { page: pageNum, pageSize, type } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('activity.ai-tasks');

  const aiTasks = await getAITasks({
    userId: user.id,
    mediaType: type,
    page,
    limit,
  });

  const total = await getAITasksCount({
    userId: user.id,
    mediaType: type,
  });

  const tabs = [
    { name: 'all', title: 'All', url: '/activity/ai-tasks', is_active: !type || type === 'all' },
    { name: 'music', title: 'Music', url: '/activity/ai-tasks?type=music', is_active: type === 'music' },
    { name: 'image', title: 'Image', url: '/activity/ai-tasks?type=image', is_active: type === 'image' },
    { name: 'video', title: 'Video', url: '/activity/ai-tasks?type=video', is_active: type === 'video' },
    { name: 'audio', title: 'Audio', url: '/activity/ai-tasks?type=audio', is_active: type === 'audio' },
    { name: 'text', title: 'Text', url: '/activity/ai-tasks?type=text', is_active: type === 'text' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-foreground text-2xl font-bold">AI Tasks</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View and manage your AI-generated content
          </p>
        </div>

        {/* Tabs */}
        <div className="border-border mb-6 flex space-x-1 overflow-x-auto border-b">
          {tabs.map((tab) => (
            <a
              key={tab.name}
              href={tab.url}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab.is_active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.title}
            </a>
          ))}
        </div>

        {/* Task Grid */}
        {aiTasks.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {aiTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {page > 1 && (
              <a
                href={`/activity/ai-tasks?type=${type || 'all'}&page=${page - 1}`}
                className="bg-card border-border text-foreground hover:bg-accent rounded-lg border px-4 py-2 text-sm"
              >
                Previous
              </a>
            )}
            <span className="text-muted-foreground text-sm">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            {page < Math.ceil(total / limit) && (
              <a
                href={`/activity/ai-tasks?type=${type || 'all'}&page=${page + 1}`}
                className="bg-card border-border text-foreground hover:bg-accent rounded-lg border px-4 py-2 text-sm"
              >
                Next
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
