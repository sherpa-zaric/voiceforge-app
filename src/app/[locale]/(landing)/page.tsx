import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

import { FieldBriefWorkspace } from './components/fieldbrief-workspace';

export const metadata: Metadata = {
  title: 'FieldBrief AI - Voice Notes to Professional Reports',
  description:
    'Turn voice notes, voicemails, and field memos into construction daily logs, job briefs, punch lists, and action items.',
};

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FieldBriefWorkspace mode="home" />;
}
