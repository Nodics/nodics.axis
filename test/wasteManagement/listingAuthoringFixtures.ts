/** Synthetic owner receipts only; not installed authority, real publication or financial evidence. */
import { configuration, listing, presentation } from './listingFixtures';
import {
  parseWasteListing,
  type WasteListingPresentation,
} from '../../src/operations/wasteManagement/api/wasteListingClient';
export const authorConfiguration = {
  ...configuration,
  bootstrap: {
    ...configuration.bootstrap,
    moduleConnections: {
      ...configuration.bootstrap.moduleConnections,
      product: [
        {
          moduleName: 'product',
          instanceId: 'product-staged',
          endpoint: 'https://product.example.test/nodics/product',
          environment: 'Local',
          state: 'UP' as const,
          runtimeRole: { code: 'COMMERCE_STAGED', publication: 'STAGED' as const },
        },
      ],
    },
    navigation: [
      {
        id: 'publishing-requests',
        moduleName: 'nPublish',
        label: 'Publication Requests',
        route: '/publishing/requests',
        category: 'content',
        icon: 'workflow',
        order: 1,
        availability: 'UP' as const,
        featureState: 'ACTIVE' as const,
        workbenchTarget: { moduleName: 'publish', schemaName: 'publicationRequest' },
      },
    ],
  },
};
export const authorable = parseWasteListing(
  {
    ...listing,
    state: 'AWAITING_AUTHORING',
    eligibility: { ...listing.eligibility, canAuthor: true },
    actions: ['READ_DETAILS', 'AUTHOR_PRODUCT_SOURCE'],
  },
  configuration.enterpriseCode,
);
export const authoredProduct = {
  productCode: 'SYNTHETIC_PRODUCT',
  variantCode: 'SYNTHETIC_VARIANT',
  sku: 'SYNTHETIC_SKU',
  catalogVersion: 'Staged',
  versionId: 7,
  locales: ['en'],
};
export const authorAcknowledgment = {
  ...authoredProduct,
  publicationRequired: true,
  sourceProof: {
    contractVersion: 1,
    assetCode: authorable.assetCode,
    listingKey: authorable.listingKey,
    requestRevision: authorable.requestRevision,
    intentDigest: authorable.intentDigest,
    storeContext: authorable.storeContext,
  },
};
export const authoredReadback = parseWasteListing(
  {
    ...authorable,
    product: authoredProduct,
    state: 'AWAITING_PUBLICATION',
    eligibility: { ...authorable.eligibility, canAuthor: false },
    actions: ['READ_DETAILS', 'OPEN_PUBLICATION_WORKFLOW'],
  },
  configuration.enterpriseCode,
);
export const authorPresentation: WasteListingPresentation = {
  ...presentation,
  authoring: {
    reviewTitle: 'Review Product source',
    confirmLabel: 'Create Product source',
    cancelLabel: 'Cancel source review',
    workingLabel: 'Authoring source...',
    savedMessage: 'Source saved; publication still required.',
    uncertainMessage: 'Outcome unconfirmed. Inspect the original listing.',
    inspectLabel: 'Inspect source outcome',
  },
};
