'use client';

import { useCallback, useRef } from 'react';
import { Download, Play } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import type { EbookChapter, EbookResult } from '../types';

interface ChapterSelectorProps {
  chapters: EbookChapter[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
}

export function ChapterSelector({
  chapters,
  selected,
  onToggle,
  onToggleAll,
}: ChapterSelectorProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-foreground/80 text-sm font-medium">
          Chapters ({selected.size}/{chapters.length} selected)
        </label>
        <button
          onClick={onToggleAll}
          className="text-primary cursor-pointer text-xs hover:underline"
          type="button"
        >
          {selected.size === chapters.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      <div className="border-border bg-card divide-border max-h-60 divide-y overflow-y-auto rounded-lg border">
        {chapters.map((ch) => (
          <label
            key={ch.id}
            className="hover:bg-primary/5 flex cursor-pointer items-center gap-3 px-3 py-2"
          >
            <input
              type="checkbox"
              checked={selected.has(ch.id)}
              onChange={() => onToggle(ch.id)}
              className="accent-primary"
            />
            <span className="flex-1 truncate text-sm">{ch.title}</span>
            <span className="text-muted-foreground text-xs">
              {ch.wordCount.toLocaleString()} words
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface ChapterResultsProps {
  results: EbookResult[];
  onPlay: (audio: string) => void;
  onDownload: (title: string, audio: string) => void;
}

export function ChapterResults({
  results,
  onPlay,
  onDownload,
}: ChapterResultsProps) {
  return (
    <div className="space-y-3">
      <label className="text-foreground/80 block text-sm font-medium">
        Generated Audio ({results.length} chapters)
      </label>
      {results.map((r) => (
        <div key={r.id} className="bg-card border-border rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="truncate text-sm font-medium">{r.title}</span>
            <div className="flex gap-2">
              <button
                onClick={() => onPlay(r.audio)}
                className="text-primary inline-flex cursor-pointer items-center gap-1 text-xs hover:underline"
                type="button"
              >
                <Play className="h-3 w-3" />
                Play
              </button>
              <button
                onClick={() => onDownload(r.title, r.audio)}
                className="text-primary inline-flex cursor-pointer items-center gap-1 text-xs hover:underline"
                type="button"
              >
                <Download className="h-3 w-3" />
                Download
              </button>
            </div>
          </div>
          <audio
            controls
            src={`data:audio/wav;base64,${r.audio}`}
            className="w-full"
            preload="none"
          />
        </div>
      ))}
    </div>
  );
}
