import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useInitializationApproval } from '../../src/initialization/useInitializationApproval';
import type { AxisInitializationStatus } from '../../src/initialization/axisInitializationClient';
import type { AxisAuthenticatedBootstrap } from '../../src/bootstrap/publicBootstrap';
const owner = vi.hoisted(() => vi.fn());
vi.mock('../../src/operations/processWorkflow/api/processDefinitionClient', () => ({
  loadProcessTasks: owner,
}));
const status = {
  publication: {
    code: 'publication',
    revision: 2,
    state: 'PENDING_APPROVAL',
    workflowRef: 'workflow',
  },
  review: { publicationCode: 'publication', workflowRef: 'workflow' },
} as AxisInitializationStatus;
const bootstrap = {
  moduleConnections: {
    workflow: [
      {
        moduleName: 'workflow',
        instanceId: 'process',
        endpoint: 'https://process.test',
        environment: 'local',
        state: 'UP',
        runtimeRole: { code: 'PROCESS', publication: 'OPERATIONAL' },
      },
    ],
  },
} as unknown as AxisAuthenticatedBootstrap;
const task = (eligible: boolean, publicationCode = 'publication') => ({
  instanceCode: 'workflow',
  status: 'OPEN',
  reviewContext: { publicationCode },
  reviewerEligibility: {
    eligible,
    reasonCode: eligible ? 'ELIGIBLE' : 'REVIEWER_NOT_AUTHORISED',
    message: eligible ? 'Current Process reviewer' : 'This actor cannot approve',
  },
});
beforeEach(() => owner.mockReset());
it('requires affirmative current eligibility for the exact frozen publication', async () => {
  owner.mockResolvedValue([task(true)]);
  const h = renderHook(() =>
    useInitializationApproval(status, bootstrap, 'actor', 'default', 1000, false),
  );
  expect(h.result.current.eligible).toBe(false);
  await waitFor(() => expect(h.result.current.eligible).toBe(true));
});
it.each(
  [
    [],
    [task(true, 'foreign')],
    [task(false)],
    [{ ...task(true), reviewerEligibility: undefined }],
  ].map((tasks) => ({ tasks })),
)('refuses missing, foreign and denied Process proof: %j', async ({ tasks }) => {
  owner.mockResolvedValue(tasks);
  const h = renderHook(() =>
    useInitializationApproval(status, bootstrap, 'actor', 'default', 1000, false),
  );
  await waitFor(() => expect(owner).toHaveBeenCalledOnce());
  expect(h.result.current.eligible).toBe(false);
});
it('retires the old actor read before accepting a new actor response', async () => {
  let resolveOld!: (tasks: unknown[]) => void;
  owner
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValue([task(false)]);
  const h = renderHook(
    ({ actor }) =>
      useInitializationApproval(status, bootstrap, actor, 'default', 1000, false),
    { initialProps: { actor: 'first' } },
  );
  h.rerender({ actor: 'second' });
  await waitFor(() =>
    expect(h.result.current.message).toBe('This actor cannot approve'),
  );
  await act(async () => {
    resolveOld([task(true)]);
    await Promise.resolve();
  });
  expect(h.result.current.eligible).toBe(false);
});
it('retires affirmative proof when publication revision or status availability changes', async () => {
  owner.mockResolvedValue([task(true)]);
  const h = renderHook(
    ({ current, unavailable }) =>
      useInitializationApproval(
        current,
        bootstrap,
        'actor',
        'default',
        1000,
        unavailable,
      ),
    { initialProps: { current: status, unavailable: false } },
  );
  await waitFor(() => expect(h.result.current.eligible).toBe(true));
  h.rerender({
    current: { ...status, publication: { ...status.publication!, revision: 3 } },
    unavailable: true,
  });
  expect(h.result.current.eligible).toBe(false);
});
