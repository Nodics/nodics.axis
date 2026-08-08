import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AxisThemeProvider } from '../../../src/app/AxisThemeProvider';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../../src/bootstrap/publicBootstrap';
import { MediaManagementRoutePage } from '../../../src/operations/mediaManagement/MediaManagementRoutePage';
import type { AxisRuntimeConfig } from '../../../src/runtime/runtimeConfig';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';

const runtime: AxisRuntimeConfig = {
  backofficeBaseUrl: 'http://localhost:3000',
  enterpriseCode: 'default',
  projectCode: 'kickoff',
  clientContractVersion: 1,
  requestTimeoutMs: 1_000,
  browserSessionCsrfCookieName: 'csrf',
  assistantMaximumEventBytes: 1_024,
  assistantReconnectWindowMs: 1_000,
  assistantIdleTimeoutMs: 1_000,
};

const mediaConnection = {
  moduleName: 'media',
  instanceId: 'startioLocal:monoServer:media:0',
  endpoint: 'http://localhost:3000/nodics/media',
  environment: 'startioLocal',
  state: 'UP' as const,
};

const importConnection = {
  moduleName: 'import',
  instanceId: 'startioLocal:monoServer:import:0',
  endpoint: 'http://localhost:3000/nodics/import',
  environment: 'startioLocal',
  state: 'UP' as const,
};

function navigationItem(
  id: string,
  label: string,
  route: string,
  order: number,
  parentId?: string,
): AxisNavigationItem {
  return {
    id,
    label,
    route,
    order,
    parentId,
    moduleName: 'media',
    category: 'operations',
    icon: id === 'media-management' ? 'media' : 'storage',
    availability: 'UP',
    group: { id: 'media-management', label: 'Media Management', order: 250 },
  };
}

const bootstrap: AxisAuthenticatedBootstrap = {
  axisPolicy: {
    contractVersion: 1,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 1,
    source: 'DEFAULT',
  },
  navigation: [
    navigationItem('media-management', 'Media Management', '/media', 250),
    navigationItem('media', 'Media records', '/media/items', 251, 'media-management'),
    navigationItem(
      'storage-delivery',
      'Storage and delivery',
      '/media/storage-delivery',
      252,
      'media-management',
    ),
    navigationItem(
      'media-folders',
      'Media folders',
      '/media/folders',
      253,
      'media-management',
    ),
    navigationItem(
      'media-formats',
      'Media formats',
      '/media/formats',
      254,
      'media-management',
    ),
    navigationItem(
      'media-usage',
      'Media usage',
      '/media/usage',
      255,
      'media-management',
    ),
    navigationItem('media-sets', 'Media sets', '/media/sets', 256, 'media-management'),
  ],
  environments: ['startioLocal'],
  moduleCatalog: {},
  moduleConnections: {
    media: [mediaConnection],
    import: [importConnection],
  },
  documentationSources: [],
  tenantCode: 'default',
};

const mediaSchema: WorkbenchSchema = {
  moduleName: 'media',
  schemaName: 'media',
  label: 'Media',
  description: 'Media records',
  displayProperty: 'code',
  displayProperties: ['code', 'originalFileName'],
  queryCapabilities: {
    searchableFields: ['code', 'originalFileName', 'folderCode'],
    sortableFields: [
      'code',
      'folderCode',
      'formatCode',
      'access',
      'status',
      'sizeBytes',
      'created',
      'updated',
      'createdBy',
      'updatedBy',
    ],
    filterFields: [],
    groupOperators: ['AND'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25],
    defaultPageSize: 10,
    maximumPageSize: 25,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read', 'update'],
  fields: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
      required: true,
      readOnly: false,
      primary: true,
      description: '',
      searchable: true,
    },
    {
      name: 'folderCode',
      label: 'Folder',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'formatCode',
      label: 'Format',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'access',
      label: 'Access',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'sizeBytes',
      label: 'Size Bytes',
      type: 'int',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'created',
      label: 'Created',
      type: 'date',
      required: true,
      readOnly: true,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'updated',
      label: 'Updated',
      type: 'date',
      required: true,
      readOnly: true,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'createdBy',
      label: 'Created By',
      type: 'string',
      required: false,
      readOnly: true,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'updatedBy',
      label: 'Updated By',
      type: 'string',
      required: false,
      readOnly: true,
      primary: false,
      description: '',
      searchable: false,
    },
  ],
  relationships: [],
};

const mediaReferenceSchema: WorkbenchSchema = {
  ...mediaSchema,
  schemaName: 'mediaReference',
  label: 'Media reference',
  operations: ['search', 'read'],
};

const mediaFolderSchema: WorkbenchSchema = {
  ...mediaSchema,
  schemaName: 'mediaFolder',
  label: 'Media folder',
  displayProperties: ['code', 'name'],
  queryCapabilities: {
    ...mediaSchema.queryCapabilities,
    searchableFields: [
      'code',
      'name',
      'storagePrefix',
      'access',
      'allowedExtensions',
      'allowedMimeTypes',
    ],
  },
  operations: ['search', 'read'],
};

