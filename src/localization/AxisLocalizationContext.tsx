import IntlMessageFormat from 'intl-messageformat';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { AxisPublicBootstrap } from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { AxisApiError } from './axisApiError';
import { loadLocalizationBundle } from './localizationBundleClient';
import type {
  AxisLocalizationBundle,
  AxisLocalizationState,
} from './localizationContracts';

/* eslint-disable react-refresh/only-export-components */

const LOCALE_STORAGE_KEY = 'nodics-axis-locale-v1';
const BUNDLE_STORAGE_PREFIX = 'nodics-axis-localization-bundle-v1:';
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

interface CachedBundle {
  readonly etag?: string | undefined;
  readonly bundle: AxisLocalizationBundle;
}

function direction(locale: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.has(new Intl.Locale(locale).language) ? 'rtl' : 'ltr';
}

function cachedBundle(storage: Storage, locale: string): CachedBundle | undefined {
  try {
    const raw = storage.getItem(`${BUNDLE_STORAGE_PREFIX}${locale}`);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as CachedBundle;
    if (!value.bundle || value.bundle.locale !== locale) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function useAxisLocalizationController(
  bootstrap: AxisPublicBootstrap | undefined,
  runtime: AxisRuntimeConfig,
): AxisLocalizationState {
  const supportedLocales = useMemo(
    () => bootstrap?.uiComposition.supportedLocales ?? Object.freeze(['en']),
    [bootstrap],
  );
  const defaultLocale = bootstrap?.uiComposition.locale ?? 'en';
  const [selectedLocale, setSelectedLocale] = useState<string>();
  const [bundle, setBundle] = useState<AxisLocalizationBundle>();
  const preferredLocale = useMemo(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const browserLocale = navigator.language;
    return (
      [stored, browserLocale, browserLocale.split('-')[0], defaultLocale]
        .filter((value): value is string => Boolean(value))
        .find((value) => supportedLocales.includes(value)) ?? defaultLocale
    );
  }, [defaultLocale, supportedLocales]);
  const locale =
    selectedLocale && supportedLocales.includes(selectedLocale)
      ? selectedLocale
      : preferredLocale;
  const cached = useMemo(() => cachedBundle(window.localStorage, locale), [locale]);
  const activeBundle = bundle?.locale === locale ? bundle : cached?.bundle;
  const stale = Boolean(cached && bundle?.locale !== locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction(locale);
  }, [locale]);

  useEffect(() => {
    if (!bootstrap?.endpoints.localization) return;
    if (!cached?.bundle && (supportedLocales.length <= 1 || locale === defaultLocale)) {
      return;
    }
    let active = true;
    void loadLocalizationBundle(
      bootstrap.endpoints.localization,
      runtime.enterpriseCode,
      locale,
      bootstrap.uiComposition.site,
      bootstrap.uiComposition.channel,
      [
        'auth',
        'common',
        'localization',
        'profile',
        'communication',
        'commerce',
        'process',
        'engagement',
        'cron',
        'docs',
      ],
      runtime.requestTimeoutMs,
      cached?.etag,
    )
      .then((result) => {
        if (!active) return;
        const next = result.notModified ? cached?.bundle : result.bundle;
        if (!next) return;
        setBundle(next);
        window.localStorage.setItem(
          `${BUNDLE_STORAGE_PREFIX}${locale}`,
          JSON.stringify({ bundle: next, etag: result.etag ?? cached?.etag }),
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [
    bootstrap,
    cached?.bundle,
    cached?.etag,
    defaultLocale,
    locale,
    runtime.enterpriseCode,
    runtime.requestTimeoutMs,
    supportedLocales.length,
  ]);

  return useMemo(() => {
    const format: AxisLocalizationState['format'] = (
      key,
      fallback,
      parameters = {},
    ) => {
      const message = activeBundle?.entries[key] ?? fallback;
      try {
        return String(new IntlMessageFormat(message, locale).format(parameters));
      } catch {
        return fallback;
      }
    };
    return {
      locale,
      direction: direction(locale),
      supportedLocales,
      releaseVersion: activeBundle?.releaseVersion,
      stale,
      setLocale: (nextLocale: string) => {
        if (!supportedLocales.includes(nextLocale)) return;
        window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
        setSelectedLocale(nextLocale);
      },
      format,
      formatError: (error: unknown, fallback: string) =>
        error instanceof AxisApiError &&
        error.messageKey &&
        ['PUBLIC', 'AUTHENTICATED'].includes(error.messageExposure ?? '')
          ? format(error.messageKey, error.message, error.messageParameters)
          : error instanceof Error
            ? error.message
            : fallback,
    };
  }, [activeBundle, locale, stale, supportedLocales]);
}

const DEFAULT_LOCALIZATION_STATE: AxisLocalizationState = Object.freeze({
  locale: 'en',
  direction: 'ltr',
  supportedLocales: Object.freeze(['en']),
  stale: false,
  setLocale: (): void => undefined,
  format: (_key: string, fallback: string): string => fallback,
  formatError: (error: unknown, fallback: string): string =>
    error instanceof Error ? error.message : fallback,
});

const AxisLocalizationContext = createContext<AxisLocalizationState>(
  DEFAULT_LOCALIZATION_STATE,
);

export function AxisLocalizationBoundary({
  children,
  value,
}: PropsWithChildren<{ readonly value: AxisLocalizationState }>) {
  return <AxisLocalizationContext value={value}>{children}</AxisLocalizationContext>;
}

export function useAxisLocalization(): AxisLocalizationState {
  return useContext(AxisLocalizationContext);
}
