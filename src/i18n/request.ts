import { getRequestConfig } from 'next-intl/server';

import { routing, type Locale } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const maybeLocale = await requestLocale;
  const locale: Locale = routing.locales.includes(maybeLocale as Locale)
    ? (maybeLocale as Locale)
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
