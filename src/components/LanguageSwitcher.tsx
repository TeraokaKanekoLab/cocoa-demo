'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import React from 'react';

import { routing, type Locale } from '@/i18n/routing';

const isLocale = (value: string): value is Locale => {
  return (routing.locales as readonly string[]).includes(value);
};

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;

  const setLocale = (nextLocale: Locale) => {
    if (!pathname) return;
    const parts = pathname.split('/');
    // ['', 'ja', ...]
    if (parts.length >= 2 && isLocale(parts[1])) {
      parts[1] = nextLocale;
      router.push(parts.join('/') || `/${nextLocale}`);
    } else {
      router.push(`/${nextLocale}${pathname.startsWith('/') ? pathname : `/${pathname}`}`);
    }
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm">
      <button
        type="button"
        onClick={() => setLocale('ja')}
        className={
          'rounded-md px-2 py-1 font-semibold transition ' +
          (locale === 'ja' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100')
        }
        aria-pressed={locale === 'ja'}
      >
        JA
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={
          'rounded-md px-2 py-1 font-semibold transition ' +
          (locale === 'en' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100')
        }
        aria-pressed={locale === 'en'}
      >
        EN
      </button>
    </div>
  );
}
