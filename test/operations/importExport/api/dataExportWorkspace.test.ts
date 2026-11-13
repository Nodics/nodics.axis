import { describe, expect, it, vi } from 'vitest';
import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';
import {
  generateDataExport,
  loadDataExportWorkspace,
} from '../../../../src/operations/importExport/api/dataReleaseClient';
import type { DataExportRequest } from '../../../../src/operations/importExport/api/dataReleaseContracts';

const connection: AxisModuleConnection = {
  moduleName: 'export',
  instanceId: 'export-wcms',
  endpoint: 'http://localhost:4312/nodics/export',
  environment: 'local',
  server: 'wcmsStagedServer',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const configuration = {
  accessToken: 'employee-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};
const available = {
  contractVersion: 1,
  kind: 'GOVERNED_EXPORT',
  availability: 'AVAILABLE',
  formats: ['csv', 'json'],
};
const response = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('Export owner availability client', () => {
  it.each(['moduleName', 'schemaName', 'format'] as const)(
    'rejects an acknowledged export with a different %s without replay',
    async (field) => {
      const command: DataExportRequest = {
        enterpriseCode: 'default',
        moduleName: 'editorial',
        schemaName: 'editorialAuthor',
        format: 'json',
        query: {
          search: 'local-author',
          pageNumber: 1,
          pageSize: 10,
          sort: { field: 'code', direction: 'ASC' },
        },
      };
      const result = {
        moduleName: command.moduleName,
        schemaName: command.schemaName,
        format: command.format,
        fileName: 'local-author.json',
        media: { mediaCode: 'local-author-export', name: 'Local author export' },
        summary: {
          requestedRecords: 1,
          exportedRecords: 1,
          totalAvailableRecords: 1,
          truncated: false,
        },
        [field]: field === 'format' ? 'csv' : 'foreign',
      };
      const request = vi.fn<typeof fetch>().mockResolvedValue(response(result));
      await expect(
        generateDataExport(connection, configuration, command, request),
      ).rejects.toThrow(/selected model and format/i);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it('reads the selected runtime exactly once with GET and no export command body', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(available));
    await expect(
      loadDataExportWorkspace(connection, configuration, request),
    ).resolves.toEqual(available);
    expect(request).toHaveBeenCalledTimes(1);
    const input = request.mock.calls[0]?.[0];
    expect(
      input instanceof Request ? input.url : input instanceof URL ? input.href : input,
    ).toBe('http://localhost:4312/nodics/export/v0/workspace');
    expect(request.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(request.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it('retains owner disabled evidence instead of inferring availability from formats', async () => {
    const disabled = {
      ...available,
      availability: 'DISABLED',
      reason: 'File export is not enabled in this workspace.',
    };
    await expect(
      loadDataExportWorkspace(
        connection,
        configuration,
        vi.fn<typeof fetch>().mockResolvedValue(response(disabled)),
      ),
    ).resolves.toEqual(disabled);
  });

  it.each([
    ['future version', { ...available, contractVersion: 2 }],
    ['foreign kind', { ...available, kind: 'IMPORT' }],
    ['unknown state', { ...available, availability: 'UNKNOWN' }],
    ['empty available formats', { ...available, formats: [] }],
    ['unsupported format', { ...available, formats: ['xlsx'] }],
    ['duplicate formats', { ...available, formats: ['csv', 'csv'] }],
    [
      'unbounded reason',
      { ...available, availability: 'UNAVAILABLE', reason: 'x'.repeat(241) },
    ],
    ['missing disabled reason', { ...available, availability: 'DISABLED' }],
    ['contradictory available reason', { ...available, reason: 'Not available' }],
    ['unexpected executable field', { ...available, action: '/export' }],
  ])('rejects %s without retry or another runtime', async (_label, data) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(data));
    await expect(
      loadDataExportWorkspace(connection, configuration, request),
    ).rejects.toThrow(/availability/i);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
