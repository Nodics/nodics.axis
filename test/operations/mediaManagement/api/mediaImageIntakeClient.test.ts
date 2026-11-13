import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';
import {
  imageIntakeCopyKeys,
  parseMediaImageIntake,
  prepareMediaImage,
  inspectMediaImage,
  uploadPreparedMediaImage,
} from '../../../../src/operations/mediaManagement/api/mediaImageIntakeClient';
const source = {
  moduleName: 'media',
  endpoint: 'http://localhost:4312/nodics/media',
  instanceId: 'staged',
  state: 'UP',
  runtimeRole: { publication: 'STAGED' },
} as AxisModuleConnection;
const config = {
  accessToken: 'test-employee',
  enterpriseCode: 'acme',
  timeoutMs: 1000,
};
const definition = parseMediaImageIntake({
  contractVersion: 1,
  contextCode: 'customImages',
  presentation: Object.fromEntries(imageIntakeCopyKeys.map((key) => [key, key])),
})!;
const contexts = {
  contexts: [
    {
      code: 'customImages',
      label: 'Brand images',
      manualUploadEnabled: true,
      folderCodes: ['projectPictures'],
      defaultFolderCode: 'projectPictures',
      allowedFolders: [{ folderCode: 'projectPictures', uploadPolicy: {} }],
      allowedFormatCodes: ['imageOriginal'],
      defaultFormatCode: 'imageOriginal',
    },
  ],
};
const policy = {
  folderCode: 'projectPictures',
  uploadPolicy: {
    checksumAlgorithm: 'sha256',
    allowedExtensions: ['png'],
    allowedMimeTypes: ['image/png'],
    maximumFileSizeBytes: 10000,
  },
};
const response = (
  data: unknown,
  code = 'SUC_MED_00001',
  responseCode: unknown = '200',
) =>
  new Response(JSON.stringify({ code, responseCode, data }), {
    headers: { 'Content-Type': 'application/json' },
  });
