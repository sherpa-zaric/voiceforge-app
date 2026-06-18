/**
 * Multi-voice text analysis: splits text into segments and assigns voices.
 *
 * Flow:
 *   1. LLM analyzes text → identifies speakers, dialogue, narration
 *   2. Each segment gets a voice ID from the available pool
 *   3. Backend processes segments independently
 *   4. Audio segments merged in order
 */

export interface VoiceSegment {
  id: number;
  voice: string;
  text: string;
  type: 'narration' | 'dialogue';
}

export interface SegmentAnalysis {
  segments: VoiceSegment[];
  estimatedDurationSeconds: number;
}

export const VOICE_DESCRIPTIONS: Record<string, string> = {
  Mia: 'Warm, natural female voice, gentle and calm',
  Chloe: 'Bright, energetic young female voice',
  Milo: 'Friendly, casual young male voice',
  Dean: 'Deep, authoritative middle-aged male voice',
};

const ANALYSIS_PROMPT = `You are a text-to-speech segment analyzer. Split text into segments and assign a voice to each.

AVAILABLE VOICES (use the voice ID):
- Mia: Warm, natural female voice (narration, gentle female characters)
- Chloe: Bright, energetic female voice (young female characters)
- Milo: Friendly, casual male voice (young male characters)
- Dean: Deep, authoritative male voice (older male characters, authority figures)

RULES:
1. Split at natural boundaries: paragraph breaks, speaker changes, scene transitions.
2. Each segment gets ONE voice. No mixing within a segment.
3. For dialogue, detect the speaker gender/age and assign the appropriate voice.
4. For narration/description, use Mia (default narrator).
5. Keep segments 50-500 characters. Don't create tiny segments.
6. Preserve ALL original text exactly - do not summarize or modify.
7. Stage directions and poetic text → narration with Mia.

OUTPUT: Return ONLY a JSON array. Each element:
{"id": 1, "voice": "Mia", "text": "original text segment", "type": "narration"|"dialogue"}

No explanation. ONLY the JSON array.`;

export async function analyzeTextToSegments(
  text: string,
  voiceDescription: string,
  openrouterApiKey: string,
  openrouterBaseUrl?: string
): Promise<SegmentAnalysis> {
  const baseUrl = openrouterBaseUrl || 'https://openrouter.ai/api/v1';

  const userPrompt = voiceDescription
    ? `Voice style guidance: ${voiceDescription}\n\nText:\n${text}`
    : `Text:\n${text}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openrouterApiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 16000,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(
      `LLM analysis failed: ${res.status} - ${errBody.slice(0, 200)}`
    );
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response');

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('LLM did not return valid JSON segments');

  const rawSegments: any[] = JSON.parse(jsonMatch[0]);

  const segments: VoiceSegment[] = rawSegments
    .map((seg, i) => ({
      id: i + 1,
      voice: seg.voice in VOICE_DESCRIPTIONS ? seg.voice : 'Mia',
      text: String(seg.text || '').trim(),
      type: (seg.type === 'dialogue' ? 'dialogue' : 'narration') as
        | 'narration'
        | 'dialogue',
    }))
    .filter((seg) => seg.text.length > 0);

  if (segments.length === 0) throw new Error('No valid segments produced');

  const totalChars = segments.reduce((s, seg) => s + seg.text.length, 0);
  const estimatedDurationSeconds = Math.ceil((totalChars / 150) * 60);

  return { segments, estimatedDurationSeconds };
}
