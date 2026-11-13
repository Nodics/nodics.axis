import { describe, expect, it } from 'vitest';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import type { DataRelease } from '../../../src/operations/importExport/api/dataReleaseContracts';
import {
  captureDataCatalogueSelection,
  currentDataCatalogueSelection,
  dataCatalogueCommandBatches,
  dataReleaseResponseMatchesSelection,
} from '../../../src/operations/importExport/api/dataCatalogueSelection';
import {
  combineDataCatalogueReads,
  dataCatalogueSources,
  withDataCatalogueSource,
} from '../../../src/operations/importExport/api/dataCatalogueSources';
import {
  ownerReleaseKey,
  releaseKey,
} from '../../../src/operations/importExport/importExportPresentation';

const staged: AxisModuleConnection = {
  moduleName: 'import',
  instanceId: 'staged',
  endpoint: 'http://localhost:4312/nodics/import',
  environment: 'local',
  server: 'content',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const process: AxisModuleConnection = {
  ...staged,
  instanceId: 'process',
  endpoint: 'http://localhost:4330/nodics/import',
  server: 'workflow',
  runtimeRole: { code: 'PROCESS', publication: 'OPERATIONAL' },
};
const release: DataRelease = {
  releaseCode: 'editorial:workflow',
  canonicalIdentity: 'editorial:workflow',
  moduleName: 'editorial',
  displayName: 'Editorial workflows',
  dataType: 'init',
  version: '0.0.1',
  checksum: 'source-hash',
  description: '',
  status: 'NOT_INSTALLED',
};
const origins = new Map([[release.releaseCode!, process]]);

describe('source-bound import selection', () => {
  it('keeps independently eligible identical owner codes distinct without changing request identity or owner status', () => {
    const platform = {
      ...staged,
      instanceId: 'platform',
      endpoint: 'http://localhost:4300/nodics/import',
      runtimeRole: { code: 'PLATFORM', publication: 'OPERATIONAL' },
    };
    const sources = dataCatalogueSources([staged, process, platform], platform);
    const raw = { ...release, destinationRole: 'RETIRED_ROLE_LABEL' };
    const read = combineDataCatalogueReads(
      sources,
      sources.map((source) => ({
        data:
          source.connection === platform
            ? []
            : withDataCatalogueSource([raw], source.connection),
        isFetching: false,
        isPending: false,
        isError: false,
      })),
      releaseKey,
      () => true,
    );
    expect(read.conflicts).toEqual([]);
    expect(read.data).toHaveLength(2);
    expect(new Set(read.data.map(releaseKey)).size).toBe(2);
    expect(read.data.map(ownerReleaseKey)).toEqual([
      release.releaseCode,
      release.releaseCode,
    ]);
    expect(raw).not.toHaveProperty('catalogueSource');
    const batches = dataCatalogueCommandBatches(read.data, read.origins);
    expect(batches.map((batch) => batch.connection.instanceId).sort()).toEqual([
      'process',
      'staged',
    ]);
    expect(
      batches.every(
        (batch) =>
          batch.releases[0]?.status === 'NOT_INSTALLED' &&
          batch.releases[0]?.destinationRole === 'RETIRED_ROLE_LABEL',
      ),
    ).toBe(true);
  });
  it('retains the original owner proof for unchanged fresh release evidence', () => {
    const selection = captureDataCatalogueSelection(
      'private-scope-a',
      new Set([release.releaseCode!]),
      [release],
      origins,
    );
    expect([
      ...currentDataCatalogueSelection(
        selection,
        'private-scope-a',
        [release],
        origins,
      ),
    ]).toEqual([release.releaseCode]);
    expect([
      ...currentDataCatalogueSelection(
        selection,
        'private-scope-b',
        [release],
        origins,
      ),
    ]).toEqual([]);
  });
  it.each([{ version: '0.0.2' }, { checksum: 'changed-source' }])(
    'does not inherit selection after immutable evidence changes %j',
    (changes) => {
      const selection = captureDataCatalogueSelection(
        'a',
        new Set([release.releaseCode!]),
        [release],
        origins,
      );
      expect(
        currentDataCatalogueSelection(
          selection,
          'a',
          [{ ...release, ...changes }],
          origins,
        ).size,
      ).toBe(0);
    },
  );
  it('does not select unavailable, replaced or unrelated owner evidence', () => {
    const selection = captureDataCatalogueSelection(
      'a',
      new Set([release.releaseCode!]),
      [release],
      origins,
    );
    expect(currentDataCatalogueSelection(selection, 'a', [], origins).size).toBe(0);
    expect(
      currentDataCatalogueSelection(selection, 'a', [release], new Map()).size,
    ).toBe(0);
    expect(
      currentDataCatalogueSelection(
        selection,
        'a',
        [release],
        new Map([[release.releaseCode!, staged]]),
      ).size,
    ).toBe(0);
    expect(
      currentDataCatalogueSelection(
        selection,
        'a',
        [release],
        new Map([
          [
            release.releaseCode!,
            { ...process, endpoint: 'http://localhost:9999/nodics/import' },
          ],
        ]),
      ).size,
    ).toBe(0);
  });
  it('dispatches legacy releases without destination metadata to their observed owner rather than a default runtime', () => {
    const second = { ...release, releaseCode: 'cms:references', moduleName: 'cms' };
    const batches = dataCatalogueCommandBatches(
      [release, second],
      new Map([
        [release.releaseCode!, process],
        [second.releaseCode, staged],
      ]),
    );
    expect(batches.map((batch) => batch.connection)).toEqual([process, staged]);
    expect(batches.map((batch) => batch.releases)).toEqual([[release], [second]]);
  });
  it('refuses an entire dispatch if any selected release lacks a fresh owner', () => {
    expect(() =>
      dataCatalogueCommandBatches(
        [release, { ...release, releaseCode: 'missing' }],
        origins,
      ),
    ).toThrow(/original release source is unavailable/);
  });
});

describe('owner-defined prerequisite response correlation', () => {
  const dependency = {
    ...release,
    releaseCode: 'reference:base',
    moduleName: 'reference',
    checksum: 'b'.repeat(64),
  };
  const selection = {
    contractVersion: 1 as const,
    requestedReleaseCodes: [release.releaseCode!],
    prerequisites: [dependency],
  };
  const result = {
    dataType: 'init' as const,
    tenant: 'default',
    releases: [dependency, release],
    selection,
  };
  const matches = (value: typeof result, mode: 'validate' | 'install' = 'validate') =>
    dataReleaseResponseMatchesSelection(value, [release], 'init', 'default', mode);

  it('accepts the owner closure for validation and completed subset for installation without planning dependencies', () => {
    expect(matches(result)).toBe(true);
    expect(matches({ ...result, releases: [release] }, 'install')).toBe(true);
    expect(matches({ ...result, releases: [release] })).toBe(false);
    expect(
      matches({ ...result, selection: undefined } as unknown as typeof result),
    ).toBe(false);
    expect(
      dataReleaseResponseMatchesSelection(
        { dataType: result.dataType, tenant: result.tenant, releases: [release] },
        [release],
        'init',
        'default',
        'install',
      ),
    ).toBe(true);
  });

  it('refuses changed scope, missing roots, unexpected members and altered prerequisite evidence', () => {
    for (const changed of [
      { ...result, tenant: 'foreign' },
      { ...result, releases: [dependency] },
      { ...result, releases: [dependency, release, release] },
      { ...result, releases: [release, { ...dependency, checksum: 'changed' }] },
      {
        ...result,
        releases: [release, { ...dependency, releaseCode: 'unexpected:extra' }],
      },
      { ...result, releases: [dependency, { ...release, version: '9.0.0' }] },
      {
        ...result,
        selection: { ...selection, requestedReleaseCodes: ['foreign:root'] },
      },
      {
        ...result,
        selection: {
          ...selection,
          requestedReleaseCodes: [release.releaseCode!, release.releaseCode!],
        },
      },
      {
        ...result,
        selection: { ...selection, prerequisites: [dependency, dependency] },
      },
      { ...result, selection: { ...selection, prerequisites: [release] } },
    ])
      expect(matches(changed as typeof result)).toBe(false);
  });
});
