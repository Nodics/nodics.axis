import { describe, expect, it, vi } from 'vitest';

import { createDocumentationPublicationClient } from '../../../src/documentation/api/documentationPublicationClient';

const connection = {
  moduleName: 'backoffice',
  instanceId: 'platform/backoffice',
  endpoint: 'http://localhost:4300',
  environment: 'kickoffLocal',
  state: 'UP' as const,
};

function response(readiness = 'READY', allowedActions = ['ROLLBACK', 'RETIRE']) {
  return {
    code: 'SUC_BOF_00021',
    data: {
      profileCode: 'frameworkdocs',
      siteCode: 'nodicsDocumentationSite',
      readiness,
      releaseCode: 'contentPack:nodicsDocumentation',
      releaseVersion: '0.16.0',
      releaseStatus: 'CURRENT',
      allowedActions,
      publication: {
        code: 'cms-baseline-frameworkdocs',
        state: readiness === 'READY' ? 'ONLINE' : readiness,
        revision: 7,
      },
    },
  };
}

describe('documentation publication client', () => {
  it('uses only the governed initialization lifecycle endpoints', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(response()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const client = createDocumentationPublicationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      fetchImplementation,
    );

    expect((await client.getStatus()).allowedActions).toEqual(['ROLLBACK', 'RETIRE']);
    await client.initiate();
    await client.rollback();
    await client.retire();

    expect(
      fetchImplementation.mock.calls.map(([url, init]) => [
        url instanceof URL ? url.href : 'unexpected-request',
        init?.method,
      ]),
    ).toEqual([
      ['http://localhost:4300/v0/applications/frameworkdocs/initialization', 'GET'],
      [
        'http://localhost:4300/v0/applications/frameworkdocs/initialization/initiate',
        'POST',
      ],
      [
        'http://localhost:4300/v0/applications/frameworkdocs/initialization/rollback',
        'POST',
      ],
      [
        'http://localhost:4300/v0/applications/frameworkdocs/initialization/retire',
        'POST',
      ],
    ]);
  });

  it('rejects backend actions outside the bounded lifecycle contract', async () => {
    const client = createDocumentationPublicationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(response('READY', ['DELETE'])), {
          status: 200,
        }),
      ),
    );

    await expect(client.getStatus()).rejects.toThrow(
      'Documentation publication action is unsupported',
    );
  });
});
