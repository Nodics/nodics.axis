import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { OperationalReadinessInspector } from '../../src/bootstrap/OperationalReadinessInspector';
import {
  loadOperationalReadiness,
  type AxisAuthenticatedBootstrap,
  type AxisOperationalReadinessReport,
} from '../../src/bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../src/runtime/runtimeConfig';
vi.mock('../../src/bootstrap/publicBootstrap', async (original) => ({
  ...(await original<object>()),
  loadOperationalReadiness: vi.fn(),
}));
const presentation = {
  openLabel: 'Inspect readiness',
  title: 'Operational readiness',
  description:
    'Compare the same owner-reported state while working in any workspace. This view does not grant permission to run an action.',
  refreshLabel: 'Refresh readiness',
  closeLabel: 'Close',
  loadingMessage: 'Checking readiness with the owning services…',
  errorMessage: 'Readiness could not be loaded. Refresh to try again.',
  checkedAtLabel: 'Checked at',
  receiptLabel: 'Evidence receipt',
  buildLabel: 'Running build',
  stateLabel: 'Status',
  nextActionLabel: 'Next action',
  historicalMessage:
    'Previous observations are historical evidence. Actions always recheck current owner permissions and prerequisites.',
};
const bootstrap = {
  moduleConnections: { backoffice: [{ endpoint: 'https://owner.example/backoffice' }] },
  operationalReadinessObservation: {
    contractVersion: 1,
    mode: 'ON_DEMAND',
    presentation,
  },
} as unknown as AxisAuthenticatedBootstrap;
const runtime = {
  backofficeBaseUrl: 'https://owner.example',
  clientContractVersion: 1,
  requestTimeoutMs: 30000,
} as AxisRuntimeConfig;
const report: AxisOperationalReadinessReport = {
  contractVersion: 1,
  state: 'NEEDS_ATTENTION',
  checkedAt: '2026-11-12T12:00:00Z',
  source: 'BackOffice',
  summary: {
    latestSnapshot: {
      evidenceCode: 'readinessSnapshot:receipt-a',
      durable: true,
      buildIdentity: { inputDigest: 'a'.repeat(64) },
    },
  },
  sections: [
    {
      key: 'process',
      title: 'Process owner',
      businessStatus: 'BLOCKED',
      ownerModule: 'workflow',
      source: 'Process',
      route: '/tasks',
      summary: {},
      blockers: [],
      nextAction: 'Restore the Process owner before approval.',
    },
  ],
};
beforeEach(() => vi.mocked(loadOperationalReadiness).mockReset());
function mount(scope = 'tenant-a:actor-a') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const element = (scope: string, data = bootstrap) => (
    <QueryClientProvider client={client}>
      <OperationalReadinessInspector
        bootstrap={data}
        runtime={runtime}
        accessToken="test-token"
        scope={scope}
      />
    </QueryClientProvider>
  );
  return { ...render(element(scope)), client, element };
}
it('loads only after explicit opening and shows exact owner evidence with next action', async () => {
  vi.mocked(loadOperationalReadiness).mockResolvedValue(report);
  mount();
  expect(loadOperationalReadiness).not.toHaveBeenCalled();
  const trigger = screen.getByRole('button', { name: presentation.openLabel });
  trigger.focus();
  fireEvent.click(trigger);
  expect(
    await screen.findByText('Restore the Process owner before approval.'),
  ).toBeVisible();
  fireEvent.click(screen.getByText(presentation.receiptLabel));
  expect(screen.getByText('readinessSnapshot:receipt-a')).toBeVisible();
  expect(
    screen.getByText(presentation.buildLabel + ': ' + 'a'.repeat(64)),
  ).toBeVisible();
  expect(loadOperationalReadiness).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: presentation.closeLabel }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByText(presentation.receiptLabel));
  expect(await screen.findByText('readinessSnapshot:receipt-a')).toBeVisible();
  expect(loadOperationalReadiness).toHaveBeenCalledTimes(1);
});
it('withdraws stale success while refreshing and requires manual recovery after failure', async () => {
  vi.mocked(loadOperationalReadiness)
    .mockResolvedValueOnce(report)
    .mockRejectedValueOnce(Error('unavailable'))
    .mockResolvedValue(report);
  mount();
  fireEvent.click(screen.getByRole('button', { name: presentation.openLabel }));
  await screen.findByText('Restore the Process owner before approval.');
  fireEvent.click(screen.getByRole('button', { name: presentation.refreshLabel }));
  expect(await screen.findByRole('alert')).toHaveTextContent(presentation.errorMessage);
  expect(
    screen.queryByText('Restore the Process owner before approval.'),
  ).not.toBeInTheDocument();
  expect(loadOperationalReadiness).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: presentation.refreshLabel }));
  expect(
    await screen.findByText('Restore the Process owner before approval.'),
  ).toBeVisible();
  expect(loadOperationalReadiness).toHaveBeenCalledTimes(3);
});
it('retires a late observation when closed and does not expose it in another actor scope', async () => {
  let finish!: (value: AxisOperationalReadinessReport) => void;
  vi.mocked(loadOperationalReadiness)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ ...report, sections: [] });
  const view = mount();
  fireEvent.click(screen.getByRole('button', { name: presentation.openLabel }));
  await waitFor(() => expect(loadOperationalReadiness).toHaveBeenCalledOnce());
  const signal = vi.mocked(loadOperationalReadiness).mock.calls[0]?.[5];
  fireEvent.click(screen.getByRole('button', { name: presentation.closeLabel }));
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  view.rerender(view.element('tenant-b:actor-b'));
  await act(async () => {
    finish(report);
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole('button', { name: presentation.openLabel }));
  await waitFor(() => expect(loadOperationalReadiness).toHaveBeenCalledTimes(2));
  expect(
    screen.queryByText('Restore the Process owner before approval.'),
  ).not.toBeInTheDocument();
});
it('does not invent an inspector without owner presentation', () => {
  const view = mount();
  view.rerender(
    view.element('tenant-a', {
      ...bootstrap,
      operationalReadinessObservation: { contractVersion: 1, mode: 'ON_DEMAND' },
    }),
  );
  expect(
    screen.queryByRole('button', { name: presentation.openLabel }),
  ).not.toBeInTheDocument();
  expect(loadOperationalReadiness).not.toHaveBeenCalled();
});
