import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicationRequestBrowser } from '../../../src/operations/contentExperience/PublicationRequestBrowser';
import type { PublicationSummaryPage } from '../../../src/operations/contentExperience/api/publicationRequestBrowserClient';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';
const loader = vi.hoisted(() => vi.fn());
vi.mock(
  '../../../src/operations/contentExperience/api/publicationRequestBrowserClient',
  () => ({ loadPublicationRequestPage: loader }),
);
const source: AxisModuleConnection = {
  moduleName: 'publish',
  instanceId: 'source',
  endpoint: 'https://source.example.test/nodics/publish',
  environment: 'local',
  server: 'authoring',
  state: 'UP',
};
const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'https://platform.example.test',
  enterpriseCode: 'default',
  projectCode: 'project',
  clientContractVersion: 1,
  requestTimeoutMs: 1000,
  browserSessionTimeoutMs: 15000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1024,
  assistantReconnectWindowMs: 1000,
  assistantIdleTimeoutMs: 1000,
};
const page = (rootCode: string): PublicationSummaryPage => ({
  records: [
    {
      code: 'request-one',
      state: 'ONLINE',
      domain: 'cms',
      rootCode,
      sourceVersion: '0',
      revision: 6,
    },
  ],
  pageNumber: 1,
  pageSize: 10,
  totalCount: 1,
});
beforeEach(() => {
  vi.clearAllMocks();
  loader.mockResolvedValue(page('page-one'));
});
describe('publication request list', () => {
  it('opens the selected exact reference without copying identifiers', async () => {
    const inspect = vi.fn(),
      client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PublicationRequestBrowser
          source={source}
          accessToken="private-access"
          actorScope="opaque-employee-scope"
          tenantCode="tenant"
          runtime={runtime}
          active
          onInspect={inspect}
        />
      </QueryClientProvider>,
    );
    expect((await screen.findAllByText('page-one')).length).toBeGreaterThan(0);
    await userEvent
      .setup()
      .click(screen.getAllByRole('button', { name: 'Inspect request' })[0]!);
    expect(inspect).toHaveBeenCalledExactlyOnceWith('request-one');
    expect(loader.mock.calls[0]?.[0]).toBe(source);
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain('private-access');
  });
  it.each(['actor', 'source'])(
    'retires a delayed result after %s scope changes',
    async (scope) => {
      let resolveOld: ((value: PublicationSummaryPage) => void) | undefined;
      loader
        .mockImplementationOnce(
          () =>
            new Promise<PublicationSummaryPage>((resolve) => {
              resolveOld = resolve;
            }),
        )
        .mockResolvedValue(page('new-page'));
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const show = (next: boolean) => (
        <QueryClientProvider client={client}>
          <PublicationRequestBrowser
            source={
              next && scope === 'source'
                ? {
                    ...source,
                    instanceId: 'another-source',
                    endpoint: 'https://other.example.test/nodics/publish',
                  }
                : source
            }
            accessToken={
              next && scope === 'actor'
                ? 'second-private-access'
                : 'first-private-access'
            }
            actorScope={next && scope === 'actor' ? 'scope-two' : 'scope-one'}
            tenantCode="tenant"
            runtime={runtime}
            active
            onInspect={vi.fn()}
          />
        </QueryClientProvider>
      );
      const view = render(show(false));
      view.rerender(show(true));
      await screen.findAllByText('new-page');
      await act(async () => {
        resolveOld?.(page('retired-page'));
        await Promise.resolve();
      });
      expect(screen.queryByText('retired-page')).toBeNull();
    },
  );
  it('keeps direct request inspection free of background collection reads', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <PublicationRequestBrowser
          source={source}
          accessToken="private-access"
          actorScope="scope"
          tenantCode="tenant"
          runtime={runtime}
          active={false}
          onInspect={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(loader).not.toHaveBeenCalled();
    expect(screen.queryByText('Requests in this source')).toBeNull();
  });
});
