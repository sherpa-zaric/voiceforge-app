'use client';

import { cn } from '@/shared/lib/utils';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

interface ConfigSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function ConfigSheet({ open, onClose, title = 'Configuration', children }: ConfigSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="bg-background/80 fixed inset-0 z-50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'bg-background border-border fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] overflow-y-auto rounded-t-2xl border p-4 shadow-lg lg:hidden',
        )}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer rounded-full p-1 transition-colors"
            aria-label="Close configuration"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