const mediaFormatSchema: WorkbenchSchema = {
  ...mediaSchema,
  schemaName: 'mediaFormat',
  label: 'Media format',
  displayProperties: ['code', 'name'],
  queryCapabilities: {
    ...mediaSchema.queryCapabilities,
    searchableFields: [
      'code',
      'name',
      'description',
      'purpose',
      'formatFamily',
      'status',
    ],
    filterFields: [
      {
        field: 'formatFamily',
        label: 'Format family',
        type: 'string',
        operators: ['EQUALS', 'IN'],
      },
      {
        field: 'purpose',
        label: 'Purpose',
        type: 'string',
        operators: ['EQUALS', 'IN'],
      },
      { field: 'status', label: 'Status', type: 'string', operators: ['EQUALS', 'IN'] },
    ],
    groupOperators: ['AND', 'OR'],
  },
  operations: ['search', 'read'],
};

const mediaSetSchema: WorkbenchSchema = {
  ...mediaSchema,
  schemaName: 'mediaSet',
  label: 'Media set',
  displayProperties: ['code', 'name'],
  queryCapabilities: {
    ...mediaSchema.queryCapabilities,
    searchableFields: ['code', 'name', 'description', 'mediaType', 'businessPurpose'],
    filterFields: [
      {
        field: 'mediaType',
        label: 'Media type',
        type: 'string',
        operators: ['EQUALS', 'IN'],
      },
      {
        field: 'businessPurpose',
        label: 'Business purpose',
        type: 'string',
        operators: ['EQUALS', 'IN'],
      },
      { field: 'status', label: 'Status', type: 'string', operators: ['EQUALS', 'IN'] },
    ],
    groupOperators: ['AND', 'OR'],
  },
  operations: ['search', 'read'],
};

const mediaSetEntrySchema: WorkbenchSchema = {
  ...mediaSchema,
  schemaName: 'mediaSetEntry',
  label: 'Media set entry',
  displayProperties: ['code', 'mediaCode'],
  queryCapabilities: {
    ...mediaSchema.queryCapabilities,
    searchableFields: ['code', 'mediaSetCode', 'mediaCode', 'formatCode'],
    sortableFields: ['position', 'mediaCode', 'formatCode', 'variantRole', 'status'],
    filterFields: [
      {
        field: 'mediaSetCode',
        label: 'Media set',
        type: 'string',
        operators: ['EQUALS', 'IN'],
      },
    ],
  },
  fields: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
      required: true,
      readOnly: true,
      primary: true,
      description: '',
      searchable: true,
    },
    {
      name: 'position',
      label: 'Position',
      type: 'int',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'mediaCode',
      label: 'Media',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'formatCode',
      label: 'Format',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'variantRole',
      label: 'Role',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'localeCode',
      label: 'Locale',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'channelCode',
      label: 'Channel',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'deviceCode',
      label: 'Device',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'breakpointCode',
      label: 'Breakpoint',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'fallbackEntryCode',
      label: 'Fallback',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'string',
      required: true,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'primary',
      label: 'Primary',
      type: 'boolean',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: false,
    },
  ],
  operations: ['search', 'read', 'create', 'update'],
};

