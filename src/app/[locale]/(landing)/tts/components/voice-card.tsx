'use client';

import { cn } from '@/shared/lib/utils';
import { Play, Pause } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { VoiceOption } from '../types';

interface VoiceCardProps {
  voice: VoiceOption;
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
}

export function VoiceCard({ voice, isSelected, onSelect, className }: VoiceCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        audioRef.current = null;
        return;
      }
      const audio = new Audio(`/voices/${voice.id}.wav`);
      audio.onended = () => { setIsPlaying(false); audioRef.current = null; };
      audio.play();
      audioRef.current = audio;
      setIsPlaying(true);
    },
    [voice.id],
  );

  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={cn(
        'relative flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.98]',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50 hover:shadow-sm',
        className,
      )}
      role="radio"
      tabIndex={0}
      aria-checked={isSelected}
      aria-label={`${voice.label} - ${voice.description}`}
    >
      <span className="text-foreground text-sm font-medium">{voice.label}</span>
      <span className="text-muted-foreground text-xs">{voice.description}</span>
      <button
        onClick={handlePlay}
        className={cn(
          'absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors',
          isPlaying
            ? 'bg-primary text-primary-foreground'
            : 'bg-primary/10 text-primary hover:bg-primary/20',
        )}
        aria-label={isPlaying ? `Stop preview of ${voice.label}` : `Preview ${voice.label}`}
      >
        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="ml-0.5 h-3 w-3" />}
      </button>
    </div>
  );
}
