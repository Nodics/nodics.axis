import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';
import type { WorkbenchClientConfiguration } from '../../../../src/workbench/api/workbenchClient';
import {
  uploadMedia,
  type MediaFolderUploadPolicy,
  type MediaSourceContext,
  type MediaUploadResult,
} from '../../../../src/operations/mediaManagement/api/mediaStoragePolicyClient';
import { MediaUploadWizard } from '../../../../src/operations/mediaManagement/components/MediaUploadWizard';

vi.mock(
  '../../../../src/operations/mediaManagement/api/mediaStoragePolicyClient',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../src/operations/mediaManagement/api/mediaStoragePolicyClient')
      >();
    return {
      ...actual,
      uploadMedia: vi.fn(),
    };
  },
);

const connection: AxisModuleConnection = {
  moduleName: 'media',
  instanceId: 'local:monoServer:media:1',
  endpoint: 'http://localhost:3000/nodics/media',
  environment: 'kickoffLocal',
  state: 'UP',
};

const configuration: WorkbenchClientConfiguration = {
  accessToken: 'employee-token',
  enterpriseCode: 'default',
  timeoutMs: 1000,
};

function formatBytes(value: number | undefined): string {
  if (value === undefined) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function policy(folderCode: string): MediaFolderUploadPolicy {
  const importSource = folderCode === 'importSources';
  return Object.freeze({
    folderCode,
    label: folderCode,
    access: folderCode === 'cmsAssets' ? 'PUBLIC' : 'PRIVATE',
    allowedExtensions: Object.freeze(importSource ? ['csv', 'json'] : ['png']),
    allowedMimeTypes: Object.freeze(
      importSource ? ['text/csv', 'application/json'] : ['image/png'],
    ),
    checksumAlgorithm: 'sha256',
    maxFileSizeBytes: importSource ? 4096 : 1024,
  });
}

function context(
  code: string,
  sourceType: string,
  folderCode: string,
  manualUploadEnabled: boolean,
  options?: {
    readonly moduleName?: string;
    readonly schemaName?: string;
    readonly targetRequired?: boolean;
  },
): MediaSourceContext {
  const folderPolicy = policy(folderCode);
  return Object.freeze({
    code,
    sourceType,
    aliases: Object.freeze([code, folderCode]),
    label: sourceType,
    description: `${sourceType} context`,
    folderCodes: Object.freeze([folderCode]),
    defaultFolderCode: folderCode,
    allowedFolders: Object.freeze([
      Object.freeze({
        ...folderPolicy,
        storagePrefix: `media/${folderCode}`,
        retentionDays: 0,
      }),
    ]),
    allowedFormatCodes: Object.freeze(
      sourceType === 'Data imports' ? ['importFile'] : ['original'],
    ),
    defaultFormatCode: sourceType === 'Data imports' ? 'importFile' : 'original',
    defaultModuleName:
      options?.moduleName ??
      (sourceType === 'Content media'
        ? 'cms'
        : sourceType === 'Data imports'
          ? 'import'
          : undefined),
    defaultSchemaName:
      options?.schemaName ??
      (sourceType === 'Content media'
        ? 'cmsComponent'
        : sourceType === 'Data imports'
          ? 'mediaImport'
          : undefined),
    targetRequired: options?.targetRequired ?? sourceType === 'Data imports',
    manualUploadEnabled,
    storageRouteTemplate: `media/${folderCode}/{mediaCode}.{extension}`,
  });
}

const sourceContexts: readonly MediaSourceContext[] = Object.freeze([
  context('dataImports', 'Data imports', 'importSources', true),
  context('contentMedia', 'Content media', 'cmsAssets', true),
  context('dataExports', 'Data exports', 'exportFiles', false),
]);

function renderWizard(props?: {
  readonly enterpriseCode?: string;
  readonly onEnterpriseCodeChange?: (enterpriseCode: string) => void;
  readonly onUploaded?: (media: MediaUploadResult) => void;
  readonly sourceContexts?: readonly MediaSourceContext[];
  readonly tenantCode?: string;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MediaUploadWizard
        connection={connection}
        configuration={configuration}
        enterpriseCode={props?.enterpriseCode ?? configuration.enterpriseCode}
        error={undefined}
        formatBytes={formatBytes}
        loading={false}
        onEnterpriseCodeChange={props?.onEnterpriseCodeChange ?? vi.fn()}
        onUploaded={props?.onUploaded ?? vi.fn()}
        policies={[policy('importSources'), policy('cmsAssets'), policy('exportFiles')]}
        sourceContexts={props?.sourceContexts ?? sourceContexts}
        tenantCode={props?.tenantCode ?? 'default'}
      />
    </QueryClientProvider>,
  );
}

async function selectContentMediaAndUpload(file: File) {
  return selectSourceTypeAndUpload('Content media', file);
}

async function selectSourceTypeAndUpload(sourceType: string, file: File) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Source type' }));
  await user.click(await screen.findByRole('option', { name: sourceType }));
  const fileInput = document.querySelector('input[type="file"]');
  expect(fileInput).toBeInstanceOf(HTMLInputElement);
  await user.upload(fileInput as HTMLInputElement, file);
  return user;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MediaUploadWizard', () => {
  it('shows governed upload scope before media selection', () => {
    renderWizard({
      enterpriseCode: 'enterprise-a',
      tenantCode: 'tenant-a',
    });

    expect(screen.getByRole('textbox', { name: 'Target enterprise' })).toHaveValue(
      'enterprise-a',
    );
    expect(screen.getByText('tenant-a')).toBeVisible();
  });

  it('offers only backend contexts that allow manual upload', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(screen.getByRole('button', { name: 'Choose file' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await user.click(screen.getByRole('combobox', { name: 'Source type' }));

    expect(await screen.findByRole('option', { name: 'Content media' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Data imports' })).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'Data exports' }),
    ).not.toBeInTheDocument();
  });

  it('uploads through nMedia with backend-derived context and reports the created media', async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    const uploadMediaMock = vi.mocked(uploadMedia);
    uploadMediaMock.mockResolvedValue({
      code: 'media_content_001',
      name: 'hero.png',
      originalFileName: 'hero.png',
      folderCode: 'cmsAssets',
      formatCode: 'original',
      access: 'PUBLIC',
      status: 'ACTIVE',
      mimeType: 'image/png',
      extension: 'png',
      sizeBytes: 8,
      accessUrl: undefined,
    });
    renderWizard({ onUploaded });

    await user.click(screen.getByRole('combobox', { name: 'Source type' }));
    await user.click(await screen.findByRole('option', { name: 'Content media' }));
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInstanceOf(HTMLInputElement);
    await user.upload(
      fileInput as HTMLInputElement,
      new File(['png-data'], 'hero.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload to media' }));

    await waitFor(() => expect(uploadMediaMock).toHaveBeenCalledTimes(1));
    const uploadedRequest = uploadMediaMock.mock.calls[0]?.[2];
    expect(uploadedRequest?.file).toBeInstanceOf(File);
    expect(uploadedRequest).toMatchObject({
      folderCode: 'cmsAssets',
      formatCode: 'original',
      name: 'hero.png',
      description: 'Uploaded from Nodics Axis Media Management as Content media',
      moduleName: 'cms',
      schemaName: 'cmsComponent',
    });
    await waitFor(() =>
      expect(onUploaded).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'media_content_001' }),
      ),
    );
    expect(
      await screen.findByText(/Media uploaded as media_content_001/i),
    ).toBeVisible();
  });

  it('keeps backend target context out of the upload policy display', async () => {
    renderWizard();

    await selectSourceTypeAndUpload(
      'Data imports',
      new File(['code,name\np1,Product 1'], 'products.csv', { type: 'text/csv' }),
    );

    expect(screen.getByText('Allowed: .csv, .json')).toBeVisible();
    expect(screen.getByText('Max size: 4.0 KB')).toBeVisible();
    expect(screen.queryByText(/Target route:/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Target module: import')).not.toBeInTheDocument();
    expect(screen.queryByText('Target schema: mediaImport')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Backend context requires a target/i),
    ).not.toBeInTheDocument();
  });

  it('blocks file selection when a required target is not published by backend context', async () => {
    const user = userEvent.setup();
    const missingTargetContexts: readonly MediaSourceContext[] = Object.freeze([
      context('dataImports', 'Data imports', 'importSources', true, {
        moduleName: '',
        schemaName: '',
        targetRequired: true,
      }),
    ]);
    renderWizard({ sourceContexts: missingTargetContexts });

    await user.click(screen.getByRole('combobox', { name: 'Source type' }));
    await user.click(await screen.findByRole('option', { name: 'Data imports' }));

    expect(
      await screen.findByText(
        'This source type requires a backend target module and schema before Axis can accept a file.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose file' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('summarizes image dimensions before upload without treating the preview as validation', async () => {
    const originalImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 640;
      naturalHeight = 480;
      width = 640;
      height = 480;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);
    renderWizard();

    try {
      await selectContentMediaAndUpload(
        new File(['png-data'], 'hero.png', { type: 'image/png' }),
      );

      expect(await screen.findByText('Image summary: 640 × 480 px.')).toBeVisible();
      expect(
        screen.queryByText(
          /Image preview is available before upload\. Backend policy still performs final validation/i,
        ),
      ).not.toBeInTheDocument();
    } finally {
      vi.stubGlobal('Image', originalImage);
    }
  });

  it('blocks unsupported file extensions before calling nMedia', async () => {
    const uploadMediaMock = vi.mocked(uploadMedia);
    renderWizard();

    await selectContentMediaAndUpload(
      new File(['not-png'], 'hero.gif', { type: 'image/png' }),
    );

    expect(await screen.findAllByText(/\.gif files are not allowed/i)).not.toHaveLength(
      0,
    );
    expect(screen.getByRole('button', { name: 'Upload to media' })).toBeDisabled();
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('blocks oversized files before calling nMedia', async () => {
    const uploadMediaMock = vi.mocked(uploadMedia);
    renderWizard();

    await selectContentMediaAndUpload(
      new File(['x'.repeat(1025)], 'hero.png', { type: 'image/png' }),
    );

    expect(
      await screen.findAllByText(/larger than the 1\.0 KB backend upload limit/i),
    ).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Upload to media' })).toBeDisabled();
    expect(uploadMediaMock).not.toHaveBeenCalled();
  });

  it('presents backend upload policy failures without service-name prefixes', async () => {
    const uploadMediaMock = vi.mocked(uploadMedia);
    uploadMediaMock.mockRejectedValue(
      new Error('Media upload failed: Backend policy rejected this file.'),
    );
    renderWizard();

    const user = await selectContentMediaAndUpload(
      new File(['png-data'], 'hero.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload to media' }));

    expect(await screen.findByText('Backend policy rejected this file.')).toBeVisible();
    expect(
      screen.queryByText(/Media upload failed: Backend policy rejected this file/i),
    ).not.toBeInTheDocument();
  });

  it('summarizes CSV import files before upload without treating the preview as validation', async () => {
    renderWizard();

    await selectSourceTypeAndUpload(
      'Data imports',
      new File(
        ['code,name,status\np1,Product 1,ACTIVE\np2,Product 2,DRAFT'],
        'products.csv',
        {
          type: 'text/csv',
        },
      ),
    );

    expect(
      await screen.findByText(
        'CSV summary: 3 columns, 2 data rows. Headers: code, name, status.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(
        /Backend import\/export processes perform governed content validation/i,
      ),
    ).not.toBeInTheDocument();
  });

  it('summarizes JSON import files before upload without treating the preview as validation', async () => {
    renderWizard();

    await selectSourceTypeAndUpload(
      'Data imports',
      new File(
        [JSON.stringify({ products: [], metadata: { release: 'local' } })],
        'products.json',
        {
          type: 'application/json',
        },
      ),
    );

    expect(
      await screen.findByText(
        'JSON summary: object with 2 top-level keys: products, metadata.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(
        /Backend import\/export processes perform governed content validation/i,
      ),
    ).not.toBeInTheDocument();
  });
});
