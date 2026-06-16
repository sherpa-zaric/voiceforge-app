'use client';

import { cn } from '@/shared/lib/utils';
import type { Status } from '../types';

interface StatusMessageProps {
  status: Status;
  error: string | null;
  className?: string;
}

export function StatusMessage({ status, error, className }: StatusMessageProps) {
  if (status === 'loading') {
    return (
      <div className={cn('text-primary mt-4 flex items-center gap-2', className)} role="status">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm">Generating audio...</span>
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div
        className={cn(
          'bg-destructive/10 border-destructive/30 text-destructive rounded-lg border p-3 text-sm',
          className,
        )}
        role="alert"
      >
        {error}
      </div>
    );
  }

  return null;
}
