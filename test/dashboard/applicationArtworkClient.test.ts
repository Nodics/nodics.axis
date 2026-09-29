import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadApplicationArtwork } from '../../src/operations/setupAccelerators/api/applicationArtworkClient';
import type { AxisModuleConnection } from '../../src/bootstrap/publicBootstrap';

const connection: AxisModuleConnection = {
  moduleName: 'media',
  instanceId: 'staged',
  endpoint: 'https://media.test/nodics/media',
  environment: 'test',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
  state: 'UP',
};
const input = {
  connection,
  visual: {
    mediaCode: 'owner-hero',
    alt: 'Owner hero',
    runtimeRole: 'WCMS_STAGED',
    active: true,
  },
  accessToken: 'principal-token',
  enterpriseCode: 'partner',
  signal: new AbortController().signal,
};
afterEach(() => vi.unstubAllGlobals());

describe('Application Media delivery', () => {
  it('loads the existing media record with employee and enterprise scope', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('image', { headers: { 'content-type': 'image/png' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    const image = await loadApplicationArtwork(input);
    expect(image.type).toBe('image/png');
    expect(image.size).toBe(5);
    const [url, options] = fetcher.mock.calls[0]! as [URL, RequestInit];
    expect(String(url)).toBe('https://media.test/nodics/media/v0/content/owner-hero');
    expect(options).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: input.signal,
      headers: {
        Authorization: 'Bearer principal-token',
        'x-enterprise-code': 'partner',
      },
    });
  });
  it.each([401, 403, 404, 500])(
    'does not retry or bypass response %s',
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(
        new Response('{}', {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetcher);
      await expect(loadApplicationArtwork(input)).rejects.toThrow('unavailable');
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it.each([
    { ...connection, moduleName: 'cms' },
    { ...connection, state: 'UNAVAILABLE' as const },
    { ...connection, runtimeRole: { code: 'WCMS_ONLINE', publication: 'ONLINE' } },
    { ...connection, endpoint: 'https://user:secret@media.test/nodics/media' },
    { ...connection, endpoint: 'javascript:alert(1)' },
  ])(
    'never sends credentials to an invalid or wrong owner connection',
    async (connection) => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      await expect(loadApplicationArtwork({ ...input, connection })).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each(['text/html', 'application/json', ''])(
    'rejects non-image %s',
    async (mime) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response('not-image', { headers: { 'content-type': mime } }),
          ),
      );
      await expect(loadApplicationArtwork(input)).rejects.toThrow('unavailable');
    },
  );
  it('bounds streamed content even without a length header', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1));
      },
      cancel,
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(body, { headers: { 'content-type': 'image/png' } }),
        ),
    );
    await expect(loadApplicationArtwork(input)).rejects.toThrow('limits');
    expect(cancel).toHaveBeenCalledOnce();
  });
});
