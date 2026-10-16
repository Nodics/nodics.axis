import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadWasteListing,
  loadWasteListings,
  loadWasteListingWorkspace,
  listingPublicationStates,
  parseWasteListing,
} from '../../src/operations/wasteManagement/api/wasteListingClient';
import { configuration, listing, presentation } from './listingFixtures';

afterEach(() => vi.unstubAllGlobals());
function transport(result: unknown, status = 200) {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ data: result }), { status }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
describe('Waste-owned listing reads', () => {
  it('projects only the exact owner presentation and keeps executable/unknown metadata out', async () => {
    const fetch = transport({
      contractVersion: 1,
      workspaceCode: 'waste.listing',
      viewCode: 'ewaste.listingRequests',
      presentation: {
        ...presentation,
        componentUrl: 'PRIVATE',
        labels: { ...presentation.labels, script: 'PRIVATE' },
      },
    });
    const result = await loadWasteListingWorkspace(configuration);
    expect(result).toEqual(presentation);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(fetch.mock.calls[0]?.[0]).toEqual(
      new URL('https://waste.example.test/nodics/eWaste/v0/listing-workspace'),
    );
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('GET');
  });
  const product = {
    productCode: 'SYNTHETIC_PRODUCT',
    variantCode: 'SYNTHETIC_VARIANT',
    sku: 'SYNTHETIC_SKU',
    catalogVersion: 'Staged',
    versionId: 0,
    locales: ['en'],
  };
  it.each(listingPublicationStates)(
    'preserves the frozen owner display state %s without fabricating a Process reference',
    (state) => {
      const result = parseWasteListing(
        {
          ...listing,
          product,
          publicationReferences: [
            { domain: 'product', code: 'SYNTHETIC_PUBLICATION', state },
          ],
        },
        configuration.enterpriseCode,
      );
      expect(result.product?.versionId).toBe(0);
      expect(result.publicationReferences).toEqual([
        { domain: 'product', code: 'SYNTHETIC_PUBLICATION', state },
      ]);
    },
  );
  it.each(['CREATED', 'https://outside.test', 'APPROVED_AND_ACTIVE'])(
    'rejects unadvertised publication state %s',
    (state) => {
      expect(() =>
        parseWasteListing(
          {
            ...listing,
            product,
            publicationReferences: [
              { domain: 'product', code: 'SYNTHETIC_PUBLICATION', state },
            ],
          },
          configuration.enterpriseCode,
        ),
      ).toThrow('incompatible');
    },
  );
  it.each([undefined, null, -1, 1.5, '0', Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid or missing Product version %s',
    (versionId) => {
      expect(() =>
        parseWasteListing(
          { ...listing, product: { ...product, versionId } },
          configuration.enterpriseCode,
        ),
      ).toThrow('incompatible');
    },
  );
  it('preserves the actual Product version and refuses a drifted numeric or Pricing-digest Product pin', () => {
    const value = {
      ...listing,
      product: { ...product, versionId: 7 },
      productReference: {
        publicationCode: 'SYNTHETIC_PUBLICATION',
        productCode: product.productCode,
        storeCode: listing.storeContext.code,
        sourceVersion: '7',
        targetVersion: 'c'.repeat(64),
      },
    };
    const result = parseWasteListing(value, configuration.enterpriseCode);
    expect(result.product?.versionId).toBe(7);
    expect(result.productReference?.sourceVersion).toBe('7');
    for (const sourceVersion of ['0', 'a'.repeat(64)]) {
      expect(() =>
        parseWasteListing(
          { ...value, productReference: { ...value.productReference, sourceVersion } },
          configuration.enterpriseCode,
        ),
      ).toThrow('incompatible');
    }
  });
  it('uses one canonical GET with the current employee namespace and excludes unknown command/private fields', async () => {
    const fetch = transport({
      contractVersion: 1,
      items: [
        {
          ...listing,
          privateCause: 'PRIVATE',
          productCommand: {
            ...listing.productCommand,
            imageUrl: 'https://outside.test/private',
            secret: 'PRIVATE',
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });
    const result = await loadWasteListings(configuration);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toEqual(
      new URL(
        'https://waste.example.test/nodics/eWaste/v0/listing-requests?page=1&limit=25',
      ),
    );
    expect(fetch.mock.calls[0]![1]).toMatchObject({
      method: 'GET',
      headers: {
        Authorization: 'Bearer synthetic-access',
        'x-enterprise-code': 'STORE_ENTERPRISE',
      },
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    expect(fetch.mock.calls[0]![1]?.body).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(JSON.stringify(result)).not.toContain('outside.test');
  });
  it('preserves wrong-enterprise read-only evidence without substituting the required Store namespace', async () => {
    const value = {
      ...listing,
      eligibility: {
        ...listing.eligibility,
        signedEnterpriseCode: 'Default',
        blockerCode: 'ERR_EWASTE_LISTING_STORE_ENTERPRISE_REQUIRED',
      },
    };
    const fetch = transport(value);
    const result = await loadWasteListing(
      { ...configuration, enterpriseCode: 'Default' },
      listing.assetCode,
    );
    expect(result.eligibility.canAuthor).toBe(false);
    expect(result.eligibility.requiredEnterpriseCode).toBe('STORE_ENTERPRISE');
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get('x-enterprise-code')).toBe(
      'Default',
    );
  });
  it('preserves legacy unknowns without inventing proof, source absence or an authoring action', () => {
    const legacy = {
      ...listing,
      state: 'RECONCILIATION_REQUIRED',
      listingKey: null,
      requestRevision: null,
      intentDigest: null,
      rewardPrice: null,
      storeContext: null,
      authoringContext: null,
      productCommand: null,
      priceRowIntent: null,
      eligibility: {
        ...listing.eligibility,
        requiredEnterpriseCode: null,
        blockerCode: 'ERR_EWASTE_LISTING_RECONCILIATION_REQUIRED',
      },
    };
    const result = parseWasteListing(legacy, configuration.enterpriseCode);
    expect(result.state).toBe('RECONCILIATION_REQUIRED');
    expect(result.listingKey).toBeNull();
    expect(result.rewardPrice).toBeNull();
    expect(result.product).toBeNull();
    expect(result.actions).toEqual(['READ_DETAILS']);
  });
  it.each([
    { state: 'INVENTED' },
    { actions: ['https://outside.test/command'] },
    { actions: ['READ_DETAILS', 'READ_DETAILS'] },
    { eligibility: { ...listing.eligibility, signedEnterpriseCode: 'OTHER' } },
    { eligibility: { ...listing.eligibility, canAuthor: true } },
    { listingKey: 'not-a-digest' },
    { rewardPrice: 1.5 },
    {
      publicationReferences: [
        { domain: 'product', code: 'https://outside.test', state: 'APPROVED' },
      ],
    },
  ])('rejects malformed or contradictory owner evidence: %j', (patch) => {
    expect(() =>
      parseWasteListing({ ...listing, ...patch }, configuration.enterpriseCode),
    ).toThrow('incompatible');
  });
  it('admits exact qualified absence only as owner-projected awaiting authoring, without issuing a command', () => {
    const result = parseWasteListing(
      {
        ...listing,
        state: 'AWAITING_AUTHORING',
        eligibility: { ...listing.eligibility, canAuthor: true },
        actions: ['READ_DETAILS', 'AUTHOR_PRODUCT_SOURCE'],
      },
      configuration.enterpriseCode,
    );
    expect(result.eligibility.canAuthor).toBe(true);
    expect(result.product).toBeNull();
  });
  it.each([
    { page: 2 },
    { total: 2 },
    { items: [listing, listing], total: 2 },
    { contractVersion: 2 },
  ])('rejects mismatched/incomplete page evidence: %j', async (patch) => {
    transport({
      contractVersion: 1,
      items: [listing],
      total: 1,
      page: 1,
      limit: 25,
      ...patch,
    });
    await expect(loadWasteListings(configuration)).rejects.toThrow('incompatible');
  });
  it('rejects another detail identity and sends no request for invalid selectors', async () => {
    const fetch = transport({ ...listing, assetCode: 'OTHER' });
    await expect(loadWasteListing(configuration, listing.assetCode)).rejects.toThrow(
      'incompatible',
    );
    await expect(loadWasteListing(configuration, '//outside.test')).rejects.toThrow(
      'incompatible',
    );
    await expect(loadWasteListings(configuration, 0)).rejects.toThrow('incompatible');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not retry owner denial, use a fallback route or borrow a missing role', async () => {
    const fetch = transport({ message: 'Denied' }, 403);
    await expect(loadWasteListing(configuration, listing.assetCode)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(
      loadWasteListings({
        ...configuration,
        ownerSelector: { runtimeRoleCode: 'MISSING' },
      }),
    ).rejects.toThrow('unavailable');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
