import { describe, expect, it, vi } from 'vitest';
import type {
  AxisModuleConnection,
  AxisNavigationLifecycleAction,
} from '../../../src/bootstrap/publicBootstrap';
import {
  executePublicationCommand,
  publicationCommandAvailable,
  qualifiedPublicationActions,
} from '../../../src/operations/contentExperience/api/publicationCommandClient';
import {
  parsePublicationInspection,
  type PublicationInspection,
} from '../../../src/operations/contentExperience/api/publicationInspectionClient';
const source = {
  moduleName: 'publish',
  endpoint: 'http://localhost:4312/nodics/publish',
  instanceId: 'original-source',
  state: 'UP',
} as AxisModuleConnection;
const configuration = {
  accessToken: 'private-employee-token',
  enterpriseCode: 'acme',
  timeoutMs: 1000,
};
const action = {
  id: 'retry',
  label: 'Retry original operation',
  ownerModule: 'publish',
  intent: 'RETRY',
  permission: 'publish.lifecycle.retry',
  featureState: 'ACTIVE',
  httpMethod: 'POST',
  operationRoute: '/publications/:publicationCode/retry',
  targetStatuses: ['FAILED'],
  order: 1,
} as AxisNavigationLifecycleAction;
const snapshot: PublicationInspection = {
  code: 'request-a',
  state: 'FAILED',
  revision: 7,
  domain: 'editorial',
  rootType: 'article',
  rootCode: 'article-a',
  sourceVersion: '2',
  operatorOperations: ['retry'],
};
const receipt = { ...snapshot, state: 'WITHDRAWN', revision: 9 };
const response = (result: unknown, extra = {}) =>
  Response.json({ code: 'SUC_PUB_00000', result, ...extra });
describe('declared original publication command', () => {
  it('sends one original-source POST with the inspected publication revision and no activation or credential acquisition', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(receipt));
    expect(
      await executePublicationCommand(
        source,
        configuration,
        action,
        snapshot,
        'Original response lost',
        fetcher,
      ),
    ).toMatchObject(receipt);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url instanceof Request ? url.url : url.toString()).toBe(
      'http://localhost:4312/nodics/publish/v0/publications/request-a/retry',
    );
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer private-employee-token',
        'x-enterprise-code': 'acme',
      },
    });
    expect(
      JSON.parse(typeof options?.body === 'string' ? options.body : 'null') as unknown,
    ).toEqual({
      expectedRevision: 7,
      reason: 'Original response lost',
    });
  });
  it.each([
    { ownerModule: 'cms' },
    { permission: undefined },
    { featureState: 'PREVIEW' },
    { httpMethod: 'GET' },
    { operationRoute: '/publications/:publicationCode/activate' },
    { targetStatuses: ['ONLINE'] },
  ] as const)(
    'holds undeclared or incompatible authority %j before transport',
    async (patch) => {
      const fetcher = vi.fn<typeof fetch>(),
        selected = { ...action, ...patch };
      expect(publicationCommandAvailable(selected, snapshot)).toBe(false);
      await expect(
        executePublicationCommand(
          source,
          configuration,
          selected,
          snapshot,
          '',
          fetcher,
        ),
      ).rejects.toThrow(/Refresh/);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('requires owner business eligibility independently of metadata and rejects duplicate declarations', () => {
    expect(
      publicationCommandAvailable(action, { ...snapshot, operatorOperations: [] }),
    ).toBe(false);
    const historical = { ...snapshot };
    delete historical.operatorOperations;
    expect(publicationCommandAvailable(action, historical)).toBe(false);
    expect(qualifiedPublicationActions([action, { ...action }], snapshot)).toEqual([]);
  });
  it.each([
    { domain: 'cms' },
    { rootCode: 'other' },
    { sourceVersion: '3' },
    { revision: 7 },
    { state: 'ONLINE' },
  ])(
    'holds an uncorrelated or nonterminal acknowledgement %j without retry',
    async (patch) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(response({ ...receipt, ...patch }));
      await expect(
        executePublicationCommand(source, configuration, action, snapshot, '', fetcher),
      ).rejects.toThrow(/unverified/);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { code: 'ERR_PUB_00006' },
    { responseCode: 409 },
    { acknowledged: false },
    { success: false },
    { errors: ['denied'] },
  ])('holds contradictory successful HTTP evidence %j', async (extra) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(receipt, extra));
    await expect(
      executePublicationCommand(source, configuration, action, snapshot, '', fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('holds a lost response without any automatic read or command replay', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('Response lost'));
    await expect(
      executePublicationCommand(source, configuration, action, snapshot, '', fetcher),
    ).rejects.toThrow('Response lost');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { operations: ['approve'] },
    { operations: ['retry', 'retry'] },
    { operations: ['unknown'] },
  ])('rejects malformed owner eligibility %j', ({ operations: operatorOperations }) => {
    expect(() =>
      parsePublicationInspection(
        { code: 'SUC_PUB_00000', result: { ...snapshot, operatorOperations } },
        snapshot.code,
      ),
    ).toThrow(/operator evidence/);
  });
});

it('rollback requires an explicit retained predecessor and preserves its full bounded identity for review', () => {
  const current = {
    ...snapshot,
    state: 'ONLINE',
    operatorOperations: ['rollback'] as const,
  };
  const rollback = {
    ...action,
    id: 'rollback',
    permission: 'publish.lifecycle.rollback',
    operationRoute: '/publications/:publicationCode/rollback',
    targetStatuses: ['ONLINE'],
  };
  expect(publicationCommandAvailable(rollback, current)).toBe(false);
  const previousOnlineVersion = 'retained-'.repeat(1000);
  const observed = parsePublicationInspection(
    { code: 'SUC_PUB_00000', result: { ...current, previousOnlineVersion } },
    current.code,
  );
  expect(observed.previousOnlineVersion).toBe(previousOnlineVersion);
  expect(publicationCommandAvailable(rollback, observed)).toBe(true);
});
