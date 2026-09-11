import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { WasteAuditPanel } from '../../src/operations/wasteManagement/WasteAuditPanel';
import {
  loadWasteAudit,
  type WasteAuditEntry,
} from '../../src/operations/wasteManagement/api/wasteReviewClient';
vi.mock('../../src/operations/wasteManagement/api/wasteReviewClient', () => ({
  loadWasteAudit: vi.fn(),
}));
const configuration = {} as Parameters<typeof loadWasteAudit>[0];
const labels = { auditAction: 'View review audit', auditTitle: 'Waste review audit' };
beforeEach(() => vi.resetAllMocks());
it('can close a pending audit; late responses stay hidden and reopening reads fresh data', async () => {
  let resolve!: (entries: WasteAuditEntry[]) => void;
  vi.mocked(loadWasteAudit)
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    )
    .mockResolvedValueOnce([{ code: 'NEW', status: 'APPROVED', revision: 1 }]);
  const user = userEvent.setup();
  render(<WasteAuditPanel configuration={configuration} labels={labels} />);
  expect(loadWasteAudit).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'View review audit' }));
  await user.click(screen.getByRole('button', { name: 'Waste review audit' }));
  resolve([{ code: 'STALE', status: 'APPROVED', revision: 1 }]);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'View review audit' })).toHaveAttribute(
      'aria-expanded',
      'false',
    ),
  );
  expect(screen.queryByText('STALE')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View review audit' }));
  expect(await screen.findByText('NEW')).toBeVisible();
  expect(loadWasteAudit).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('region', { name: 'Waste review audit' })).toHaveAttribute(
    'tabindex',
    '0',
  );
});
it('keeps failure collapsible and retries on the next opening', async () => {
  vi.mocked(loadWasteAudit)
    .mockRejectedValueOnce(new Error('Audit service unavailable'))
    .mockResolvedValueOnce([]);
  const user = userEvent.setup();
  render(<WasteAuditPanel configuration={configuration} labels={labels} />);
  await user.click(screen.getByRole('button', { name: 'View review audit' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Audit service unavailable',
  );
  await user.click(screen.getByRole('button', { name: 'Waste review audit' }));
  await user.click(screen.getByRole('button', { name: 'View review audit' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(loadWasteAudit).toHaveBeenCalledTimes(2);
});
