import { runtime, profileBaseUrl, workspace, progress } from './registrationFixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserScopedProfileUrl } from '../../src/auth/employeeAuthClient';
import { loadPublicBackendWorkspacePayload } from '../../src/app/backendWorkspaceClient';
import { sendRegistrationAction } from '../../src/operations/enterprise/registration/registrationClient';

/** Source transport tests. They do not qualify browser rendering or deployed CORS. */
afterEach(() => vi.unstubAllGlobals());
function browser() {
  vi.stubGlobal('window', {
    location: { hostname: 'axis.example.test', protocol: 'https:' },
  });
}
describe('Discovered Profile registration connection', () => {
  it('uses Profile, not BackOffice, for public workspace discovery', async () => {
    browser();
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ data: workspace })));
    vi.stubGlobal('fetch', transport);
    await loadPublicBackendWorkspacePayload(runtime, profileBaseUrl);
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, options] = transport.mock.calls[0] ?? [];
    expect(url instanceof Request ? url.url : url?.toString()).toBe(
      'https://profile.example.test/nodics/profile/v0/enterprise-access/workspace',
    );
    expect(options).toMatchObject({
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    });
  });
  it('sends the command to the same discovered Profile connection once', async () => {
    browser();
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ data: progress })));
    vi.stubGlobal('fetch', transport);
    await sendRegistrationAction(
      runtime,
      profileBaseUrl,
      workspace,
      'start',
      { email: 'alex@example.test' },
      new AbortController().signal,
    );
    expect(transport).toHaveBeenCalledTimes(1);
    const target = transport.mock.calls[0]?.[0];
    expect(target instanceof Request ? target.url : target?.toString()).toBe(
      'https://profile.example.test/nodics/profile/v0/enterprise-access/start',
    );
    expect(runtime.backofficeBaseUrl).toBe('https://backoffice.example.test');
  });
  it.each([
    'https://name:secret@profile.example.test',
    'http://profile.example.test',
    'javascript:void(0)',
    'https://profile.example.test/?secret=x',
    'https://profile.example.test/#proof',
  ])('rejects unsafe connection %s before sending', async (connection) => {
    browser();
    const transport = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', transport);
    await expect(
      loadPublicBackendWorkspacePayload(runtime, connection),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it('retains the shared loopback browser hostname alignment', () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost', protocol: 'http:' } });
    expect(browserScopedProfileUrl('http://127.0.0.1:8080').hostname).toBe('localhost');
  });
  it('rejects an error envelope even under HTTP 200', async () => {
    browser();
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'ERR_PROFILE', data: workspace })),
        ),
    );
    await expect(
      loadPublicBackendWorkspacePayload(runtime, profileBaseUrl),
    ).rejects.toThrow();
  });
});
