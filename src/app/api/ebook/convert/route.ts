import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { callTTS, mergeWavBase64, splitText } from '@/shared/lib/tts';
import { consumeCredits, getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

const CREDITS_PER_CHAR = 1;

export async function POST(request: NextRequest) {
  try {
    const { text, voice, style } = await request.json();

    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';

    if (!apiKey || apiKey === 'your_api_key_here') {
      return respErr('MIMO_API_KEY is not configured');
    }

    if (!text || typeof text !== 'string') {
      return respErr('No text provided');
    }

    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in to convert ebook chapters');
    }

    const charCount = text.length;
    const creditsNeeded = charCount * CREDITS_PER_CHAR;

    const remaining = await getRemainingCredits(user.id);
    if (remaining < creditsNeeded) {
      return respErr(
        `Insufficient credits. Need ${creditsNeeded}, have ${remaining}. Each character costs ${CREDITS_PER_CHAR} credit.`
      );
    }

    const chunks = splitText(text).filter((c) => c.length > 0);
    const audioChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const audio = await callTTS(
          chunks[i],
          voice || 'Mia',
          style,
          apiKey,
          baseUrl
        );
        audioChunks.push(audio);
      } catch (err) {
        console.error(
          `Ebook convert chunk ${i + 1}/${chunks.length} failed:`,
          err
        );
        throw new Error(
          `Chunk ${i + 1}/${chunks.length} failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    const merged = mergeWavBase64(audioChunks);

    await consumeCredits({
      userId: user.id,
      credits: creditsNeeded,
      scene: 'ebook_convert',
      description: `Ebook chapter: ${charCount} chars, voice: ${voice || 'Mia'}`,
    });

    return respData({ audio: merged });
  } catch (err) {
    return respErr(`Request failed: ${err}`);
  }
}
