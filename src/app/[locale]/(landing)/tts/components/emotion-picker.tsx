'use client';

import { cn } from '@/shared/lib/utils';
import type { StyleOption } from '../types';

interface EmotionPickerProps {
  styles: StyleOption[];
  selected: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function EmotionPicker({ styles, selected, onSelect, className }: EmotionPickerProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="radiogroup" aria-label="Emotion style">
      {styles.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          role="radio"
          aria-checked={selected === s.id}
          className={cn(
            'cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            selected === s.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50 border',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
