import { describe, expect, it } from 'vitest';
import type { AxisAuthenticatedBootstrap } from '../../../src/bootstrap/publicBootstrap';
import {
  importHistoryConnection,
  importHistoryRoute,
  parseImportHistoryHandoff,
  resolveImportHistoryHandoff,
} from '../../../src/operations/importExport/importHistoryHandoff';

const staged = {
  moduleName: 'import',
  instanceId: 'custom-staged-import',
  endpoint: 'https://staged.example/nodics/import',
  environment: 'local',
  server: 'customStaged',
  runtimeRole: { code: 'CUSTOM_STAGED', publication: 'STAGED' },
  state: 'UP' as const,
};
const bootstrap = {
  navigation: [
    {
      id: 'imports-exports',
      moduleName: 'backoffice',
      route: '/operations/imports-exports',
      availability: 'UP',
      featureState: 'ACTIVE',
    },
  ],
  moduleConnections: {
    import: [
      staged,
      {
        ...staged,
        instanceId: 'other',
        server: 'other',
        runtimeRole: { code: 'OTHER', publication: 'OPERATIONAL' },
      },
    ],
  },
} as unknown as AxisAuthenticatedBootstrap;
describe('owner-target Import history handoff', () => {
  const descriptor = {
    contractVersion: 1,
    owner: 'import',
    action: 'REVIEW_IMPORT_HISTORY',
    available: true,
    readOnly: true,
    automaticExecution: false,
    route:
      '/operations/imports-exports?area=history&importInstance=custom-staged-import',
    importInstance: staged.instanceId,
    targetServer: staged.server,
    targetRuntimeRole: 'CUSTOM_STAGED',
  };
  it('consumes only the exact owner route and authorized instance, including configured navigation prefixes', () => {
    expect(
      resolveImportHistoryHandoff(bootstrap, parseImportHistoryHandoff(descriptor)),
    ).toBe(descriptor.route);
    const route = '/project/operations/imports';
    const custom = {
      ...descriptor,
      route: `${route}?area=history&importInstance=custom-staged-import`,
    };
    expect(
      resolveImportHistoryHandoff(
        {
          ...bootstrap,
          navigation: bootstrap.navigation.map((item) => ({ ...item, route })),
        },
        parseImportHistoryHandoff(custom),
      ),
    ).toBe(custom.route);
    expect(
      resolveImportHistoryHandoff(bootstrap, parseImportHistoryHandoff(custom)),
    ).toBeUndefined();
    expect(importHistoryConnection(bootstrap, descriptor.importInstance)).toBe(staged);
  });
  it.each([
    { contractVersion: 2 },
    { automaticExecution: true },
    { readOnly: false },
    {
      route:
        '//external.example/history?area=history&importInstance=custom-staged-import',
    },
    {
      route: '/operations/../imports?area=history&importInstance=custom-staged-import',
    },
    { route: `${descriptor.route}&importInstance=other` },
    { route: `${descriptor.route}&privateInput=value` },
    { route: `${descriptor.route}#fragment` },
    { importInstance: 'other' },
  ])('rejects malformed or executable owner handoff %j without fallback', (change) => {
    expect(() => parseImportHistoryHandoff({ ...descriptor, ...change })).toThrow();
  });
  it('keeps unavailable or wrong-target handoffs inert despite prose suggesting Process', () => {
    expect(
      resolveImportHistoryHandoff(
        bootstrap,
        parseImportHistoryHandoff({ ...descriptor, available: false }),
      ),
    ).toBeUndefined();
    expect(
      resolveImportHistoryHandoff(
        bootstrap,
        parseImportHistoryHandoff({ ...descriptor, targetServer: 'other' }),
      ),
    ).toBeUndefined();
    expect(
      resolveImportHistoryHandoff(
        { ...bootstrap, navigation: [] },
        parseImportHistoryHandoff(descriptor),
      ),
    ).toBeUndefined();
  });
  it('uses authorized navigation and exact customized runtime, without a fabricated run', () => {
    const route = importHistoryRoute(bootstrap, {
      targetServer: 'customStaged',
      targetRuntimeRole: 'CUSTOM_STAGED',
    });
    expect(route).toBe(
      '/operations/imports-exports?area=history&importInstance=custom-staged-import',
    );
    expect(importHistoryConnection(bootstrap, 'custom-staged-import')).toBe(staged);
  });
  it('carries a bounded owner run reference when explicitly provided', () => {
    expect(
      importHistoryRoute(
        bootstrap,
        { targetServer: 'customStaged', targetRuntimeRole: 'CUSTOM_STAGED' },
        'import_test',
      ),
    ).toContain('importRun=import_test');
  });
  it('rejects unavailable, ambiguous and missing target authority without another runtime fallback', () => {
    expect(importHistoryConnection(bootstrap, 'unknown')).toBeUndefined();
    expect(
      importHistoryRoute(bootstrap, {
        targetServer: 'other',
        targetRuntimeRole: 'CUSTOM_STAGED',
      }),
    ).toBeUndefined();
    expect(
      importHistoryRoute(
        { ...bootstrap, navigation: [] },
        { targetServer: 'customStaged', targetRuntimeRole: 'CUSTOM_STAGED' },
      ),
    ).toBeUndefined();
    expect(
      importHistoryRoute(
        { ...bootstrap, moduleConnections: { import: [staged, staged] } },
        { targetServer: 'customStaged', targetRuntimeRole: 'CUSTOM_STAGED' },
      ),
    ).toBeUndefined();
  });
});
