import { describe, expect, it, vi } from 'vitest';

import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';
import {
  installDataReleases,
  installMediaImport,
  loadDataReleases,
  loadImportHistory,
  loadImportHistoryForMediaCode,
  downloadDataExportMedia,
  preflightDataReleases,
  uploadImportMedia,
  validateMediaImport,
} from '../../../../src/operations/importExport/api/dataReleaseClient';

const connection: AxisModuleConnection = {
  moduleName: 'import',
  instanceId: 'local:monoServer:default:1',
  endpoint: 'http://localhost:3000/nodics/import',
  environment: 'kickoffLocal',
  state: 'UP',
};
const configuration = {
  accessToken: 'employee-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};
const mediaConnection: AxisModuleConnection = {
  moduleName: 'media',
  instanceId: 'local:monoServer:media:1',
  endpoint: 'http://localhost:3000/nodics/media',
  environment: 'kickoffLocal',
  state: 'UP',
};
const systemConnection: AxisModuleConnection = {
  moduleName: 'system',
  instanceId: 'local:monoServer:system:1',
  endpoint: 'http://localhost:3000/nodics/system',
  environment: 'kickoffLocal',
  state: 'UP',
};
const release = {
  moduleName: 'profile',
  displayName: 'Employee Profiles',
  parentModule: 'nodics.platform',
  canonicalIdentity: 'nodics.platform/modules/profile',
  dataType: 'core',
  version: '0.0.0',
  description: 'Profile baseline records',
  checksum: 'a'.repeat(64),
  status: 'UPDATE_AVAILABLE',
};

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('data release client', () => {
  it('loads and parses the backend-owned catalogue', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation((input) => {
      const pathname = (input as URL).pathname;
      return Promise.resolve(
        response({ data: pathname.endsWith('/core') ? [release] : [] }),
      );
    });

    const result = await loadDataReleases(
      connection,
      configuration,
      fetchImplementation,
    );

    expect(result[0]?.displayName).toBe('Employee Profiles');
    expect(result[0]?.status).toBe('UPDATE_AVAILABLE');
    const [, options] = fetchImplementation.mock.calls[0]!;
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(
      fetchImplementation.mock.calls.map(([input]) => (input as URL).pathname),
    ).toEqual([
      '/nodics/import/v0/init',
      '/nodics/import/v0/core',
      '/nodics/import/v0/sample',
    ]);
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer employee-token',
    );
  });

  it('sends the same immutable selection to preflight and typed execution', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        response({
          data: {
            dataType: 'core',
            tenant: 'default',
            releases: [release],
            importRun: 'run-1',
          },
        }),
      ),
    );
    const plan = {
      dataType: 'core' as const,
      modules: ['profile'],
      expectedReleases: { profile: '1.2.0' },
    };

    await preflightDataReleases(connection, configuration, plan, fetchImplementation);
    await installDataReleases(connection, configuration, plan, fetchImplementation);

    expect((fetchImplementation.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/nodics/import/v0/core/validate',
    );
    expect((fetchImplementation.mock.calls[1]?.[0] as URL).pathname).toBe(
      '/nodics/import/v0/core/install',
    );
    expect(fetchImplementation.mock.calls[1]?.[1]?.body).toBe(JSON.stringify(plan));
  });

  it('rejects incompatible catalogue states and returns bounded authorization errors', async () => {
    await expect(
      loadDataReleases(
        connection,
        configuration,
        vi.fn<typeof fetch>().mockImplementation((input) => {
          const pathname = (input as URL).pathname;
          return Promise.resolve(
            response({
              data: pathname.endsWith('/core')
                ? [{ ...release, status: 'SECRET_STATE' }]
                : [],
            }),
          );
        }),
      ),
    ).rejects.toThrow('incompatible');

    await expect(
      loadDataReleases(
        connection,
        configuration,
        vi.fn<typeof fetch>().mockResolvedValue(response({}, 403)),
      ),
    ).rejects.toThrow('not authorized');
  });

  it('loads bounded import history without accepting diagnostic fields', async () => {
    const result = await loadImportHistory(
      connection,
      configuration,
      vi.fn<typeof fetch>().mockResolvedValue(
        response({
          data: [
            {
              runId: 'run-1',
              status: 'COMPLETED',
              dataType: 'core',
              modules: ['profile'],
              summary: {
                recordsRead: 10,
                recordsSucceeded: 9,
                recordsFailed: 1,
              },
              failures: [
                {
                  fileName: 'tenant.csv',
                  recordKey: 'testOne',
                  schemaName: 'tenant',
                  operation: 'saveAll',
                  error: {
                    code: 'ERR_TEST_IMPORT',
                    message: 'Synthetic row failure',
                    stack: 'must not pass',
                  },
                  internalAbsolutePath: '/must/not/pass',
                },
              ],
              stack: 'must not pass',
            },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      {
        runId: 'run-1',
        status: 'COMPLETED',
        dataType: 'core',
        modules: ['profile'],
        summary: {
          recordsRead: 10,
          recordsSucceeded: 9,
          recordsFailed: 1,
        },
        failures: [
          {
            fileName: 'tenant.csv',
            recordKey: 'testOne',
            schemaName: 'tenant',
            operation: 'saveAll',
            error: {
              code: 'ERR_TEST_IMPORT',
              message: 'Synthetic row failure',
            },
          },
        ],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('stack');
    expect(JSON.stringify(result)).not.toContain('internalAbsolutePath');
  });

  it('loads media-specific import history through a sanitized mediaCode query', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        data: [
          {
            runId: 'media-import-run-1',
            status: 'COMPLETED',
            dataType: 'media',
            modules: ['catalog'],
            sourceName: 'media:tenant-upload',
            providerPath: '/must/not/pass',
          },
        ],
      }),
    );

    const result = await loadImportHistoryForMediaCode(
      connection,
      configuration,
      'tenant-upload',
      fetchImplementation,
    );

    const requestUrl = fetchImplementation.mock.calls[0]?.[0] as URL;
    expect(requestUrl.pathname).toBe('/nodics/import/v0/run/history');
    expect(requestUrl.searchParams.get('mediaCode')).toBe('tenant-upload');
    expect(requestUrl.searchParams.get('limit')).toBe('10');
    expect(result).toEqual([
      {
        runId: 'media-import-run-1',
        status: 'COMPLETED',
        dataType: 'media',
        modules: ['catalog'],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('sourceName');
    expect(JSON.stringify(result)).not.toContain('/must/not/pass');
  });

  it('uploads import media without overriding the browser multipart boundary', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        result: {
          code: 'tenant-upload',
          name: 'tenant.csv',
          originalFileName: 'tenant.csv',
          extension: 'csv',
          sizeBytes: 32,
          checksum: 'b'.repeat(64),
          status: 'READY',
        },
      }),
    );
    const file = new File(['code,description\n'], 'tenant.csv', { type: 'text/csv' });

    const result = await uploadImportMedia(
      mediaConnection,
      configuration,
      file,
      {
        enterpriseCode: 'default',
        moduleName: 'profile',
        schemaName: 'tenant',
        tenantCode: 'default',
      },
      fetchImplementation,
    );

    expect(result.mediaCode).toBe('tenant-upload');
    expect((fetchImplementation.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/nodics/media/v0/storage/upload',
    );
    const headers = new Headers(fetchImplementation.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Content-Type')).toBeNull();
    const body = fetchImplementation.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('folderCode')).toBe('importSources');
    expect((body as FormData).get('formatCode')).toBe('importFile');
    expect((body as FormData).get('enterpriseCode')).toBe('default');
    expect((body as FormData).get('tenantCode')).toBe('default');
    expect((body as FormData).get('moduleName')).toBe('profile');
    expect((body as FormData).get('schemaName')).toBe('tenant');
  });

  it('validates and installs media imports through the system import route', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        response({
          code: 'SUC_IMP_00000',
          responseCode: '200',
          message: 'Data successfully processed',
          validationOnly: true,
          importRun: {
            runId: 'media-validation-1',
            status: 'VALIDATED',
            modules: ['profile'],
            summary: {
              recordsRead: 1,
              recordsFinalized: 1,
              recordsDispatched: 0,
              recordsSucceeded: 0,
            },
            stack: 'must not pass',
          },
          mediaSource: { mediaCode: 'tenant-upload', name: 'tenant.csv' },
        }),
      ),
    );

    await validateMediaImport(
      connection,
      configuration,
      {
        mediaCode: 'tenant-upload',
        moduleName: 'profile',
        schemaName: 'tenant',
        operation: 'saveAll',
      },
      fetchImplementation,
    );
    const installResult = await installMediaImport(
      connection,
      configuration,
      {
        mediaCode: 'tenant-upload',
        moduleName: 'profile',
        schemaName: 'tenant',
        operation: 'saveAll',
      },
      fetchImplementation,
    );

    expect(installResult.importRun?.runId).toBe('media-validation-1');
    expect(installResult.importRun?.summary?.recordsRead).toBe(1);
    expect(JSON.stringify(installResult)).not.toContain('stack');
    expect((fetchImplementation.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/nodics/import/v0/media',
    );
    expect(fetchImplementation.mock.calls[0]?.[1]?.body).toContain(
      '"validateOnly":true',
    );
    expect(fetchImplementation.mock.calls[0]?.[1]?.body).toContain(
      '"moduleName":"profile"',
    );
    expect(fetchImplementation.mock.calls[0]?.[1]?.body).toContain(
      '"schemaName":"tenant"',
    );
    expect(fetchImplementation.mock.calls[0]?.[1]?.body).not.toContain(
      'definitionCode',
    );
    expect(fetchImplementation.mock.calls[1]?.[1]?.body).toContain(
      '"importFinalizeData":true',
    );
    expect(fetchImplementation.mock.calls[1]?.[1]?.body).not.toContain(
      'definitionCode',
    );
  });

  it('downloads generated export media through the nMedia download route', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="address-export.json"',
        },
      }),
    );

    const result = await downloadDataExportMedia(
      systemConnection,
      configuration,
      {
        mediaCode: 'address-export-1',
        name: 'address-export-1',
        originalFileName: 'address-export.json',
        accessUrl: '/nodics/media/v0/content/address-export-1',
      },
      fetchImplementation,
    );

    expect(result.fileName).toBe('address-export.json');
    expect((fetchImplementation.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/nodics/media/v0/download/address-export-1',
    );
    const headers = new Headers(fetchImplementation.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer employee-token');
  });

  it('reports export download HTTP failures as media service failures', async () => {
    await expect(
      downloadDataExportMedia(
        systemConnection,
        configuration,
        {
          mediaCode: 'address-export-1',
          name: 'address-export-1',
          originalFileName: 'address-export.json',
        },
        vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 })),
      ),
    ).rejects.toThrow('Media service returned HTTP 404');
  });

  it('returns bounded nested import failure details from failed media imports', async () => {
    await expect(
      validateMediaImport(
        systemConnection,
        configuration,
        {
          mediaCode: 'tenant-upload',
          moduleName: 'profile',
          schemaName: 'tenant',
          operation: 'saveAll',
        },
        vi.fn<typeof fetch>().mockResolvedValue(
          response(
            {
              responseCode: '400',
              code: 'ERR_IMP_00000',
              name: 'DataImportError',
              message: 'Import processing completed with errors',
              errors: [
                {
                  code: 'ERR_TEST_IMPORT',
                  message: 'Tenant row failed validation',
                  contexts: [{ recordKey: 'testOne' }],
                },
              ],
            },
            400,
          ),
        ),
      ),
    ).rejects.toThrow(
      'Import processing completed with errors: ERR_TEST_IMPORT: Tenant row failed validation',
    );
  });
});
