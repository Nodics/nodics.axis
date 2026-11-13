import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import { observeEmployeeSessionResponse } from '../../../auth/employeeSessionEvents';
import {
  parseMediaPublicationDependency,
  type MediaPublicationDependency,
} from '../../readiness/mediaPublicationHandoff';
import type { MediaStoragePolicyClientConfiguration } from './mediaStoragePolicyClient';

export const mediaReviewCopyKeys = [
  'title',
  'captured',
  'version',
  'fileType',
  'size',
  'preview',
  'hide',
  'loading',
  'unavailable',
  'unsupported',
  'historical',
  'refresh',
  'publication',
  'openAsset',
] as const;
export interface MediaReviewIdentity {
  readonly owner: 'media';
  readonly rootType: 'media';
  readonly rootCode: string;
  readonly publicationCode: string;
  readonly sourceVersion: string;
}
export interface MediaPublicationReview {
  readonly publicationCode: string;
  readonly mediaCode: string;
  readonly sourceVersion: string;
  readonly asset: Readonly<{
    code: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    versionId: number;
    checksum: string;
  }>;
  readonly previewAvailable: boolean;
  readonly presentation: Readonly<Record<(typeof mediaReviewCopyKeys)[number], string>>;
  readonly workingAsset?: MediaPublicationDependency;
}
const raster = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Media review evidence is incompatible');
  return value as Record<string, unknown>;
};
const negative = (value: Record<string, unknown>) =>
  value.success === false ||
  value.valid === false ||
  value.acknowledged === false ||
  value.confirmed === false ||
  Boolean(value.error) ||
  (value.errors !== undefined &&
    (!Array.isArray(value.errors) || value.errors.length > 0));
const identifier = (value: string) => /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);

/** Only the declared original identity and one Staged Media owner can receive credentials. */
function url(
  source: AxisModuleConnection,
  identity: MediaReviewIdentity,
  image: boolean,
  locale: string,
): URL {
  const target = new URL(source.endpoint);
  if (
    source.moduleName !== 'media' ||
    source.runtimeRole?.publication !== 'STAGED' ||
    !['UP', 'DEGRADED'].includes(source.state) ||
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    !/\/nodics\/media\/?$/.test(target.pathname) ||
    identity.owner !== 'media' ||
    identity.rootType !== 'media' ||
    !identifier(identity.rootCode) ||
    !identifier(identity.publicationCode) ||
    !/^[a-f0-9]{64}$/.test(identity.sourceVersion) ||
    !['en', 'ar'].includes(locale)
  )
    throw new Error('Media review owner or identity is unavailable');
  return new URL(
    `${target.toString().replace(/\/$/, '')}/v0/library/publications/${encodeURIComponent(identity.publicationCode)}/review${image ? '/image' : `?localeCode=${locale}`}`,
  );
}

/** Every read is single-attempt, private and bounded; failures never select current/public bytes as a fallback. */
async function request<T>(
  source: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  identity: MediaReviewIdentity,
  image: boolean,
  locale: string,
  consume: (response: Response) => Promise<T>,
  fetcher: typeof fetch,
): Promise<T> {
  const endpoint = url(source, identity, image, locale);
  if (
    globalThis.navigator?.onLine === false ||
    !Number.isFinite(configuration.timeoutMs) ||
    configuration.timeoutMs <= 0
  )
    throw new Error('Media review connection is unavailable');
  const controller = new AbortController(),
    timeout = globalThis.setTimeout(
      () => controller.abort(),
      Math.min(configuration.timeoutMs, 30000),
    );
  try {
    const response = await fetcher(endpoint, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: image
          ? 'image/png,image/jpeg,image/webp,image/gif'
          : 'application/json',
        Authorization: `Bearer ${configuration.accessToken}`,
        'x-enterprise-code': configuration.enterpriseCode,
      },
    });
    observeEmployeeSessionResponse(response, configuration.accessToken);
    if (!response.ok) throw new Error('Media review evidence is unavailable');
    return await consume(response);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** Exact retained metadata enriches review, never Process decision or current-website authority. */
