'use client';

import { cn } from '@/shared/lib/utils';
import type { Tab } from '../types';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

function TabButton({ active, onClick, children, icon }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground/70',
      )}
    >
      {icon}
      <span className="font-medium">{children}</span>
      {active && (
        <span className="bg-primary absolute top-0 left-2 right-2 h-0.5 rounded-full" />
      )}
    </button>
  );
}

interface TTSMobileTabsProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function TTSMobileTabs({ active, onChange }: TTSMobileTabsProps) {
  return (
    <nav
      className="bg-background border-border fixed right-0 bottom-0 left-0 z-40 border-t lg:hidden"
      aria-label="TTS mode"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg">
        <TabButton
          active={active === 'preset'}
          onClick={() => onChange('preset')}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          }
        >
          Preset
        </TabButton>
        <TabButton
          active={active === 'design'}
          onClick={() => onChange('design')}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
        >
          Design
        </TabButton>
        <TabButton
          active={active === 'clone'}
          onClick={() => onChange('clone')}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          }
        >
          Clone
        </TabButton>
        <TabButton
          active={active === 'ebook'}
          onClick={() => onChange('ebook')}
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        >
          Ebook
        </TabButton>
      </div>
    </nav>
  );
}
