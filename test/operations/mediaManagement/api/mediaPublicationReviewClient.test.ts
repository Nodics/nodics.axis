import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';
import {
  loadMediaPublicationReview,
  loadMediaPublicationReviewImage,
  mediaReviewCopyKeys,
  type MediaReviewIdentity,
} from '../../../../src/operations/mediaManagement/api/mediaPublicationReviewClient';
const source = {
  moduleName: 'media',
  endpoint: 'http://localhost:4312/nodics/media',
  instanceId: 'staged',
  state: 'UP',
  runtimeRole: { publication: 'STAGED' },
} as AxisModuleConnection;
const config = {
  accessToken: 'private-employee',
  enterpriseCode: 'acme',
  timeoutMs: 1000,
};
const identity: MediaReviewIdentity = {
  owner: 'media',
  rootType: 'media',
  rootCode: 'asset-a',
  publicationCode: 'publication-a',
  sourceVersion: 'a'.repeat(64),
};
const bytes = new TextEncoder().encode('retained image');
const data = () => ({
  contractVersion: 1,
  publicationCode: identity.publicationCode,
  mediaCode: identity.rootCode,
  sourceVersion: identity.sourceVersion,
  asset: {
    code: identity.rootCode,
    name: 'Captured original',
    mimeType: 'image/png',
    versionId: 0,
    sizeBytes: bytes.length,
    checksumAlgorithm: 'sha256',
    checksum: createHash('sha256').update(bytes).digest('hex'),
  },
  previewAvailable: true,
  presentation: Object.fromEntries(mediaReviewCopyKeys.map((key) => [key, key])),
});
const response = (value: unknown) =>
  new Response(
    JSON.stringify({ code: 'SUC_MED_00032', responseCode: '200', data: value }),
  );
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
});
describe('exact retained Media review client', () => {
  it('loads correlated original metadata once without reading current Media or attaching credentials to a URL', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ ...data(), providerCode: 'secret', storageKey: '/private' }),
      );
    const result = await loadMediaPublicationReview(
      source,
      config,
      identity,
      'ar',
      fetcher,
    );
    expect(result.asset.name).toBe('Captured original');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect((fetcher.mock.calls[0]?.[0] as URL).toString()).toBe(
      'http://localhost:4312/nodics/media/v0/library/publications/publication-a/review?localeCode=ar',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      credentials: 'omit',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { sourceVersion: 'b'.repeat(64) },
    { mediaCode: 'other' },
    { publicationCode: 'other' },
    { success: false },
  ])('holds mismatched or negative evidence: %j', async (delta) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ ...data(), ...delta }));
    await expect(
      loadMediaPublicationReview(source, config, identity, 'en', fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    'http://user:secret@localhost/nodics/media',
    'http://localhost/nodics/media?path=x',
    'http://localhost/nodics/cms',
  ])('rejects unsafe owner endpoint before credentials: %s', async (endpoint) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      loadMediaPublicationReview(
        { ...source, endpoint },
        config,
        identity,
        'en',
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('never uses Online, hidden legacy fallback or failed HTTP reads as current evidence', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: '/private/provider/secret' }), {
        status: 403,
      }),
    );
    await expect(
      loadMediaPublicationReview(
        { ...source, runtimeRole: { code: 'WCMS', publication: 'ONLINE' } },
        config,
        identity,
        'en',
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      loadMediaPublicationReview(source, config, identity, 'en', fetcher),
    ).rejects.not.toThrow('secret');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('hash-verifies bounded retained raster bytes and produces only an image Blob', async () => {
    const review = await loadMediaPublicationReview(
      source,
      config,
      identity,
      'en',
      vi.fn<typeof fetch>().mockResolvedValue(response(data())),
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(bytes, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(bytes.length),
        },
      }),
    );
    const image = await loadMediaPublicationReviewImage(
      source,
      config,
      identity,
      review,
      fetcher,
    );
    expect(image.type).toBe('image/png');
    expect(image.size).toBe(bytes.length);
    expect((fetcher.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/nodics/media/v0/library/publications/publication-a/review/image',
    );
  });
  it.each(['checksum', 'size', 'mime'])(
    'rejects corrupt retained image %s without fallback',
    async (failure) => {
      const review = await loadMediaPublicationReview(
        source,
        config,
        identity,
        'en',
        vi.fn<typeof fetch>().mockResolvedValue(response(data())),
      );
      const changed = new Uint8Array(bytes);
      changed[0] = 0;
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          failure === 'size'
            ? new Uint8Array(bytes.length + 1)
            : failure === 'checksum'
              ? changed
              : bytes,
          {
            headers: {
              'Content-Type': failure === 'mime' ? 'image/svg+xml' : 'image/png',
            },
          },
        ),
      );
      await expect(
        loadMediaPublicationReviewImage(source, config, identity, review, fetcher),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('does not invent preview access from a supported MIME type or render malformed optional navigation', async () => {
    const review = await loadMediaPublicationReview(
      source,
      config,
      identity,
      'en',
      vi.fn<typeof fetch>().mockResolvedValue(
        response({
          ...data(),
          previewAvailable: false,
          workingAsset: { route: '//foreign' },
        }),
      ),
    );
    expect(review.workingAsset).toBeUndefined();
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      loadMediaPublicationReviewImage(source, config, identity, review, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
