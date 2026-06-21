import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { getUserInfo } from '@/shared/models/user';
import { Pricing } from '@/themes/default/blocks/pricing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.pricing.metadata',
  canonicalUrl: '/pricing',
});

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // get current subscription
  let currentSubscription;
  try {
    const user = await getUserInfo();
    if (user) {
      currentSubscription = await getCurrentSubscription(user.id);
    }
  } catch (error) {
    console.log('getting current subscription failed:', error);
  }

  // get pricing data
  const t = await getTranslations('pages.pricing');
  const section = t.raw('page.sections.pricing');

  return (
    <main>
      {t.has('page.title') && <h1 className="sr-only">{t.raw('page.title')}</h1>}
      <Pricing section={section} currentSubscription={currentSubscription} />
    </main>
  );
}
