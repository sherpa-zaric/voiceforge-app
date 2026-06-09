const MAX_CHUNK = 1500;

export function splitText(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK) {
      chunks.push(remaining);
      break;
    }
    // Try paragraph breaks first (double newline)
    let cut = remaining.lastIndexOf('\n\n', MAX_CHUNK);
    if (cut > MAX_CHUNK * 0.3) {
      cut += 2;
    } else {
      // Try sentence boundaries
      cut = remaining.lastIndexOf('.', MAX_CHUNK);
      if (cut < MAX_CHUNK * 0.3) cut = remaining.lastIndexOf('!', MAX_CHUNK);
      if (cut < MAX_CHUNK * 0.3) cut = remaining.lastIndexOf('?', MAX_CHUNK);
      if (cut < MAX_CHUNK * 0.3) cut = remaining.lastIndexOf(';', MAX_CHUNK);
      if (cut < MAX_CHUNK * 0.3) cut = remaining.lastIndexOf(',', MAX_CHUNK);
      if (cut < MAX_CHUNK * 0.3) cut = remaining.lastIndexOf('\n', MAX_CHUNK);
      if (cut < MAX_CHUNK * 0.3) cut = MAX_CHUNK;
      else cut += 1;
    }
    const chunk = remaining.slice(0, cut).trim();
    if (chunk.length > 0) chunks.push(chunk);
    remaining = remaining.slice(cut).trim();
  }
  return chunks;
}

export function mergeWavBase64(chunks: string[]): string {
  if (chunks.length === 1) return chunks[0];
  const parts = chunks.map((b64) => {
    const raw = Buffer.from(b64, 'base64');
    return raw.subarray(44);
  });
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + totalLen, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(totalLen, 40);
  const merged = Buffer.concat([header, ...parts]);
  return merged.toString('base64');
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  delayMs = 1000
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || attempt === retries) return res;
      // Wait before retry on non-OK responses
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw new Error('Unreachable');
}

export async function callTTS(
  text: string,
  voice: string,
  style: string | undefined,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const styleTag = style ? `<style>${style}</style>` : '';
  const body = {
    model: 'mimo-v2.5-tts',
    messages: [
      { role: 'user', content: 'Generate speech' },
      { role: 'assistant', content: `${styleTag}${text}` },
    ],
    audio: { format: 'wav', voice: voice || 'Mia' },
    stream: false,
  };
  const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`MiMo API error: ${res.status} ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(
      `MiMo API error: ${data.error.message || JSON.stringify(data.error)}`
    );
  }
  const audio = data.choices?.[0]?.message?.audio?.data;
  if (!audio) {
    console.error(
      'MiMo API response missing audio:',
      JSON.stringify(data).slice(0, 500)
    );
    throw new Error('No audio data in response');
  }
  return audio;
}

export async function callVoiceDesign(
  text: string,
  voiceDescription: string,
  style: string | undefined,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const styleTag = style ? `<style>${style}</style>` : '';
  const body = {
    model: 'mimo-v2.5-tts-voicedesign',
    messages: [
      { role: 'user', content: voiceDescription },
      { role: 'assistant', content: `${styleTag}${text}` },
    ],
    audio: { format: 'wav' },
    stream: false,
  };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`MiMo API error: ${res.status}`);
  const data = await res.json();
  const audio = data.choices?.[0]?.message?.audio?.data;
  if (!audio) throw new Error('No audio data in response');
  return audio;
}

export async function callVoiceClone(
  text: string,
  audioBase64: string,
  mimeType: string,
  style: string | undefined,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const styleTag = style ? `<style>${style}</style>` : '';
  const body = {
    model: 'mimo-v2.5-tts-voiceclone',
    messages: [
      { role: 'user', content: '' },
      { role: 'assistant', content: `${styleTag}${text}` },
    ],
    audio: {
      format: 'wav',
      voice: `data:${mimeType || 'audio/wav'};base64,${audioBase64}`,
    },
    stream: false,
  };
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`MiMo API error: ${res.status}`);
  const data = await res.json();
  const audio = data.choices?.[0]?.message?.audio?.data;
  if (!audio) throw new Error('No audio data in response');
  return audio;
}
