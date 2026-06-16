'use client';

import { cn } from '@/shared/lib/utils';
import { Loader2 } from 'lucide-react';

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
          'bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-all active:scale-[0.98]',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
        {isProcessing ? (processingLabel || label) : label}
      </button>
      {creditCost && (
        <p className="text-muted-foreground text-center text-xs">{creditCost}</p>
      )}
    </div>
  );
}
