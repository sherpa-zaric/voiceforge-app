import type { DesignPreset, StyleOption, VoiceOption } from './types';

export const VOICES: VoiceOption[] = [
  { id: 'Mia', label: 'Mia', description: 'Warm, natural female voice' },
  { id: 'Chloe', label: 'Chloe', description: 'Bright, energetic female voice' },
  { id: 'Milo', label: 'Milo', description: 'Friendly, casual male voice' },
  { id: 'Dean', label: 'Dean', description: 'Deep, authoritative male voice' },
];

export const STYLES: StyleOption[] = [
  { id: '', label: 'None', tag: '' },
  { id: 'happy', label: 'Happy', tag: 'happy' },
  { id: 'sad', label: 'Sad', tag: 'sad' },
  { id: 'angry', label: 'Angry', tag: 'angry' },
  { id: 'calm', label: 'Calm', tag: 'calm' },
  { id: 'excited', label: 'Excited', tag: 'excited' },
  { id: 'scary', label: 'Scary', tag: 'scary' },
  { id: 'whisper', label: 'Whisper', tag: 'whisper' },
];

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: 'narrator',
    label: 'British Narrator',
    description:
      'Warm British narrator, middle-aged, perfect for audiobooks and documentaries',
  },
  {
    id: 'podcast',
    label: 'Podcast Host',
    description: 'Friendly, energetic young American female, great for podcasts and vlogs',
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
    description: 'Eerie, whispering voice with unsettling pauses, perfect for horror content',
  },
  {
    id: 'anime',
    label: 'Anime Character',
    description: 'High-pitched, expressive anime-style voice with exaggerated emotions',
  },
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_EBOOK_SIZE = 50 * 1024 * 1024;

export function fileToBase64(file: File): Promise<string> {
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

export async function webmToWav(blob: Blob): Promise<File> {
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
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  ctx.close();
  return new File([buffer], 'recorded-voice.wav', { type: 'audio/wav' });
}
