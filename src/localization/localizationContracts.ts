export interface AxisLocalizationBundle {
  readonly contractVersion: number;
  readonly locale: string;
  readonly scopeCode: string;
  readonly channel: string;
  readonly namespaces: readonly string[];
  readonly releaseVersion: string;
  readonly entries: Readonly<Record<string, string>>;
}

export interface AxisLocalizedErrorContract {
  readonly messageKey?: string | undefined;
  readonly messageParameters?: Readonly<Record<string, string | number | boolean>>;
  readonly messageExposure?: 'PUBLIC' | 'AUTHENTICATED' | undefined;
  readonly message: string;
  readonly code?: string | undefined;
}

export interface AxisLocalizationState {
  readonly locale: string;
  readonly direction: 'ltr' | 'rtl';
  readonly supportedLocales: readonly string[];
  readonly releaseVersion?: string | undefined;
  readonly stale: boolean;
  readonly setLocale: (locale: string) => void;
  readonly format: (
    key: string,
    fallback: string,
    parameters?: Readonly<Record<string, string | number | boolean>>,
  ) => string;
  readonly formatError: (error: unknown, fallback: string) => string;
}
