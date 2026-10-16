import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authorListingProduct,
  listingAuthoringSelectors,
  parseListingAuthoringOutcome,
  listingAuthoringReadback,
  listingProductConfiguration,
  listingPublicationRoute,
} from '../../src/operations/wasteManagement/api/wasteListingAuthoringClient';
import {
  authorable,
  authorConfiguration,
  authorAcknowledgment,
  authoredProduct,
  authoredReadback,
} from './listingAuthoringFixtures';
afterEach(() => vi.unstubAllGlobals());
describe('governed human Product source handoff', () => {
  it('uses one Staged Product POST with exactly six original proof selectors and the current Store employee', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { ...authorAcknowledgment, privateCause: 'PRIVATE' },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await authorListingProduct(authorConfiguration, authorable);
    expect(result).toEqual(authoredProduct);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toEqual(
      new URL('https://product.example.test/nodics/product/v0/products/listings'),
    );
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer synthetic-access',
        'x-enterprise-code': 'STORE_ENTERPRISE',
      },
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    });
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      contractVersion: 1,
      assetCode: authorable.assetCode,
      listingKey: authorable.listingKey,
      expectedRevision: 3,
      intentDigest: authorable.intentDigest,
      storeCode: 'SYNTHETIC_STORE',
    });
    expect(authorAcknowledgment.sourceProof.requestRevision).toBe(2);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });
  it('rejects another enterprise, unavailable/ambiguous Staged owners and never borrows Online', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal('fetch', fetch);
    await expect(
      authorListingProduct(
        { ...authorConfiguration, enterpriseCode: 'Default' },
        authorable,
      ),
    ).rejects.toThrow();
    const connection = authorConfiguration.bootstrap.moduleConnections.product[0]!;
    for (const product of [
      [],
      [
        {
          ...connection,
          runtimeRole: { code: 'COMMERCE_ONLINE', publication: 'ONLINE' as const },
        },
      ],
      [{ ...connection, environment: 'Other' }],
      [connection, { ...connection, instanceId: 'another-staged' }],
    ]) {
      const configuration = {
        ...authorConfiguration,
        bootstrap: {
          ...authorConfiguration.bootstrap,
          moduleConnections: {
            ...authorConfiguration.bootstrap.moduleConnections,
            product,
          },
        },
      };
      expect(listingProductConfiguration(configuration)).toBeUndefined();
      await expect(authorListingProduct(configuration, authorable)).rejects.toThrow(
        'unavailable',
      );
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { state: 'OWNER_UNAVAILABLE' },
    { product: authoredProduct },
    { listingKey: null },
    { requestRevision: null },
    { eligibility: { ...authorable.eligibility, canAuthor: false } },
    { actions: ['READ_DETAILS'] },
  ])('refuses non-authorable evidence before transport: %j', (patch) => {
    expect(() =>
      listingAuthoringSelectors(authorConfiguration, {
        ...authorable,
        ...patch,
      } as typeof authorable),
    ).toThrow();
  });
  it.each([
    { publicationRequired: false },
    { versionId: undefined },
    { versionId: -1 },
    { locales: ['ar'] },
    {
      sourceProof: { ...authorAcknowledgment.sourceProof, listingKey: 'c'.repeat(64) },
    },
    { sourceProof: { ...authorAcknowledgment.sourceProof, requestRevision: 3 } },
    {
      sourceProof: {
        ...authorAcknowledgment.sourceProof,
        storeContext: { ...authorable.storeContext!, enterpriseCode: 'Default' },
      },
    },
  ])('refuses unconfirmed or cross-intent acknowledgment: %j', (patch) => {
    expect(() =>
      parseListingAuthoringOutcome({ ...authorAcknowledgment, ...patch }, authorable),
    ).toThrow();
  });
  it('preserves actual version zero and never retries a failure wrapper', async () => {
    expect(
      parseListingAuthoringOutcome(
        { ...authorAcknowledgment, versionId: 0 },
        authorable,
      ).versionId,
    ).toBe(0);
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ success: false, data: authorAcknowledgment }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(
      authorListingProduct(authorConfiguration, authorable),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('reconciles a lost reply only with exact original-intent Product readback', () => {
    expect(listingAuthoringReadback(authorable, authoredReadback)).toBe(true);
    expect(
      listingAuthoringReadback(authorable, authoredReadback, authoredProduct),
    ).toBe(true);
    expect(listingAuthoringReadback(authorable, authorable)).toBe(false);
    expect(
      listingAuthoringReadback(authorable, { ...authoredReadback, assetRevision: 4 }),
    ).toBe(false);
    expect(
      listingAuthoringReadback(authorable, {
        ...authoredReadback,
        intentDigest: 'f'.repeat(64),
      }),
    ).toBe(false);
    expect(
      listingAuthoringReadback(authorable, authoredReadback, {
        ...authoredProduct,
        versionId: 8,
      }),
    ).toBe(false);
  });
  it('navigates only admitted publication destinations, without fabricating a Process reference', () => {
    expect(listingPublicationRoute(authorConfiguration, authoredReadback)).toBe(
      '/publishing/requests',
    );
    expect(listingPublicationRoute(authorConfiguration, authorable)).toBeUndefined();
    expect(
      listingPublicationRoute(
        { ...authorConfiguration, enterpriseCode: 'Default' },
        authoredReadback,
      ),
    ).toBeUndefined();
    expect(
      listingPublicationRoute(
        {
          ...authorConfiguration,
          bootstrap: { ...authorConfiguration.bootstrap, navigation: [] },
        },
        authoredReadback,
      ),
    ).toBeUndefined();
    const approval = {
      ...authorConfiguration.bootstrap.navigation[0]!,
      id: 'publishing-approval-tasks',
      route: '/process/tasks',
    };
    const configuration = {
      ...authorConfiguration,
      bootstrap: {
        ...authorConfiguration.bootstrap,
        navigation: [approval, ...authorConfiguration.bootstrap.navigation],
      },
    };
    expect(listingPublicationRoute(configuration, authoredReadback)).toBe(
      '/publishing/requests',
    );
    expect(
      listingPublicationRoute(configuration, {
        ...authoredReadback,
        publicationReferences: [
          {
            domain: 'product',
            code: 'OWNER_PUBLICATION',
            state: 'PENDING_APPROVAL',
            processCode: 'OWNER_PROCESS',
          },
        ],
      }),
    ).toBe('/process/tasks');
    expect(
      listingPublicationRoute(
        {
          ...configuration,
          bootstrap: {
            ...configuration.bootstrap,
            navigation: [{ ...approval, featureState: 'DISABLED' }],
          },
        },
        authoredReadback,
      ),
    ).toBeUndefined();
  });
});
