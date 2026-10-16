/** Synthetic retained listing DTO and presentation; no installed identity, grant or publication proof. */
import type { OperationalOwnerConfiguration } from '../../src/operations/shared/operationalOwnerClient';
import type { WasteListingPresentation } from '../../src/operations/wasteManagement/WasteListingRequestsPanel';
import { listingStates } from '../../src/operations/wasteManagement/api/wasteListingClient';

export const configuration: OperationalOwnerConfiguration = {
  accessToken: 'synthetic-access',
  enterpriseCode: 'STORE_ENTERPRISE',
  timeoutMs: 1000,
  bootstrap: {
    axisPolicy: {
      contractVersion: 0,
      screenLockEnabled: true,
      idleTimeoutSeconds: 900,
      recentNavigationLimit: 12,
      revision: 0,
      source: 'DEFAULT',
    },
    tenantCode: 'synthetic-tenant',
    navigation: [],
    moduleCatalog: {},
    environments: [],
    documentationSources: [],
    moduleConnections: {
      eWaste: [
        {
          moduleName: 'eWaste',
          instanceId: 'waste-one',
          endpoint: 'https://waste.example.test/nodics/eWaste',
          environment: 'Local',
          state: 'UP',
        },
      ],
    },
  },
};
export const listing = {
  contractVersion: 1 as const,
  assetCode: 'SYNTHETIC_ASSET',
  assetRevision: 3,
  assetStatus: 'LISTING_REQUESTED' as const,
  state: 'OWNER_INSPECTION_REQUIRED' as const,
  listingKey: 'a'.repeat(64),
  requestRevision: 2,
  intentDigest: 'b'.repeat(64),
  rewardPrice: 6,
  ownerRef: {
    module: 'profile' as const,
    schema: 'customer' as const,
    code: 'synthetic-customer',
  },
  storeContext: {
    code: 'SYNTHETIC_STORE',
    enterpriseCode: 'STORE_ENTERPRISE',
    revision: 1,
  },
  authoringContext: { catalogVersion: 'Staged', locales: ['en'] },
  productCommand: {
    name: 'Synthetic headphone',
    description: 'Fixture only, not physical evidence.',
    sample: true,
  },
  product: null,
  productReference: null,
  priceRowIntent: {
    code: 'SYNTHETIC_PRICE',
    priceBookCode: 'SYNTHETIC_BOOK',
    currency: 'POINTS',
    unitAmount: '6',
    minQuantity: '1' as const,
  },
  publicationReferences: [],
  eligibility: {
    signedEnterpriseCode: 'STORE_ENTERPRISE',
    requiredEnterpriseCode: 'STORE_ENTERPRISE',
    canAuthor: false,
    blockerCode: null,
  },
  actions: ['READ_DETAILS' as const],
};
export const presentation: WasteListingPresentation = {
  labels: {
    title: 'Listing requests',
    refresh: 'Refresh listings',
    loading: 'Loading listings',
    empty: 'No listing requests',
    unavailable: 'Listing inspection unavailable',
    details: 'Inspect listing',
    close: 'Close',
    previous: 'Previous page',
    next: 'Next page',
    page: 'Page',
    asset: 'Asset',
    name: 'Item',
    status: 'Publication state',
    rewardPrice: 'Original points',
    signedEnterprise: 'Signed enterprise',
    requiredEnterprise: 'Required enterprise',
    store: 'Store',
    product: 'Product',
    priceRow: 'Price row',
    publication: 'Publication evidence',
    unknown: 'Unknown',
    readOnly: 'Read-only listing inspection',
    wrongEnterprise:
      'Use the authorized Store enterprise context to author this listing.',
    ownerUnavailable: 'Owner evidence is unavailable, not proven absent.',
    reconciliationRequired: 'Original intent needs owner reconciliation.',
    commandUnavailable: 'Owner action is not yet available.',
    authorProduct: 'Author Product source',
    openPublication: 'Review publication',
  },
  states: Object.fromEntries(
    listingStates.map((state) => [state, state.replaceAll('_', ' ')]),
  ) as WasteListingPresentation['states'],
};
