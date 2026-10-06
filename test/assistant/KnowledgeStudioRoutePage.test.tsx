/** @file Proves native source route admission and enterprise-scoped inventory teardown. */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeStudioRoutePage } from '../../src/assistant/KnowledgeStudioRoutePage';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
import { knowledgeStudioFixture } from './knowledgeStudioFixture';
import {
  capability,
  target,
  connection as cronConnection,
} from '../cron/scheduleDraftFixture';

/** Reads mock request destinations without coercing Request objects to strings. */
const requestUrl = (address: RequestInfo | URL) =>
  new URL(address instanceof Request ? address.url : address);

const bootstrap = {
  navigation: [
    {
      id: 'copilot-knowledge',
      moduleName: 'copilotApi',
      label: 'Knowledge Studio',
      route: '/copilot/knowledge',
      availability: 'UP',
      featureState: 'ACTIVE',
      backendWorkspace: {
        renderer: 'axis.workspace.native',
        contractVersion: 1,
        workspaceCode: 'copilot.knowledge',
        viewCode: 'sources',
        title: 'Knowledge Studio',
      },
    },
  ],
  moduleConnections: {
    copilotApi: [
      {
        moduleName: 'copilotApi',
        instanceId: 'one',
        endpoint: 'http://localhost:4300/copilotApi',
        environment: 'test',
        state: 'UP',
      },
    ],
  },
} as unknown as AxisAuthenticatedBootstrap;
const runtime = {
  enterpriseCode: 'enterprise',
  requestTimeoutMs: 1000,
} as AxisRuntimeConfig;
afterEach(() => vi.unstubAllGlobals());

describe('Knowledge Studio admission', () => {
  it('admits source-bound drafts only with both owner declarations and removes them on Cron revocation', async () => {
    const fixture = knowledgeStudioFixture();
    const sourceBinding = {
      moduleName: 'copilotApi',
      sourceCode: fixture.sources[0]!.code,
      policyDigest: 'a'.repeat(64),
    };
    const inventory = {
      ...fixture,
      sourceSchedules: { ownerModule: 'cronjob', enabled: true },
      sources: fixture.sources.map((source) => ({
        ...source,
        sourcePolicyDigest: sourceBinding.policyDigest,
      })),
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation((address) => {
      const url = requestUrl(address);
      return Promise.resolve(
        new Response(
          JSON.stringify(
            url.hostname === 'schedule-fixture.invalid'
              ? {
                  ...capability,
                  data: {
                    ...capability.data,
                    enterpriseCode: runtime.enterpriseCode,
                    targets: [
                      {
                        ...target,
                        sourceBinding,
                      },
                    ],
                  },
                }
              : { code: 'SUC_SYS_00000', data: inventory },
          ),
        ),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const withConnection = {
      ...bootstrap,
      moduleConnections: { ...bootstrap.moduleConnections, cronjob: [cronConnection] },
    };
    const view = render(
      <KnowledgeStudioRoutePage
        accessToken="token"
        bootstrap={withConnection}
        runtime={runtime}
      />,
    );
    await screen.findByRole('heading', { name: 'framework-readmes' });
    expect(
      fetcher.mock.calls.some(
        ([address]) => requestUrl(address).hostname === 'schedule-fixture.invalid',
      ),
    ).toBe(false);
    const withNavigation = {
      ...withConnection,
      navigation: [
        ...withConnection.navigation,
        {
          id: 'cronjob',
          moduleName: 'cronjob',
          label: 'Cron jobs',
          route: '/cronjob',
          availability: 'UP',
          featureState: 'ACTIVE',
        },
      ],
    } as AxisAuthenticatedBootstrap;
    view.rerender(
      <KnowledgeStudioRoutePage
        accessToken="token"
        bootstrap={withNavigation}
        runtime={runtime}
      />,
    );
    await screen.findByRole('heading', { name: 'Schedule drafts' });
    expect(
      fetcher.mock.calls.filter(
        ([address]) => requestUrl(address).hostname === 'schedule-fixture.invalid',
      ),
    ).toHaveLength(1);
    view.rerender(
      <KnowledgeStudioRoutePage
        accessToken="token"
        bootstrap={withConnection}
        runtime={runtime}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Schedule drafts' })).toBeNull();
  });
  it('does not fetch for hidden or wrong-owner native bindings', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const patch of [
      { featureState: 'HIDDEN' },
      { moduleName: 'other' },
      { availability: 'DOWN' },
    ]) {
      const rendered = render(
        <KnowledgeStudioRoutePage
          accessToken="token"
          bootstrap={
            {
              ...bootstrap,
              navigation: [{ ...bootstrap.navigation[0]!, ...patch }],
            } as AxisAuthenticatedBootstrap
          }
          runtime={runtime}
        />,
      );
      expect(fetcher).not.toHaveBeenCalled();
      rendered.unmount();
    }
  });
  it('removes inventory and selected source data on enterprise change', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 'SUC_SYS_00000', data: knowledgeStudioFixture() }),
        ),
      );
    fetcher.mockImplementationOnce(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetcher);
    const { rerender } = render(
      <KnowledgeStudioRoutePage
        accessToken="token"
        bootstrap={bootstrap}
        runtime={runtime}
      />,
    );
    await screen.findByRole('heading', { name: 'framework-readmes' });
    rerender(
      <KnowledgeStudioRoutePage
        accessToken="token"
        bootstrap={bootstrap}
        runtime={{ ...runtime, enterpriseCode: 'other' }}
      />,
    );
    expect(screen.queryByText('**/README.md')).toBeNull();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
