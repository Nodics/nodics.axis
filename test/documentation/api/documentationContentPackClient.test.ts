import { describe, expect, it, vi } from 'vitest';

import { createDocumentationContentPackClient } from '../../../src/documentation/api/documentationContentPackClient';

const connection = {
  moduleName: 'backoffice',
  instanceId: 'platformServer/backoffice',
  endpoint: 'http://localhost:3000/nodics/backoffice',
  environment: 'kickoffLocal',
  state: 'UP' as const,
};

const status = {
  code: 'SUC_IMP_00000',
  data: {
    code: 'nodicsDocumentation',
    enabled: true,
    state: 'NOT_INSTALLED',
    available: true,
    installedVersion: null,
    availableVersion: '1.0.0',
    runId: null,
    allowedOperations: ['IMPORT'],
    presentation: {
      title: 'Nodics documentation',
      unavailableMessage: 'Documentation is unavailable.',
      disabledMessage: 'Documentation is disabled.',
      importAction: 'Import documentation',
      updateAction: 'Update documentation',
      retryAction: 'Retry',
    },
  },
};

describe('documentation content-pack client', () => {
  it('loads status and imports through the registered nImport endpoint', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(status), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const client = createDocumentationContentPackClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      fetchImplementation,
    );

    const result = await client.getStatus();
    expect(result.state).toBe('NOT_INSTALLED');
    expect(result.allowedOperations).toEqual(['IMPORT']);
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      new URL(
        'http://localhost:3000/nodics/backoffice/v0/applications/frameworkdocs/initialization/content-pack',
      ),
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
      }),
    );

    await client.importOrUpdate();
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      new URL(
        'http://localhost:3000/nodics/backoffice/v0/applications/frameworkdocs/initialization/content-pack/install',
      ),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects unbounded or incompatible backend operations', async () => {
    const invalid = structuredClone(status);
    invalid.data.allowedOperations = ['DELETE'];
    const client = createDocumentationContentPackClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(invalid), { status: 200 })),
    );

    await expect(client.getStatus()).rejects.toThrow(
      'Content-pack operation is unsupported',
    );
  });

  it('returns a low-disclosure authorization failure', async () => {
    const client = createDocumentationContentPackClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })),
    );

    await expect(client.getStatus()).rejects.toThrow(
      'You are not authorized to manage documentation.',
    );
  });

  it('explains an immutable documentation release conflict safely', async () => {
    const client = createDocumentationContentPackClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'ERR_IMP_00003',
            message: 'Content-pack release changed without a version change',
            stack: 'must not reach the browser',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(client.importOrUpdate()).rejects.toThrow(
      'The documentation content changed without a new release version. ' +
        'Ask the release owner to increment and regenerate the content pack, then try again.',
    );
  });

  it('does not expose unknown backend diagnostics', async () => {
    const client = createDocumentationContentPackClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'ERR_UNKNOWN',
            message: 'Sensitive backend detail',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(client.importOrUpdate()).rejects.toThrow(
      'Documentation service returned HTTP 400',
    );
  });
});
