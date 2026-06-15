import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { getUserInfo } from '@/shared/models/user';

export default async function SecurityPage() {
  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.security');

  return (
    <div className="space-y-8">
      <div className="max-w-md rounded-lg border p-6">
        <h3 className="text-lg font-medium">{t('reset_password.title')}</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Password and account security are managed through your authentication
          provider. To change your password, please use the sign-in page or
          contact support.
        </p>
      </div>
    </div>
  );
}
