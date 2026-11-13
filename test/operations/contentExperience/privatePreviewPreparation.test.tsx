import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivatePreviewPreparation } from '../../../src/operations/contentExperience/PrivatePreviewPreparation';
import {
  privateWcmsPreviewPreparation,
  privatePreviewCopyKeys,
} from '../../../src/operations/contentExperience/api/wcmsExperienceClient';
const connection = {
  moduleName: 'wcmsExperience',
  instanceId: 'staged',
  endpoint: 'http://localhost:4312/nodics/wcmsExperience',
  environment: 'local',
  server: 'wcms',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
} as const;
const configuration = {
  accessToken: 'test-actor',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};
const context = {
  site: 'agoraApparelSite',
  pageType: 'COLLECTION_INDEX',
  targetType: 'DEFAULT',
  targetCode: '*',
  locale: 'en',
  channel: 'web',
  device: 'desktop',
  region: '',
};
const token = '00000000-0000-4000-8000-000000000001';
const presentation = Object.fromEntries(
  privatePreviewCopyKeys.map((key) => [key, key]),
);
const evidence = (extra = {}) => ({
  contractVersion: 1,
  publication: 'STAGED',
  scope: context,
  state: 'NOT_PREPARED',
  presentation,
  ...extra,
});
const response = (value: unknown, extra = {}) =>
  Response.json({ code: 'SUC_SYS_00000', result: value, ...extra });
afterEach(() => vi.unstubAllGlobals());
describe('private Staged preparation admission and uncertain writes', () => {
  it.each([
    ['foreign journey', evidence({ scope: { ...context, site: 'other' } }), {}],
    ['missing generation', evidence({ state: 'READY', documentCount: 1 }), {}],
    ['Online acknowledgement', evidence({ publication: 'ONLINE' }), {}],
    ['failed envelope', evidence(), { status: 'FAILED' }],
    ['unconfirmed command', evidence(), {}],
  ])('rejects %s with one request and no retry', async (_label, value, extra) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(value, extra));
    await expect(
      privateWcmsPreviewPreparation(
        connection,
        configuration,
        context,
        'prepare',
        undefined,
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('requires exact inspected pending identity and sends only the fixed retirement operation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        evidence({
          revision: 3,
          onlineChanged: false,
          retiredPendingGeneration: token,
        }),
      ),
    );
    await expect(
      privateWcmsPreviewPreparation(
        connection,
        configuration,
        context,
        'retire',
        undefined,
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await privateWcmsPreviewPreparation(
      connection,
      configuration,
      context,
      'retire',
      {
        state: 'INSPECTION_REQUIRED',
        revision: 2,
        pendingGeneration: token,
        presentation,
      } as never,
      fetcher,
    );
    expect((fetcher.mock.calls[0]![0] as URL).href).toBe(
      'http://localhost:4312/nodics/wcmsExperience/v0/authoring/preparation/abandon',
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1]?.body as string)).toEqual({
      ...context,
      revision: 2,
      pendingGeneration: token,
    });
  });
  it('never prepares automatically and holds an uncertain command until a positive owner inspection', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(evidence()))
      .mockRejectedValueOnce(new TypeError('connection lost'))
      .mockResolvedValueOnce(
        response(
          evidence({
            state: 'READY',
            generation: token,
            documentCount: 1,
            revision: 4,
          }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const onPrepared = vi.fn();
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <PrivatePreviewPreparation
          connection={connection}
          configuration={configuration}
          context={context}
          onPrepared={onPrepared}
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    const prepare = await screen.findByRole('button', { name: 'prepare' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await user.dblClick(prepare);
    await waitFor(() => expect(prepare).toBeDisabled());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onPrepared).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'inspect' }));
    await waitFor(() => expect(prepare).toBeEnabled());
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onPrepared).toHaveBeenCalledTimes(1);
  });
});
