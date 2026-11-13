import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  parseMediaSourceContexts,
  type MediaStoragePolicyClientConfiguration,
} from './mediaStoragePolicyClient';

export const imageIntakeCopyKeys = [
  'title',
  'choose',
  'check',
  'upload',
  'inspect',
  'apply',
  'clear',
  'checking',
  'uploading',
  'inspecting',
  'review',
  'confirmed',
  'uncertain',
  'unavailable',
  'failed',
  'reference',
  'applied',
] as const;
export interface MediaImageIntakeDefinition {
  readonly contextCode: string;
  readonly presentation: Readonly<Record<(typeof imageIntakeCopyKeys)[number], string>>;
}
export interface PreparedMediaImage {
  readonly file: File;
  readonly versioned: boolean;
  readonly purpose: string;
  readonly descriptor: Readonly<{
    mediaCode: string;
    checksum: string;
    sizeBytes: number;
    originalFileName: string;
    mimeType: string;
    folderCode: string;
    formatCode: string;
    name: string;
    moduleName: string;
    schemaName: string;
  }>;
}
export interface ConfirmedMediaImage {
  readonly code: string;
  readonly name: string;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Media evidence');
  return value as Record<string, unknown>;
};
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(value);

/** Optional owner purpose/copy is inert; incompatible intake never blocks reading the article. */
export function parseMediaImageIntake(
  value: unknown,
): MediaImageIntakeDefinition | undefined {
  if (value === undefined) return undefined;
  try {
    const input = object(value),
      presentation = object(input.presentation);
    if (input.contractVersion !== 1 || !identifier(input.contextCode)) return undefined;
    return Object.freeze({
      contextCode: input.contextCode,
      presentation: Object.freeze(
        Object.fromEntries(
          imageIntakeCopyKeys.map((key) => {
            const text = presentation[key];
            if (typeof text !== 'string' || !text.trim() || text.length > 2000)
              throw new Error('Invalid intake copy');
            return [key, text];
          }),
        ) as MediaImageIntakeDefinition['presentation'],
      ),
    });
  } catch {
    return undefined;
  }
}

/** Bind credentials only to the one admitted Staged Media owner; no delivery or alternate-route fallback. */
function endpoint(source: AxisModuleConnection, path: string): URL {
  const url = new URL(source.endpoint);
  if (
    source.moduleName !== 'media' ||
    source.runtimeRole?.publication !== 'STAGED' ||
    !['UP', 'DEGRADED'].includes(source.state) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/\/nodics\/media\/?$/.test(url.pathname)
  )
    throw new Error('Media intake owner is unavailable');
  return new URL(`${url.toString().replace(/\/$/, '')}/v0/${path}`);
}

/** Contradictory negative flags never become a positive receipt because HTTP succeeded. */
function negative(value: Record<string, unknown>): boolean {
  return (
    value.success === false ||
    value.valid === false ||
    value.acknowledged === false ||
    value.confirmed === false ||
    Boolean(value.error) ||
    (value.errors !== undefined &&
      (!Array.isArray(value.errors) || value.errors.length > 0))
  );
}

/** Require explicit positive owner evidence, including the runtime's numeric HTTP responseCode. */
function positive(value: unknown): Record<string, unknown> {
  const result = object(value);
  if (
    typeof result.code !== 'string' ||
    !/^SUC_[A-Z0-9_]+$/.test(result.code) ||
    negative(result) ||
    (result.responseCode !== undefined &&
      !(
        (typeof result.responseCode === 'string' &&
          /^2\d\d$/.test(result.responseCode)) ||
        (typeof result.responseCode === 'number' &&
          Number.isInteger(result.responseCode) &&
          result.responseCode >= 200 &&
          result.responseCode < 300)
      ))
  )
    throw new Error('Media response was not acknowledged');
  const data = object(result.data ?? result.result);
  if (negative(data)) throw new Error('Media response was not acknowledged');
  return data;
}

