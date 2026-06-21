'use client';

import { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  HardHat,
  Loader2,
  MessageSquareText,
  Mic,
  PhoneCall,
  Radio,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { useLocale } from 'next-intl';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppContext } from '@/shared/contexts/app';
import {
  FIELD_BRIEF_TEMPLATES,
  FieldBriefReport,
  FieldBriefSourceType,
  FieldBriefTemplateId,
  formatFieldBriefMarkdown,
} from '@/shared/lib/fieldbrief';
import { cn } from '@/shared/lib/utils';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal: boolean;
          0: { transcript: string };
        }>;
      }) => void)
    | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const templateIcons: Record<FieldBriefTemplateId, ComponentType<any>> = {
  'construction-daily-log': HardHat,
  'voicemail-to-job-brief': PhoneCall,
  'punch-list': ClipboardCheck,
};

const sourceOptions: Array<{
  id: FieldBriefSourceType;
  label: string;
  icon: ComponentType<any>;
}> = [
  { id: 'voice-note', label: 'Voice note', icon: Mic },
  { id: 'voicemail', label: 'Voicemail', icon: PhoneCall },
  { id: 'field-notes', label: 'Field notes', icon: FileText },
];

const workflowStats = [
  { label: 'Daily reports', value: 'Site work, delays, safety, next steps' },
  { label: 'Punch lists', value: 'Rooms, issues, priorities, owners' },
  { label: 'Job briefs', value: 'Caller, location, urgency, dispatch notes' },
];

const templateSummaries: Record<
  FieldBriefTemplateId,
  {
    description: string;
    previewTitle: string;
    previewRows: Array<{ label: string; value: string }>;
  }
> = {
  'construction-daily-log': {
    description:
      'Turn end-of-day voice notes into a clean construction daily report.',
    previewTitle: 'Daily Report Preview',
    previewRows: [
      { label: 'Project', value: 'Riverside retail shell' },
      { label: 'Crew', value: '8 on site, 7:00 AM - 3:30 PM' },
      {
        label: 'Work completed',
        value: 'West wall framing, storefront blocking',
      },
      { label: 'Delays', value: 'Ceiling grid delivery moved to tomorrow' },
      { label: 'Safety', value: 'No injuries reported' },
      { label: 'Next steps', value: 'Finish rough-in and verify delivery' },
    ],
  },
  'punch-list': {
    description:
      'Turn a site walk or inspection memo into assigned closeout items.',
    previewTitle: 'Punch List Preview',
    previewRows: [
      { label: 'Area', value: 'North corridor / Unit 207 / Lobby' },
      { label: 'Issues', value: 'Drywall seam, outlet cover, cracked tile' },
      { label: 'Priority', value: 'Inspection blockers first' },
      { label: 'Trade', value: 'Drywall, electrical, flooring' },
      { label: 'Status', value: 'Open until verified' },
    ],
  },
  'voicemail-to-job-brief': {
    description: 'Turn customer voicemails into a dispatch-ready job brief.',
    previewTitle: 'Job Brief Preview',
    previewRows: [
      { label: 'Caller', value: 'Karen, 415-555-0192' },
      { label: 'Location', value: '42 Cedar Lane' },
      { label: 'Request', value: 'Bathroom sink leaking under cabinet' },
      { label: 'Urgency', value: 'Water reaching vanity, home after 2 PM' },
      { label: 'Next step', value: 'Call back and schedule technician' },
    ],
  },
};

interface FieldBriefWorkspaceProps {
  initialTemplateId?: FieldBriefTemplateId;
  mode?: 'home' | 'tool';
}

