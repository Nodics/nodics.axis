import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadRuleDefinitions,
  saveRuleDraft,
  simulateRuleDraft,
} from '../../src/operations/rulesManagement/api/rulesClient';

vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: (_bootstrap: unknown, moduleName: string) =>
    moduleName === 'rulesApi'
      ? { endpoint: 'https://rules.example/nodics/rulesApi' }
      : undefined,
}));

const configuration = {
  accessToken: 'employee-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
  bootstrap: {} as never,
};

afterEach(() => vi.unstubAllGlobals());

function respond(value: unknown) {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: value }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('Rules owner client', () => {
  it('loads definitions only through the discovered Rules API owner', async () => {
    const fetch = respond([{ code: 'EWASTE_REWARD', status: 'PUBLISHED' }]);
    await expect(loadRuleDefinitions(configuration)).resolves.toHaveLength(1);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'https://rules.example/nodics/rulesApi/v0/definitions',
    );
    expect(fetch.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });

  it('uses the lifecycle PATCH operation once without a fallback transport', async () => {
    const fetch = respond({ code: 'EWASTE_REWARD', status: 'DRAFT' });
    await saveRuleDraft(configuration, 'EWASTE_REWARD', { groups: [] });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'https://rules.example/nodics/rulesApi/v0/definitions/EWASTE_REWARD/draft',
    );
    expect(fetch.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ definition: { groups: [] } }),
      }),
    );
  });

  it('sends simulation input without publishing or evaluating in the browser', async () => {
    const fetch = respond({ finalScore: 80, scoreBandCode: 'HIGH' });
    await expect(
      simulateRuleDraft(configuration, 'EWASTE_REWARD', { weight: 2 }),
    ).resolves.toEqual({ finalScore: 80, scoreBandCode: 'HIGH' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/draft/simulate');
  });
});