/** One request only. Failed dispatched writes are always treated as unconfirmed by the caller. */
async function request(
  source: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  path: string,
  body: Record<string, unknown> | FormData | undefined,
  fetcher: typeof fetch,
): Promise<Record<string, unknown>> {
  const url = endpoint(source, path);
  if (!globalThis.navigator?.onLine && globalThis.navigator?.onLine !== undefined)
    throw new Error('Media is offline');
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const multipart = body instanceof FormData;
    const response = await fetcher(url, {
      method: body === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${configuration.accessToken}`,
        'x-enterprise-code': configuration.enterpriseCode,
        ...(body !== undefined && !multipart
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    });
    if (!response.ok)
      throw new Error(`Media request returned HTTP ${String(response.status)}`);
    return positive(await response.json());
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** Qualify the actual file against the configured purpose and current owner policy; no write is performed. */
export async function prepareMediaImage(
  source: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  definition: MediaImageIntakeDefinition,
  file: File,
  target: Readonly<{ moduleName: string; schemaName: string }>,
  fetcher: typeof fetch = fetch,
): Promise<PreparedMediaImage> {
  if (
    !identifier(target.moduleName) ||
    !identifier(target.schemaName) ||
    !file.type.startsWith('image/') ||
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > 50 * 1024 * 1024 ||
    !file.name ||
    file.name.length > 256
  )
    throw new Error('Choose a supported image');
  const contexts = parseMediaSourceContexts(
    await request(source, configuration, 'contexts', undefined, fetcher),
  );
  const matches = contexts.filter((item) => item.code === definition.contextCode);
  const context = matches.length === 1 ? matches[0] : undefined;
  if (
    !context?.manualUploadEnabled ||
    !context.defaultFolderCode ||
    !context.defaultFormatCode ||
    !context.folderCodes.includes(context.defaultFolderCode) ||
    !context.allowedFormatCodes.includes(context.defaultFormatCode) ||
    context.allowedFolders.filter(
      (folder) => folder.folderCode === context.defaultFolderCode,
    ).length !== 1
  )
    throw new Error('The configured image purpose is unavailable');
  const descriptor = Object.freeze({
    mediaCode: `axis-image-${crypto.randomUUID()}`,
    checksum: Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
    )
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
    sizeBytes: file.size,
    originalFileName: file.name,
    mimeType: file.type,
    folderCode: context.defaultFolderCode,
    formatCode: context.defaultFormatCode,
    name: file.name,
    ...target,
  });
  const policy = await request(
    source,
    configuration,
    'storage/policy',
    { ...descriptor, fileName: file.name },
    fetcher,
  );
  const rules = object(policy.uploadPolicy),
    extension = file.name.split('.').at(-1)?.toLowerCase();
  const maximum = rules.maximumFileSizeBytes ?? rules.maxFileSizeBytes;
  if (
    policy.folderCode !== descriptor.folderCode ||
    rules.checksumAlgorithm !== 'sha256' ||
    !Array.isArray(rules.allowedExtensions) ||
    !rules.allowedExtensions.includes(extension) ||
    !Array.isArray(rules.allowedMimeTypes) ||
    !rules.allowedMimeTypes.includes(file.type) ||
    typeof maximum !== 'number' ||
    !Number.isSafeInteger(maximum) ||
    maximum < file.size
  )
    throw new Error('The image does not match the current upload policy');
  // Read original identity before a write. A pre-existing identity never grants overwrite authority.
  const prepared = Object.freeze({
    file,
    versioned: false,
    descriptor,
    purpose: context.label,
  });
  const inspection = await readMediaImageInspection(
    source,
    configuration,
    prepared,
    fetcher,
  );
  if (inspection.outcome !== 'ABSENT')
    throw new Error('The original image identity already exists or is unconfirmed');
  return Object.freeze({ ...prepared, versioned: inspection.versioned });
}

/** Read-only recovery of exactly the original descriptor; absence is not permission to resend. */
async function readMediaImageInspection(
  source: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  prepared: PreparedMediaImage,
  fetcher: typeof fetch = fetch,
): Promise<
  Readonly<{ outcome: 'CONFIRMED' | 'ABSENT' | 'UNCONFIRMED'; versioned: boolean }>
> {
  const result = await request(
    source,
    configuration,
    'storage/upload/inspect',
    { ...prepared.descriptor },
    fetcher,
  );
  if (
    result.contractVersion !== 1 ||
    result.mediaCode !== prepared.descriptor.mediaCode ||
    typeof result.exists !== 'boolean' ||
    typeof result.versioned !== 'boolean' ||
    typeof result.unchanged !== 'boolean' ||
    (result.exists &&
      result.versioned &&
      (!Number.isSafeInteger(result.versionId) || Number(result.versionId) < 0)) ||
    (!result.exists && result.unchanged)
  )
    throw new Error('Invalid original image inspection');
  return Object.freeze({
    versioned: result.versioned,
    outcome: !result.exists
      ? 'ABSENT'
      : result.versioned && result.unchanged
        ? 'CONFIRMED'
        : 'UNCONFIRMED',
  });
}

/** Inspect an original upload without replay or replacement authority. */
export async function inspectMediaImage(
  source: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  prepared: PreparedMediaImage,
  fetcher: typeof fetch = fetch,
): Promise<'CONFIRMED' | 'ABSENT' | 'UNCONFIRMED'> {
  return (await readMediaImageInspection(source, configuration, prepared, fetcher))
    .outcome;
}

/** Dispatch the reviewed bytes once. Exact persisted metadata is required before offering association. */
export async function uploadPreparedMediaImage(
  source: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  prepared: PreparedMediaImage,
  fetcher: typeof fetch = fetch,
): Promise<ConfirmedMediaImage> {
  const form = new FormData();
  form.append('file', prepared.file);
  Object.entries(prepared.descriptor).forEach(([key, value]) =>
    form.append(key, String(value)),
  );
  const saved = await request(source, configuration, 'storage/upload', form, fetcher);
  if (
    saved.code !== prepared.descriptor.mediaCode ||
    (prepared.versioned && saved.versionId !== 0) ||
    saved.active !== true ||
    saved.status !== 'READY' ||
    saved.checksumAlgorithm !== 'sha256' ||
    [
      'checksum',
      'sizeBytes',
      'originalFileName',
      'mimeType',
      'folderCode',
      'formatCode',
      'name',
    ].some(
      (key) =>
        saved[key] !==
        prepared.descriptor[key as keyof PreparedMediaImage['descriptor']],
    )
  )
    throw new Error('The original image upload was not confirmed');
  // Only safe metadata leaves this client; no provider paths, keys or delivery URLs are exposed.
  return Object.freeze({
    code: prepared.descriptor.mediaCode,
    name: prepared.descriptor.name,
  });
}
