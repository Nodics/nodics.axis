import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface MediaStoragePolicyClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface MediaFolderPolicyProbe {
  readonly folderCode: string;
  readonly label: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface MediaFolderUploadPolicy {
  readonly folderCode: string;
  readonly label: string;
  readonly access: string;
  readonly allowedExtensions: readonly string[];
  readonly allowedMimeTypes: readonly string[];
  readonly checksumAlgorithm: string;
  readonly maxFileSizeBytes: number | undefined;
}

export interface MediaSourceContextFolderPolicy extends MediaFolderUploadPolicy {
  readonly storagePrefix: string | undefined;
  readonly retentionDays: number | undefined;
}

export interface MediaSourceContext {
  readonly code: string;
  readonly sourceType: string | undefined;
  readonly aliases: readonly string[];
  readonly label: string;
  readonly description: string | undefined;
  readonly folderCodes: readonly string[];
  readonly defaultFolderCode: string | undefined;
  readonly allowedFolders: readonly MediaSourceContextFolderPolicy[];
  readonly allowedFormatCodes: readonly string[];
  readonly defaultFormatCode: string | undefined;
  readonly defaultModuleName: string | undefined;
  readonly defaultSchemaName: string | undefined;
  readonly targetRequired: boolean;
  readonly manualUploadEnabled: boolean;
  readonly storageRouteTemplate: string | undefined;
}

export interface MediaUploadInput {
  readonly file: File;
  readonly folderCode: string;
  readonly formatCode?: string;
  readonly moduleName?: string;
  readonly schemaName?: string;
  readonly name?: string;
  readonly description?: string;
}

export interface MediaFolderPolicyUpdateInput {
  readonly folderCode: string;
  readonly access: string;
  readonly maximumFileSizeBytes?: number | undefined;
  readonly retentionDays?: number | undefined;
}

export interface MediaSetEntryOperationInput {
  readonly mediaSetCode: string;
  readonly entryCode: string;
}

export interface MediaUploadResult {
  readonly code: string;
  readonly name: string | undefined;
  readonly originalFileName: string | undefined;
  readonly folderCode: string | undefined;
  readonly formatCode: string | undefined;
  readonly access: string | undefined;
  readonly status: string | undefined;
  readonly mimeType: string | undefined;
  readonly extension: string | undefined;
  readonly sizeBytes: number | undefined;
  readonly accessUrl: string | undefined;
}

export interface MediaStorageDeliverySummary {
  readonly enabled: boolean;
  readonly publicAccessEnabled: boolean;
  readonly signedAccessEnabled: boolean;
  readonly privateAccessEnabled: boolean;
  readonly cacheControl: string | undefined;
  readonly contentDisposition: string | undefined;
}

export interface MediaStorageProviderHealthSummary {
  readonly status: string;
  readonly rootMode: string | undefined;
  readonly pathExposed: boolean;
  readonly message: string | undefined;
}

export interface MediaStorageProviderSummaryItem {
  readonly providerCode: string;
  readonly providerType: string;
  readonly active: boolean;
  readonly enabled: boolean;
  readonly health: MediaStorageProviderHealthSummary;
  readonly deliveryMode: string;
  readonly secretsHidden: boolean;
  readonly rawPathsHidden: boolean;
}

export interface MediaStorageProviderSummary {
  readonly activeProviderCode: string;
  readonly keyStrategyName: string;
  readonly delivery: MediaStorageDeliverySummary;
  readonly providers: readonly MediaStorageProviderSummaryItem[];
}

export const mediaFolderPolicyProbes: readonly MediaFolderPolicyProbe[] = Object.freeze(
  [
    Object.freeze({
      folderCode: 'importSources',
      label: 'Import source files',
      fileName: 'policy-probe.csv',
      mimeType: 'text/csv',
      sizeBytes: 1,
    }),
    Object.freeze({
      folderCode: 'exportFiles',
      label: 'Data export files',
      fileName: 'policy-probe.csv',
      mimeType: 'text/csv',
      sizeBytes: 1,
    }),
    Object.freeze({
      folderCode: 'cmsAssets',
      label: 'CMS content assets',
      fileName: 'policy-probe.png',
      mimeType: 'image/png',
      sizeBytes: 1,
    }),
    Object.freeze({
      folderCode: 'productAssets',
      label: 'Product media assets',
      fileName: 'policy-probe.png',
      mimeType: 'image/png',
      sizeBytes: 1,
    }),
    Object.freeze({
      folderCode: 'default',
      label: 'Utility files',
      fileName: 'policy-probe.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
    }),
  ],
);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown): boolean {
  return value === true;
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    ),
  );
}

