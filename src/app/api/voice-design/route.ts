import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { callVoiceDesign, mergeWavBase64, splitText } from '@/shared/lib/tts';
import { consumeCredits, getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

const CREDITS_PER_CHAR = 2;

export async function POST(request: NextRequest) {
  try {
    const { text, voiceDescription, style } = await request.json();

    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';

    if (!apiKey || apiKey === 'your_api_key_here') {
      return respErr('MIMO_API_KEY is not configured');
    }

    if (!text || typeof text !== 'string') {
      return respErr('No text provided');
    }

    if (!voiceDescription || typeof voiceDescription !== 'string') {
      return respErr('Voice description is required');
    }

    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in to design a voice');
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
    for (const chunk of chunks) {
      const audio = await callVoiceDesign(
        chunk,
        voiceDescription,
        style,
        apiKey,
        baseUrl
      );
      audioChunks.push(audio);
    }
    const merged = mergeWavBase64(audioChunks);

    await consumeCredits({
      userId: user.id,
      credits: creditsNeeded,
      scene: 'voice_design',
      description: `Voice Design: ${charCount} chars`,
    });

    return respData({ audio: merged });
  } catch (err) {
    return respErr(`Request failed: ${err}`);
  }
}
