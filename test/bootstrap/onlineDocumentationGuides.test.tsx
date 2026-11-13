import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import { runtime } from '../enterprise/registrationFixtures';
import { describe, it, expect, vi } from 'vitest';
import {
  parseOnlineDocumentationGuides,
  useOnlineDocumentationGuides,
} from '../../src/bootstrap/onlineDocumentationGuides';

const topic = {
  id: 'article',
  label: 'Published article',
  route: '/docs/topics/first',
  site: 'shared',
  locale: 'en',
  channel: 'web',
  accessMode: 'AUTHENTICATED',
};
const project = {
  guide: 'project',
  projectId: 'acme',
  label: 'Acme handbook',
  route: '/docs?guide=project&project=acme',
  topics: [{ ...topic, channelId: 'store', channelLabel: 'Store' }],
};
const nav = {
  id: 'catalogue-entry',
  label: 'Employee guides',
  route: '/docs?guide=project',
  order: 26,
};
function read(guides: unknown[], navigation: unknown[]) {
  return parseOnlineDocumentationGuides({
    code: 'OK',
    result: { contractVersion: 1, guides, navigation },
  });
}

describe('Online documentation delivery contract', () => {
  it('preserves imported identities, labels, routes, delivery bindings and order without inventing entries', () => {
    expect(read([project], [nav])).toEqual({
      contractVersion: 1,
      guides: [project],
      navigation: [nav],
    });
    expect(read([], [])).toEqual({ contractVersion: 1, guides: [], navigation: [] });
  });

  it.each([
    [[], [nav]],
    [[project], [{ ...nav, route: 'https://external.example' }]],
    [[{ ...project, route: '/docs?guide=project&project=other' }], [nav]],
    [[{ ...project, topics: [{ ...topic, route: '/docs/../admin' }] }], [nav]],
    [[{ ...project, topics: [{ ...topic, accessMode: 'UNKNOWN' }] }], [nav]],
    [[{ ...project, topics: [{ ...topic, channelId: 'store' }] }], [nav]],
    [[project, project], [nav]],
    [[project], [nav, nav]],
  ])('rejects mismatched or unsafe published evidence', (guides, navigation) => {
    expect(() => read(guides, navigation)).toThrow(/invalid/);
  });
});

it('withdraws cached guide data when the Online CMS refuses an employee refresh', async () => {
  const bootstrap: AxisAuthenticatedBootstrap = {
    axisPolicy: {
      contractVersion: 0,
      screenLockEnabled: false,
      idleTimeoutSeconds: 900,
      recentNavigationLimit: 10,
      revision: 0,
      source: 'DEFAULT',
    },
    navigation: [],
    moduleCatalog: {},
    environments: ['local'],
    documentationSources: [],
    tenantCode: 'tenant',
    moduleConnections: {
      cms: [
        {
          moduleName: 'cms',
          instanceId: 'online',
          environment: 'local',
          endpoint: 'https://cms.example/nodics/cms',
          state: 'UP',
          runtimeRole: { code: 'ONLINE', publication: 'ONLINE' },
        },
      ],
    },
  };
  const client = new QueryClient();
  const request = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({
        result: { contractVersion: 1, guides: [project], navigation: [nav] },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 403 }));
  try {
    const { result } = renderHook(
      () =>
        useOnlineDocumentationGuides(bootstrap, runtime, 'employee-token', 'reader'),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => expect(result.current.data?.navigation).toEqual([nav]));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(2);
  } finally {
    request.mockRestore();
    client.clear();
  }
});