function envelopeData(value: unknown): unknown {
  const envelope = record(value, 'Media storage response');
  if ('result' in envelope) return envelope.result;
  if ('data' in envelope) return envelope.data;
  throw new Error('Media storage response does not contain data');
}

function parseFolderUploadPolicy(
  value: unknown,
  probe: MediaFolderPolicyProbe,
): MediaFolderUploadPolicy {
  const data = record(value, 'Media storage policy');
  const uploadPolicy = record(data.uploadPolicy, 'Media upload policy');
  return Object.freeze({
    folderCode: optionalText(data.folderCode) ?? probe.folderCode,
    label: probe.label,
    access: optionalText(data.access) ?? 'UNKNOWN',
    allowedExtensions: stringList(uploadPolicy.allowedExtensions),
    allowedMimeTypes: stringList(uploadPolicy.allowedMimeTypes),
    checksumAlgorithm: optionalText(uploadPolicy.checksumAlgorithm) ?? '—',
    maxFileSizeBytes:
      optionalNumber(uploadPolicy.maxFileSizeBytes) ??
      optionalNumber(uploadPolicy.maximumFileSizeBytes),
  });
}

function parseContextFolderPolicy(value: unknown): MediaSourceContextFolderPolicy {
  const data = record(value, 'Media context folder policy');
  const uploadPolicy = record(data.uploadPolicy, 'Media context upload policy');
  const folderCode = optionalText(data.folderCode);
  if (!folderCode) throw new Error('Media context folder policy is missing folderCode');
  return Object.freeze({
    folderCode,
    label: optionalText(data.label) ?? folderCode,
    storagePrefix: optionalText(data.storagePrefix),
    access: optionalText(data.access) ?? 'UNKNOWN',
    retentionDays: optionalNumber(data.retentionDays),
    allowedExtensions: stringList(uploadPolicy.allowedExtensions),
    allowedMimeTypes: stringList(uploadPolicy.allowedMimeTypes),
    checksumAlgorithm: optionalText(uploadPolicy.checksumAlgorithm) ?? '—',
    maxFileSizeBytes:
      optionalNumber(uploadPolicy.maxFileSizeBytes) ??
      optionalNumber(uploadPolicy.maximumFileSizeBytes),
  });
}

function parseMediaSourceContext(value: unknown): MediaSourceContext {
  const data = record(value, 'Media source context');
  const code = optionalText(data.code);
  if (!code) throw new Error('Media source context is missing code');
  return Object.freeze({
    code,
    sourceType: optionalText(data.sourceType),
    aliases: stringList(data.aliases),
    label: optionalText(data.label) ?? code,
    description: optionalText(data.description),
    folderCodes: stringList(data.folderCodes),
    defaultFolderCode: optionalText(data.defaultFolderCode),
    allowedFolders: Object.freeze(
      Array.isArray(data.allowedFolders)
        ? data.allowedFolders.map(parseContextFolderPolicy)
        : [],
    ),
    allowedFormatCodes: stringList(data.allowedFormatCodes),
    defaultFormatCode: optionalText(data.defaultFormatCode),
    defaultModuleName: optionalText(data.defaultModuleName),
    defaultSchemaName: optionalText(data.defaultSchemaName),
    targetRequired: optionalBoolean(data.targetRequired),
    manualUploadEnabled: optionalBoolean(data.manualUploadEnabled),
    storageRouteTemplate: optionalText(data.storageRouteTemplate),
  });
}

export function parseMediaSourceContexts(
  value: unknown,
): readonly MediaSourceContext[] {
  const data = record(value, 'Media source context response');
  const contexts = data.contexts;
  if (!Array.isArray(contexts)) {
    throw new Error('Media source context response does not contain contexts');
  }
  return Object.freeze(contexts.map(parseMediaSourceContext));
}

function parseMediaUploadResult(value: unknown): MediaUploadResult {
  const data = record(value, 'Media upload result');
  const code = optionalText(data.code);
  if (!code) throw new Error('Media upload response does not contain media code');
  return Object.freeze({
    code,
    name: optionalText(data.name),
    originalFileName: optionalText(data.originalFileName),
    folderCode: optionalText(data.folderCode),
    formatCode: optionalText(data.formatCode),
    access: optionalText(data.access),
    status: optionalText(data.status),
    mimeType: optionalText(data.mimeType),
    extension: optionalText(data.extension),
    sizeBytes: optionalNumber(data.sizeBytes),
    accessUrl: optionalText(data.accessUrl) ?? optionalText(data.url),
  });
}

