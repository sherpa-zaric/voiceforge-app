import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { callVoiceClone } from '@/shared/lib/tts';
import { consumeCredits, getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

const CREDITS_PER_CHAR = 3;

export async function POST(request: NextRequest) {
  try {
    const { text, audioBase64, mimeType, style } = await request.json();

    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';

    if (!apiKey || apiKey === 'your_api_key_here') {
      return respErr('MIMO_API_KEY is not configured');
    }

    if (!text || typeof text !== 'string') {
      return respErr('No text provided');
    }

    if (!audioBase64) {
      return respErr('Voice sample audio is required');
    }

    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in to clone a voice');
    }

    const charCount = text.length;
    const creditsNeeded = charCount * CREDITS_PER_CHAR;

    const remaining = await getRemainingCredits(user.id);
    if (remaining < creditsNeeded) {
      return respErr(
        `Insufficient credits. Need ${creditsNeeded}, have ${remaining}. Each character costs ${CREDITS_PER_CHAR} credit.`
      );
    }

    const audio = await callVoiceClone(
      text,
      audioBase64,
      mimeType || 'audio/wav',
      style,
      apiKey,
      baseUrl
    );

    await consumeCredits({
      userId: user.id,
      credits: creditsNeeded,
      scene: 'voice_clone',
      description: `Voice Clone: ${charCount} chars`,
    });

    return respData({ audio });
  } catch (err) {
    return respErr(`Request failed: ${err}`);
  }
}
