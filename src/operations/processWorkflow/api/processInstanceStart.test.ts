import { afterEach, describe, expect, it, vi } from 'vitest';
import { startProcessInstance } from './processDefinitionClient';
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
afterEach(() => vi.restoreAllMocks());
describe('Process start acknowledgement', () => {
  it.each([
    { code: 'instance-1', definitionCode: 'other', version: 1, status: 'WAITING' },
    { code: 'bad/ref', definitionCode: 'flow', version: 1, status: 'WAITING' },
    { code: 'instance-1', definitionCode: 'flow', version: 0, status: 'WAITING' },
  ])(
    'rejects an incompatible returned identity before linking to a workflow',
    async (instance) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: { instance } }), { status: 200 }),
      );
      await expect(
        startProcessInstance(connection, configuration, 'flow'),
      ).rejects.toThrow('Process start acknowledgement is incompatible');
    },
  );
  it('retains a matching exact returned instance without another start', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            instance: {
              code: 'instance-1',
              definitionCode: 'flow',
              version: 1,
              status: 'WAITING',
            },
          },
        }),
        { status: 200 },
      ),
    );
    expect(await startProcessInstance(connection, configuration, 'flow')).toMatchObject(
      { code: 'instance-1', definitionCode: 'flow', version: 1 },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