function parseStorageProviderHealth(value: unknown): MediaStorageProviderHealthSummary {
  const data =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return Object.freeze({
    status: optionalText(data.status) ?? 'UNKNOWN',
    rootMode: optionalText(data.rootMode),
    pathExposed: data.pathExposed === true,
    message: optionalText(data.message),
  });
}

function parseStorageProviderSummaryItem(
  value: unknown,
): MediaStorageProviderSummaryItem {
  const data = record(value, 'Media storage provider summary');
  const providerCode = optionalText(data.providerCode);
  if (!providerCode) throw new Error('Media storage provider summary is missing code');
  return Object.freeze({
    providerCode,
    providerType: optionalText(data.providerType) ?? 'CUSTOM',
    active: optionalBoolean(data.active),
    enabled: optionalBoolean(data.enabled),
    health: parseStorageProviderHealth(data.health),
    deliveryMode: optionalText(data.deliveryMode) ?? 'BACKEND_DELIVERY',
    secretsHidden: data.secretsHidden !== false,
    rawPathsHidden: data.rawPathsHidden !== false,
  });
}

function parseStorageDeliverySummary(value: unknown): MediaStorageDeliverySummary {
  const data = record(value, 'Media storage delivery summary');
  return Object.freeze({
    enabled: optionalBoolean(data.enabled),
    publicAccessEnabled: optionalBoolean(data.publicAccessEnabled),
    signedAccessEnabled: optionalBoolean(data.signedAccessEnabled),
    privateAccessEnabled: optionalBoolean(data.privateAccessEnabled),
    cacheControl: optionalText(data.cacheControl),
    contentDisposition: optionalText(data.contentDisposition),
  });
}

function parseStorageProviderSummary(value: unknown): MediaStorageProviderSummary {
  const data = record(value, 'Media storage provider response');
  return Object.freeze({
    activeProviderCode: optionalText(data.activeProviderCode) ?? 'unknown',
    keyStrategyName: optionalText(data.keyStrategyName) ?? 'default',
    delivery: parseStorageDeliverySummary(data.delivery),
    providers: Object.freeze(
      Array.isArray(data.providers)
        ? data.providers.map(parseStorageProviderSummaryItem)
        : [],
    ),
  });
}

async function safeError(response: Response): Promise<string> {
  try {
    const value = record(await response.json(), 'Media storage error');
    const message = optionalText(value.message);
    if (message && message.length <= 500) return message;
  } catch {
    // Preserve the bounded HTTP fallback.
  }
  return `Media storage policy returned HTTP ${String(response.status)}`;
}

