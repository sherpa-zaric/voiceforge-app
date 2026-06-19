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

const COMPLETE_KEYWORDS = [
  'completed',
  'finished',
  'installed',
  'poured',
  'framed',
  'started',
  'delivered',
  'set',
  'closed',
  'approved',
];

const DELAY_KEYWORDS = [
  'delay',
  'delayed',
  'waiting',
  'blocked',
  'hold',
  'late',
  'missing',
  'backorder',
  'weather',
  'access',
];

const SAFETY_KEYWORDS = [
  'safety',
  'injury',
  'injuries',
  'hazard',
  'incident',
  'unsafe',
  'water',
  'electrical',
  'leak',
];

const ACTION_KEYWORDS = [
  'need',
  'needs',
  'tomorrow',
  'follow up',
  'call',
  'schedule',
  'verify',
  'approve',
  'approval',
  'check',
  'confirm',
  'send',
];

const URGENT_KEYWORDS = [
  'urgent',
  'emergency',
  'leak',
  'water',
  'no heat',
  'no power',
  'safety',
  'today',
  'asap',
];

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitNotes(input: string): string[] {
  return input
    .replace(/\r/g, '\n')
    .split(/\n+|[.!?;]\s+/)
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 40);
}

function includesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function pickItems(
  sentences: string[],
  keywords: string[],
  fallbackCount = 3
): string[] {
  const matches = sentences.filter((sentence) =>
    includesAny(sentence, keywords)
  );
  const selected =
    matches.length > 0 ? matches : sentences.slice(0, fallbackCount);
  return unique(selected).slice(0, 6);
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map(cleanText))).filter(Boolean);
}

function getPhoneNumber(input: string): string | null {
  const match = input.match(
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/
  );
  return match ? match[0] : null;
}

function getUrgency(sentences: string[]): string {
  const urgent = sentences.find((sentence) =>
    includesAny(sentence, URGENT_KEYWORDS)
  );
  if (urgent) return `High - ${urgent}`;
  return 'Normal - no emergency language detected in the source note.';
}

function getTrade(item: string): string {
  const lower = item.toLowerCase();
  if (lower.includes('electric') || lower.includes('outlet'))
    return 'Electrical';
  if (
    lower.includes('plumb') ||
    lower.includes('sink') ||
    lower.includes('water')
  ) {
    return 'Plumbing';
  }
  if (lower.includes('paint')) return 'Painting';
  if (lower.includes('drywall') || lower.includes('seam')) return 'Drywall';
  if (lower.includes('tile') || lower.includes('floor')) return 'Flooring';
  if (lower.includes('label') || lower.includes('inspection'))
    return 'Closeout';
  return 'General';
}

function withFallback(items: string[], fallback: string): string[] {
  return items.length > 0 ? items : [fallback];
}

function buildConstructionReport(
  sentences: string[],
  context: FieldBriefContext
): Pick<FieldBriefReport, 'summary' | 'sections' | 'actions' | 'risks'> {
  const site = context.siteName || 'the site';
  const completed = pickItems(sentences, COMPLETE_KEYWORDS);
  const delays = pickItems(sentences, DELAY_KEYWORDS, 2).filter((item) =>
    includesAny(item, DELAY_KEYWORDS)
  );
  const safety = pickItems(sentences, SAFETY_KEYWORDS, 2).filter((item) =>
    includesAny(item, SAFETY_KEYWORDS)
  );
  const next = pickItems(
    sentences,
    ['tomorrow', 'next', 'need', 'verify', 'finish'],
    3
  );
  const actions = pickItems(sentences, ACTION_KEYWORDS, 3);

  return {
    summary: `Daily field report prepared for ${site}. The note was organized into completed work, blockers, safety items, and next steps.`,
    sections: [
      {
        title: 'Completed Work',
        items: withFallback(
          completed,
          'No completed work was clearly identified.'
        ),
      },
      {
        title: 'Delays and Blockers',
        items: withFallback(
          delays,
          'No delay or blocker was clearly identified.'
        ),
      },
      {
        title: 'Safety Notes',
        items: withFallback(safety, 'No safety incident was reported.'),
      },
      {
        title: 'Next Steps',
        items: withFallback(
          next,
          'Confirm tomorrow priorities with the field lead.'
        ),
      },
    ],
    actions: withFallback(
      actions,
      'Review and send the daily log to stakeholders.'
    ),
    risks: withFallback(
      delays.concat(safety),
      'No major risk was detected in the note.'
    ),
  };
}

