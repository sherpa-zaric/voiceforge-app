import { envConfigs } from '@/config';
import { defaultTheme } from '@/config/theme';

type ThemeModule = Record<string, any> & { default?: any };
type ThemeLoader = () => Promise<ThemeModule>;

const asThemeModule = (module: unknown) => module as ThemeModule;

const defaultPageLoaders: Record<string, ThemeLoader> = {
  'dynamic-page': () =>
    import('@/themes/default/pages/dynamic-page').then(asThemeModule),
  'static-page': () =>
    import('@/themes/default/pages/static-page').then(asThemeModule),
};

const defaultLayoutLoaders: Record<string, ThemeLoader> = {
  landing: () =>
    import('@/themes/default/layouts/landing').then(asThemeModule),
};

const defaultBlockLoaders: Record<string, ThemeLoader> = {
  blog: () => import('@/themes/default/blocks/blog').then(asThemeModule),
  'blog-detail': () =>
    import('@/themes/default/blocks/blog-detail').then(asThemeModule),
  cta: () => import('@/themes/default/blocks/cta').then(asThemeModule),
  faq: () => import('@/themes/default/blocks/faq').then(asThemeModule),
  features: () =>
    import('@/themes/default/blocks/features').then(asThemeModule),
  'features-accordion': () =>
    import('@/themes/default/blocks/features-accordion').then(asThemeModule),
  'features-flow': () =>
    import('@/themes/default/blocks/features-flow').then(asThemeModule),
  'features-list': () =>
    import('@/themes/default/blocks/features-list').then(asThemeModule),
  'features-media': () =>
    import('@/themes/default/blocks/features-media').then(asThemeModule),
  'features-step': () =>
    import('@/themes/default/blocks/features-step').then(asThemeModule),
  footer: () => import('@/themes/default/blocks/footer').then(asThemeModule),
  header: () => import('@/themes/default/blocks/header').then(asThemeModule),
  hero: () => import('@/themes/default/blocks/hero').then(asThemeModule),
  logos: () => import('@/themes/default/blocks/logos').then(asThemeModule),
  'page-detail': () =>
    import('@/themes/default/blocks/page-detail').then(asThemeModule),
  pricing: () => import('@/themes/default/blocks/pricing').then(asThemeModule),
  showcases: () =>
    import('@/themes/default/blocks/showcases').then(asThemeModule),
  'showcases-flow': () =>
    import('@/themes/default/blocks/showcases-flow').then(asThemeModule),
  'social-avatars': () =>
    import('@/themes/default/blocks/social-avatars').then(asThemeModule),
  stats: () => import('@/themes/default/blocks/stats').then(asThemeModule),
  subscribe: () =>
    import('@/themes/default/blocks/subscribe').then(asThemeModule),
  testimonials: () =>
    import('@/themes/default/blocks/testimonials').then(asThemeModule),
  updates: () => import('@/themes/default/blocks/updates').then(asThemeModule),
};

/**
 * get active theme
 */
export function getActiveTheme(): string {
  const theme = envConfigs.theme as string;

  if (theme) {
    return theme;
  }

  return defaultTheme;
}

/**
 * load theme page
 */
export async function getThemePage(pageName: string, theme?: string) {
  const loadTheme = theme || getActiveTheme();
  const loader = loadTheme === defaultTheme ? defaultPageLoaders[pageName] : null;

  if (!loader) {
    throw new Error(`Unknown theme page "${pageName}" for theme "${loadTheme}"`);
  }

  const module = await loader();
  return module.default;
}

/**
 * load theme layout
 */
export async function getThemeLayout(layoutName: string, theme?: string) {
  const loadTheme = theme || getActiveTheme();
  const loader =
    loadTheme === defaultTheme ? defaultLayoutLoaders[layoutName] : null;

  if (!loader) {
    throw new Error(
      `Unknown theme layout "${layoutName}" for theme "${loadTheme}"`
    );
  }

  const module = await loader();
  return module.default;
}

/**
 * convert kebab-case to PascalCase
 */
function kebabToPascalCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * load theme block
 */
export async function getThemeBlock(blockName: string, theme?: string) {
  const loadTheme = theme || getActiveTheme();
  const pascalCaseName = kebabToPascalCase(blockName);
  const loader =
    loadTheme === defaultTheme ? defaultBlockLoaders[blockName] : null;

  if (!loader) {
    throw new Error(`Unknown theme block "${blockName}" for theme "${loadTheme}"`);
  }

  const module = await loader();
  // Try PascalCase named export first, then original blockName
  const component = module[pascalCaseName] || module[blockName];
  if (!component) {
    throw new Error(`No valid export found in block "${blockName}"`);
  }

  return component;
}
