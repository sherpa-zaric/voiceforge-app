import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
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
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'border border-gray-200 bg-gray-50 text-gray-700'}`}
    >
      {status}
    </span>
  );
}

// Task Card Component
function TaskCard({ task }: { task: AITask }) {
  const taskResult = safeJsonParse(task.taskResult);
  const fieldBriefReport =
    task.mediaType === 'text' ? taskResult?.report : null;

  const formatDate = (date: Date | number | string) => {
    const d =
      date instanceof Date
        ? date
        : new Date(typeof date === 'number' ? date : String(date));
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
          {task.prompt.length > 100
            ? task.prompt.slice(0, 100) + '...'
            : task.prompt}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {task.scene || task.model} • {task.costCredits} credits
        </p>
      </div>

      {/* FieldBrief reports */}
      {fieldBriefReport && (
        <div className="border-border bg-muted/30 mb-3 rounded-md border p-3">
          <p className="text-foreground text-sm font-medium">
            {fieldBriefReport.title}
          </p>
          <p className="text-muted-foreground mt-2 line-clamp-3 text-xs leading-5">
            {fieldBriefReport.summary}
          </p>
          {fieldBriefReport.actions?.length > 0 && (
            <div className="mt-3">
              <p className="text-muted-foreground text-xs font-medium">
                Next action
              </p>
              <p className="text-foreground mt-1 text-xs leading-5">
                {fieldBriefReport.actions[0]}
              </p>
            </div>
          )}
          {fieldBriefReport.markdown && (
            <a
              href={`data:text/markdown;charset=utf-8,${encodeURIComponent(fieldBriefReport.markdown)}`}
              download={`${task.scene || 'fieldbrief-report'}.md`}
              className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1.5 text-xs transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Markdown
            </a>
          )}
        </div>
      )}

      {/* Audio transcription results */}
      {task.mediaType === 'audio' && taskResult?.text && (
        <div className="border-border bg-muted/30 mb-3 rounded-md border p-3">
          <p className="text-foreground text-sm font-medium">Transcription</p>
          <p className="text-muted-foreground mt-2 line-clamp-4 text-xs leading-5">
            {taskResult.text}
          </p>
        </div>
      )}

      {/* Error message for failed tasks */}
      {task.status === 'failed' && task.taskInfo && (
        <div className="mb-3 rounded-md bg-red-50 p-3">
          <p className="text-xs text-red-600">
            {safeJsonParse(task.taskInfo)?.errorMessage || 'Generation failed'}
          </p>
        </div>
      )}

      {/* Status, Time and Action */}
      <div className="flex items-center justify-between">
        <StatusBadge status={task.status} />
        <div className="flex items-center gap-2">
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

  const mediaType = type && type !== 'all' ? type : undefined;

  const aiTasks = await getAITasks({
    userId: user.id,
    mediaType,
    page,
    limit,
  });

  const total = await getAITasksCount({
    userId: user.id,
    mediaType,
  });

  const tabs = [
    {
      name: 'all',
      title: 'All',
      url: '/activity/ai-tasks',
      is_active: !type || type === 'all',
    },
    {
      name: 'text',
      title: 'Reports',
      url: '/activity/ai-tasks?type=text',
      is_active: type === 'text',
    },
    {
      name: 'audio',
      title: 'Audio',
      url: '/activity/ai-tasks?type=audio',
      is_active: type === 'audio',
    },
  ];

  return (
    <div className="bg-background min-h-screen">
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
              className={`border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                tab.is_active
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
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
                href={mediaType ? `/activity/ai-tasks?type=${mediaType}&page=${page - 1}` : `/activity/ai-tasks?page=${page - 1}`}
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
                href={mediaType ? `/activity/ai-tasks?type=${mediaType}&page=${page + 1}` : `/activity/ai-tasks?page=${page + 1}`}
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
