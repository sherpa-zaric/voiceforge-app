import { z } from 'zod';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const FIELD_BRIEF_TEMPLATES = {
  'construction-daily-log': {
    id: 'construction-daily-log',
    title: 'Construction Daily Log',
    shortTitle: 'Daily Log',
    category: 'Construction',
    scene: 'fieldbrief-construction-daily-log',
    creditCost: 5,
    placeholder:
      'Paste a superintendent voice note transcript, field memo, or rough end-of-day notes...',
    sample:
      'Site: Riverside retail shell. Crew of 8 on site from 7:00 to 3:30. Completed framing at the west wall and installed blocking at the storefront openings. Electrical rough-in started in units 101 and 102. Delivery of ceiling grid was delayed until tomorrow. No injuries. Need GC approval on the revised access panel location. Tomorrow: finish electrical rough-in, start insulation, and verify ceiling grid delivery.',
  },
  'voicemail-to-job-brief': {
    id: 'voicemail-to-job-brief',
    title: 'Voicemail to Job Brief',
    shortTitle: 'Job Brief',
    category: 'Home Service',
    scene: 'fieldbrief-voicemail-to-job-brief',
    creditCost: 5,
    placeholder:
      'Paste a customer voicemail transcript, call note, or dispatch message...',
    sample:
      'Hi, this is Karen at 415-555-0192. Our upstairs bathroom sink is leaking under the cabinet and the water is starting to get into the vanity. We are home after 2pm today. Please call me back and let me know if someone can come out. The address is 42 Cedar Lane.',
  },
  'punch-list': {
    id: 'punch-list',
    title: 'Punch List',
    shortTitle: 'Punch List',
    category: 'Construction',
    scene: 'fieldbrief-punch-list',
    creditCost: 5,
    placeholder:
      'Paste a site walk transcript, inspection notes, or punch walkthrough memo...',
    sample:
      'North corridor: drywall seam visible above door 204. Unit 207: outlet cover missing at kitchen island. Stair B: paint touch-up needed at handrail return. Lobby: cracked floor tile near elevator 2. Mechanical room: label disconnect switch before final inspection. Water stain visible under break room sink, check plumbing before closeout.',
  },
} as const;

export type FieldBriefTemplateId = keyof typeof FIELD_BRIEF_TEMPLATES;

export type FieldBriefSourceType = 'voice-note' | 'voicemail' | 'field-notes';

export interface FieldBriefContext {
  siteName?: string;
  customerName?: string;
  preparedFor?: string;
}

export interface FieldBriefSection {
  title: string;
  items: string[];
}

export interface FieldBriefReport {
  templateId: FieldBriefTemplateId;
  title: string;
  generatedAt: string;
  sourceType: FieldBriefSourceType;
  summary: string;
  sections: FieldBriefSection[];
  actions: string[];
  risks: string[];
  callbackScript?: string;
  markdown: string;
}

// ---------------------------------------------------------------------------
// Zod schema for LLM structured output
// ---------------------------------------------------------------------------

const FieldBriefSectionSchema = z.object({
  title: z.string().describe('Section heading'),
  items: z.array(z.string()).min(1).describe('Bullet points in this section'),
});

export const FieldBriefReportSchema = z.object({
  summary: z.string().describe('A 2-3 sentence summary of the field notes'),
  sections: z
    .array(FieldBriefSectionSchema)
    .min(2)
    .describe('Structured sections extracted from the notes'),
  actions: z
    .array(z.string())
    .min(1)
    .describe('Concrete action items or next steps'),
  risks: z
    .array(z.string())
    .describe(
      'Risks: delays, safety issues, inspection blockers, or cost overruns'
    ),
  callbackScript: z
    .string()
    .optional()
    .describe(
      'A short phone script for calling the customer back (voicemail-to-job-brief only)'
    ),
});

export type FieldBriefLLMOutput = z.infer<typeof FieldBriefReportSchema>;

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS: Record<FieldBriefTemplateId, string> = {
  'construction-daily-log': `You are a construction project reporting assistant. Parse the user's rough field notes into a structured daily report.

Rules:
- Extract completed work, delays/blockers, safety notes, and next steps.
- Be specific: use actual names, locations, trade names, and quantities from the notes.
- Do not invent information that isn't in the source notes.
- Keep items concise (one sentence each).
- "actions" should be concrete next steps someone can act on.
- "risks" should flag anything that could cause delay, safety issues, or cost overruns.
- Do NOT include a callbackScript.`,

  'voicemail-to-job-brief': `You are a dispatch coordinator assistant. Parse the user's voicemail transcript or customer message into a dispatch-ready job brief.

Rules:
- Identify: caller name, phone number, address, service request, urgency, and availability window.
- The "callbackScript" field must be a short, natural script a dispatcher can read when calling the customer back to confirm details.
- "sections" should include: Customer Need, Contact and Scheduling, Technician Brief.
- "risks" should flag urgent or time-sensitive issues.
- Do not invent details not present in the source.`,

  'punch-list': `You are a construction closeout assistant. Parse the user's punch walk or inspection notes into a punch list.

Rules:
- Each issue should be assigned a priority (High for safety/inspection blockers, Normal otherwise) and the responsible trade (Electrical, Plumbing, Painting, Drywall, Flooring, HVAC, General, etc.).
- Format items in "Issue Register" as: "Priority - Trade - Description".
- Include a "Closeout Checklist" section with standard closeout steps.
- "actions" should assign each issue to the responsible trade.
- "risks" should flag high-priority or inspection-blocking items.
- Do not invent issues not mentioned in the source.`,
};

function buildFieldBriefUserPrompt(args: {
  sourceText: string;
  sourceType: FieldBriefSourceType;
  context?: FieldBriefContext;
}): string {
  const parts: string[] = [];

  if (args.context?.siteName) {
    parts.push(`Site/Project: ${args.context.siteName}`);
  }
  if (args.context?.customerName) {
    parts.push(`Customer: ${args.context.customerName}`);
  }
  if (args.context?.preparedFor) {
    parts.push(`Prepared for: ${args.context.preparedFor}`);
  }

  parts.push(`Source type: ${args.sourceType}`);
  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push(args.sourceText);

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildFieldBriefSystemPrompt(
  templateId: FieldBriefTemplateId
): string {
  return SYSTEM_PROMPTS[templateId];
}

export { buildFieldBriefUserPrompt };

export function formatFieldBriefMarkdown(report: FieldBriefReport): string {
  const lines = [
    `# ${report.title}`,
    '',
    `Generated: ${new Date(report.generatedAt).toLocaleString('en-US')}`,
    '',
    '## Summary',
    report.summary,
    '',
  ];

  for (const section of report.sections) {
    lines.push(`## ${section.title}`);
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  lines.push('## Action Items');
  for (const action of report.actions) {
    lines.push(`- ${action}`);
  }
  lines.push('');

  lines.push('## Risks');
  for (const risk of report.risks) {
    lines.push(`- ${risk}`);
  }
  lines.push('');

  if (report.callbackScript) {
    lines.push('## Callback Script', report.callbackScript, '');
  }

  return lines.join('\n').trim();
}

export function isFieldBriefTemplateId(
  value: unknown
): value is FieldBriefTemplateId {
  return typeof value === 'string' && value in FIELD_BRIEF_TEMPLATES;
}
