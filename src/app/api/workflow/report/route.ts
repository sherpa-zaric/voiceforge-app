import { NextRequest } from 'next/server';

import {
  buildFieldBriefUserPrompt as _buildUserPrompt,
  buildFieldBriefSystemPrompt,
  FIELD_BRIEF_TEMPLATES,
  FieldBriefReport,
  FieldBriefReportSchema,
  FieldBriefSourceType,
  formatFieldBriefMarkdown,
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

    // --- MiMo LLM-powered report generation ---
    const apiKey = process.env.MIMO_API_KEY;
    const baseUrl =
      process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';

    if (!apiKey) {
      return respErr('AI service is not configured. Please contact support.');
    }

    const systemPrompt = buildFieldBriefSystemPrompt(templateId);
    const userPrompt = _buildUserPrompt({
      sourceText: trimmedSource,
      sourceType: safeSourceType,
      context,
    });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mimo-v2-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_completion_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        'MiMo report generation error:',
        response.status,
        errorText
      );
      return respErr('Report generation failed. Please try again.');
    }

    const result = await response.json();
    const rawContent = result?.choices?.[0]?.message?.content || '';

    if (!rawContent.trim()) {
      return respErr('AI returned an empty response. Please try again.');
    }

    // Parse LLM output as JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Try extracting JSON from markdown code fences
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        console.error('Failed to parse LLM output:', rawContent.slice(0, 200));
        return respErr(
          'AI returned an invalid response format. Please try again.'
        );
      }
    }

    // Validate with zod schema
    const validated = FieldBriefReportSchema.parse(parsed);

    const report: FieldBriefReport = {
      templateId,
      title: template.title,
      generatedAt: new Date().toISOString(),
      sourceType: safeSourceType,
      summary: validated.summary,
      sections: validated.sections,
      actions: validated.actions,
      risks: validated.risks,
      callbackScript: validated.callbackScript,
      markdown: '',
    };
    report.markdown = formatFieldBriefMarkdown(report);

    const taskId = getUuid();
    const task = await createAITask({
      id: taskId,
      userId: user.id,
      userEmail: user.email,
      mediaType: 'text',
      provider: 'mimo',
      model: 'mimo-v2-flash',
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
