import { describe, expect, it, vi } from 'vitest';

import { resolveCmsPage } from '../../src/cms/cmsClient';
import { validResolvedPage } from './fixtures/resolvedPage';

function requestUrl(value: RequestInfo | URL | undefined): string {
  if (typeof value === 'string') return value;
  if (value instanceof URL) return value.href;
  return value?.url ?? '';
}

const baseInput = {
  cmsBaseUrl: 'https://cms.example.com',
  enterpriseCode: 'default',
  site: 'axisCmsSite',
  path: '/login',
  locale: 'en',
  channel: 'web',
  timeoutMs: 10_000,
};

describe('resolveCmsPage', () => {
  it('calls public delivery with bounded, credential-free request options', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ result: validResolvedPage }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: '"axis-login-1"',
        },
      }),
    );

    await expect(resolveCmsPage(baseInput, fetchImplementation)).resolves.toMatchObject(
      {
        status: 'resolved',
        etag: '"axis-login-1"',
        page: { path: '/login' },
      },
    );

    const [url, options] = fetchImplementation.mock.calls[0] ?? [];
    expect(requestUrl(url)).toContain('/nodics/cms/v0/delivery/pages/resolve?');
    expect(requestUrl(url)).toContain('site=axisCmsSite');
    expect(options?.credentials).toBe('omit');
    expect(new Headers(options?.headers).get('Authorization')).toBeNull();
    expect(new Headers(options?.headers).get('x-enterprise-code')).toBe('default');
  });

  it('uses authenticated delivery without leaking the token into the URL', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ result: validResolvedPage }), {
        status: 200,
      }),
    );
    await resolveCmsPage(
      { ...baseInput, path: '/dashboard', accessToken: 'memory-only-token' },
      fetchImplementation,
    );

    const [url, options] = fetchImplementation.mock.calls[0] ?? [];
    expect(requestUrl(url)).toContain('/resolve/authenticated?');
    expect(requestUrl(url)).not.toContain('memory-only-token');
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer memory-only-token',
    );
  });

  it('supports conditional delivery without treating 304 as an error', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 304,
        headers: { ETag: '"axis-login-1"' },
      }),
    );
    await expect(
      resolveCmsPage({ ...baseInput, etag: '"axis-login-1"' }, fetchImplementation),
    ).resolves.toEqual({
      status: 'not-modified',
      etag: '"axis-login-1"',
    });
  });

  it('rejects invalid contracts and failed transport responses', async () => {
    const invalidContract = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: { ...validResolvedPage, contractVersion: 99 },
        }),
        { status: 200 },
      ),
    );
    await expect(resolveCmsPage(baseInput, invalidContract)).rejects.toThrow(
      'Unsupported CMS delivery contract version',
    );

    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(resolveCmsPage(baseInput, unavailable)).rejects.toThrow('HTTP 503');
  });

  it('explains a missing CMS route without exposing backend diagnostics', async () => {
    const missingRoute = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ERR_CMS_00087',
          message: 'CMS route was not found',
          stack: 'must not reach the browser',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(resolveCmsPage(baseInput, missingRoute)).rejects.toThrow(
      'The requested CMS route is not available for this Site. ' +
        'Install or update the owning content pack, then try again.',
    );
  });
});
