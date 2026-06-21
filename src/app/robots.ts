import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';

export default function robots(): MetadataRoute.Robots {
  const appUrl = envConfigs.app_url;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/*?*q=',
        '/blog',
        '/blog/*',
        '/docs',
        '/docs/*',
        '/en/blog',
        '/en/blog/*',
        '/en/docs',
        '/en/docs/*',
        '/en/privacy-policy',
        '/en/showcases',
        '/en/terms-of-service',
        '/en/updates',
        '/showcases',
        '/updates',
        '/privacy-policy',
        '/terms-of-service',
        '/settings/*',
        '/activity/*',
        '/admin/*',
        '/api/*',
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
