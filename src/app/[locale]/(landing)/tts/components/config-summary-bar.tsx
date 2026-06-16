'use client';

import { cn } from '@/shared/lib/utils';
import { Settings2 } from 'lucide-react';

interface ConfigSummaryBarProps {
  voice?: string;
  emotion?: string;
  onClick: () => void;
}

export function ConfigSummaryBar({ voice, emotion, onClick }: ConfigSummaryBarProps) {
  return (
    <button
      onClick={onClick}
      className="bg-card border-border text-foreground hover:bg-primary/5 flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors"
    >
      {voice || emotion ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {voice && (
            <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
              {voice}
            </span>
          )}
          {emotion && (
            <>
              <span className="text-muted-foreground">&middot;</span>
              <span className="text-muted-foreground shrink-0 text-xs font-medium">{emotion}</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 text-left">
          <span className="text-muted-foreground text-xs">Tap to configure voice settings</span>
        </div>
      )}
      <Settings2 className="text-muted-foreground h-4 w-4 shrink-0" />
    </button>
  );
}
