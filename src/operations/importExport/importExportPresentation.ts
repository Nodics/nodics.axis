import type {
  DataRelease,
  DataReleaseStatus,
  DataReleaseType,
  ImportRunSummary,
} from './api/dataReleaseContracts';

export interface DataReleaseTypeCopy {
  readonly label: string;
  readonly help: string;
  readonly warning: string;
}

export type ImportExportArea =
  | DataReleaseType
  | 'guided'
  | 'file-imports'
  | 'exports'
  | 'history';

export type HistoryFilter = 'all' | 'imports' | 'exports';

export const typeCopy: Readonly<Record<DataReleaseType, DataReleaseTypeCopy>> = {
  init: {
    label: 'Initialization data',
    help: 'Required bootstrap identities and records needed before dependent capabilities can operate.',
    warning:
      'Initialization data is security-sensitive. Validate it before installation.',
  },
  core: {
    label: 'Core data',
    help: 'Governed baseline business and configuration records contributed by active modules.',
    warning:
      'Install after adding modules or deploying a new immutable core-data release.',
  },
  sample: {
    label: 'Sample data',
    help: 'Optional demonstration records intended for permitted non-production environments.',
    warning: 'Never use sample data as production business data.',
  },
};

export const releaseTypes: readonly DataReleaseType[] = ['init', 'core', 'sample'];

export const importExportAreas: readonly ImportExportArea[] = [
  'guided',
  ...releaseTypes,
  'file-imports',
  'exports',
  'history',
];

export const areaCopy: Readonly<
  Record<
    Exclude<ImportExportArea, DataReleaseType>,
    {
      readonly label: string;
      readonly eyebrow: string;
      readonly title: string;
      readonly help: string;
    }
  >
> = {
  guided: {
    label: 'Guided setup',
    eyebrow: 'Governed initialization',
    title: 'Guided setup',
    help: 'Validate and install a backend-owned deterministic initialization profile.',
  },
  'file-imports': {
    label: 'File imports',
    eyebrow: 'External data intake',
    title: 'File import workspace',
    help: 'Upload governed files after selecting the backend-owned target model and validating the media-backed import.',
  },
  exports: {
    label: 'Exports',
    eyebrow: 'Governed outbound data',
    title: 'Export workspace',
    help: 'Prepare future export execution without introducing a browser-owned data authority.',
  },
  history: {
    label: 'History',
    eyebrow: 'Audit projection',
    title: 'Import and export history',
    help: 'Review secured backend run history. Axis keeps no browser-side audit log.',
  },
};

export function releaseKey(release: DataRelease): string {
  return (
    release.releaseCode ??
    `${release.dataType}:${release.moduleName}:${release.version}:${release.checksum}`
  );
}

export function isInstallableStatus(status: DataReleaseStatus): boolean {
  return (
    status === 'NOT_INSTALLED' || status === 'UPDATE_AVAILABLE' || status === 'FAILED'
  );
}

export function releaseDisabledReason(release: DataRelease): string | undefined {
  if (release.status === 'RUNNING') return 'Import is already running';
  if (release.status === 'CURRENT') return 'Already current';
  if (release.status === 'INVALID_RELEASE')
    return (
      release.invalidReason ??
      'Release manifest is invalid; repair it before installing'
    );
  if (release.status === 'DOWNGRADE_AVAILABLE')
    return 'Downgrade is not allowed from Axis';
  return undefined;
}

export function operationSucceededWithCurrentOnly(
  mode: 'validate' | 'install' | undefined,
  releases: readonly DataRelease[] | undefined,
): boolean {
  return (
    mode === 'validate' &&
    Boolean(releases?.length) &&
    releases!.every((release) => release.status === 'CURRENT')
  );
}

export function historySearchText(run: ImportRunSummary): string {
  return [
    run.runId,
    run.status,
    run.dataType,
    run.requestedBy,
    run.createdAt,
    ...run.modules,
    ...(run.failures ?? []).flatMap((failure) => [
      failure.fileName,
      failure.recordKey,
      failure.schemaName,
      failure.operation,
      failure.error?.code,
      failure.error?.message,
    ]),
    ...(run.validationErrors ?? []).flatMap((failure) => [
      failure.fileName,
      failure.recordKey,
      failure.schemaName,
      failure.operation,
      failure.error?.code,
      failure.error?.message,
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

export function formatRunType(dataType: string | undefined): string {
  const normalized = dataType?.trim().toLowerCase();
  if (normalized === 'init') return 'Initialization data';
  if (normalized === 'core') return 'Core data';
  if (normalized === 'sample') return 'Sample data';
  if (normalized === 'local') return 'Content pack import';
  if (normalized === 'export') return 'Data export';
  return 'Data import';
}

export function formatStatus(status: string): string {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/gu, (value) => value.toUpperCase());
}

export function summarizeModules(modules: readonly string[]): string {
  if (modules.length === 0) return 'No module list recorded';
  const visibleModules = modules.slice(0, 6).join(', ');
  const remaining = modules.length - 6;
  return remaining > 0
    ? `${visibleModules}, and ${remaining.toString()} more`
    : visibleModules;
}
