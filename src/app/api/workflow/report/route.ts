import { NextRequest } from 'next/server';

import {
  FIELD_BRIEF_TEMPLATES,
  FieldBriefSourceType,
  generateFieldBriefReport,
  isFieldBriefTemplateId,
} from '@/shared/lib/fieldbrief';
import { getUuid } from '@/shared/lib/hash';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { respData, respErr } from '@/shared/lib/resp';
import { createAITask } from '@/shared/models/ai_task';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';

const MAX_SOURCE_LENGTH = 20000;
const VALID_SOURCE_TYPES = ['voice-note', 'voicemail', 'field-notes'];

export async function POST(request: NextRequest) {
  const rateLimited = enforceMinIntervalRateLimit(request, {
    intervalMs: 8_000,
    keyPrefix: 'fieldbrief-report',
  });
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { templateId, sourceText, sourceType, context } = body;

    if (!isFieldBriefTemplateId(templateId)) {
      return respErr('Invalid workflow template');
    }

    if (!sourceText || typeof sourceText !== 'string') {
      return respErr('Source notes are required');
    }

    const trimmedSource = sourceText.trim();
    if (trimmedSource.length < 10) {
      return respErr('Please provide a longer field note');
    }

    if (trimmedSource.length > MAX_SOURCE_LENGTH) {
      return respErr(
        `Source notes are too long. Maximum ${MAX_SOURCE_LENGTH} characters.`
      );
    }

    const safeSourceType: FieldBriefSourceType = VALID_SOURCE_TYPES.includes(
      sourceType
    )
      ? sourceType
      : 'voice-note';

    const user = await getUserInfo();
    if (!user || !user.email) {
      return respErr('Please sign in to generate a report');
    }

    const template = FIELD_BRIEF_TEMPLATES[templateId];
    const costCredits = template.creditCost;
    const remainingCredits = await getRemainingCredits(user.id);
    if (remainingCredits < costCredits) {
      return respErr(
        `Insufficient credits. Need ${costCredits}, have ${remainingCredits}.`
      );
    }

    const report = generateFieldBriefReport({
      templateId,
      sourceText: trimmedSource,
      sourceType: safeSourceType,
      context,
    });

    const taskId = getUuid();
    const task = await createAITask({
      id: taskId,
      userId: user.id,
      userEmail: user.email,
      mediaType: 'text',
      provider: 'fieldbrief',
      model: 'fieldbrief-template-v1',
      prompt: trimmedSource,
      options: JSON.stringify({
        templateId,
        sourceType: safeSourceType,
        context: context || {},
      }),
      status: 'success',
      costCredits,
      scene: template.scene,
      taskId,
      taskResult: JSON.stringify({ report }),
    });

    return respData({
      task,
      report,
    });
  } catch (error: any) {
    console.error('FieldBrief report generation failed:', error);
    return respErr(error.message || 'Report generation failed');
  }
}
