import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadPublishedProcessScheduleVersions,
  pinProcessTriggerVersion,
} from './processDefinitionClient';

const connection = {
  moduleName: 'workflow',
  instanceId: 'workflow',
  endpoint: 'http://workflow.example/nodics/process',
  environment: 'local',
  state: 'UP' as const,
};
const configuration = {
  accessToken: 'fixture-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};
const version = {
  code: 'review-v3',
  definitionCode: 'review',
  version: 3,
  status: 'PUBLISHED',
  checksum: 'owner-checksum',
};
const response = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });
afterEach(() => vi.restoreAllMocks());

describe('Published schedule version evidence', () => {
  it('reads exact published choices without choosing a default or dispatching work', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response({ code: 'SUC_PROCESS_00000', data: [version] }));
    expect(
      await loadPublishedProcessScheduleVersions(connection, configuration, 'review'),
    ).toEqual([version]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((fetcher.mock.calls[0]?.[0] as URL).href).toBe(
      'http://workflow.example/nodics/process/v0/definitions/review/versions',
    );
    expect(fetcher.mock.calls[0]?.[1]?.method ?? 'GET').toBe('GET');
  });
  it.each([
    { code: 'ERR_PROCESS', data: [version] },
    { code: 'SUC_PROCESS', success: false, data: [version] },
    { code: 'SUC_PROCESS', data: {} },
    { code: 'SUC_PROCESS', data: [{ ...version, definitionCode: 'foreign' }] },
    { code: 'SUC_PROCESS', data: [{ ...version, version: '3' }] },
    { code: 'SUC_PROCESS', data: [{ ...version, version: 0 }] },
    { code: 'SUC_PROCESS', data: [version, version] },
  ])('rejects contradictory or ambiguous owner evidence', async (envelope) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(envelope));
    await expect(
      loadPublishedProcessScheduleVersions(connection, configuration, 'review'),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('pins only the selected version through one exact existing command', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({
        code: 'SUC_PROCESS_00010',
        data: { code: 'review-job', version: 3 },
      }),
    );
    await pinProcessTriggerVersion(connection, configuration, 'review-job', 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((fetcher.mock.calls[0]?.[0] as URL).href).toBe(
      'http://workflow.example/nodics/process/v0/triggers/review-job',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ version: 3 }),
    });
  });
  it.each([
    { code: 'ERR_PROCESS', data: { code: 'review-job', version: 3 } },
    { code: 'SUC_PROCESS', data: { code: 'foreign', version: 3 } },
    { code: 'SUC_PROCESS', data: { code: 'review-job', version: 2 } },
    { code: 'SUC_PROCESS', data: { code: 'review-job', version: 3, success: false } },
  ])(
    'does not accept or replay an incompatible version acknowledgement',
    async (envelope) => {
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(response(envelope));
      await expect(
        pinProcessTriggerVersion(connection, configuration, 'review-job', 3),
      ).rejects.toThrow(/unconfirmed/);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});
