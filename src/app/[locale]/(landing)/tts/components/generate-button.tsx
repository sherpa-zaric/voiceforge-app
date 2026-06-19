'use client';

import { Loader2 } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
  label: string;
  processingLabel?: string;
  creditCost?: string;
  className?: string;
}

export function GenerateButton({
  onClick,
  disabled = false,
  isProcessing = false,
  label,
  processingLabel,
  creditCost,
  className,
}: GenerateButtonProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-semibold transition-all active:scale-[0.98]',
          'from-primary via-primary/90 to-primary text-primary-foreground shadow-primary/25 bg-gradient-to-r shadow-lg',
          'hover:shadow-primary/30 hover:scale-[1.02] hover:shadow-xl',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-lg'
        )}
      >
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
        {isProcessing ? processingLabel || label : label}
      </button>
      {creditCost && (
        <p className="text-muted-foreground text-center text-xs">
          {creditCost}
        </p>
      )}
    </div>
  );
}
