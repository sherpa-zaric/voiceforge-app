'use client';

import { ComponentType, useMemo, useState } from 'react';
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
  Mic,
  PhoneCall,
  Sparkles,
  Wrench,
} from 'lucide-react';

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
  { label: 'Workflow templates', value: '3' },
  { label: 'Credits per report', value: '5' },
  { label: 'Output format', value: 'Markdown' },
];

interface FieldBriefWorkspaceProps {
  initialTemplateId?: FieldBriefTemplateId;
  mode?: 'home' | 'tool';
}

export function FieldBriefWorkspace({
  initialTemplateId = 'construction-daily-log',
  mode = 'home',
}: FieldBriefWorkspaceProps) {
  const { user, setIsShowSignModal } = useAppContext();
  const [templateId, setTemplateId] =
    useState<FieldBriefTemplateId>(initialTemplateId);
  const [sourceType, setSourceType] =
    useState<FieldBriefSourceType>('voice-note');
  const [sourceText, setSourceText] = useState<string>(
    FIELD_BRIEF_TEMPLATES[initialTemplateId].sample
  );
  const [siteName, setSiteName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [report, setReport] = useState<FieldBriefReport | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const template = FIELD_BRIEF_TEMPLATES[templateId];
  const markdown = useMemo(
    () => (report ? formatFieldBriefMarkdown(report) : ''),
    [report]
  );

  const selectTemplate = (nextTemplateId: FieldBriefTemplateId) => {
    setTemplateId(nextTemplateId);
    setSourceText(FIELD_BRIEF_TEMPLATES[nextTemplateId].sample);
    setReport(null);
    setTaskId(null);
    setStatus('idle');
    setError(null);
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
    <main className="bg-background text-foreground">
      <section className="border-border border-b">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.94fr_1.06fr] lg:px-8 lg:py-10">
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <Badge variant="outline" className="gap-1.5">
                <Sparkles className="size-3.5" />
                FieldBrief AI
              </Badge>
              <div className="max-w-2xl space-y-3">
                <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
                  Record once. Get the field report.
                </h1>
                <p className="text-muted-foreground max-w-xl text-base leading-7">
                  Turn rough voice notes, voicemails, and site walk memos into
                  daily logs, job briefs, punch lists, action items, and clean
                  Markdown reports.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {workflowStats.map((item) => (
                <div
                  key={item.label}
                  className="border-border bg-card rounded-lg border p-4"
                >
                  <div className="text-2xl font-semibold">{item.value}</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              {Object.values(FIELD_BRIEF_TEMPLATES).map((item) => {
                const Icon = templateIcons[item.id];
                const active = item.id === templateId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTemplate(item.id)}
                    className={cn(
                      'border-border bg-card hover:bg-accent/40 flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors',
                      active && 'border-primary bg-primary/5'
                    )}
                  >
                    <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-md">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {item.title}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {item.category} template
                      </span>
                    </span>
                    {active ? (
                      <CheckCircle2 className="text-primary size-5" />
                    ) : (
                      <ArrowRight className="text-muted-foreground size-4" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-border bg-card grid min-h-[640px] overflow-hidden rounded-lg border lg:grid-cols-[0.88fr_1.12fr]">
            <div className="border-border flex flex-col gap-5 border-b p-5 lg:border-r lg:border-b-0">
              <div>
                <div className="text-sm font-semibold">{template.title}</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {template.creditCost} credits per report
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {sourceOptions.map((option) => {
                  const Icon = option.icon;
                  const active = sourceType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSourceType(option.id)}
                      className={cn(
                        'border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                        active
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'hover:bg-accent text-muted-foreground'
                      )}
                    >
                      <Icon className="size-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3">
                <Input
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder="Site, project, or company"
                />
                <Input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer or prepared-for name"
                />
              </div>

              <Textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={template.placeholder}
                className="min-h-[250px] resize-none"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={generateReport}
                  disabled={status === 'loading' || !sourceText.trim()}
                  className="min-w-44"
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

            <div className="flex min-h-[520px] flex-col">
              <div className="border-border flex items-center justify-between gap-3 border-b p-5">
                <div>
                  <div className="text-sm font-semibold">Report Preview</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    Saved to AI Tasks after generation
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
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-5">
                {report ? (
                  <ReportPreview report={report} />
                ) : (
                  <EmptyReportState templateId={templateId} />
                )}
              </div>

              <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t p-5">
                <div className="text-muted-foreground text-xs">
                  {copied
                    ? 'Report copied'
                    : taskId
                      ? `Task saved: ${taskId.slice(0, 8)}`
                      : 'Ready for structured output'}
                </div>
                <div className="flex gap-2">
                  {mode === 'tool' && (
                    <Button asChild variant="ghost">
                      <Link href="/">Open dashboard</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link href="/activity/ai-tasks?type=text">
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
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 text-center">
      <span className="bg-muted flex size-14 items-center justify-center rounded-lg">
        <Icon className="size-7" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">
          {FIELD_BRIEF_TEMPLATES[templateId].shortTitle} preview
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
          Generated reports appear here with sections, action items, risks, and
          a downloadable Markdown file.
        </p>
      </div>
    </div>
  );
}

function WorkflowSections() {
  const useCases = [
    {
      title: 'Construction',
      text: 'Daily logs, punch walks, safety notes, owner updates.',
      icon: HardHat,
    },
    {
      title: 'Home service',
      text: 'Voicemail briefs, dispatch summaries, callback scripts.',
      icon: Wrench,
    },
    {
      title: 'Operations',
      text: 'Shift handoffs, manager notes, opening and closing checklists.',
      icon: BriefcaseBusiness,
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Badge variant="outline">Workflow first</Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal">
            Audio is the input. Finished work is the product.
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-7">
            FieldBrief stores each generated report as an AI task, so the
            existing account, credits, activity, billing, and admin systems keep
            working while the product moves from generic voice tools to field
            workflows.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {useCases.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="border-border bg-card rounded-lg border p-5"
              >
                <Icon className="size-5" />
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