function buildVoicemailReport(
  sourceText: string,
  sentences: string[],
  context: FieldBriefContext
): Pick<
  FieldBriefReport,
  'summary' | 'sections' | 'actions' | 'risks' | 'callbackScript'
> {
  const phone = getPhoneNumber(sourceText);
  const customer = context.customerName || 'the customer';
  const urgency = getUrgency(sentences);
  const needs = pickItems(
    sentences,
    ['need', 'leak', 'repair', 'come out', 'call', 'address'],
    4
  );
  const availability = pickItems(
    sentences,
    ['today', 'tomorrow', 'after', 'before', 'home'],
    2
  );

  return {
    summary: `Job brief prepared from a customer voicemail for ${customer}. Urgency: ${urgency}`,
    sections: [
      {
        title: 'Customer Need',
        items: withFallback(
          needs,
          'Clarify the requested service during callback.'
        ),
      },
      {
        title: 'Contact and Scheduling',
        items: withFallback(
          [phone ? `Callback number: ${phone}` : '', ...availability].filter(
            Boolean
          ),
          'Confirm phone number, address, and available service window.'
        ),
      },
      {
        title: 'Technician Brief',
        items: withFallback(
          needs.map((item) => `${item} (${getTrade(item)})`),
          'Dispatch technician after confirming scope and access.'
        ),
      },
    ],
    actions: withFallback(
      [
        phone ? `Call ${phone} back.` : 'Call the customer back.',
        'Confirm address, access, and preferred appointment window.',
        'Create or update the work order before dispatch.',
      ],
      'Call the customer back.'
    ),
    risks: withFallback(
      sentences.filter((sentence) => includesAny(sentence, URGENT_KEYWORDS)),
      'No urgent risk language was detected.'
    ),
    callbackScript: `Hi, this is calling about your service request. I want to confirm the issue, the address, and the best service window before we dispatch a technician.`,
  };
}

function buildPunchListReport(
  sentences: string[]
): Pick<FieldBriefReport, 'summary' | 'sections' | 'actions' | 'risks'> {
  const issues = unique(sentences).slice(0, 12);
  const formattedIssues = issues.map((item) => {
    const priority = includesAny(item, SAFETY_KEYWORDS) ? 'High' : 'Normal';
    return `${priority} priority - ${getTrade(item)} - ${item}`;
  });
  const highRisk = formattedIssues.filter((item) => item.startsWith('High'));

  return {
    summary:
      'Punch walk notes organized into issue register, responsible trade, and closeout actions.',
    sections: [
      {
        title: 'Issue Register',
        items: withFallback(
          formattedIssues,
          'No punch items were clearly identified.'
        ),
      },
      {
        title: 'Closeout Checklist',
        items: [
          'Assign each issue to the responsible trade.',
          'Confirm photo evidence after correction.',
          'Re-walk high priority items before final sign-off.',
        ],
      },
    ],
    actions: withFallback(
      issues.map((item) => `Assign ${getTrade(item)}: ${item}`),
      'Assign punch list items to responsible trades.'
    ),
    risks: withFallback(highRisk, 'No high priority punch risk was detected.'),
  };
}

export function generateFieldBriefReport({
  templateId,
  sourceText,
  sourceType,
  context = {},
}: {
  templateId: FieldBriefTemplateId;
  sourceText: string;
  sourceType: FieldBriefSourceType;
  context?: FieldBriefContext;
}): FieldBriefReport {
  const template = FIELD_BRIEF_TEMPLATES[templateId];
  const cleanedSource = cleanText(sourceText);
  const sentences = splitNotes(cleanedSource);

  const partial: Pick<
    FieldBriefReport,
    'summary' | 'sections' | 'actions' | 'risks' | 'callbackScript'
  > =
    templateId === 'construction-daily-log'
      ? buildConstructionReport(sentences, context)
      : templateId === 'voicemail-to-job-brief'
        ? buildVoicemailReport(cleanedSource, sentences, context)
        : buildPunchListReport(sentences);

  const report: FieldBriefReport = {
    templateId,
    title: template.title,
    generatedAt: new Date().toISOString(),
    sourceType,
    summary: partial.summary,
    sections: partial.sections,
    actions: partial.actions,
    risks: partial.risks,
    callbackScript: partial.callbackScript,
    markdown: '',
  };

  report.markdown = formatFieldBriefMarkdown(report);
  return report;
}

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
