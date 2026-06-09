'use client';

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import { useAppContext } from '@/shared/contexts/app';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'preset' | 'design' | 'clone' | 'ebook';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface VoiceOption {
  id: string;
  label: string;
  description: string;
}

interface StyleOption {
  id: string;
  label: string;
  tag: string;
}

interface DesignPreset {
  id: string;
  label: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOICES: VoiceOption[] = [
  { id: 'Mia', label: 'Mia', description: 'Warm, natural female voice' },
  {
    id: 'Chloe',
    label: 'Chloe',
    description: 'Bright, energetic female voice',
  },
  { id: 'Milo', label: 'Milo', description: 'Friendly, casual male voice' },
  { id: 'Dean', label: 'Dean', description: 'Deep, authoritative male voice' },
];

const STYLES: StyleOption[] = [
  { id: '', label: 'None', tag: '' },
  { id: 'happy', label: 'Happy', tag: 'happy' },
  { id: 'sad', label: 'Sad', tag: 'sad' },
  { id: 'angry', label: 'Angry', tag: 'angry' },
  { id: 'calm', label: 'Calm', tag: 'calm' },
  { id: 'excited', label: 'Excited', tag: 'excited' },
  { id: 'scary', label: 'Scary', tag: 'scary' },
  { id: 'whisper', label: 'Whisper', tag: 'whisper' },
];

const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: 'narrator',
    label: 'British Narrator',
    description:
      'Warm British narrator, middle-aged, perfect for audiobooks and documentaries',
  },
  {
    id: 'podcast',
    label: 'Podcast Host',
    description:
      'Friendly, energetic young American female, great for podcasts and vlogs',
  },
  {
    id: 'trailer',
    label: 'Movie Trailer',
    description: 'Deep, gravelly movie trailer voice with dramatic intensity',
  },
  {
    id: 'robot',
    label: 'Sci-Fi Robot',
    description: 'Robotic, monotone AI voice with slight metallic resonance',
  },
  {
    id: 'horror',
    label: 'Horror Host',
    description:
      'Eerie, whispering voice with unsettling pauses, perfect for horror content',
  },
  {
    id: 'anime',
    label: 'Anime Character',
    description:
      'High-pitched, expressive anime-style voice with exaggerated emotions',
  },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function webmToWav(blob: Blob): Promise<File> {
  const ctx = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = audioBuffer.length * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  ctx.close();
  return new File([buffer], 'recorded-voice.wav', { type: 'audio/wav' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function AudioPlayer({ src }: { src: string }) {
  return (
    <div className="mt-4">
      <audio controls src={src} className="w-full" />
    </div>
  );
}

function StatusMessage({
  status,
  error,
}: {
  status: Status;
  error: string | null;
}) {
  if (status === 'loading') {
    return (
      <div className="text-primary mt-4 flex items-center gap-2">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
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
        <span className="text-sm">Generating audio...</span>
      </div>
    );
  }
  if (status === 'error' && error) {
    return (
      <div className="bg-destructive/10 border-destructive/30 text-destructive mt-4 rounded-lg border p-3 text-sm">
        {error}
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Preset Voices Tab
// ---------------------------------------------------------------------------

function PresetTab() {
  const { user, setIsShowSignModal } = useAppContext();
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('Mia');
  const [style, setStyle] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    setStatus('loading');
    setError(null);
    setAudioSrc(null);

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
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.message || 'Generation failed');
      setAudioSrc(`data:audio/wav;base64,${data.data.audio}`);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [text, voice, style, user, setIsShowSignModal]);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Voice
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VOICES.map((v) => (
            <div
              key={v.id}
              className={`relative rounded-lg border p-3 transition-all ${
                voice === v.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <button
                onClick={() => setVoice(v.id)}
                className="w-full cursor-pointer text-left"
              >
                <span className="block text-sm font-medium">{v.label}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {v.description}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (previewAudioRef.current) {
                    previewAudioRef.current.pause();
                    previewAudioRef.current.currentTime = 0;
                  }
                  const audio = new Audio(`/voices/${v.id}.wav`);
                  previewAudioRef.current = audio;
                  audio.play();
                }}
                className="bg-card border-border text-muted-foreground hover:text-primary hover:border-primary absolute top-2 right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border transition-colors"
                title={`Preview ${v.label}`}
              >
                <svg
                  className="h-3 w-3"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Emotion / Style
        </label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                style === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50 border'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Text to speak
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type what you want the voice to say..."
          rows={4}
          className="bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full resize-none rounded-lg border p-3 focus:outline-none"
        />
        {text.length > 2500 && (
          <p className="text-muted-foreground mt-1 text-xs">
            Long text will be automatically split and merged.
          </p>
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={status === 'loading' || !text.trim()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full cursor-pointer rounded-lg py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'loading' ? 'Generating...' : 'Generate Speech'}
      </button>

      <StatusMessage status={status} error={error} />
      {audioSrc && <AudioPlayer src={audioSrc} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice Design Tab
// ---------------------------------------------------------------------------

function DesignTab() {
  const { user, setIsShowSignModal } = useAppContext();
  const [text, setText] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [style, setStyle] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!text.trim() || !voiceDescription.trim()) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }
    setStatus('loading');
    setError(null);
    setAudioSrc(null);

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
      const data = await res.json();
      if (data.code !== 0) throw new Error(data.message || 'Generation failed');
      setAudioSrc(`data:audio/wav;base64,${data.data.audio}`);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [text, voiceDescription, style, user, setIsShowSignModal]);

  return (
    <div className="space-y-5">
      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Quick Presets
        </label>
        <div className="flex flex-wrap gap-2">
          {DESIGN_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setVoiceDescription(p.description)}
              className="bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Voice Description
        </label>
        <textarea
          value={voiceDescription}
          onChange={(e) => setVoiceDescription(e.target.value)}
          placeholder='e.g. "Warm British narrator, middle-aged, with a slight rasp"'
          rows={3}
          className="bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full resize-none rounded-lg border p-3 focus:outline-none"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Describe the voice you want in plain English. The AI will create it.
        </p>
      </div>

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Emotion / Style
        </label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                style === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50 border'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Text to speak
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type what you want the voice to say..."
          rows={4}
          className="bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full resize-none rounded-lg border p-3 focus:outline-none"
        />
        {text.length > 2500 && (
          <p className="text-muted-foreground mt-1 text-xs">
            Long text will be automatically split and merged.
          </p>
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={
          status === 'loading' || !text.trim() || !voiceDescription.trim()
        }
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full cursor-pointer rounded-lg py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'loading' ? 'Generating...' : 'Generate Voice'}
      </button>

      <StatusMessage status={status} error={error} />
      {audioSrc && <AudioPlayer src={audioSrc} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice Clone Tab
// ---------------------------------------------------------------------------

function CloneTab() {
  const { user, setIsShowSignModal } = useAppContext();
  const [text, setText] = useState('');
  const [style, setStyle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validateAndSetFile = useCallback((f: File) => {
    setFileError(null);
    if (f.size > MAX_FILE_SIZE) {
      setFileError('File too large. Maximum size is 10 MB.');
      return;
    }
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (
      ext !== 'wav' &&
      ext !== 'mp3' &&
      ext !== 'webm' &&
      f.type !== 'audio/wav' &&
      f.type !== 'audio/mpeg' &&
      f.type !== 'audio/webm'
    ) {
      setFileError('Only WAV, MP3, and recorded audio are supported.');
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) validateAndSetFile(f);
    },
    [validateAndSetFile]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) validateAndSetFile(f);
    },
    [validateAndSetFile]
  );

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
        validateAndSetFile(wavFile);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((d) => d + 1);
      }, 1000);
    } catch {
      setFileError('Microphone access denied. Please allow microphone access.');
    }
  }, [validateAndSetFile]);

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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragging
              ? 'border-primary bg-primary/5'
              : file
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-border bg-card hover:border-primary/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".wav,.mp3,audio/wav,audio/mpeg"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <>
              <svg
                className="mb-2 h-8 w-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-muted-foreground mt-1 text-xs">
                {(file.size / 1024 / 1024).toFixed(1)} MB &mdash; Click or drop
                to replace
              </span>
            </>
          ) : (
            <>
              <svg
                className="text-muted-foreground mb-2 h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-muted-foreground text-sm">
                Drop an audio file here or click to browse
              </span>
              <span className="text-muted-foreground/60 mt-1 text-xs">
                WAV, MP3 &middot; Max 10 MB
              </span>
            </>
          )}
        </div>
        {fileError && (
          <p className="text-destructive mt-1 text-xs">{fileError}</p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-muted-foreground text-xs">or</span>
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              recording
                ? 'bg-destructive/20 border-destructive/50 text-destructive border'
                : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50 border'
            }`}
          >
            {recording ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="bg-destructive absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="bg-destructive relative inline-flex h-3 w-3 rounded-full" />
                </span>
                Recording {Math.floor(recordDuration / 60)}:
                {String(recordDuration % 60).padStart(2, '0')}
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                Record Audio
              </>
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="text-foreground/80 mb-2 block text-sm font-medium">
          Emotion / Style
        </label>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                style === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50 border'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-foreground/80 text-sm font-medium">
            Text to speak
          </label>
          <span
            className={`text-xs ${text.length > 2500 ? 'text-destructive' : text.length > 2000 ? 'text-yellow-500' : 'text-muted-foreground'}`}
          >
            {text.length.toLocaleString()} / 2,500 chars
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type what you want the cloned voice to say..."
          rows={4}
          className="bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full resize-none rounded-lg border p-3 focus:outline-none"
        />
        {text.length > 2500 && (
          <p className="text-destructive mt-1 text-xs">
            Text exceeds 2,500 character limit. Please shorten your text.
          </p>
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={status === 'loading' || !text.trim() || !file}
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full cursor-pointer rounded-lg py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'loading' ? 'Cloning Voice...' : 'Clone & Generate'}
      </button>

      <StatusMessage status={status} error={error} />
      {audioSrc && <AudioPlayer src={audioSrc} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ebook to Audio Tab
// ---------------------------------------------------------------------------

interface EbookChapter {
  id: number;
  title: string;
  text: string;
  wordCount: number;
}

function EbookTab() {
  const { user, setIsShowSignModal } = useAppContext();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [chapters, setChapters] = useState<EbookChapter[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [voice, setVoice] = useState('Mia');
  const [status, setStatus] = useState<
    'idle' | 'parsing' | 'converting' | 'done'
  >('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<
    { id: number; title: string; audio: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const validateAndSetFile = useCallback((f: File) => {
    setFileError(null);
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'epub' && ext !== 'txt') {
      setFileError('Only EPUB and TXT files are supported.');
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setFileError('File too large. Maximum 50MB.');
      return;
    }
    setFile(f);
    setChapters([]);
    setSelected(new Set());
    setResults([]);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) validateAndSetFile(f);
    },
    [validateAndSetFile]
  );

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
    if (selected.size === chapters.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(chapters.map((c) => c.id)));
    }
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragging
              ? 'border-primary bg-primary/5'
              : file
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-border bg-card hover:border-primary/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".epub,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) validateAndSetFile(f);
            }}
            className="hidden"
          />
          {file ? (
            <>
              <svg
                className="mb-2 h-8 w-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-muted-foreground mt-1 text-xs">
                {(file.size / 1024 / 1024).toFixed(1)} MB &mdash; Click to
                replace
              </span>
            </>
          ) : (
            <>
              <svg
                className="text-muted-foreground mb-2 h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <span className="text-muted-foreground text-sm">
                Drop an ebook here or click to browse
              </span>
              <span className="text-muted-foreground/60 mt-1 text-xs">
                EPUB, TXT &middot; Max 50 MB
              </span>
            </>
          )}
        </div>
        {fileError && (
          <p className="text-destructive mt-1 text-xs">{fileError}</p>
        )}
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
        <div className="text-primary flex items-center gap-2">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
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
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-foreground/80 text-sm font-medium">
              Chapters ({selected.size}/{chapters.length} selected)
            </label>
            <button
              onClick={toggleAll}
              className="text-primary cursor-pointer text-xs hover:underline"
            >
              {selected.size === chapters.length
                ? 'Deselect All'
                : 'Select All'}
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
                  onChange={() => toggleChapter(ch.id)}
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
      )}

      {chapters.length > 0 && (
        <div>
          <label className="text-foreground/80 mb-2 block text-sm font-medium">
            Voice
          </label>
          <div className="flex flex-wrap gap-2">
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
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
        <div className="space-y-2">
          <div className="text-primary flex items-center gap-2">
            <svg
              className="h-5 w-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
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
            <span className="text-sm">
              Converting chapter {progress.current} of {progress.total}...
            </span>
          </div>
          <div className="bg-card h-2 w-full rounded-full">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border-destructive/30 text-destructive rounded-lg border p-3 text-sm">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <label className="text-foreground/80 block text-sm font-medium">
            Generated Audio ({results.length} chapters)
          </label>
          {results.map((r) => (
            <div
              key={r.id}
              className="bg-card border-border rounded-lg border p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate text-sm font-medium">{r.title}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => playPreview(r.audio)}
                    className="text-primary cursor-pointer text-xs hover:underline"
                  >
                    Play
                  </button>
                  <button
                    onClick={() => downloadChapter(r.title, r.audio)}
                    className="text-primary cursor-pointer text-xs hover:underline"
                  >
                    Download
                  </button>
                </div>
              </div>
              <audio
                controls
                src={`data:audio/wav;base64,${r.audio}`}
                className="w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TTSPage() {
  const [tab, setTab] = useState<Tab>('preset');

  return (
    <div className="bg-background flex flex-1 flex-col items-center">
      <main className="w-full max-w-2xl px-4 py-12 sm:py-20">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Voice<span className="text-primary">Forge</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-base">
            AI Voice Studio &mdash; Design, clone, and generate voices with AI
          </p>
        </div>

        <div className="border-border mb-8 flex border-b">
          <TabButton active={tab === 'preset'} onClick={() => setTab('preset')}>
            Preset Voices
          </TabButton>
          <TabButton active={tab === 'design'} onClick={() => setTab('design')}>
            Voice Design
          </TabButton>
          <TabButton active={tab === 'clone'} onClick={() => setTab('clone')}>
            Voice Clone
          </TabButton>
          <TabButton active={tab === 'ebook'} onClick={() => setTab('ebook')}>
            Ebook
          </TabButton>
        </div>

        {tab === 'preset' && <PresetTab />}
        {tab === 'design' && <DesignTab />}
        {tab === 'clone' && <CloneTab />}
        {tab === 'ebook' && <EbookTab />}
      </main>
    </div>
  );
}
