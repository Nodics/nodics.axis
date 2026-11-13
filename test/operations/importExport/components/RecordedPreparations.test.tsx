import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordedPreparations } from '../../../../src/operations/importExport/components/RecordedPreparations';
import {
  installDataReleases,
  loadDataReleaseExecutions,
} from '../../../../src/operations/importExport/api/dataReleaseClient';
import type { DataReleaseExecution } from '../../../../src/operations/importExport/api/dataReleaseContracts';
import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';
vi.mock('../../../../src/operations/importExport/api/dataReleaseClient', () => ({
  installDataReleases: vi.fn(),
  loadDataReleaseExecutions: vi.fn(),
}));
const execution: DataReleaseExecution = {
  code: 'releaseExecution_' + 'a'.repeat(64),
  planHash: 'b'.repeat(64),
  dataType: 'sample',
  status: 'READY',
  revision: 3,
  completed: 1,
  total: 2,
  canContinue: true,
  nextAction: 'Continue the recorded preparation when ready.',
  releaseCodes: ['example:first', 'example:second'],
  expectedReleases: { 'example:first': '0.0.1', 'example:second': '0.0.1' },
};
const connection = {
  moduleName: 'import',
  endpoint: 'http://localhost:4300/nodics/import',
  server: 'platformServer',
  instanceId: 'platform-1',
} as AxisModuleConnection;
const configuration = {
  accessToken: 'test-access',
  enterpriseCode: 'default',
  timeoutMs: 1000,
  sessionGeneration: 1,
};
function mount(scopeId = 'actor-a') {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RecordedPreparations
        scopeId={scopeId}
        configuration={configuration}
        dataType="sample"
        connections={[connection]}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadDataReleaseExecutions).mockResolvedValue([execution]);
});
afterEach(cleanup);
describe('RecordedPreparations', () => {
  it('reloads progress without posting and continues the exact recorded plan only after an explicit action', async () => {
    const first = mount();
    expect(await screen.findByText(/1 of 2 release stages prepared/)).toBeVisible();
    expect(installDataReleases).not.toHaveBeenCalled();
    first.unmount();
    mount();
    await screen.findByRole('button', { name: 'Continue preparation' });
    expect(installDataReleases).not.toHaveBeenCalled();
    vi.mocked(installDataReleases).mockImplementation(() => {
      const completed = {
        ...execution,
        completed: 2,
        status: 'COMPLETED' as const,
        canContinue: false,
      };
      vi.mocked(loadDataReleaseExecutions).mockResolvedValue([completed]);
      return Promise.resolve({
        dataType: 'sample' as const,
        tenant: 'default',
        releases: [],
        execution: completed,
      });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Continue preparation' }));
    await screen.findByText(/2 of 2 release stages prepared/);
    expect(installDataReleases).toHaveBeenCalledExactlyOnceWith(
      connection,
      configuration,
      {
        dataType: 'sample',
        releaseCodes: execution.releaseCodes,
        expectedReleases: execution.expectedReleases,
        continuation: true,
        executionCode: execution.code,
      },
    );
    expect(
      screen.getByRole('heading', { name: 'Recorded preparations' }),
    ).toHaveFocus();
  });
  it('hides continuation after owner permission denial and never posts for the new actor', async () => {
    vi.mocked(loadDataReleaseExecutions).mockResolvedValue([
      { ...execution, canContinue: false },
    ]);
    mount('actor-b');
    await screen.findByText(/1 of 2 release stages prepared/);
    expect(screen.queryByRole('button', { name: 'Continue preparation' })).toBeNull();
    expect(installDataReleases).not.toHaveBeenCalled();
  });
  it('holds competing clicks while pending and inspects the owner after a lost acknowledgement without replay', async () => {
    let fail!: (error: Error) => void;
    vi.mocked(installDataReleases).mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    mount();
    const button = await screen.findByRole('button', { name: 'Continue preparation' });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(installDataReleases).toHaveBeenCalledTimes(1);
    vi.mocked(loadDataReleaseExecutions).mockResolvedValue([
      {
        ...execution,
        status: 'UNCERTAIN',
        nextAction: 'Inspect this receipt. Do not repeat the import.',
      },
    ]);
    fail(new Error('Acknowledgement lost'));
    await screen.findByRole('button', { name: 'Reconcile receipt' });
    await waitFor(() => expect(screen.getByText(/Acknowledgement lost/)).toBeVisible());
    expect(installDataReleases).toHaveBeenCalledTimes(1);
  });
});
