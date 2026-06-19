import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import {
  FIELD_BRIEF_TEMPLATES,
  isFieldBriefTemplateId,
} from '@/shared/lib/fieldbrief';

import { FieldBriefWorkspace } from '../../components/fieldbrief-workspace';

export function generateStaticParams() {
  return Object.keys(FIELD_BRIEF_TEMPLATES).map((tool) => ({ tool }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;

  if (!isFieldBriefTemplateId(tool)) {
    return {};
  }

  const template = FIELD_BRIEF_TEMPLATES[tool];

  return {
    title: `${template.title} - FieldBrief AI`,
    description: `Generate a professional ${template.title.toLowerCase()} from rough voice notes, voicemails, or field memos.`,
  };
}

export default async function FieldBriefToolPage({
  params,
}: {
  params: Promise<{ locale: string; tool: string }>;
}) {
  const { locale, tool } = await params;
  setRequestLocale(locale);

  if (!isFieldBriefTemplateId(tool)) {
    return notFound();
  }

  return <FieldBriefWorkspace initialTemplateId={tool} mode="tool" />;
}
