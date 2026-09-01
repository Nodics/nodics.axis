import { describe, expect, it, vi } from 'vitest';

import {
  loadWcmsExperienceIndexStatus,
  parseWcmsExperienceResolveResult,
  previewWcmsExperience,
} from '../../../src/operations/contentExperience/api/wcmsExperienceClient';

describe('wcmsExperienceClient', () => {
  const connection = {
    moduleName: 'wcmsExperience',
    instanceId: 'kickoffLocal:wcmsStagedServer:wcmsExperience:0',
    endpoint: 'http://localhost:4312/nodics/wcmsExperience',
    environment: 'kickoffLocal',
    server: 'wcmsStagedServer',
    state: 'UP',
  } as const;

  const configuration = {
    accessToken: 'employee-token',
    enterpriseCode: 'default',
    timeoutMs: 1_000,
  };

  it('posts preview context to the backend authoring preview endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            site: 'agoraApparelSite',
            pageType: 'PRODUCT_LISTING',
            slots: {
              hero: [
                {
                  placementCode: 'newInHeroPlacement',
                  componentCode: 'newInHero',
                  rendererKey: 'agora.heroBanner',
                  contractVersion: 1,
                  properties: { heading: 'Fresh styles just in' },
                  media: [],
                },
              ],
            },
            diagnostics: {
              matched: true,
              fallbackUsed: false,
              placementCount: 1,
            },
          },
        }),
      ),
    );

    const result = await previewWcmsExperience(
      connection,
      configuration,
      {
        site: 'agoraApparelSite',
        pageType: 'PRODUCT_LISTING',
        targetType: 'COLLECTION',
        targetCode: 'agoraNewArrivals',
        locale: 'en-US',
        channel: 'web',
        device: 'desktop',
      },
      fetchMock,
    );

    const previewCall = fetchMock.mock.calls[0] as
      | readonly [URL, RequestInit]
      | undefined;
    expect(previewCall?.[0]).toEqual(
      new URL('http://localhost:4312/nodics/wcmsExperience/v0/authoring/preview'),
    );
    expect(previewCall?.[1].method).toBe('POST');
    expect(previewCall?.[1].credentials).toBe('omit');
    expect(previewCall?.[1].redirect).toBe('error');
    expect(typeof previewCall?.[1].body).toBe('string');
    expect(previewCall?.[1].body).toContain('"targetType":"COLLECTION"');
    expect(result.slots.hero?.[0]?.rendererKey).toBe('agora.heroBanner');
    expect(result.diagnostics.matched).toBe(true);
  });

  it('loads index status from the backend authoring diagnostics endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            status: 'CURRENT',
            indexingMode: 'OUTBOX_EVENTUAL',
            currentIndexVersion: 'manifest-v12',
            documentCount: 42,
          },
        }),
      ),
    );

    const result = await loadWcmsExperienceIndexStatus(
      connection,
      configuration,
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'http://localhost:4312/nodics/wcmsExperience/v0/authoring/index-status',
      ),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.status).toBe('CURRENT');
    expect(result.documentCount).toBe(42);
  });

  it('rejects public-unsafe resolved components without renderer identity', () => {
    expect(() =>
      parseWcmsExperienceResolveResult({
        site: 'agoraApparelSite',
        pageType: 'PRODUCT_LISTING',
        slots: { hero: [{ componentCode: 'missingRenderer' }] },
        diagnostics: {},
      }),
    ).toThrow(/renderer identity/i);
  });
});
