'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppContext } from '@/shared/contexts/app';

import { AudioPlayer } from './components/audio-player';
import { ChapterResults, ChapterSelector } from './components/chapter-selector';
import { ConfigSheet } from './components/config-sheet';
import { ConfigSummaryBar } from './components/config-summary-bar';
import { DesignPresets } from './components/design-preset';
import { EmotionPicker } from './components/emotion-picker';
import { FileUploader } from './components/file-uploader';
import { GenerateButton } from './components/generate-button';
import { ProgressTracker } from './components/progress-tracker';
import { StatusMessage } from './components/status-message';
import { TextInputArea } from './components/text-input-area';
import { TTSMobileTabs } from './components/tts-mobile-tabs';
import { VoiceCard } from './components/voice-card';
import {
  DESIGN_PRESETS,
  fileToBase64,
  MAX_EBOOK_SIZE,
  MAX_FILE_SIZE,
  STYLES,
  VOICES,
  webmToWav,
} from './constants';
import type { EbookChapter, EbookResult, Status, Tab } from './types';

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 cursor-pointer px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground/70'
      }`}
    >
      {children}
      {active && (
        <span className="bg-primary absolute right-2 bottom-0 left-2 h-0.5 rounded-full" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Preset Voices Tab
// ---------------------------------------------------------------------------

function PresetTabContent({
  voice,
  setVoice,
  style,
  setStyle,
}: {
  voice: string;
  setVoice: (v: string) => void;
  style: string;
  setStyle: (s: string) => void;
}) {
  const { user, setIsShowSignModal } = useAppContext();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const pollTaskStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/tts/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: id }),
      });
      const data = await res.json();
      if (data.code !== 0)
        throw new Error(data.message || 'Failed to query task');

      const task = data.data;
      setProgress(task.progress);

      if (task.status === 'success') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (task.audio) setAudioSrc(`data:audio/wav;base64,${task.audio}`);
        setStatus('success');
        setTaskId(null);
      } else if (task.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setError('Task failed');
        setStatus('error');
        setTaskId(null);
      } else if (task.status === 'paused') {
        const continueRes = await fetch('/api/tts/continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: id }),
        });
        const continueData = await continueRes.json();
        if (continueData.code !== 0)
          throw new Error(continueData.message || 'Failed to continue task');
        setProgress(continueData.data.progress);
      }
    } catch (err) {
      console.error('Poll task failed:', err);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    setStatus('loading');
    setError(null);
    setAudioSrc(null);
    setProgress({ current: 0, total: 0 });

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice,
          style: style || undefined,
        }),
      });
      if (res.status === 429) {
        const data = await res.json();
        throw new Error(
          data.message ||
            'Too many requests. Please wait a few seconds and try again.'
        );
      }
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.message || 'Generation failed');

      const task = data.data;
      setTaskId(task.taskId);
      setProgress(task.progress);

      if (task.status === 'success') {
        if (task.audio) setAudioSrc(`data:audio/wav;base64,${task.audio}`);
        setStatus('success');
        setTaskId(null);
      } else if (task.status === 'processing' || task.status === 'paused') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(
          () => pollTaskStatus(task.taskId),
          2000
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [text, voice, style, user, setIsShowSignModal, pollTaskStatus]);

  const isProcessing = status === 'loading' || taskId !== null;

  return (
    <div className="space-y-5">
      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Voice
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VOICES.map((v) => (
            <VoiceCard
              key={v.id}
              voice={v}
              isSelected={voice === v.id}
              onSelect={() => setVoice(v.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Emotion / Style
        </label>
        <EmotionPicker styles={STYLES} selected={style} onSelect={setStyle} />
      </div>

      <TextInputArea
        value={text}
        onChange={setText}
        label="Text to speak"
        placeholder="Type what you want the voice to say..."
        hint={
          text.length > 2500
            ? 'Long text will be automatically split and merged.'
            : undefined
        }
      />

      <GenerateButton
        onClick={handleGenerate}
        disabled={isProcessing || !text.trim()}
        isProcessing={isProcessing}
        label="Generate Speech"
        creditCost="1 credit per character"
      />

      {isProcessing && progress.total > 0 && (
        <ProgressTracker current={progress.current} total={progress.total} />
      )}
      <StatusMessage status={status} error={error} />
      {audioSrc && (
        <AudioPlayer src={audioSrc} downloadFileName="vocalvia-speech.wav" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice Design Tab
// ---------------------------------------------------------------------------

function DesignTabContent({
  style,
  setStyle,
}: {
  style: string;
  setStyle: (s: string) => void;
}) {
  const { user, setIsShowSignModal } = useAppContext();
  const [text, setText] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(
    null
  );
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const pollTaskStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/tts/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: id }),
      });
      const data = await res.json();
      if (data.code !== 0)
        throw new Error(data.message || 'Failed to query task');

      const task = data.data;
      setProgress(task.progress);
      if (task.estimatedDurationSeconds) {
        setEstimatedDuration(task.estimatedDurationSeconds);
      }

      if (task.status === 'success') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (task.audio) setAudioSrc(`data:audio/wav;base64,${task.audio}`);
        setStatus('success');
        setTaskId(null);
      } else if (task.status === 'failed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setError('Task failed');
        setStatus('error');
        setTaskId(null);
      } else if (task.status === 'paused') {
        const continueRes = await fetch('/api/tts/continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: id }),
        });
        const continueData = await continueRes.json();
        if (continueData.code !== 0)
          throw new Error(continueData.message || 'Failed to continue task');
        setProgress(continueData.data.progress);
      }
    } catch (err) {
      console.error('Poll task failed:', err);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim() || !voiceDescription.trim()) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    setStatus('loading');
    setError(null);
    setAudioSrc(null);
    setProgress({ current: 0, total: 0 });

    try {
      const res = await fetch('/api/voice-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceDescription: voiceDescription.trim(),
          style: style || undefined,
        }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message ||
            'Too many requests. Please wait a few seconds and try again.'
        );
      }
      if (res.status === 504) {
        throw new Error(
          'Server timeout. The text may be too long. Try shorter text or split it into parts.'
        );
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(
          `Server error (${res.status}): ${errText.slice(0, 200) || 'Please try again.'}`
        );
      }
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.message || 'Generation failed');

      const task = data.data;
      setTaskId(task.taskId);
      setProgress(task.progress);
      if (task.estimatedDurationSeconds) {
        setEstimatedDuration(task.estimatedDurationSeconds);
      }

      if (task.status === 'success') {
        if (task.audio) setAudioSrc(`data:audio/wav;base64,${task.audio}`);
        setStatus('success');
        setTaskId(null);
      } else if (task.status === 'processing' || task.status === 'paused') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(
          () => pollTaskStatus(task.taskId),
          2000
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [text, voiceDescription, style, user, setIsShowSignModal, pollTaskStatus]);

  const isProcessing = status === 'loading' || taskId !== null;

  return (
    <div className="space-y-5">
      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Quick Presets
        </label>
        <DesignPresets
          presets={DESIGN_PRESETS}
          onSelect={setVoiceDescription}
        />
      </div>

      <TextInputArea
        value={voiceDescription}
        onChange={setVoiceDescription}
        label="Voice Description"
        placeholder='e.g. "Warm British narrator, middle-aged, with a slight rasp"'
        rows={3}
        hint="Describe the voice you want in plain English. The AI will create it."
      />

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Emotion / Style
        </label>
        <EmotionPicker styles={STYLES} selected={style} onSelect={setStyle} />
      </div>

      <TextInputArea
        value={text}
        onChange={setText}
        label="Text to speak"
        hint={
          text.length > 2500
            ? 'Long text will be automatically split and merged.'
            : undefined
        }
      />

      <GenerateButton
        onClick={handleGenerate}
        disabled={isProcessing || !text.trim() || !voiceDescription.trim()}
        isProcessing={isProcessing}
        label="Generate Voice"
        creditCost="2 credits per character"
      />

      {isProcessing && progress.total > 0 && (
        <div className="space-y-2">
          <ProgressTracker
            current={progress.current}
            total={progress.total}
            label={`Generating segments`}
          />
          {estimatedDuration && (
            <p className="text-muted-foreground text-center text-xs">
              Estimated time: ~
              {Math.ceil(
                estimatedDuration * (1 - progress.current / progress.total)
              )}
              s remaining
            </p>
          )}
        </div>
      )}
      <StatusMessage status={status} error={error} />
      {audioSrc && (
        <AudioPlayer
          src={audioSrc}
          downloadFileName="vocalvia-designed-voice.wav"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice Clone Tab
// ---------------------------------------------------------------------------

function CloneTabContent({
  style,
  setStyle,
}: {
  style: string;
  setStyle: (s: string) => void;
}) {
  const { user, setIsShowSignModal } = useAppContext();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validateFile = useCallback((f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (
      ext !== 'wav' &&
      ext !== 'mp3' &&
      ext !== 'webm' &&
      f.type !== 'audio/wav' &&
      f.type !== 'audio/mpeg' &&
      f.type !== 'audio/webm'
    ) {
      return 'Only WAV, MP3, and recorded audio are supported.';
    }
    return null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const wavFile = await webmToWav(blob);
        setFile(wavFile);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(
        () => setRecordDuration((d) => d + 1),
        1000
      );
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access in your browser settings.'
          : 'Failed to start recording. Please try again.'
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim() || !file) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    setStatus('loading');
    setError(null);
    setAudioSrc(null);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/voice-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          audioBase64: base64,
          mimeType: file.type || 'audio/wav',
          style: style || undefined,
        }),
      });
      if (res.status === 429) {
        const data = await res.json();
        throw new Error(
          data.message ||
            'Too many requests. Please wait a few seconds and try again.'
        );
      }
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.message || 'Generation failed');
      setAudioSrc(`data:audio/wav;base64,${data.data.audio}`);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [text, file, style, user, setIsShowSignModal]);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Voice Sample Audio
        </label>
        <FileUploader
          file={file}
          onFileChange={setFile}
          accept=".wav,.mp3,audio/wav,audio/mpeg"
          maxSize={MAX_FILE_SIZE}
          acceptLabel="WAV, MP3"
          maxSizeLabel="Max 10 MB"
          onValidate={validateFile}
          showRecord
          recording={recording}
          recordDuration={recordDuration}
          onStartRecord={startRecording}
          onStopRecord={stopRecording}
        />
      </div>

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Emotion / Style
        </label>
        <EmotionPicker styles={STYLES} selected={style} onSelect={setStyle} />
      </div>

      <TextInputArea
        value={text}
        onChange={setText}
        label="Text to speak"
        placeholder="Type what you want the cloned voice to say..."
        maxChars={2500}
        showCharCount
      />

      <GenerateButton
        onClick={handleGenerate}
        disabled={status === 'loading' || !text.trim() || !file}
        isProcessing={status === 'loading'}
        label="Clone & Generate"
        processingLabel="Cloning Voice..."
        creditCost="3 credits per character"
      />

      <StatusMessage status={status} error={error} />
      {audioSrc && (
        <AudioPlayer
          src={audioSrc}
          downloadFileName="vocalvia-cloned-voice.wav"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ebook Tab
// ---------------------------------------------------------------------------

function EbookTabContent({
  voice,
  setVoice,
}: {
  voice: string;
  setVoice: (v: string) => void;
}) {
  const { user, setIsShowSignModal } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [chapters, setChapters] = useState<EbookChapter[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<
    'idle' | 'parsing' | 'converting' | 'done'
  >('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<EbookResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const validateFile = useCallback((f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'epub' && ext !== 'txt')
      return 'Only EPUB and TXT files are supported.';
    return null;
  }, []);

  const handleParse = useCallback(async () => {
    if (!file) return;
    setStatus('parsing');
    setError(null);
    setChapters([]);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/ebook/parse', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.message || 'Parse failed');
      const parsed: EbookChapter[] = data.data.chapters.map(
        (c: EbookChapter) => ({
          id: c.id,
          title: c.title,
          text: c.text || '',
          wordCount: c.wordCount,
        })
      );
      setChapters(parsed);
      setSelected(new Set(parsed.map((c) => c.id)));
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('idle');
    }
  }, [file]);

  const toggleChapter = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === chapters.length) setSelected(new Set());
    else setSelected(new Set(chapters.map((c) => c.id)));
  }, [selected.size, chapters]);

  const handleConvert = useCallback(async () => {
    if (selected.size === 0) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    setStatus('converting');
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: selected.size });

    const selectedChapters = chapters.filter((c) => selected.has(c.id));
    let current = 0;
    for (const ch of selectedChapters) {
      setProgress({ current: current + 1, total: selectedChapters.length });
      try {
        const res = await fetch('/api/ebook/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: ch.text, voice }),
        });
        const data = await res.json();
        if (data.code !== 0) throw new Error(data.message || 'Convert failed');
        setResults((prev) => [
          ...prev,
          { id: ch.id, title: ch.title, audio: data.data.audio },
        ]);
      } catch (err) {
        setError(
          `Chapter "${ch.title}" failed: ${err instanceof Error ? err.message : 'Unknown'}`
        );
      }
      current++;
    }
    setStatus('done');
  }, [selected, chapters, voice, user, setIsShowSignModal]);

  const playPreview = useCallback((audioBase64: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
    previewAudioRef.current = audio;
    audio.play();
  }, []);

  const downloadChapter = useCallback((title: string, audioBase64: string) => {
    const link = document.createElement('a');
    link.href = `data:audio/wav;base64,${audioBase64}`;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
    link.click();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Upload Ebook
        </label>
        <FileUploader
          file={file}
          onFileChange={(f) => {
            setFile(f);
            setChapters([]);
            setSelected(new Set());
            setResults([]);
          }}
          accept=".epub,.txt"
          maxSize={MAX_EBOOK_SIZE}
          acceptLabel="EPUB, TXT"
          maxSizeLabel="Max 50 MB"
          onValidate={validateFile}
        />
      </div>

      {file && chapters.length === 0 && status !== 'parsing' && (
        <button
          onClick={handleParse}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full cursor-pointer rounded-lg py-3 font-medium transition-colors"
        >
          Parse Chapters
        </button>
      )}

      {status === 'parsing' && (
        <div className="text-primary flex items-center gap-2" role="status">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm">Parsing ebook...</span>
        </div>
      )}

      {chapters.length > 0 && (
        <ChapterSelector
          chapters={chapters}
          selected={selected}
          onToggle={toggleChapter}
          onToggleAll={toggleAll}
        />
      )}

      {chapters.length > 0 && (
        <div>
          <label className="text-foreground/80 mb-2 block text-sm font-medium">
            Voice
          </label>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Voice selection"
          >
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                role="radio"
                aria-checked={voice === v.id}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  voice === v.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50 border'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {chapters.length > 0 && status !== 'converting' && (
        <button
          onClick={handleConvert}
          disabled={selected.size === 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full cursor-pointer rounded-lg py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Convert Selected ({selected.size})
        </button>
      )}

      {status === 'converting' && (
        <ProgressTracker
          current={progress.current}
          total={progress.total}
          label="Converting"
          showCancel={false}
        />
      )}
      {error && (
        <div
          className="bg-destructive/10 border-destructive/30 text-destructive rounded-lg border p-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}
      {results.length > 0 && (
        <ChapterResults
          results={results}
          onPlay={playPreview}
          onDownload={downloadChapter}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TTSPage() {
  const [tab, setTab] = useState<Tab>('preset');
  const [voice, setVoice] = useState('Mia');
  const [style, setStyle] = useState('');
  const [showConfigSheet, setShowConfigSheet] = useState(false);

  const activeTabContent = (() => {
    switch (tab) {
      case 'preset':
        return (
          <PresetTabContent
            key="preset"
            voice={voice}
            setVoice={setVoice}
            style={style}
            setStyle={setStyle}
          />
        );
      case 'design':
        return (
          <DesignTabContent key="design" style={style} setStyle={setStyle} />
        );
      case 'clone':
        return (
          <CloneTabContent key="clone" style={style} setStyle={setStyle} />
        );
      case 'ebook':
        return (
          <EbookTabContent key="ebook" voice={voice} setVoice={setVoice} />
        );
    }
  })();

  const selectedVoiceLabel = VOICES.find((v) => v.id === voice)?.label;
  const selectedStyleLabel = STYLES.find((s) => s.id === style)?.label;
  const showConfig = tab === 'preset' || tab === 'clone';

  return (
    <div className="bg-background flex min-h-[100dvh] flex-col">
      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-20">
          {/* Page Header */}
          <div className="mb-6 animate-[fade-in-up_0.6s_ease-out]">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              Vocal<span className="text-primary">Via</span>
            </h1>
            <p className="text-primary mt-2 text-base font-medium">
              AI Voice Studio
            </p>
          </div>

          {/* Hero Waveform Decoration */}
          <div className="mb-8 h-14 w-full animate-[fade-in-up_0.6s_ease-out_0.1s_both] overflow-hidden rounded-2xl bg-white/[0.03] dark:bg-white/[0.03]">
            <div
              className="h-full w-[200%]"
              style={{
                background:
                  'repeating-linear-gradient(90deg, transparent, transparent 6px, oklch(0.75 0.15 85 / 0.25) 6px, oklch(0.75 0.15 85 / 0.25) 8px)',
                animation: 'waveform-flow 6s linear infinite',
              }}
            />
          </div>

          {/* Desktop Tab Bar */}
          <div className="bg-card/50 mb-6 hidden animate-[fade-in-up_0.6s_ease-out_0.2s_both] rounded-2xl border border-white/10 p-1 backdrop-blur-xl md:flex">
            <TabButton
              active={tab === 'preset'}
              onClick={() => setTab('preset')}
            >
              Preset Voices
            </TabButton>
            <TabButton
              active={tab === 'design'}
              onClick={() => setTab('design')}
            >
              Voice Design
            </TabButton>
            <TabButton active={tab === 'clone'} onClick={() => setTab('clone')}>
              Voice Clone
            </TabButton>
            <TabButton active={tab === 'ebook'} onClick={() => setTab('ebook')}>
              Ebook to Audio
            </TabButton>
          </div>

          {/* Mobile Config Summary */}
          {showConfig && (
            <div className="mb-4 md:hidden">
              <ConfigSummaryBar
                voice={selectedVoiceLabel}
                emotion={
                  selectedStyleLabel !== 'None' ? selectedStyleLabel : undefined
                }
                onClick={() => setShowConfigSheet(true)}
              />
            </div>
          )}

          {/* Tab Content */}
          {activeTabContent}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <TTSMobileTabs active={tab} onChange={setTab} />

      {/* Mobile Config Sheet */}
      <ConfigSheet
        open={showConfigSheet}
        onClose={() => setShowConfigSheet(false)}
        title="Voice Settings"
      >
        <div className="space-y-4">
          <div>
            <label className="text-foreground/80 mb-2 block text-sm font-medium">
              Voice
            </label>
            <div className="grid grid-cols-2 gap-2">
              {VOICES.map((v) => (
                <VoiceCard
                  key={v.id}
                  voice={v}
                  isSelected={voice === v.id}
                  onSelect={() => {
                    setVoice(v.id);
                    setShowConfigSheet(false);
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-foreground/80 mb-2 block text-sm font-medium">
              Emotion
            </label>
            <EmotionPicker
              styles={STYLES}
              selected={style}
              onSelect={(s) => {
                setStyle(s);
                setShowConfigSheet(false);
              }}
            />
          </div>
        </div>
      </ConfigSheet>
    </div>
  );
}
