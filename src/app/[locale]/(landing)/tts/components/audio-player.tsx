'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

interface AudioPlayerProps {
  src: string;
  title?: string;
  className?: string;
  showDownload?: boolean;
  downloadFileName?: string;
}

export function AudioPlayer({
  src,
  title,
  className,
  showDownload = true,
  downloadFileName,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Draw waveform — runs once, reads live state from audio element
  useEffect(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;

    // Cache theme colors once
    const cs = getComputedStyle(document.documentElement);
    const playedColor = cs.getPropertyValue('--primary').trim() || '#7C3AED';
    const unplayedColor = cs.getPropertyValue('--border').trim() || '#e2e8f0';

    const drawWaveform = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = 3;
      const gap = 1;
      const totalBars = Math.floor(width / (barWidth + gap));
      const midY = height / 2;
      const dur = audio.duration || 0;
      const cur = audio.currentTime;

      for (let i = 0; i < totalBars; i++) {
        const t = i / totalBars;
        const isPlayed = dur > 0 && t < cur / dur;
        const barHeight = Math.abs(
          Math.sin(t * Math.PI * 8) * (height * 0.4) + height * 0.15
        );

        ctx.fillStyle = isPlayed ? playedColor : unplayedColor;
        ctx.fillRect(
          i * (barWidth + gap),
          midY - barHeight / 2,
          barWidth,
          barHeight
        );
      }
    };

    drawWaveform();

    let rafId: number;
    const handleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(drawWaveform);
    };

    audio.addEventListener('timeupdate', handleUpdate);
    return () => {
      audio.removeEventListener('timeupdate', handleUpdate);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = src;
    link.download = downloadFileName || 'audio.wav';
    link.click();
  }, [src, downloadFileName]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-3 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-center',
        className
      )}
      role="region"
      aria-label={title || 'Audio player'}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors active:scale-90"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" />
        )}
      </button>

      {/* Progress + Waveform */}
      <div className="flex flex-1 flex-col gap-1.5">
        {title && <div className="truncate text-sm font-medium">{title}</div>}

        {/* Waveform */}
        <canvas
          ref={canvasRef}
          className="h-10 w-full cursor-pointer rounded"
          width={300}
          height={40}
          onClick={(e) => {
            const canvas = canvasRef.current;
            const audio = audioRef.current;
            if (!canvas || !audio || !duration) return;

            const rect = canvas.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            audio.currentTime = ratio * duration;
          }}
          role="presentation"
        />

        {/* Range slider + Time display */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="bg-secondary [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary h-1 flex-1 cursor-pointer appearance-none rounded-lg [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
            aria-label="Seek position"
          />
          <span className="text-muted-foreground w-9 text-xs tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Download */}
      {showDownload && (
        <button
          onClick={handleDownload}
          className="text-muted-foreground hover:text-primary shrink-0 self-end transition-colors sm:self-center"
          aria-label="Download audio"
          title="Download"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
