import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, HardHat, PhoneCall } from 'lucide-react';
import { setRequestLocale } from 'next-intl/server';

import { Badge } from '@/shared/components/ui/badge';
import { FIELD_BRIEF_TEMPLATES } from '@/shared/lib/fieldbrief';

export const metadata: Metadata = {
  title: 'FieldBrief AI Tools',
  description:
    'Generate construction daily logs, voicemail job briefs, and punch lists from rough field notes.',
};

const icons = {
  'construction-daily-log': HardHat,
  'voicemail-to-job-brief': PhoneCall,
  'punch-list': ClipboardCheck,
};

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="bg-background min-h-screen">
      <section className="border-border border-b">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <Badge variant="outline">FieldBrief workflows</Badge>
          <div className="mt-5 max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-normal">
              Choose a field workflow
            </h1>
            <p className="text-muted-foreground mt-3 text-base leading-7">
              Start with one of the high-value templates, generate a structured
              report, and keep the result in your AI task history.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        {Object.values(FIELD_BRIEF_TEMPLATES).map((template) => {
          const Icon = icons[template.id];
          return (
            <Link
              key={template.id}
              href={`/tools/${template.id}`}
              className="border-border bg-card hover:bg-accent/40 group rounded-lg border p-5 transition-colors"
            >
              <div className="bg-muted flex size-12 items-center justify-center rounded-md">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">{template.title}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {template.category} workflow. {template.creditCost} credits per
                report.
              </p>
              <span className="text-primary mt-5 inline-flex items-center gap-2 text-sm font-medium">
                Open tool
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
