export const routing = {
  locales: ['en', 'ja'] as const,
  defaultLocale: 'ja' as const,
};

export type Locale = (typeof routing.locales)[number];