function json(result: unknown): Response {
  return new Response(JSON.stringify({ result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchInputUrl(input: RequestInfo | URL): URL {
  if (typeof input === 'string') return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

function fetchBodyText(init?: RequestInit): string {
  const body = init?.body;
  if (body === undefined || body === null) return '{}';
  if (typeof body === 'string') return body;
  throw new TypeError('Expected test fetch body to be a JSON string.');
}

function renderPage(path = '/media/items') {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AxisThemeProvider>
        <QueryClientProvider client={queryClient}>
          <MediaManagementRoutePage
            accessToken="employee-token"
            bootstrap={bootstrap}
            runtime={runtime}
          />
        </QueryClientProvider>
      </AxisThemeProvider>
    </MemoryRouter>,
  );
}

describe('MediaManagementRoutePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows schema-driven create actions for media formats and media sets', async () => {
    const writableMediaFormatSchema: WorkbenchSchema = {
      ...mediaFormatSchema,
      operations: ['search', 'read', 'create', 'update', 'delete'],
    };
    const writableMediaSetSchema: WorkbenchSchema = {
      ...mediaSetSchema,
      operations: ['search', 'read', 'create', 'update', 'delete'],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.pathname === '/nodics/media/v0/schema/workbench') {
        return Promise.resolve(
          json({
            moduleName: 'media',
            schemas: [
              writableMediaFormatSchema,
              writableMediaSetSchema,
              mediaSetEntrySchema,
            ],
          }),
        );
      }
      if (
        url.pathname === '/nodics/media/v0/schema/workbench/mediaFormat/records' ||
        url.pathname === '/nodics/media/v0/schema/workbench/mediaSet/records' ||
        url.pathname === '/nodics/media/v0/schema/workbench/mediaSetEntry/records'
      ) {
        return Promise.resolve(
          json({
            records: [],
            totalCount: 0,
            pageNumber: 1,
            pageSize: 10,
            sort: { field: 'code', direction: 'ASC' },
          }),
        );
      }
      if (url.pathname === '/nodics/media/v0/contexts') {
        return Promise.resolve(json({ contexts: [] }));
      }
      return Promise.resolve(json({}));
    });

    const formats = renderPage('/media/formats');

    expect(await screen.findByRole('button', { name: 'Create format' })).toBeVisible();
    formats.unmount();

    renderPage('/media/sets');

    expect(await screen.findByRole('button', { name: 'Create set' })).toBeVisible();
  });

  it('renders media records through nMedia contracts without exposing storage keys', async () => {
    const user = userEvent.setup();
    const createObjectUrl = vi.fn(() => 'blob:private-media-preview');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = fetchInputUrl(input);
        if (url.pathname === '/nodics/media/v0/schema/workbench') {
          return Promise.resolve(
            json({
              moduleName: 'media',
              schemas: [mediaSchema, mediaReferenceSchema, mediaFolderSchema],
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/schema/workbench/media/records') {
          return Promise.resolve(
            json({
              records: [
                {
                  code: 'home-banner',
                  name: 'Home banner',
                  originalFileName: 'home-banner.png',
                  folderCode: 'brandAssets',
                  formatCode: 'desktop',
                  providerCode: 'local',
                  access: 'PUBLIC',
                  status: 'READY',
                  mimeType: 'image/png',
                  extension: 'png',
                  sizeBytes: 2048,
                  checksum: 'abc123',
                  checksumAlgorithm: 'sha256',
                  created: '2026-07-30T10:00:00.000Z',
                  updated: '2026-07-31T10:00:00.000Z',
                  createdBy: 'media.creator',
                  updatedBy: 'media.operator',
                  storageKey: 'private/internal/home-banner.png',
                  accessUrl: '/nodics/media/v0/content/home-banner',
                },
                {
                  code: 'export-report',
                  name: 'Export report',
                  originalFileName: 'export-report.csv',
                  folderCode: 'exportFiles',
                  formatCode: 'export',
                  providerCode: 'local',
                  access: 'PUBLIC',
                  status: 'READY',
                  mimeType: 'text/csv',
                  extension: 'csv',
                  sizeBytes: 48,
                  checksum: 'def456',
                  checksumAlgorithm: 'sha256',
                  created: '2026-07-30T11:00:00.000Z',
                  updated: '2026-07-31T11:00:00.000Z',
                  createdBy: 'export.creator',
                  updatedBy: 'export.operator',
                  storageKey: 'private/internal/export-report.csv',
                  accessUrl: '/nodics/media/v0/content/export-report',
                },
                {
                  code: 'private-product-image',
                  name: 'Private product image',
                  originalFileName: 'private-product-image.png',
                  folderCode: 'default',
                  formatCode: 'original',
                  providerCode: 'local',
                  access: 'PRIVATE',
                  status: 'READY',
                  mimeType: 'image/png',
                  extension: 'png',
                  sizeBytes: 128,
                  checksum: 'ghi789',
                  checksumAlgorithm: 'sha256',
                  created: '2026-07-30T12:00:00.000Z',
                  updated: '2026-07-31T12:00:00.000Z',
                  createdBy: 'media.creator',
                  updatedBy: 'media.operator',
                  storageKey: 'private/internal/private-product-image.png',
                  accessUrl: '/nodics/media/v0/content/private-product-image',
                },
                {
                  code: 'private-export-json',
                  name: 'Private export JSON',
                  originalFileName: 'private-export.json',
                  folderCode: 'exportFiles',
                  formatCode: 'exportFile',
                  providerCode: 'local',
                  access: 'PRIVATE',
                  status: 'READY',
                  mimeType: 'application/json',
                  extension: 'json',
                  sizeBytes: 72,
                  checksum: 'jkl012',
                  checksumAlgorithm: 'sha256',
                  created: '2026-07-30T13:00:00.000Z',
                  updated: '2026-07-31T13:00:00.000Z',
                  createdBy: 'export.creator',
                  updatedBy: 'export.operator',
                  storageKey: 'private/internal/private-export.json',
                  accessUrl: '/nodics/media/v0/content/private-export-json',
                },
              ],
              totalCount: 4,
              pageNumber: 1,
              pageSize: 10,
              sort: { field: 'code', direction: 'ASC' },
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/content/export-report') {
          return Promise.resolve(
            new Response('code,status\naddress,READY\nprofile,READY', {
              status: 200,
              headers: { 'Content-Type': 'text/csv' },
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/content/private-product-image') {
          expect(new Headers(init?.headers).get('Authorization')).toBe(
            'Bearer employee-token',
          );
          return Promise.resolve(
            new Response(new Blob(['private image bytes'], { type: 'image/png' }), {
              status: 200,
              headers: { 'Content-Type': 'image/png' },
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/content/private-export-json') {
          expect(new Headers(init?.headers).get('Authorization')).toBe(
            'Bearer employee-token',
          );
          return Promise.resolve(
            new Response(JSON.stringify({ records: [{ code: 'address' }] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/download/private-export-json') {
          const headers = new Headers(init?.headers);
          expect(headers.get('Authorization')).toBe('Bearer employee-token');
          expect(headers.get('x-enterprise-code')).toBe('default');
          return Promise.resolve(
            new Response(new Blob(['{"records":[]}'], { type: 'application/json' }), {
              status: 200,
              headers: {
                'Content-Disposition': 'attachment; filename="private-export.json"',
                'Content-Type': 'application/json',
              },
            }),
          );
        }
        if (
          url.pathname === '/nodics/media/v0/schema/workbench/mediaReference/records'
        ) {
          return Promise.resolve(
            json({
              records: [
                {
                  code: 'ref-home-banner-import',
                  ownerModule: 'import',
                  ownerSchema: 'importRun',
                  ownerCode: 'importRun_media_1',
                  mediaCode: 'home-banner',
                  relationType: 'SOURCE_FILE',
                  status: 'ACTIVE',
                },
              ],
              totalCount: 1,
              pageNumber: 1,
              pageSize: 10,
              sort: { field: 'code', direction: 'ASC' },
            }),
          );
        }
        if (url.pathname === '/nodics/import/v0/run/history') {
          if (url.searchParams.get('mediaCode') !== 'home-banner') {
            return Promise.resolve(json([]));
          }
          return Promise.resolve(
            json([
              {
                runId: 'importRun_media_1',
                status: 'COMPLETED',
                dataType: 'media',
                modules: ['cms'],
                summary: {
                  recordsRead: 10,
                  recordsSucceeded: 10,
                  recordsFailed: 0,
                },
              },
            ]),
          );
        }
        if (url.pathname === '/nodics/media/v0/schema/workbench/mediaFolder/records') {
          return Promise.resolve(
            json({
              records: [
                {
                  code: 'cmsAssets',
                  name: 'CMS assets',
                  description: 'Content media folder',
                  storagePrefix: 'media/content',
                  access: 'PUBLIC',
                  allowedExtensions: ['png', 'webp'],
                  allowedMimeTypes: ['image/png', 'image/webp'],
                  maximumFileSizeBytes: 52428800,
                  retentionDays: 0,
                  fullPath: '/do/not/show/cms-assets',
                  providerSecret: 'must-not-render',
                },
              ],
              totalCount: 1,
              pageNumber: 1,
              pageSize: 10,
              sort: { field: 'code', direction: 'ASC' },
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/contexts') {
          return Promise.resolve(
            json({
              contexts: [
                {
                  code: 'contentMedia',
                  sourceType: 'Content media',
                  aliases: [
                    'contentMedia',
                    'cmsAssets',
                    'contentAssets',
                    'brandAssets',
                  ],
                  label: 'Content media',
                  description: 'Backend content media context',
                  folderCodes: ['brandAssets'],
                  defaultFolderCode: 'brandAssets',
                  allowedFolders: [
                    {
                      folderCode: 'brandAssets',
                      storagePrefix: 'media/content',
                      access: 'PUBLIC',
                      retentionDays: 0,
                      uploadPolicy: {
                        maximumFileSizeBytes: 4,
                        allowedExtensions: ['png'],
                        allowedMimeTypes: ['image/png'],
                        checksumAlgorithm: 'sha256',
                      },
                    },
                  ],
                  allowedFormatCodes: ['original', 'desktop'],
                  defaultFormatCode: 'original',
                  defaultModuleName: 'cms',
                  defaultSchemaName: 'cmsComponent',
                  targetRequired: false,
                  manualUploadEnabled: true,
                  storageRouteTemplate:
                    'media/content/{tenant}/{enterprise}/{schema}/{yyyy}/{mm}/{mediaCode}.{extension}',
                },
              ],
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/storage/policy') {
          const body = JSON.parse(fetchBodyText(init)) as {
            readonly folderCode?: string;
          };
          return Promise.resolve(
            json({
              folderCode: body.folderCode ?? 'default',
              access: body.folderCode === 'cmsAssets' ? 'PUBLIC' : 'PRIVATE',
              uploadPolicy: {
                allowedExtensions: body.folderCode === 'cmsAssets' ? ['png'] : ['pdf'],
                allowedMimeTypes:
                  body.folderCode === 'cmsAssets' ? ['image/png'] : ['application/pdf'],
                checksumAlgorithm: 'sha256',
                maxFileSizeBytes: 52428800,
              },
            }),
          );
        }
        return Promise.resolve(json({}));
      });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('home-banner.png').length).toBeGreaterThan(0);
    });
    expect(
      screen.getByRole('button', { name: 'Collapse media records' }),
    ).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    expect(
      screen.getByRole('checkbox', { name: 'Toggle Created column' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Toggle Updated column' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Toggle Created By column' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Toggle Updated By column' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Import/export linkage')).not.toBeInTheDocument();
    await user.click(screen.getAllByText('home-banner.png')[0]!);
    expect(screen.getByText('Content media')).toBeVisible();
    expect(screen.getByText('Visibility: PUBLIC')).toBeVisible();
    expect(await screen.findByText('Import/export linkage')).toBeVisible();
    expect(await screen.findByText('importRun_media_1')).toBeVisible();
    expect(screen.getByText('nImport')).toBeVisible();
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/operations/imports-exports?area=history',
    );
    expect(
      screen.queryByText(/does not mutate owner records/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open through media delivery' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeVisible();
    expect(screen.queryByText('Storage key')).not.toBeInTheDocument();
    expect(
      screen.queryByText('private/internal/home-banner.png'),
    ).not.toBeInTheDocument();
    await user.click(screen.getAllByText('export-report.csv')[0]!);
    expect(await screen.findByText('CSV preview')).toBeVisible();
    expect(await screen.findByText('address')).toBeVisible();
    expect(screen.getByText('profile')).toBeVisible();
    expect(
      screen.queryByText('private/internal/export-report.csv'),
    ).not.toBeInTheDocument();
    await user.click(screen.getAllByText('private-export.json')[0]!);
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Export file' }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('JSON preview')).toBeVisible();
    expect(await screen.findByText(/"records"/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input]) =>
            fetchInputUrl(input).pathname ===
            '/nodics/media/v0/download/private-export-json',
        ),
      ).toBe(true),
    );
    expect(
      screen.queryByText('private/internal/private-export.json'),
    ).not.toBeInTheDocument();
    await user.click(screen.getAllByText('private-product-image.png')[0]!);
    const privatePreview = await screen.findByAltText(
      'Preview of private-product-image.png',
    );
    expect(privatePreview).toHaveAttribute('src', 'blob:private-media-preview');
    expect(createObjectUrl).toHaveBeenCalled();
    expect(
      screen.queryByText('private/internal/private-product-image.png'),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = fetchInputUrl(input);
          return url.pathname === '/nodics/media/v0/contexts' && init?.method === 'GET';
        }),
      ).toBe(true);
    });
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = fetchInputUrl(input);
        return url.pathname === '/nodics/media/v0/storage/policy';
      }),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = fetchInputUrl(input);
        return (
          url.pathname === '/nodics/import/v0/run/history' &&
          url.searchParams.get('mediaCode') === 'home-banner'
        );
      }),
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/nodics/media/v0/schema/workbench/media/records',
      }),
      expect.objectContaining({ method: 'POST' }),
    );
    const mediaRecordRequest = fetchMock.mock.calls.find(([input]) => {
      const url = fetchInputUrl(input);
      return url.pathname === '/nodics/media/v0/schema/workbench/media/records';
    });
    expect(JSON.parse(fetchBodyText(mediaRecordRequest?.[1]))).toEqual({
      search: '',
      pageNumber: 1,
      pageSize: 10,
      sort: { field: 'code', direction: 'ASC' },
    });

    await user.click(screen.getByRole('button', { name: 'Expand upload media' }));
    expect(
      screen.getByRole('button', { name: 'Collapse upload media' }),
    ).toHaveAttribute('aria-expanded', 'true');
    const sourceTypeComboboxes = screen.getAllByRole('combobox', {
      name: 'Source type',
    });
    await user.click(sourceTypeComboboxes[sourceTypeComboboxes.length - 1]!);
    await user.click(await screen.findByRole('option', { name: 'Content media' }));
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInstanceOf(HTMLInputElement);
    await user.upload(
      fileInput as HTMLInputElement,
      new File(['oversized-media-content'], 'oversized.png', { type: 'image/png' }),
    );
    const uploadPolicyWarnings = await screen.findAllByText(
      /larger than the 4 B backend upload limit/i,
    );
    expect(uploadPolicyWarnings.length).toBeGreaterThan(0);
    expect(uploadPolicyWarnings[0]).toBeVisible();
    expect(screen.getByRole('button', { name: 'Upload to media' })).toBeDisabled();
  });

  it('shows media folder policy impact without exposing provider internals', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.pathname === '/nodics/media/v0/schema/workbench') {
        return Promise.resolve(
          json({
            moduleName: 'media',
            schemas: [mediaSchema, mediaReferenceSchema, mediaFolderSchema],
          }),
        );
      }
      if (url.pathname === '/nodics/media/v0/schema/workbench/mediaFolder/records') {
        return Promise.resolve(
          json({
            records: [
              {
                code: 'cmsAssets',
                name: 'CMS assets',
                description: 'Content media folder',
                storagePrefix: 'media/content',
                access: 'PUBLIC',
                allowedExtensions: ['png', 'webp'],
                allowedMimeTypes: ['image/png', 'image/webp'],
                maximumFileSizeBytes: 52428800,
                retentionDays: 0,
                fullPath: '/do/not/show/cms-assets',
                providerSecret: 'must-not-render',
              },
            ],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 10,
            sort: { field: 'code', direction: 'ASC' },
          }),
        );
      }
      if (url.pathname === '/nodics/media/v0/contexts') {
        return Promise.resolve(json({ contexts: [] }));
      }
      return Promise.resolve(json({}));
    });

    renderPage('/media/folders');

    expect((await screen.findAllByText('CMS assets')).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Folder policy affects future uploads for cmsAssets/i),
    ).toBeVisible();
    expect(screen.getByText(/nMedia owns upload validation/i)).toBeVisible();
    expect(
      screen.getByText(
        /Editing is unavailable until nMedia exposes mediaFolder update/i,
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save folder policy' })).toBeDisabled();
    expect(
      screen.getByRole('link', {
        name: 'Open in Schema Workbench',
      }),
    ).toHaveAttribute('href', '/schema-workbench?module=media&schema=mediaFolder');
    expect(
      screen.queryByRole('link', { name: 'Create folder' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('/do/not/show/cms-assets')).not.toBeInTheDocument();
    expect(screen.queryByText('must-not-render')).not.toBeInTheDocument();
  });

  it('shows safe storage provider operations without exposing raw paths or secrets', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.pathname === '/nodics/media/v0/contexts') {
        return Promise.resolve(
          json({
            contexts: [
              {
                code: 'importSourceFile',
                sourceType: 'Import source',
                aliases: ['importSources'],
                label: 'Import source',
                folderCodes: ['importSources'],
                defaultFolderCode: 'importSources',
                allowedFolders: [
                  {
                    folderCode: 'importSources',
                    storagePrefix: 'media/import',
                    access: 'PRIVATE',
                    uploadPolicy: {
                      allowedExtensions: ['csv'],
                      allowedMimeTypes: ['text/csv'],
                      checksumAlgorithm: 'sha256',
                      maximumFileSizeBytes: 1024,
                    },
                  },
                ],
                allowedFormatCodes: ['importFile'],
                defaultFormatCode: 'importFile',
                targetRequired: true,
                manualUploadEnabled: true,
              },
            ],
          }),
        );
      }
      if (url.pathname === '/nodics/media/v0/storage/providers/summary') {
        return Promise.resolve(
          json({
            activeProviderCode: 'local',
            keyStrategyName: 'tenantEnterpriseSchemaDateMedia',
            delivery: {
              enabled: true,
              publicAccessEnabled: true,
              signedAccessEnabled: false,
              privateAccessEnabled: true,
              cacheControl: 'public, max-age=3600',
            },
            providers: [
              {
                providerCode: 'local',
                providerType: 'LOCAL_FILESYSTEM',
                active: true,
                enabled: true,
                health: {
                  status: 'AVAILABLE',
                  rootMode: 'CONFIGURED_RELATIVE',
                  pathExposed: false,
                  message: 'Local media provider is available.',
                },
                deliveryMode: 'BACKEND_DELIVERY',
                secretsHidden: true,
                rawPathsHidden: true,
                rawPath: '/tmp/media',
                bucketName: 'private-bucket',
              },
            ],
          }),
        );
      }
      return Promise.resolve(json({}));
    });

    renderPage('/media/storage-delivery');

    expect(await screen.findByText('Providers')).toBeVisible();
    expect(screen.getByText('Active: local')).toBeVisible();
    expect(
      screen.getByText('Key strategy: tenantEnterpriseSchemaDateMedia'),
    ).toBeVisible();
    expect(screen.getByText('Local Filesystem')).toBeVisible();
    expect(screen.getByText('Health: Available')).toBeVisible();
    expect(screen.getByText('Root mode: Configured Relative')).toBeVisible();
    expect(screen.getByText('Backend controlled')).toBeVisible();
    expect(
      screen.getByText(/nMedia owns storage paths, provider credentials/i),
    ).toBeVisible();
    expect(screen.getByText('Import source')).toBeVisible();
    expect(screen.queryByText('/tmp/media')).not.toBeInTheDocument();
    expect(screen.queryByText('private-bucket')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = fetchInputUrl(input);
        return url.pathname === '/nodics/media/v0/storage/providers/summary';
      }),
    ).toBe(true);
  });

  it('updates effective media folder policy through nMedia policy operations', async () => {
    const user = userEvent.setup();
    const editableMediaFolderSchema: WorkbenchSchema = {
      ...mediaFolderSchema,
      operations: ['search', 'read', 'create', 'update'],
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = fetchInputUrl(input);
        if (url.pathname === '/nodics/media/v0/schema/workbench') {
          return Promise.resolve(
            json({
              moduleName: 'media',
              schemas: [mediaSchema, mediaReferenceSchema, editableMediaFolderSchema],
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/schema/workbench/mediaFolder/records') {
          return Promise.resolve(
            json({
              records: [
                {
                  code: 'cmsAssets',
                  name: 'CMS assets',
                  description: 'Content media folder',
                  storagePrefix: 'media/content',
                  access: 'PUBLIC',
                  allowedExtensions: ['png', 'webp'],
                  allowedMimeTypes: ['image/png', 'image/webp'],
                  maximumFileSizeBytes: 52428800,
                  retentionDays: 0,
                  fullPath: '/do/not/show/cms-assets',
                  providerSecret: 'must-not-render',
                },
              ],
              totalCount: 1,
              pageNumber: 1,
              pageSize: 10,
              sort: { field: 'code', direction: 'ASC' },
            }),
          );
        }
        if (
          url.pathname === '/nodics/media/v0/folders/policy/cmsAssets' &&
          init?.method === 'PATCH'
        ) {
          return Promise.resolve(
            json({
              folderCode: 'cmsAssets',
              name: 'CMS assets',
              storagePrefix: 'media/content',
              access: 'SIGNED',
              retentionDays: 30,
              status: 'ACTIVE',
              uploadPolicy: {
                allowedExtensions: ['png', 'webp'],
                allowedMimeTypes: ['image/png', 'image/webp'],
                maximumFileSizeBytes: 1024,
                checksumAlgorithm: 'sha256',
              },
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/contexts') {
          return Promise.resolve(json({ contexts: [] }));
        }
        return Promise.resolve(json({}));
      });

    renderPage('/media/folders');

    expect((await screen.findAllByText('CMS assets')).length).toBeGreaterThan(0);
    expect(screen.getByText(/Axis submits changes through the nMedia/i)).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: 'Create folder' }).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole('combobox', { name: 'Visibility' }));
    await user.click(await screen.findByRole('option', { name: 'SIGNED' }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Maximum file size' }));
    await user.type(
      screen.getByRole('spinbutton', { name: 'Maximum file size' }),
      '1024',
    );
    await user.clear(screen.getByRole('spinbutton', { name: 'Retention days' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Retention days' }), '30');
    await user.click(screen.getByRole('button', { name: 'Save folder policy' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = fetchInputUrl(input);
          return (
            url.pathname === '/nodics/media/v0/folders/policy/cmsAssets' &&
            init?.method === 'PATCH'
          );
        }),
      ).toBe(true);
    });
    const updateRequest = fetchMock.mock.calls.find(([input, init]) => {
      const url = fetchInputUrl(input);
      return (
        url.pathname === '/nodics/media/v0/folders/policy/cmsAssets' &&
        init?.method === 'PATCH'
      );
    });
    expect(JSON.parse(fetchBodyText(updateRequest?.[1]))).toEqual({
      access: 'SIGNED',
      maximumFileSizeBytes: 1024,
      retentionDays: 30,
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/nodics/media/v0/storage/policy',
      }),
      expect.anything(),
    );
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = fetchInputUrl(input);
        return url.pathname === '/nodics/media/v0/mediaFolder';
      }),
    ).toBe(false);
    expect(screen.queryByText('/do/not/show/cms-assets')).not.toBeInTheDocument();
    expect(screen.queryByText('must-not-render')).not.toBeInTheDocument();
  });

  it('creates, edits, and deletes media folders through generated schema CRUD', async () => {
    const user = userEvent.setup();
    const crudMediaFolderSchema: WorkbenchSchema = {
      ...mediaFolderSchema,
      operations: ['search', 'read', 'create', 'update', 'delete'],
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = fetchInputUrl(input);
        if (url.pathname === '/nodics/media/v0/schema/workbench') {
          return Promise.resolve(
            json({
              moduleName: 'media',
              schemas: [mediaSchema, mediaReferenceSchema, crudMediaFolderSchema],
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/schema/workbench/mediaFolder/records') {
          return Promise.resolve(
            json({
              records: [
                {
                  code: 'cmsAssets',
                  name: 'CMS assets',
                  folderCode: 'cmsAssets',
                  formatCode: 'original',
                  access: 'PUBLIC',
                  status: 'ACTIVE',
                },
              ],
              totalCount: 1,
              pageNumber: 1,
              pageSize: 10,
              sort: { field: 'code', direction: 'ASC' },
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/mediaFolder' && init?.method === 'PUT') {
          return Promise.resolve(
            json({
              code: 'brandAssets',
              folderCode: 'brandAssets',
              formatCode: 'original',
              access: 'PRIVATE',
              status: 'ACTIVE',
            }),
          );
        }
        if (
          url.pathname === '/nodics/media/v0/mediaFolder' &&
          init?.method === 'PATCH'
        ) {
          return Promise.resolve(
            json({
              models: [
                {
                  code: 'cmsAssets',
                  folderCode: 'cmsAssets',
                  formatCode: 'original',
                  access: 'SIGNED',
                  status: 'ACTIVE',
                },
              ],
            }),
          );
        }
        if (
          url.pathname === '/nodics/media/v0/schema/workbench/mediaFolder/record' &&
          init?.method === 'DELETE'
        ) {
          return Promise.resolve(json(undefined));
        }
        if (url.pathname === '/nodics/media/v0/contexts') {
          return Promise.resolve(json({ contexts: [] }));
        }
        return Promise.resolve(json({}));
      });

    renderPage('/media/folders');

    expect((await screen.findAllByText('CMS assets')).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Create folder' })[0]!);
    expect(screen.getByRole('heading', { name: 'Create media folder' })).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Code' }), 'brandAssets');
    await user.type(screen.getByRole('textbox', { name: 'Folder' }), 'brandAssets');
    await user.type(screen.getByRole('textbox', { name: 'Format' }), 'original');
    await user.type(screen.getByRole('textbox', { name: 'Access' }), 'PRIVATE');
    await user.type(screen.getByRole('textbox', { name: 'Status' }), 'ACTIVE');
    await user.click(screen.getAllByRole('button', { name: 'Create folder' }).at(-1)!);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = fetchInputUrl(input);
          return (
            url.pathname === '/nodics/media/v0/mediaFolder' && init?.method === 'PUT'
          );
        }),
      ).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: 'Edit folder' }));
    await user.clear(screen.getByRole('textbox', { name: 'Access' }));
    await user.type(screen.getByRole('textbox', { name: 'Access' }), 'SIGNED');
    await user.click(screen.getByRole('button', { name: 'Save folder' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = fetchInputUrl(input);
          return (
            url.pathname === '/nodics/media/v0/mediaFolder' && init?.method === 'PATCH'
          );
        }),
      ).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: 'Delete folder' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = fetchInputUrl(input);
          return (
            url.pathname === '/nodics/media/v0/schema/workbench/mediaFolder/record' &&
            init?.method === 'DELETE'
          );
        }),
      ).toBe(true);
    });
  });

  it('shows media format context usage from backend-owned source contexts', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = fetchInputUrl(input);
      if (url.pathname === '/nodics/media/v0/schema/workbench') {
        return Promise.resolve(
          json({
            moduleName: 'media',
            schemas: [mediaFormatSchema],
          }),
        );
      }
      if (url.pathname === '/nodics/media/v0/schema/workbench/mediaFormat/records') {
        return Promise.resolve(
          json({
            records: [
              {
                code: 'desktop',
                name: 'Desktop',
                description: 'Desktop presentation media',
                purpose: 'content',
                formatFamily: 'RESPONSIVE',
                status: 'ACTIVE',
                width: 1440,
                height: 600,
              },
            ],
            totalCount: 1,
            pageNumber: 1,
            pageSize: 10,
            sort: { field: 'code', direction: 'ASC' },
          }),
        );
      }
      if (url.pathname === '/nodics/media/v0/contexts') {
        return Promise.resolve(
          json({
            contexts: [
              {
                code: 'contentMedia',
                sourceType: 'Content media',
                aliases: ['cmsAssets'],
                label: 'Content media',
                description: 'Content assets',
                folderCodes: ['cmsAssets'],
                defaultFolderCode: 'cmsAssets',
                allowedFolders: [],
                allowedFormatCodes: ['original', 'desktop', 'mobile'],
                defaultFormatCode: 'desktop',
                targetRequired: false,
                manualUploadEnabled: true,
              },
            ],
          }),
        );
      }
      return Promise.resolve(json({}));
    });

    renderPage('/media/formats');

    expect((await screen.findAllByText('Desktop')).length).toBeGreaterThan(0);
    expect(screen.getByText('Format usage')).toBeVisible();
    expect(screen.getByText('Content media')).toBeVisible();
    expect(screen.getByText('default + allowed')).toBeVisible();
    expect(screen.getByText('Folders: cmsAssets')).toBeVisible();
  });

  it('manages media set entries through nMedia operations without Product or CMS mutation', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = fetchInputUrl(input);
        if (url.pathname === '/nodics/media/v0/schema/workbench') {
          return Promise.resolve(
            json({
              moduleName: 'media',
              schemas: [mediaSetSchema, mediaSetEntrySchema],
            }),
          );
        }
        if (url.pathname === '/nodics/media/v0/schema/workbench/mediaSet/records') {
          return Promise.resolve(
            json({
              records: [
                {
                  code: 'homeHeroSet',
                  name: 'Home hero set',
                  mediaType: 'IMAGE',
                  businessPurpose: 'cms-hero',
                  status: 'ACTIVE',
                },
              ],
              totalCount: 1,
              pageNumber: 1,
              pageSize: 10,
              sort: { field: 'code', direction: 'ASC' },
            }),
          );
        }
        if (
          url.pathname === '/nodics/media/v0/schema/workbench/mediaSetEntry/records'
        ) {
          return Promise.resolve(
            json({
              records: [
                {
                  code: 'homeHeroMobile',
                  mediaSetCode: 'homeHeroSet',
                  mediaCode: 'home-hero-mobile',
                  formatCode: 'mobile',
                  variantRole: 'hero',
                  localeCode: 'en',
                  channelCode: 'web',
                  deviceCode: 'mobile',
                  breakpointCode: 'sm',
                  fallbackEntryCode: 'homeHeroDesktop',
                  position: 1,
                  primary: true,
                  status: 'ACTIVE',
                },
                {
                  code: 'homeHeroDesktop',
                  mediaSetCode: 'homeHeroSet',
                  mediaCode: 'home-hero-desktop',
                  formatCode: 'desktop',
                  variantRole: 'hero',
                  localeCode: 'en',
                  channelCode: 'web',
                  deviceCode: 'desktop',
                  breakpointCode: 'lg',
                  position: 2,
                  primary: false,
                  status: 'ACTIVE',
                },
              ],
              totalCount: 2,
              pageNumber: 1,
              pageSize: 10,
              sort: { field: 'code', direction: 'ASC' },
            }),
          );
        }
        if (
          url.pathname ===
            '/nodics/media/v0/sets/homeHeroSet/entries/homeHeroDesktop/primary' &&
          init?.method === 'POST'
        ) {
          return Promise.resolve(
            json({
              code: 'homeHeroDesktop',
              mediaSetCode: 'homeHeroSet',
              primary: true,
            }),
          );
        }
        if (
          url.pathname === '/nodics/media/v0/sets/homeHeroSet/entries/reorder' &&
          init?.method === 'POST'
        ) {
          return Promise.resolve(json({ mediaSetCode: 'homeHeroSet', entries: [] }));
        }
        if (
          url.pathname ===
            '/nodics/media/v0/sets/homeHeroSet/entries/homeHeroDesktop' &&
          init?.method === 'DELETE'
        ) {
          return Promise.resolve(
            json({ mediaSetCode: 'homeHeroSet', code: 'homeHeroDesktop' }),
          );
        }
        return Promise.resolve(json({}));
      });

    renderPage('/media/sets');

    expect((await screen.findAllByText('Home hero set')).length).toBeGreaterThan(0);
    expect(screen.getByText('Set variants')).toBeVisible();
    expect(screen.getByText(/nMedia owns variant membership/i)).toBeVisible();
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = fetchInputUrl(input);
          return (
            url.pathname === '/nodics/media/v0/schema/workbench/mediaSetEntry/records'
          );
        }),
      ).toBe(true);
    });
    expect(await screen.findByText('home-hero-desktop')).toBeVisible();
    expect(await screen.findByText('mobile / sm')).toBeVisible();
    expect(await screen.findByText('desktop / lg')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Add entry in Schema Workbench' }),
    ).toHaveAttribute(
      'href',
      '/schema-workbench?module=media&schema=mediaSetEntry&mode=create',
    );

    await user.click(screen.getAllByRole('button', { name: 'Set primary' })[1]!);
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = fetchInputUrl(input);
          return (
            url.pathname ===
              '/nodics/media/v0/sets/homeHeroSet/entries/homeHeroDesktop/primary' &&
            init?.method === 'POST'
          );
        }),
      ).toBe(true);
    });
    await user.click(screen.getAllByRole('button', { name: 'Up' })[1]!);
    await waitFor(() => {
      const reorderRequest = fetchMock.mock.calls.find(([input, init]) => {
        const url = fetchInputUrl(input);
        return (
          url.pathname === '/nodics/media/v0/sets/homeHeroSet/entries/reorder' &&
          init?.method === 'POST'
        );
      });
      expect(reorderRequest).toBeTruthy();
      expect(JSON.parse(fetchBodyText(reorderRequest?.[1]))).toEqual({
        entryCodes: ['homeHeroDesktop', 'homeHeroMobile'],
      });
    });
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = fetchInputUrl(input);
        return url.pathname.includes('/product') || url.pathname.includes('/cms');
      }),
    ).toBe(false);
  });
});