async function requestPolicy(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  probe: MediaFolderPolicyProbe,
  fetchImplementation: typeof fetch,
): Promise<MediaFolderUploadPolicy> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Media endpoint is invalid');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}/v0/storage/policy`),
      {
        method: 'POST',
        body: JSON.stringify({
          fileName: probe.fileName,
          folderCode: probe.folderCode,
          mimeType: probe.mimeType,
          sizeBytes: probe.sizeBytes,
        }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': configuration.enterpriseCode,
        },
      },
    );
    if (!response.ok) throw new Error(await safeError(response));
    return parseFolderUploadPolicy(envelopeData(await response.json()), probe);
  } catch (error: unknown) {
    if (controller.signal.aborted)
      throw new Error('Media storage policy request timed out');
    throw error instanceof Error
      ? error
      : new Error('Media storage policy request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function loadMediaFolderUploadPolicies(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly MediaFolderUploadPolicy[]> {
  return Object.freeze(
    await Promise.all(
      mediaFolderPolicyProbes.map((probe) =>
        requestPolicy(connection, configuration, probe, fetchImplementation),
      ),
    ),
  );
}

export async function loadMediaSourceContexts(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly MediaSourceContext[]> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Media endpoint is invalid');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}/v0/contexts`),
      {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
        },
      },
    );
    if (!response.ok) throw new Error(await safeError(response));
    return parseMediaSourceContexts(envelopeData(await response.json()));
  } catch (error: unknown) {
    if (controller.signal.aborted)
      throw new Error('Media source context request timed out');
    throw error instanceof Error
      ? error
      : new Error('Media source context request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function loadMediaStorageProviderSummary(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<MediaStorageProviderSummary> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Media endpoint is invalid');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}/v0/storage/providers/summary`),
      {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
        },
      },
    );
    if (!response.ok) throw new Error(await safeError(response));
    return parseStorageProviderSummary(envelopeData(await response.json()));
  } catch (error: unknown) {
    if (controller.signal.aborted)
      throw new Error('Media storage provider summary request timed out');
    throw error instanceof Error
      ? error
      : new Error('Media storage provider summary request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function updateMediaFolderPolicy(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  input: MediaFolderPolicyUpdateInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<MediaSourceContextFolderPolicy> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Media endpoint is invalid');
  }
  if (!input.folderCode.trim()) {
    throw new Error('Media folder is required before policy update');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(
        `${endpoint.toString().replace(/\/$/, '')}/v0/folders/policy/${encodeURIComponent(input.folderCode)}`,
      ),
      {
        method: 'PATCH',
        body: JSON.stringify({
          access: input.access,
          maximumFileSizeBytes: input.maximumFileSizeBytes,
          retentionDays: input.retentionDays,
        }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': configuration.enterpriseCode,
        },
      },
    );
    if (!response.ok) throw new Error(await safeError(response));
    return parseContextFolderPolicy(envelopeData(await response.json()));
  } catch (error: unknown) {
    if (controller.signal.aborted)
      throw new Error('Media folder policy update timed out');
    throw error instanceof Error
      ? error
      : new Error('Media folder policy update failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function mutateMediaSetEntry(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  path: string,
  method: 'DELETE' | 'POST',
  body: unknown,
  failureMessage: string,
  fetchImplementation: typeof fetch,
): Promise<Record<string, unknown>> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Media endpoint is invalid');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}${path}`),
      {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          'x-enterprise-code': configuration.enterpriseCode,
        },
      },
    );
    if (!response.ok) throw new Error(await safeError(response));
    return record(envelopeData(await response.json()), 'Media set entry response');
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error(`${failureMessage} timed out`);
    throw error instanceof Error ? error : new Error(failureMessage);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function removeMediaSetEntry(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  input: MediaSetEntryOperationInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  return mutateMediaSetEntry(
    connection,
    configuration,
    `/v0/sets/${encodeURIComponent(input.mediaSetCode)}/entries/${encodeURIComponent(input.entryCode)}`,
    'DELETE',
    undefined,
    'Media set entry removal failed',
    fetchImplementation,
  );
}

export async function reorderMediaSetEntries(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  mediaSetCode: string,
  entryCodes: readonly string[],
  fetchImplementation: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  return mutateMediaSetEntry(
    connection,
    configuration,
    `/v0/sets/${encodeURIComponent(mediaSetCode)}/entries/reorder`,
    'POST',
    { entryCodes },
    'Media set entry reorder failed',
    fetchImplementation,
  );
}

export async function setPrimaryMediaSetEntry(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  input: MediaSetEntryOperationInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  return mutateMediaSetEntry(
    connection,
    configuration,
    `/v0/sets/${encodeURIComponent(input.mediaSetCode)}/entries/${encodeURIComponent(input.entryCode)}/primary`,
    'POST',
    undefined,
    'Media set primary update failed',
    fetchImplementation,
  );
}

export async function uploadMedia(
  connection: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  input: MediaUploadInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<MediaUploadResult> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Media endpoint is invalid');
  }
  if (!input.folderCode.trim()) {
    throw new Error('Media folder is required before upload');
  }
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('folderCode', input.folderCode);
  if (input.formatCode?.trim()) formData.append('formatCode', input.formatCode.trim());
  if (input.moduleName?.trim()) formData.append('moduleName', input.moduleName.trim());
  if (input.schemaName?.trim()) formData.append('schemaName', input.schemaName.trim());
  if (input.name?.trim()) formData.append('name', input.name.trim());
  if (input.description?.trim())
    formData.append('description', input.description.trim());

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}/v0/storage/upload`),
      {
        method: 'POST',
        body: formData,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
        },
      },
    );
    if (!response.ok) throw new Error(await safeError(response));
    return parseMediaUploadResult(envelopeData(await response.json()));
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('Media upload request timed out');
    throw error instanceof Error ? error : new Error('Media upload request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
