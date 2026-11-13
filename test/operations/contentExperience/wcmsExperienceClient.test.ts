import { subscribeEmployeeSessionExpired } from '../../../src/auth/employeeSessionEvents';
import { describe, expect, it, vi } from 'vitest';

import {
  inspectGuidedExperience,
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

  it('bounds network failures, localizes uncertainty and never retries the request', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('private transport diagnostic'));
    await expect(
      loadWcmsExperienceIndexStatus(connection, configuration, transport),
    ).rejects.toMatchObject({
      status: 0,
      messageKey: 'common.request-unconfirmed',
      messageExposure: 'PUBLIC',
      message:
        'The request could not be confirmed. Inspect the current state before another change.',
    });
    expect(transport).toHaveBeenCalledOnce();
  });
  it('admits the bounded target catalogue plus its default fallback and rejects overflow', async () => {
    const selection = { catalogCode: 'catalog', siteCode: 'site', pageCode: 'page' };
    const row = {
      contractVersion: 1,
      ...selection,
      sourceVersion: 'a'.repeat(64),
      pageSourceVersion: 'b'.repeat(64),
      pageName: 'Page',
      canEdit: true,
      maximumAbsolutePriority: 100000,
      pageTypes: ['HOME'],
      slots: ['hero'],
      components: [],
      placements: [],
      competingPlacements: [],
      presentation: { targetHelp: 'Choose a target' },
      targets: [
        { targetType: 'DEFAULT', targetCode: '*', label: 'Default' },
        ...Array.from({ length: 100 }, (_, i) => ({
          targetType: 'COLLECTION',
          targetCode: String(i),
          label: String(i),
        })),
      ],
    };
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ result: row }))),
      );
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect(
        (await inspectGuidedExperience(connection, configuration, selection)).targets,
      ).toHaveLength(101);
      row.targets.push({
        targetType: 'COLLECTION',
        targetCode: 'overflow',
        label: 'Overflow',
      });
      await expect(
        inspectGuidedExperience(connection, configuration, selection),
      ).rejects.toThrow(/incomplete/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

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
      new URL('http://localhost:4312/nodics/wcmsExperience/v0/authoring/index-status'),
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
  it('preserves owner denial and signals only the exact authenticated expired session', async () => {
    const observed = vi.fn();
    const unsubscribe = subscribeEmployeeSessionExpired(observed);
    try {
      const expired = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'Session expired' }), { status: 401 }),
        );
      await expect(
        loadWcmsExperienceIndexStatus(
          connection,
          { ...configuration, sessionGeneration: 7 },
          expired,
        ),
      ).rejects.toMatchObject({ status: 401 });
      expect(observed).toHaveBeenCalledWith({
        accessToken: 'employee-token',
        generation: 7,
      });
      observed.mockClear();
      const denied = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Preview permission required' }), {
          status: 403,
        }),
      );
      await expect(
        loadWcmsExperienceIndexStatus(
          connection,
          { ...configuration, sessionGeneration: 7 },
          denied,
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(observed).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