const target = { moduleName: 'editorial', schemaName: 'editorialArticle' };
function file() {
  const result = new File(['image'], 'brand.png', { type: 'image/png' });
  Object.defineProperty(result, 'arrayBuffer', {
    value: () => Promise.resolve(new TextEncoder().encode('image').buffer),
  });
  return result;
}
function preparedFetcher() {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(contexts))
    .mockResolvedValueOnce(response(policy))
    .mockImplementationOnce((_url, init) => {
      const body = JSON.parse(init?.body as string) as { mediaCode: string };
      return Promise.resolve(
        response({
          contractVersion: 1,
          mediaCode: body.mediaCode,
          versioned: true,
          exists: false,
          unchanged: false,
        }),
      );
    });
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
});
describe('Media image intake owner contract', () => {
  it('uses configured purpose/current policy, hashes actual bytes and performs only inspection before upload', async () => {
    const fetcher = preparedFetcher();
    const prepared = await prepareMediaImage(
      source,
      config,
      definition,
      file(),
      target,
      fetcher,
    );
    expect(prepared.descriptor).toMatchObject({
      ...target,
      folderCode: 'projectPictures',
      formatCode: 'imageOriginal',
      sizeBytes: 5,
    });
    expect(prepared.descriptor.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(fetcher.mock.calls.map((call) => (call[0] as URL).toString())).toEqual([
      'http://localhost:4312/nodics/media/v0/contexts',
      'http://localhost:4312/nodics/media/v0/storage/policy',
      'http://localhost:4312/nodics/media/v0/storage/upload/inspect',
    ]);
    expect(
      JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string) as Record<string, unknown>,
    ).toMatchObject(target);
  });
  it.each(['ERR_MED_00001', '', '200'])(
    'rejects a nonpositive owner code %s before later reads or writes',
    async (code) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(contexts, code));
      await expect(
        prepareMediaImage(source, config, definition, file(), target, fetcher),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([false, '500', 'SUC_LEGACY', 404])(
    'rejects incompatible secondary owner evidence %s',
    async (secondary) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(response(contexts, 'SUC_MED_00001', secondary));
      await expect(
        prepareMediaImage(source, config, definition, file(), target, fetcher),
      ).rejects.toThrow();
    },
  );
  it.each([
    'http://secret@example.test/nodics/media',
    'http://localhost/nodics/media?redirect=x',
    'http://localhost/nodics/cms',
    'ftp://localhost/nodics/media',
  ])('never attaches credentials to invalid endpoint %s', async (endpoint) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      prepareMediaImage(
        { ...source, endpoint },
        config,
        definition,
        file(),
        target,
        fetcher,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not upload or silently overwrite an existing original identity', async () => {
    const existing = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(contexts))
      .mockResolvedValueOnce(response(policy))
      .mockImplementationOnce((_url, init) =>
        Promise.resolve(
          response({
            contractVersion: 1,
            mediaCode: (JSON.parse(init?.body as string) as { mediaCode: string })
              .mediaCode,
            versioned: true,
            exists: true,
            unchanged: false,
            versionId: 2,
          }),
        ),
      );
    await expect(
      prepareMediaImage(source, config, definition, file(), target, existing),
    ).rejects.toThrow('already exists');
    expect(existing).toHaveBeenCalledTimes(3);
  });
  it('accepts one exact persisted receipt and drops provider URLs/keys from presentation', async () => {
    const prepared = await prepareMediaImage(
      source,
      config,
      definition,
      file(),
      target,
      preparedFetcher(),
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        ...prepared.descriptor,
        versionId: 0,
        code: prepared.descriptor.mediaCode,
        active: true,
        status: 'READY',
        checksumAlgorithm: 'sha256',
        fullPath: '/private',
        accessUrl: 'https://private.example',
      }),
    );
    await expect(
      uploadPreparedMediaImage(source, config, prepared, fetcher),
    ).resolves.toEqual({ code: prepared.descriptor.mediaCode, name: 'brand.png' });
    const form = fetcher.mock.calls[0]?.[1]?.body as FormData;
    expect(form.get('mediaCode')).toBe(prepared.descriptor.mediaCode);
    expect(form.get('moduleName')).toBe('editorial');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { code: 'other' },
    { checksum: 'f'.repeat(64) },
    { active: false },
    { status: 'PROCESSING' },
    { sizeBytes: 6 },
  ])('holds incompatible mutation receipt without retry: %j', async (delta) => {
    const prepared = await prepareMediaImage(
      source,
      config,
      definition,
      file(),
      target,
      preparedFetcher(),
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        ...prepared.descriptor,
        versionId: 0,
        code: prepared.descriptor.mediaCode,
        active: true,
        status: 'READY',
        checksumAlgorithm: 'sha256',
        ...delta,
      }),
    );
    await expect(
      uploadPreparedMediaImage(source, config, prepared, fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('only confirms exact current versioned byte inspection; absent or changed evidence never uploads', async () => {
    const prepared = await prepareMediaImage(
      source,
      config,
      definition,
      file(),
      target,
      preparedFetcher(),
    );
    for (const [data, expected] of [
      [{ exists: false, unchanged: false, versioned: true }, 'ABSENT'],
      [
        { exists: true, unchanged: false, versioned: true, versionId: 2 },
        'UNCONFIRMED',
      ],
      [{ exists: true, unchanged: true, versioned: false }, 'UNCONFIRMED'],
      [{ exists: true, unchanged: true, versioned: true, versionId: 2 }, 'CONFIRMED'],
    ] as const) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        response({
          contractVersion: 1,
          mediaCode: prepared.descriptor.mediaCode,
          ...data,
        }),
      );
      await expect(inspectMediaImage(source, config, prepared, fetcher)).resolves.toBe(
        expected,
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect((fetcher.mock.calls[0]?.[0] as URL).toString()).toContain(
        '/storage/upload/inspect',
      );
    }
  });
  it.each([
    { acknowledged: false },
    { confirmed: false },
    { error: 'failed' },
    { errors: ['failed'] },
  ])('rejects contradictory HTTP200 evidence without replay: %j', async (negative) => {
    const prepared = await prepareMediaImage(
      source,
      config,
      definition,
      file(),
      target,
      preparedFetcher(),
    );
    for (const atRoot of [true, false]) {
      const row = {
        ...prepared.descriptor,
        code: prepared.descriptor.mediaCode,
        active: true,
        status: 'READY',
        checksumAlgorithm: 'sha256',
        versionId: 0,
        ...(atRoot ? {} : negative),
      };
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'SUC_MED_00004',
            responseCode: '200',
            data: row,
            ...(atRoot ? negative : {}),
          }),
        ),
      );
      await expect(
        uploadPreparedMediaImage(source, config, prepared, fetcher),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('leaves incompatible purpose/copy unavailable without accepting a folder mapping', () => {
    expect(
      parseMediaImageIntake({
        contractVersion: 1,
        contextCode: '../cmsAssets',
        presentation: {},
      }),
    ).toBeUndefined();
    expect(
      parseMediaImageIntake({
        contractVersion: 1,
        contextCode: 'contentMedia',
        presentation: {},
      }),
    ).toBeUndefined();
  });
});
