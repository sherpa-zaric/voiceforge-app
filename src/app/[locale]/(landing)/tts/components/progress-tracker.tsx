'use client';

interface ProgressTrackerProps {
  current: number;
  total: number;
  label?: string;
  showCancel?: boolean;
  onCancel?: () => void;
}

export function ProgressTracker({
  current,
  total,
  label = 'Generating',
  showCancel = true,
  onCancel,
}: ProgressTrackerProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-3" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
      <div className="text-primary flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">
            {label}... ({current}/{total} chunks)
          </span>
        </div>
        {showCancel && onCancel && (
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="bg-card h-2 w-full rounded-full overflow-hidden">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
