/** @file Independent audit retention confirmation, strict receipts and no-replay recovery. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CopilotAuditRetentionPanel } from '../../src/assistant/CopilotAuditRetentionPanel';
import {
  auditRetentionTextKeys,
  parseAuditRetentionReceipt,
  type AuditRetentionCapability,
} from '../../src/assistant/api/copilotAuditRetentionClient';
const capability: AuditRetentionCapability = {
  canDelete: true,
  kinds: ['TRANSCRIPT_ACCESS', 'ACTION'],
  presentation: Object.fromEntries(
    auditRetentionTextKeys.map((key) => [key, key]),
  ) as AuditRetentionCapability['presentation'],
};
const configuration = {
  accessToken: 'synthetic',
  enterpriseCode: 'enterprise',
  moduleBaseUrl: 'https://audit-fixture.invalid/copilot',
  timeoutMs: 1000,
};
const review = {
  contractVersion: 1,
  context: { tenantCode: 'tenant', enterpriseCode: 'enterprise' },
  operationCode: 'audit-retention-11111111-1111-1111-1111-111111111111',
  kind: 'TRANSCRIPT_ACCESS',
  state: 'REVIEWED',
  cutoff: '2020-01-01T00:00:00.000Z',
  count: 2,
  removed: 0,
  reviewDigest: 'a'.repeat(64),
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('rejects foreign, malformed, contradictory and count-inconsistent audit evidence', () => {
  expect(parseAuditRetentionReceipt(review, 'enterprise').state).toBe('REVIEWED');
  for (const patch of [
    { context: { enterpriseCode: 'foreign' } },
    { count: 101 },
    { state: 'COMPLETED' },
    { acknowledged: false },
    { reviewDigest: 'bad' },
    { cutoff: 'yesterday' },
  ])
    expect(() =>
      parseAuditRetentionReceipt({ ...review, ...patch }, 'enterprise'),
    ).toThrow();
});
it('requires confirmation and inspects a lost commit without submitting deletion twice', async () => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL | Request) => {
      const operation = (url instanceof Request ? url.url : url.toString())
        .split('/')
        .at(-1)!;
      calls.push(operation);
      if (operation === 'execute') return Promise.reject(new Error('response lost'));
      const data =
        operation === 'preview'
          ? review
          : { ...review, state: 'COMPLETED', removed: 2 };
      return Promise.resolve(
        new Response(JSON.stringify({ code: 'SUC_COP_00000', data })),
      );
    }),
  );
  const user = userEvent.setup();
  render(
    <CopilotAuditRetentionPanel
      configuration={configuration}
      capability={capability}
    />,
  );
  await user.type(
    screen.getByRole('textbox', { name: 'reason' }),
    'Approved retention',
  );
  await user.click(screen.getByRole('button', { name: 'review' }));
  expect(await screen.findByRole('button', { name: 'execute' })).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: 'confirm' }));
  await user.click(screen.getByRole('button', { name: 'execute' }));
  await screen.findByText('OUTCOME_UNKNOWN');
  expect(screen.queryByRole('button', { name: 'execute' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'inspect' }));
  await screen.findByText('COMPLETED');
  expect(calls).toEqual(['preview', 'execute', 'inspect']);
});
