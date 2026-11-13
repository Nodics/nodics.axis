const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

/** Shared display direction for admitted interface and content locales; this grants no language or workflow authority. */
export function localeDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.has(new Intl.Locale(locale).language) ? 'rtl' : 'ltr';
}
