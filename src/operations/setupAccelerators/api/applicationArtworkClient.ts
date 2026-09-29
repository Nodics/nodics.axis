import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import { parseApplicationVisual, type ApplicationVisual } from './applicationVisual';

/** Read-only Media delivery. Credentials only go to the authenticated registry target. */
export async function loadApplicationArtwork({
  connection,
  visual,
  accessToken,
  enterpriseCode,
  signal,
}: {
  readonly connection: AxisModuleConnection;
  readonly visual: ApplicationVisual;
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly signal: AbortSignal;
}): Promise<Blob> {
  if (
    !parseApplicationVisual(visual)?.active ||
    !accessToken ||
    !enterpriseCode ||
    connection.moduleName !== 'media' ||
    connection.runtimeRole?.code !== visual.runtimeRole ||
    !['UP', 'DEGRADED'].includes(connection.state)
  )
    throw new Error('Application media is unavailable');
  const url = new URL(
    `${connection.endpoint.replace(/\/$/, '')}/v0/content/${encodeURIComponent(visual.mediaCode)}`,
  );
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid Media connection');
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    headers: {
      Accept: 'image/*',
      Authorization: `Bearer ${accessToken}`,
      'x-enterprise-code': enterpriseCode,
    },
  });
  const mimeType = response.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();
  if (
    !response.ok ||
    !mimeType ||
    ![
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'image/svg+xml',
    ].includes(mimeType)
  )
    throw new Error('Application media is unavailable');
  const maximumBytes = 8 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maximumBytes || !response.body) {
    await response.body?.cancel();
    throw new Error('Application media exceeds preview limits');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new Error('Application media exceeds preview limits');
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!bytes) throw new Error('Application media is empty');
  return new Blob(chunks, { type: mimeType });
}