export function FieldBriefWorkspace({
  initialTemplateId = 'construction-daily-log',
  mode = 'home',
}: FieldBriefWorkspaceProps) {
  const locale = useLocale();
  const { user, setIsShowSignModal } = useAppContext();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [templateId, setTemplateId] =
    useState<FieldBriefTemplateId>(initialTemplateId);
  const [sourceType, setSourceType] =
    useState<FieldBriefSourceType>('voice-note');
  const [sourceText, setSourceText] = useState('');
  const [siteName, setSiteName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [report, setReport] = useState<FieldBriefReport | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [selectedAudioName, setSelectedAudioName] = useState<string | null>(
    null
  );

  const template = FIELD_BRIEF_TEMPLATES[templateId];
  const markdown = useMemo(
    () => (report ? formatFieldBriefMarkdown(report) : ''),
    [report]
  );
  const href = (path: string) => {
    if (path === '/') return `/${locale}`;
    return `/${locale}${path}`;
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    setSpeechSupported(Boolean(SpeechRecognition));

    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const selectTemplate = (nextTemplateId: FieldBriefTemplateId) => {
    setTemplateId(nextTemplateId);
    setSourceText('');
    setReport(null);
    setTaskId(null);
    setStatus('idle');
    setError(null);
    setSelectedAudioName(null);
  };

  const handleAudioUpload = (file: File | null) => {
    if (!file) return;
    setSourceType('voice-note');
    setSelectedAudioName(file.name);
    setStatus('idle');
    setError(null);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = ((window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition) as
      | SpeechRecognitionConstructor
      | undefined;

    if (!SpeechRecognition) {
      setStatus('error');
      setError('Voice input is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setSourceType('voice-note');
      setIsListening(true);
      setInterimTranscript('');
      setStatus('idle');
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setInterimTranscript('');
      if (event.error && event.error !== 'no-speech') {
        setStatus('error');
        setError(`Voice input failed: ${event.error}`);
      }
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText.trim()) {
        setSourceText((current) => {
          const separator = current.trim() ? '\n' : '';
          return `${current.trimEnd()}${separator}${finalText.trim()}`;
        });
      }

      setInterimTranscript(interimText.trim());
    };

    try {
      recognition.start();
    } catch {
      setStatus('error');
      setError('Voice input could not be started.');
    }
  };

  const generateReport = async () => {
    if (!sourceText.trim()) return;
    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    setStatus('loading');
    setError(null);
    setCopied(false);

    try {
      const response = await fetch('/api/workflow/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          sourceType,
          sourceText,
          context: {
            siteName: siteName.trim(),
            customerName: customerName.trim(),
          },
        }),
      });
      const data = await response.json();
      if (data.code !== 0) {
        throw new Error(data.message || 'Report generation failed');
      }
      setReport(data.data.report);
      setTaskId(data.data.task?.id || null);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Report generation failed');
    }
  };

  const copyReport = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadReport = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${templateId}-fieldbrief.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="bg-white text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-16 pb-7 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:pt-16 lg:pb-6">
          <div className="flex flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="max-w-2xl space-y-4">
                <h1 className="text-4xl leading-[1.05] font-semibold tracking-normal text-slate-950 sm:text-5xl">
                  Construction field reporting software for voice notes
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                  Upload a recording, record from your phone, or paste rough
                  site notes. FieldBrief turns messy field updates into daily
                  reports, punch lists, and job briefs your team can use.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="h-11 bg-slate-950 px-5 text-white hover:bg-slate-800"
                >
                  <UploadCloud className="size-4" />
                  Upload audio
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSourceText(template.sample)}
                  className="h-11 border-slate-300 px-5"
                >
                  <MessageSquareText className="size-4" />
                  Try sample
                </Button>
              </div>

              <div className="grid gap-3">
                {workflowStats.map((item) => (
                  <div
                    key={item.label}
                    className="grid gap-1 border-l-2 border-slate-200 py-1 pl-4"
                  >
                    <div className="text-sm font-semibold text-slate-950">
                      {item.label}
                    </div>
                    <div className="text-sm leading-6 text-slate-600">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {mode === 'home' && (
              <div className="grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-3">
                <div>
                  <div className="text-2xl font-semibold text-slate-950">
                    300
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    trial credits for new users
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-slate-950">5</div>
                  <div className="mt-1 text-xs text-slate-500">
                    credits per generated report
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-slate-950">3</div>
                  <div className="mt-1 text-xs text-slate-500">
                    focused field workflows
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            id="workspace"
            className="grid overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm lg:grid-cols-[0.92fr_1.08fr]"
          >
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-white p-4 lg:border-r lg:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    Field report builder
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Select a workflow, then add notes or dictation.
                  </div>
                </div>
                <Badge variant="outline" className="border-slate-300">
                  {template.creditCost} credits
                </Badge>
              </div>

              <div className="grid gap-2">
                {Object.values(FIELD_BRIEF_TEMPLATES).map((item) => {
                  const Icon = templateIcons[item.id];
                  const active = item.id === templateId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTemplate(item.id)}
                      className={cn(
                        'flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-md',
                          active ? 'bg-blue-600 text-white' : 'bg-slate-100'
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {templateSummaries[item.id].description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {sourceOptions.map((option) => {
                  const Icon = option.icon;
                  const active = sourceType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSourceType(option.id)}
                      className={cn(
                        'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border px-2 text-center text-xs font-medium transition-colors',
                        active
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      )}
                    >
                      <Icon className="size-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) =>
                  handleAudioUpload(event.target.files?.[0] || null)
                }
              />

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Input
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder="Site, project, or company"
                  className="border-slate-200 bg-white"
                />
                <Input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer or prepared-for name"
                  className="border-slate-200 bg-white"
                />
              </div>

              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={isListening ? 'default' : 'outline'}
                    onClick={toggleVoiceInput}
                    className="min-w-36 border-slate-300"
                    disabled={!speechSupported && !isListening}
                    aria-pressed={isListening}
                  >
                    {isListening ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Radio className="size-4" />
                    )}
                    {isListening ? 'Stop recording' : 'Record now'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => audioInputRef.current?.click()}
                    className="border-slate-300"
                  >
                    <UploadCloud className="size-4" />
                    Upload
                  </Button>
                </div>
                <div className="min-h-5 text-xs leading-5 text-slate-500">
                  {isListening || interimTranscript
                    ? interimTranscript || 'Listening...'
                    : selectedAudioName
                      ? `Audio selected: ${selectedAudioName}`
                      : speechSupported
                        ? 'Record in browser or attach a site audio file.'
                        : 'Browser recording unavailable; paste a transcript or field note.'}
                </div>
              </div>

              <Textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={`Record, upload, or ${template.placeholder.toLowerCase()}`}
                className="min-h-[150px] resize-none border-slate-200 bg-white leading-6"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={generateReport}
                  disabled={status === 'loading' || !sourceText.trim()}
                  className="min-w-44 bg-blue-600 text-white hover:bg-blue-700"
                >
                  {status === 'loading' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <BriefcaseBusiness className="size-4" />
                  )}
                  Generate report
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSourceText(template.sample)}
                  className="border-slate-300"
                >
                  Use sample
                </Button>
              </div>

              {status === 'error' && error && (
                <div className="border-destructive/30 bg-destructive/5 text-destructive flex gap-2 rounded-md border p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex min-h-[520px] flex-col bg-slate-50">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-5">
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    {report
                      ? 'Generated Report'
                      : templateSummaries[templateId].previewTitle}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Structured output for copying, downloading, and saving.
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyReport}
                    disabled={!report}
                    aria-label="Copy report"
                    title="Copy report"
                    className="border-slate-300 bg-white"
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={downloadReport}
                    disabled={!report}
                    aria-label="Download report"
                    title="Download report"
                    className="border-slate-300 bg-white"
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-5">
                {report ? (
                  <ReportPreview report={report} />
                ) : (
                  <EmptyReportState templateId={templateId} />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white p-4 sm:p-5">
                <div className="text-xs text-slate-500">
                  {copied
                    ? 'Report copied'
                    : taskId
                      ? `Task saved: ${taskId.slice(0, 8)}`
                      : 'Ready for structured output'}
                </div>
                <div className="flex gap-2">
                  {mode === 'tool' && (
                    <Button asChild variant="ghost">
                      <Link href={href('/')}>Open homepage</Link>
                    </Button>
                  )}
                  <Button
                    asChild
                    variant="outline"
                    className="border-slate-300"
                  >
                    <Link href={href('/activity/ai-tasks?type=text')}>
                      View activity
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {mode === 'home' && <WorkflowSections />}
    </main>
  );
}

function ReportPreview({ report }: { report: FieldBriefReport }) {
  return (
    <article className="space-y-6">
      <div>
        <div className="text-muted-foreground text-xs uppercase">
          {new Date(report.generatedAt).toLocaleString('en-US')}
        </div>
        <h2 className="mt-2 text-2xl font-semibold">{report.title}</h2>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          {report.summary}
        </p>
      </div>

      {report.sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h3 className="text-sm font-semibold">{section.title}</h3>
          <ul className="space-y-2">
            {section.items.map((item) => (
              <li
                key={item}
                className="border-border bg-background rounded-md border p-3 text-sm leading-6"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Action Items</h3>
          <ul className="space-y-2">
            {report.actions.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6">
                <CheckCircle2 className="text-primary mt-1 size-4 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Risks</h3>
          <ul className="space-y-2">
            {report.risks.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6">
                <AlertTriangle className="mt-1 size-4 shrink-0 text-amber-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {report.callbackScript && (
        <section className="border-border bg-muted/40 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">Callback Script</h3>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {report.callbackScript}
          </p>
        </section>
      )}
    </article>
  );
}

function EmptyReportState({
  templateId,
}: {
  templateId: FieldBriefTemplateId;
}) {
  const Icon = templateIcons[templateId];
  const preview = templateSummaries[templateId];
  return (
    <div className="grid h-full min-h-[420px] content-start gap-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Icon className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              {preview.previewTitle}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
              {preview.description}
            </p>
          </div>
        </div>

        <div className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
          {preview.previewRows.map((row) => (
            <div
              key={row.label}
              className="grid gap-1 p-3 sm:grid-cols-[9rem_1fr]"
            >
              <div className="text-xs font-medium text-slate-500 uppercase">
                {row.label}
              </div>
              <div className="text-sm leading-6 text-slate-800">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4" />
          What happens after generation
        </div>
        <p>
          FieldBrief extracts the useful details, organizes them into a formal
          report, and saves the result to your AI task history.
        </p>
      </div>
    </div>
  );
}

function WorkflowSections() {
  const locale = useLocale();
  const href = (path: string) => {
    if (path === '/') return `/${locale}`;
    return `/${locale}${path}`;
  };

  const toolCards = [
    {
      id: 'construction-daily-log' as const,
      title: 'Construction Daily Report',
      text: 'Convert superintendent notes into completed work, delays, safety notes, and next steps.',
      cta: 'Create daily report',
      icon: HardHat,
    },
    {
      id: 'punch-list' as const,
      title: 'Punch List',
      text: 'Turn walkthrough notes into clear closeout items with area, issue, trade, and priority.',
      cta: 'Build punch list',
      icon: ClipboardCheck,
    },
    {
      id: 'voicemail-to-job-brief' as const,
      title: 'Voicemail to Job Brief',
      text: 'Extract the caller, address, job request, urgency, and dispatch-ready next step.',
      cta: 'Summarize voicemail',
      icon: PhoneCall,
    },
  ];

  const steps = [
    {
      title: 'Capture',
      text: 'Upload audio, record from the browser, or paste the rough notes already in your phone.',
      icon: UploadCloud,
    },
    {
      title: 'Structure',
      text: 'FieldBrief identifies people, locations, completed work, blockers, risks, and actions.',
      icon: FileText,
    },
    {
      title: 'Share',
      text: 'Copy, download, or save the finished report to activity history for later review.',
      icon: CheckCircle2,
    },
  ];

  return (
    <>
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <h2 className="text-3xl font-semibold tracking-normal text-slate-950">
                Start with the report you need.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Each tool has a focused landing page and a matching output
                format. The homepage simply routes users to the right field
                workflow.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {toolCards.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={href(`/tools/${item.id}`)}
                    className="group flex min-h-64 flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300"
                  >
                    <div>
                      <span className="flex size-11 items-center justify-center rounded-md bg-slate-100 text-slate-800">
                        <Icon className="size-5" />
                      </span>
                      <h3 className="mt-5 text-lg font-semibold text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {item.text}
                      </p>
                    </div>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                      {item.cta}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-normal text-slate-950">
              Built for the way field notes actually happen.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
              A superintendent rarely writes perfect prose at the end of the
              day. FieldBrief is designed around rough notes, quick voice
              updates, customer voicemails, and walkthrough observations.
            </p>
            <div className="mt-8 grid gap-4">
              {steps.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                        <Icon className="size-5" />
                      </span>
                      {index < steps.length - 1 && (
                        <span className="my-2 h-full min-h-8 w-px bg-slate-200" />
                      )}
                    </div>
                    <div className="pb-5">
                      <h3 className="text-sm font-semibold text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Example output
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Clean enough to send, structured enough to track.
                </p>
              </div>
              <Badge variant="outline" className="border-slate-300 bg-white">
                Markdown
              </Badge>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase">
                  Daily report
                </div>
                <h4 className="mt-2 text-xl font-semibold text-slate-950">
                  Riverside Retail Shell - Field Report
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Crew completed west wall framing and storefront blocking.
                  Electrical rough-in started in units 101 and 102. Ceiling grid
                  delivery is delayed until tomorrow.
                </p>
              </div>

              <div className="grid gap-2">
                {[
                  'Completed Work: west wall framing; storefront blocking',
                  'Delays: ceiling grid delivery moved to tomorrow',
                  'Safety Notes: no injuries reported',
                  'Next Steps: finish rough-in; confirm access panel approval',
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild className="bg-slate-950 hover:bg-slate-800">
                  <Link href={href('/tools/construction-daily-log')}>
                    Try daily report
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-slate-300">
                  <Link href={href('/tools/punch-list')}>Try punch list</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-normal">
              Clear SEO position, clear product promise.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              The product should rank around proven search categories, while
              using voice and upload support as the practical differentiation.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              'construction daily report software',
              'construction daily log software',
              'punch list app',
              'punch list software',
              'field report app',
              'voicemail to text for job notes',
            ].map((keyword) => (
              <div
                key={keyword}
                className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-slate-100"
              >
                {keyword}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
