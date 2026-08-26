import { describe, expect, it, vi } from 'vitest';

import {
  loadAuthenticatedBootstrap,
  loadPublicBootstrap,
  selectModuleConnection,
} from '../../src/bootstrap/publicBootstrap';

const document = {
  code: 'SUC_BOF_00014',
  data: {
    contractVersion: 1,
    clientContractVersion: 1,
    endpoints: {
      profile: 'https://profile.example.com',
      cms: 'https://cms.example.com',
    },
    uiComposition: {
      site: 'axisCmsSite',
      catalog: 'axisContentCatalog',
      defaultPublicPage: '/login',
      defaultAuthenticatedPage: '/dashboard',
      locale: 'en',
      channel: 'web',
      fallbackMode: 'STATIC_RECOVERY_SHELL',
    },
  },
};

const authenticatedData = {
  modules: {
    'nodics.wcms': [
      {
        moduleName: 'nodics.wcms',
        displayName: 'Content',
        canonicalIdentity: 'nodics.wcms',
        instanceId: 'runtime-0',
        clientCallable: false,
        moduleKind: 'group',
      },
    ],
    cms: [
      {
        moduleName: 'cms',
        displayName: 'Content Management',
        parentModule: 'nodics.wcms',
        canonicalIdentity: 'nodics.wcms/modules/cms',
        instanceId: 'runtime-1',
        environment: 'kickoffLocal',
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
        clientCallable: true,
        endpoint: 'https://cms.example.com/nodics/cms',
        state: 'UP',
        moduleKind: 'capability',
      },
    ],
  },
  catalogue: {
    cms: {
      enabled: true,
      category: 'content',
      icon: 'content',
      requiredPermissions: ['cms.backoffice.view'],
      compatibility: { status: 'COMPATIBLE' },
      navigation: [
        {
          id: 'cms',
          label: 'Content',
          route: '/content',
          icon: 'cms',
          order: 200,
          labelKey: 'axis.navigation.content',
          group: {
            id: 'content',
            label: 'Content and Experience',
            labelKey: 'axis.group.content',
            order: 200,
          },
          perspectives: ['operations', 'content'],
          contexts: ['environment', 'tenant', 'site', 'catalog'],
          featureState: 'PREVIEW',
          badgeProvider: {
            moduleName: 'cms',
            operationId: 'cms.pending.count',
          },
          workbenchTarget: {
            moduleName: 'cms',
            schemaName: 'cmsPage',
          },
          workbenchPresentation: {
            defaultColumns: ['code', 'label', 'status'],
            hiddenFields: ['notes'],
            editableFields: ['code', 'label', 'status'],
            readonlyFields: ['created', 'updated'],
            forbiddenFields: ['secret'],
            fixedFilters: [
              {
                id: 'draft-pages',
                label: 'Draft pages only',
                field: 'status',
                value: 'DRAFT',
              },
            ],
          },
          detailPanels: [
            {
              id: 'slots',
              label: 'Slots',
              target: {
                moduleName: 'cms',
                schemaName: 'cmsSlot',
              },
              relation: {
                sourceField: 'code',
                targetField: 'pageCode',
                cardinality: 'MANY',
              },
            },
          ],
          lifecycleActions: [
            {
              id: 'publish-page',
              label: 'Publish page',
              intent: 'APPROVE',
              permission: 'cms.publish',
              summary: 'Request publication through the owning CMS workflow.',
              operationRoute: '/content/pages/publish',
              httpMethod: 'POST',
              targetStatuses: ['DRAFT'],
              ownerModule: 'workflow',
              handlerAction: 'publishCmsPage',
              inputFields: [
                {
                  name: 'decision',
                  label: 'Decision',
                  type: 'HIDDEN',
                  required: true,
                  defaultValue: 'SUCCESS',
                },
                {
                  name: 'feedback',
                  label: 'Evidence',
                  type: 'MULTILINE',
                  required: true,
                  maximumLength: 2000,
                },
              ],
            },
            {
              id: 'validate-provider',
              label: 'Validate provider',
              intent: 'VALIDATE',
              permission: 'payment.backoffice.manage',
              summary: 'Validate a provider through its owning module.',
              operationRoute: '/providers/lifecycle',
              targetStatuses: ['ACTIVE'],
            },
            {
              id: 'request-checker',
              label: 'Request checker',
              intent: 'SUBMIT',
              permission: 'kyc.review.request-checker',
              operationRoute: '/reviews/actions/request-checker',
            },
            {
              id: 'execute-operation',
              label: 'Execute operation',
              intent: 'EXECUTE',
              permission: 'operations.execute',
              operationRoute: '/operations/execute',
            },
            {
              id: 'publish-release',
              label: 'Publish release',
              intent: 'PUBLISH',
              permission: 'cms.publish',
              operationRoute: '/content/releases/publish',
            },
            {
              id: 'repair-evaluation',
              label: 'Repair evaluation',
              intent: 'REPAIR',
              permission: 'promotion.evaluation.repair',
              operationRoute: '/promotions/evaluations/repair',
            },
          ],
          help: {
            summary: 'Manage content pages and components.',
            documentationRoute:
              '/docs/capabilities/content-publishing/wcms-authoring-model',
            documentationFragment: 'pages',
          },
          requiredPermissions: ['cms.backoffice.view'],
        },
      ],
    },
  },
  availability: {
    cms: { state: 'UP' },
  },
  documentationSources: [
    {
      id: 'framework',
      label: 'Framework',
      type: 'CMS',
      route: '/docs/framework',
      order: 100,
      ownerModule: 'backoffice',
      connectionModule: 'cms',
      site: 'axisCmsSite',
      catalog: 'nodicsDocumentationContentCatalog',
      defaultPage: '/docs',
      packCode: 'nodicsDocumentation',
    },
  ],
  axisPolicy: {
    contractVersion: 0,
    screenLockEnabled: true,
    idleTimeoutSeconds: 900,
    recentNavigationLimit: 12,
    revision: 0,
    source: 'DEFAULT',
  },
  tenantCode: 'default',
};

