export type Tab = 'preset' | 'design' | 'clone' | 'ebook';
export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface VoiceOption {
  id: string;
  label: string;
  description: string;
}

export interface StyleOption {
  id: string;
  label: string;
  tag: string;
}

export interface DesignPreset {
  id: string;
  label: string;
  description: string;
}

export interface EbookChapter {
  id: number;
  title: string;
  text: string;
  wordCount: number;
}

export interface EbookResult {
  id: number;
  title: string;
  audio: string;
}
