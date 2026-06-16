'use client';

import { cn } from '@/shared/lib/utils';
import { Upload, Mic } from 'lucide-react';
import { useCallback, useRef, useState, type DragEvent } from 'react';

interface FileUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  maxSize?: number;
  acceptLabel?: string;
  maxSizeLabel?: string;
  onValidate?: (file: File) => string | null;
  showRecord?: boolean;
  recording?: boolean;
  recordDuration?: number;
  onStartRecord?: () => void;
  onStopRecord?: () => void;
}

export function FileUploader({
  file,
  onFileChange,
  accept,
  maxSize,
  acceptLabel = 'Audio files',
  maxSizeLabel = 'Max 10 MB',
  onValidate,
  showRecord = false,
  recording = false,
  recordDuration = 0,
  onStartRecord,
  onStopRecord,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (f: File) => {
      setError(null);
      if (!f) return;

      if (maxSize && f.size > maxSize) {
        setError(`File exceeds ${maxSizeLabel}`);
        return;
      }

      if (onValidate) {
        const validationError = onValidate(f);
        if (validationError) { setError(validationError); return; }
      }

      onFileChange(f);
    },
    [maxSize, maxSizeLabel, onValidate, onFileChange],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: DragEvent) => { e.preventDefault(); setDragOver(false); }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'border-border flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          dragOver && 'border-primary bg-primary/5',
          file && 'border-primary/50 bg-primary/5',
        )}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {file ? (
          <div className="space-y-1">
            <Upload className="text-primary mx-auto h-6 w-6" />
            <p className="text-foreground text-sm font-medium">{file.name}</p>
            <p className="text-muted-foreground text-xs">{formatFileSize(file.size)}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileChange(null);
                setError(null);
              }}
              className="text-muted-foreground hover:text-foreground text-xs underline"
              type="button"
            >
              Remove
            </button>
          </div>
        ) : recording ? (
          <div className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
            </div>
            <p className="text-foreground text-sm font-medium">Recording...</p>
            <p className="text-muted-foreground text-xs">{formatDuration(recordDuration)}</p>
            <button
              onClick={(e) => { e.stopPropagation(); onStopRecord?.(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium"
              type="button"
            >
              Stop Recording
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="text-muted-foreground mx-auto h-8 w-8" />
            <p className="text-foreground text-sm font-medium">Drop your file here, or click to select</p>
            <p className="text-muted-foreground text-xs">
              {acceptLabel} &middot; {maxSizeLabel}
            </p>
          </div>
        )}
      </div>

      {/* Record button */}
      {showRecord && !file && !recording && (
        <button
          onClick={(e) => { e.stopPropagation(); onStartRecord?.(); }}
          className="text-muted-foreground hover:text-foreground mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border py-2 text-sm transition-colors"
          type="button"
        >
          <Mic className="h-4 w-4" />
          Record Voice Sample
        </button>
      )}

      {error && (
        <p className="text-destructive mt-2 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
