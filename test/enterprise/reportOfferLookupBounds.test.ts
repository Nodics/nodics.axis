import { beforeEach, expect, it, vi } from 'vitest';
import { searchReportOffers } from '../../src/operations/promotions/reportOfferLookup';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../src/workbench/api/workbenchClient';
import type { OperationalOwnerConfiguration } from '../../src/operations/shared/operationalOwnerClient';

vi.mock('../../src/bootstrap/publicBootstrap', () => ({
  selectModuleConnection: vi.fn(() => ({})),
}));
vi.mock('../../src/workbench/api/workbenchClient', () => ({
  loadWorkbenchRecords: vi.fn(),
  loadWorkbenchSchemas: vi.fn(),
}));
vi.mock('../../src/workbench/workbenchRouteModel', () => ({
  resolveWorkbenchLookupPageSize: () => 10,
  resolveWorkbenchRecordSort: () => undefined,
  schemaWithValidQueryCapabilities: (schema: unknown) => schema,
}));
const configuration = {
  bootstrap: {
    navigation: [
      {
        moduleName: 'promotion',
        featureState: 'ACTIVE',
        availability: 'UP',
        backendWorkspace: {
          workspaceCode: 'promotion.couponOffers',
          viewCode: 'authoring',
          ownerSelector: {
            runtimeRoleCode: 'COMMERCE_STAGED',
            publicationRole: 'STAGED',
          },
        },
        workbenchTarget: { schemaName: 'promotion' },
        workbenchPresentation: { schemaDiscovery: {} },
      },
    ],
  },
} as unknown as OperationalOwnerConfiguration;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadWorkbenchSchemas).mockResolvedValue([
    { moduleName: 'promotion', schemaName: 'promotion' },
  ] as never);
});
it('configuration regression C3: uses owner-validated display names without a copied maximum', async () => {
  const name = 'Owner-approved '.repeat(100);
  vi.mocked(loadWorkbenchRecords).mockResolvedValue({
    records: [{ code: 'offer', name }],
  } as never);
  expect(await searchReportOffers(configuration, 'offer')).toEqual([
    { code: 'offer', name },
  ]);
  for (const name of [
    '',
    '  ',
    null,
    { en: 'not a display string' },
    'invalid\nname',
  ]) {
    vi.mocked(loadWorkbenchRecords).mockResolvedValue({
      records: [{ code: 'offer', name }],
    } as never);
    await expect(searchReportOffers(configuration, 'offer')).rejects.toThrow(
      'Offer lookup is invalid.',
    );
  }
});
