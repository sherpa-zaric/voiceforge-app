'use client';

import { cn } from '@/shared/lib/utils';

interface TextInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  maxChars?: number;
  showCharCount?: boolean;
  hint?: string;
  className?: string;
}

export function TextInputArea({
  value,
  onChange,
  label = 'Enter your text',
  placeholder = 'Type or paste your text here...',
  rows = 4,
  maxChars,
  showCharCount = false,
  hint,
  className,
}: TextInputAreaProps) {
  const charCount = value.length;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between">
        <label className="text-foreground/80 block text-sm font-medium">
          {label}
        </label>
        {(showCharCount || maxChars) && (
          <span
            className={cn(
              'text-xs',
              maxChars && charCount > maxChars
                ? 'text-destructive'
                : 'text-muted-foreground'
            )}
          >
            {charCount}
            {maxChars ? ` / ${maxChars}` : ''}
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/20 min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-4 font-sans text-sm leading-relaxed transition-colors outline-none focus:ring-2"
        aria-label={label}
      />
      {hint && <p className="text-muted-foreground px-1 text-xs">{hint}</p>}
    </div>
  );
}
