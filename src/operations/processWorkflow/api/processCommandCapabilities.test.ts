import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canSubmitProcessTriggerCommand,
  loadProcessCommandCapabilities,
} from './processCommandCapabilitiesClient';

const connection = {
  moduleName: 'workflow',
  instanceId: 'workflow',
  endpoint: 'http://workflow.example/nodics/process',
  environment: 'local',
  state: 'UP' as const,
};
const configuration = {
  accessToken: 'synthetic-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};
const command = {
  authorization: 'AUTHORIZED',
  receiptInspection: 'AUTHORIZED',
} as const;
const valid = {
  contractVersion: 1,
  newRecording: 'DISABLED',
  triggerCommands: {
    create: command,
    update: command,
    archive: command,
    execute: command,
  },
} as const;
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
afterEach(() => vi.restoreAllMocks());

describe('Process native command capability metadata', () => {
  it('withholds unavailable recording policy and never downgrades a recorded request without inspection rights', () => {
    expect(canSubmitProcessTriggerCommand(valid, 'execute')).toBe(true);
    expect(
      canSubmitProcessTriggerCommand(
        { ...valid, newRecording: 'UNAVAILABLE' },
        'execute',
      ),
    ).toBe(false);
    expect(
      canSubmitProcessTriggerCommand(
        {
          ...valid,
          newRecording: 'ENABLED',
          triggerCommands: {
            ...valid.triggerCommands,
            execute: { authorization: 'AUTHORIZED', receiptInspection: 'DENIED' },
          },
        },
        'execute',
      ),
    ).toBe(false);
    expect(canSubmitProcessTriggerCommand(undefined, 'execute')).toBe(false);
  });
  it('reads current private owner metadata without enabling recording or sending a command', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response({ code: 'SUC_PROCESS_00000', data: valid }));
    expect(await loadProcessCommandCapabilities(connection, configuration)).toEqual(
      valid,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((fetcher.mock.calls[0]?.[0] as URL).href).toBe(
      'http://workflow.example/nodics/process/v0/operations/capabilities',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });
  });
  it('preserves independent denied and unavailable native/receipt facts', async () => {
    const data = {
      ...valid,
      triggerCommands: {
        ...valid.triggerCommands,
        execute: { authorization: 'UNAVAILABLE', receiptInspection: 'AUTHORIZED' },
        update: { authorization: 'DENIED', receiptInspection: 'DENIED' },
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({ code: 'SUC_PROCESS_00000', data }),
    );
    expect(await loadProcessCommandCapabilities(connection, configuration)).toEqual(
      data,
    );
  });
  it.each([
    [],
    { ...valid, contractVersion: 2 },
    { ...valid, newRecording: true },
    { ...valid, extra: 'grant' },
    { ...valid, triggerCommands: { execute: command } },
    {
      ...valid,
      triggerCommands: {
        ...valid.triggerCommands,
        execute: { authorization: true, receiptInspection: 'AUTHORIZED' },
      },
    },
    {
      ...valid,
      triggerCommands: {
        ...valid.triggerCommands,
        execute: { ...command, permission: '*' },
      },
    },
    {
      ...valid,
      triggerCommands: {
        ...valid.triggerCommands,
        execute: { authorization: 'ALLOWED', receiptInspection: 'AUTHORIZED' },
      },
    },
  ])(
    'rejects unsupported or incomplete metadata without a fallback grant',
    async (data) => {
      const fetcher = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(response({ code: 'SUC_PROCESS_00000', data }));
      await expect(
        loadProcessCommandCapabilities(connection, configuration),
      ).rejects.toThrow(/could not be verified/);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { code: 'ERR_AUTH_00003', data: valid },
    { code: 'SUC_PROCESS_00000', data: valid, success: false },
    { code: 'SUC_PROCESS_00000', data: valid, result: valid },
    { code: 'SUC_PROCESS_00000', data: valid, errors: ['denied'] },
  ])('rejects failed or ambiguous envelopes', async (envelope) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(envelope));
    await expect(
      loadProcessCommandCapabilities(connection, configuration),
    ).rejects.toThrow(/could not be verified/);
  });
  it('does not retry denied owner reads', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response({ message: 'Not permitted' }, 403));
    await expect(
      loadProcessCommandCapabilities(connection, configuration),
    ).rejects.toThrow('Not permitted');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retires an obsolete scope read through its abort signal', async () => {
    const controller = new AbortController();
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const pending = loadProcessCommandCapabilities(
      connection,
      configuration,
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('sends no request for an already retired scope', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await expect(
      loadProcessCommandCapabilities(connection, configuration, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