export async function loadMediaPublicationReview(
  source: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  identity: MediaReviewIdentity,
  locale: string,
  fetcher: typeof fetch = fetch,
): Promise<MediaPublicationReview> {
  return request(
    source,
    configuration,
    identity,
    false,
    locale,
    async (response) => {
      const envelope = object(await response.json());
      if (
        typeof envelope.code !== 'string' ||
        !/^SUC_/.test(envelope.code) ||
        negative(envelope) ||
        (envelope.responseCode !== undefined &&
          !(
            (typeof envelope.responseCode === 'string' &&
              /^2\d\d$/.test(envelope.responseCode)) ||
            (typeof envelope.responseCode === 'number' &&
              Number.isInteger(envelope.responseCode) &&
              envelope.responseCode >= 200 &&
              envelope.responseCode < 300)
          ))
      )
        throw new Error('Media review evidence was not acknowledged');
      const data = object(envelope.data ?? envelope.result),
        asset = object(data.asset),
        copy = object(data.presentation);
      if (
        negative(data) ||
        data.contractVersion !== 1 ||
        data.publicationCode !== identity.publicationCode ||
        data.mediaCode !== identity.rootCode ||
        data.sourceVersion !== identity.sourceVersion ||
        asset.code !== identity.rootCode ||
        typeof asset.name !== 'string' ||
        !asset.name.trim() ||
        asset.name.length > 192 ||
        typeof asset.mimeType !== 'string' ||
        !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(asset.mimeType) ||
        typeof asset.versionId !== 'number' ||
        !Number.isSafeInteger(asset.versionId) ||
        asset.versionId < 0 ||
        typeof asset.sizeBytes !== 'number' ||
        !Number.isSafeInteger(asset.sizeBytes) ||
        asset.sizeBytes < 1 ||
        asset.sizeBytes > 52428800 ||
        asset.checksumAlgorithm !== 'sha256' ||
        typeof asset.checksum !== 'string' ||
        !/^[a-f0-9]{64}$/.test(asset.checksum) ||
        typeof data.previewAvailable !== 'boolean' ||
        (data.previewAvailable && !raster.has(asset.mimeType))
      )
        throw new Error('Media review identity is incompatible');
      const presentation = Object.freeze(
        Object.fromEntries(
          mediaReviewCopyKeys.map((key) => {
            const text = copy[key];
            if (typeof text !== 'string' || !text.trim() || text.length > 2000)
              throw new Error('Media review presentation is incompatible');
            return [key, text];
          }),
        ) as MediaPublicationReview['presentation'],
      );
      let workingAsset: MediaPublicationDependency | undefined;
      try {
        const parsed = parseMediaPublicationDependency(data.workingAsset);
        if (
          parsed?.mediaCode === identity.rootCode &&
          parsed.status === 'NOT_INSPECTED' &&
          parsed.qualified === false
        )
          workingAsset = parsed;
      } catch {
        /* Invalid optional navigation never substitutes another source or hides valid captured details. */
      }
      return Object.freeze({
        publicationCode: identity.publicationCode,
        mediaCode: identity.rootCode,
        sourceVersion: identity.sourceVersion,
        asset: Object.freeze({
          code: asset.code,
          name: asset.name,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          versionId: asset.versionId,
          checksum: asset.checksum,
        }),
        previewAvailable: data.previewAvailable,
        presentation,
        ...(workingAsset ? { workingAsset } : {}),
      });
    },
    fetcher,
  );
}

/** Read and hash-check bounded retained raster bytes before constructing an image-only Blob. No response URL is rendered. */
export async function loadMediaPublicationReviewImage(
  source: AxisModuleConnection,
  configuration: MediaStoragePolicyClientConfiguration,
  identity: MediaReviewIdentity,
  review: MediaPublicationReview,
  fetcher: typeof fetch = fetch,
): Promise<Blob> {
  if (
    !review.previewAvailable ||
    review.publicationCode !== identity.publicationCode ||
    review.sourceVersion !== identity.sourceVersion ||
    review.mediaCode !== identity.rootCode
  )
    throw new Error('Captured image inspection is unavailable');
  return request(
    source,
    configuration,
    identity,
    true,
    'en',
    async (response) => {
      if (
        response.headers.get('content-type')?.split(';')[0]?.trim() !==
          review.asset.mimeType ||
        !raster.has(review.asset.mimeType) ||
        !response.body
      )
        throw new Error('Captured image evidence is incompatible');
      const declared = response.headers.get('content-length');
      if (
        declared !== null &&
        (!/^\d+$/.test(declared) || Number(declared) !== review.asset.sizeBytes)
      )
        throw new Error('Captured image size is incompatible');
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > review.asset.sizeBytes) {
          await reader.cancel();
          throw new Error('Captured image exceeds its bound');
        }
        chunks.push(chunk.value);
      }
      if (size !== review.asset.sizeBytes)
        throw new Error('Captured image is incomplete');
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      )
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      if (digest !== review.asset.checksum)
        throw new Error('Captured image checksum is incompatible');
      return new Blob([bytes], { type: review.asset.mimeType });
    },
    fetcher,
  );
}