describe('Axis bootstrap clients', () => {
  it('accepts only the low-disclosure compatible public contract', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(document), { status: 200 }));
    const result = await loadPublicBootstrap(
      'https://backoffice.example.com',
      1,
      10_000,
      request,
    );
    expect(result.endpoints.cms).toBe('https://cms.example.com');
    const [url, options] = request.mock.calls[0] ?? [];
    expect(url instanceof URL ? url.pathname : '').toBe(
      '/nodics/backoffice/v0/bootstrap/public',
    );
    expect(new Headers(options?.headers).get('Authorization')).toBeNull();
  });

  it('rejects incompatible public contracts', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...document,
          data: { ...document.data, contractVersion: 0 },
        }),
        { status: 200 },
      ),
    );
    await expect(
      loadPublicBootstrap('https://backoffice.example.com', 1, 10_000, request),
    ).rejects.toThrow(/incompatible/i);
  });

  it('uses the employee bearer only for the secured bootstrap', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: authenticatedData,
        }),
        { status: 200 },
      ),
    );
    const result = await loadAuthenticatedBootstrap(
      'https://backoffice.example.com',
      1,
      'employee-access',
      10_000,
      request,
    );
    const [, options] = request.mock.calls[0] ?? [];
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      'Bearer employee-access',
    );
    expect(result.axisPolicy.idleTimeoutSeconds).toBe(900);
    expect(result.environments).toEqual(['kickoffLocal']);
    expect(result.tenantCode).toBe('default');
    expect(result.moduleCatalog.cms).toEqual({
      moduleName: 'cms',
      displayName: 'Content Management',
      parentModule: 'nodics.wcms',
      canonicalIdentity: 'nodics.wcms/modules/cms',
      moduleKind: 'capability',
    });
    expect(result.moduleCatalog['nodics.wcms']).toEqual({
      moduleName: 'nodics.wcms',
      displayName: 'Content',
      canonicalIdentity: 'nodics.wcms',
      moduleKind: 'group',
    });
    expect(result.documentationSources).toEqual([
      expect.objectContaining({
        id: 'framework',
        type: 'CMS',
        site: 'axisCmsSite',
        packCode: 'nodicsDocumentation',
      }),
    ]);
    expect(result.moduleConnections.cms).toEqual([
      {
        moduleName: 'cms',
        instanceId: 'runtime-1',
        endpoint: 'https://cms.example.com/nodics/cms',
        environment: 'kickoffLocal',
        runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
        state: 'UP',
      },
    ]);
    expect(selectModuleConnection(result, 'cms')?.endpoint).toBe(
      'https://cms.example.com/nodics/cms',
    );
    expect(
      selectModuleConnection(result, 'cms', { server: 'wcmsStagedServer' }),
    ).toBeUndefined();
    expect(
      selectModuleConnection(result, 'cms', { publicationRole: 'STAGED' })?.endpoint,
    ).toBe('https://cms.example.com/nodics/cms');
    expect(result.navigation).toEqual([
      expect.objectContaining({
        label: 'Content',
        moduleName: 'cms',
        icon: 'cms',
        availability: 'UP',
        labelKey: 'axis.navigation.content',
        group: {
          id: 'content',
          label: 'Content & Experience',
          labelKey: 'axis.group.content',
          order: 200,
        },
        perspectives: ['operations', 'content'],
        contexts: ['environment', 'tenant', 'site', 'catalog'],
        featureState: 'PREVIEW',
        badgeProvider: {
          moduleName: 'cms',
          operationId: 'cms.pending.count',
        },
        workbenchTarget: {
          moduleName: 'cms',
          schemaName: 'cmsPage',
        },
        workbenchPresentation: {
          defaultColumns: ['code', 'label', 'status'],
          hiddenFields: ['notes'],
          editableFields: ['code', 'label', 'status'],
          readonlyFields: ['created', 'updated'],
          forbiddenFields: ['secret'],
          fixedFilters: [
            {
              id: 'draft-pages',
              label: 'Draft pages only',
              field: 'status',
              value: 'DRAFT',
              order: 0,
            },
          ],
        },
        detailPanels: [
          {
            id: 'slots',
            label: 'Slots',
            order: 0,
            target: {
              moduleName: 'cms',
              schemaName: 'cmsSlot',
            },
            relation: {
              sourceField: 'code',
              targetField: 'pageCode',
              cardinality: 'MANY',
            },
          },
        ],
        lifecycleActions: [
          expect.objectContaining({
            id: 'publish-page',
            intent: 'APPROVE',
            operationRoute: '/content/pages/publish',
            ownerModule: 'workflow',
            handlerAction: 'publishCmsPage',
            httpMethod: 'POST',
          }),
          expect.objectContaining({
            id: 'validate-provider',
            intent: 'VALIDATE',
            operationRoute: '/providers/lifecycle',
          }),
          expect.objectContaining({
            id: 'request-checker',
            intent: 'SUBMIT',
          }),
          expect.objectContaining({
            id: 'execute-operation',
            intent: 'EXECUTE',
          }),
          expect.objectContaining({
            id: 'publish-release',
            intent: 'PUBLISH',
          }),
          expect.objectContaining({
            id: 'repair-evaluation',
            intent: 'REPAIR',
          }),
        ],
        help: {
          summary: 'Manage content pages and components.',
          documentationRoute:
            '/docs/capabilities/content-publishing/wcms-authoring-model',
          documentationFragment: 'pages',
        },
      }),
    ]);
    expect(result.navigation[0]?.lifecycleActions?.[0]?.inputFields?.[1]).toMatchObject(
      {
        name: 'feedback',
        type: 'MULTILINE',
        required: true,
      },
    );
  });

  it('rejects unsafe direct-module connection settings', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...authenticatedData,
            modules: {
              cms: [
                {
                  moduleName: 'cms',
                  instanceId: 'unsafe',
                  environment: 'kickoffLocal',
                  clientCallable: true,
                  endpoint: 'https://user:secret@cms.example.com/nodics/cms',
                  state: 'UP',
                },
              ],
            },
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      loadAuthenticatedBootstrap(
        'https://backoffice.example.com',
        1,
        'employee-access',
        10_000,
        request,
      ),
    ).rejects.toThrow(/safe HTTP endpoint/);
  });

  it('accepts navigation that the authoritative bootstrap already permission-filtered', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...authenticatedData,
            catalogue: {
              cms: {
                ...authenticatedData.catalogue.cms,
                navigation: [
                  {
                    id: 'admin',
                    label: 'CMS administration',
                    route: '/content/admin',
                    requiredPermissions: ['cms.administration.manage'],
                  },
                ],
              },
            },
          },
        }),
        { status: 200 },
      ),
    );
    const result = await loadAuthenticatedBootstrap(
      'https://backoffice.example.com',
      1,
      'employee-access',
      10_000,
      request,
    );
    expect(result.navigation).toEqual([
      expect.objectContaining({
        id: 'admin',
        route: '/content/admin',
      }),
    ]);
  });

  it('rejects unsafe schema-workbench navigation targets', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...authenticatedData,
            catalogue: {
              cms: {
                ...authenticatedData.catalogue.cms,
                navigation: [
                  {
                    id: 'admin',
                    label: 'CMS administration',
                    route: '/content/admin',
                    workbenchTarget: {
                      moduleName: 'cms',
                      schemaName: '../cmsPage',
                    },
                  },
                ],
              },
            },
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      loadAuthenticatedBootstrap(
        'https://backoffice.example.com',
        1,
        'employee-access',
        10_000,
        request,
      ),
    ).rejects.toThrow(/workbench target schema is unsafe/i);
  });

  it('rejects unsafe navigation help documentation targets', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...authenticatedData,
            catalogue: {
              cms: {
                ...authenticatedData.catalogue.cms,
                navigation: [
                  {
                    id: 'admin',
                    label: 'CMS administration',
                    route: '/content/admin',
                    help: {
                      summary: 'Unsafe help target.',
                      documentationRoute: 'https://evil.example/docs',
                    },
                  },
                ],
              },
            },
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      loadAuthenticatedBootstrap(
        'https://backoffice.example.com',
        1,
        'employee-access',
        10_000,
        request,
      ),
    ).rejects.toThrow(/application-relative route/i);
  });

  it('rejects orphaned and cyclic navigation even when backend validation is bypassed', async () => {
    for (const navigation of [
      [{ id: 'child', label: 'Child', route: '/child', parentId: 'missing' }],
      [
        { id: 'one', label: 'One', route: '/one', parentId: 'two' },
        { id: 'two', label: 'Two', route: '/two', parentId: 'one' },
      ],
    ]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              ...authenticatedData,
              catalogue: {
                cms: {
                  ...authenticatedData.catalogue.cms,
                  navigation,
                },
              },
            },
          }),
          { status: 200 },
        ),
      );
      await expect(
        loadAuthenticatedBootstrap(
          'https://backoffice.example.com',
          1,
          'employee-access',
          10_000,
          request,
        ),
      ).rejects.toThrow(/orphan|cycle/iu);
    }
  });

  it('accepts KYC pages beneath the backend-owned Compliance Management parent', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...authenticatedData,
            catalogue: {
              complianceCore: {
                ...authenticatedData.catalogue.cms,
                navigation: [
                  {
                    id: 'compliance-management',
                    label: 'Compliance Management',
                    route: '/compliance-management',
                  },
                ],
              },
              kycCore: {
                ...authenticatedData.catalogue.cms,
                navigation: [
                  {
                    id: 'kyc-cases',
                    label: 'KYC Cases',
                    route: '/compliance-management/kyc/cases',
                    parentId: 'compliance-management',
                    parentModuleName: 'complianceCore',
                  },
                ],
              },
            },
          },
        }),
        { status: 200 },
      ),
    );

    const bootstrap = await loadAuthenticatedBootstrap(
      'https://backoffice.example.com',
      1,
      'employee-access',
      10_000,
      request,
    );

    expect(bootstrap.navigation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'kyc-cases',
          parentId: 'compliance-management',
          parentModuleName: 'complianceCore',
        }),
      ]),
    );
  });

  it('rejects unsafe or incompatible employee idle policies', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...authenticatedData,
            axisPolicy: {
              contractVersion: 0,
              screenLockEnabled: true,
              idleTimeoutSeconds: 30,
              recentNavigationLimit: 12,
              revision: 0,
              source: 'DEFAULT',
            },
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      loadAuthenticatedBootstrap(
        'https://backoffice.example.com',
        1,
        'employee-access',
        10_000,
        request,
      ),
    ).rejects.toThrow(/policy is incompatible/i);
  });

  it('rejects unsafe or incompatible recent navigation limits', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            ...authenticatedData,
            axisPolicy: {
              ...authenticatedData.axisPolicy,
              recentNavigationLimit: 25,
            },
          },
        }),
        { status: 200 },
      ),
    );
    await expect(
      loadAuthenticatedBootstrap(
        'https://backoffice.example.com',
        1,
        'employee-access',
        10_000,
        request,
      ),
    ).rejects.toThrow(/policy is incompatible/i);
  });
});
