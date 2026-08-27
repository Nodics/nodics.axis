import { describe, expect, it, vi } from 'vitest';

import {
  createDocumentationGovernanceClient,
  defaultDocumentationGovernanceRoutes,
} from '../../../../src/operations/documentationManagement/api/documentationGovernanceClient';
import type { AxisModuleConnection } from '../../../../src/bootstrap/publicBootstrap';

const connection: AxisModuleConnection = {
  moduleName: 'cms',
  instanceId: 'kickoffLocal:wcmsStagedServer:cms:0',
  endpoint: 'https://cms.example.com/nodics/cms',
  environment: 'kickoffLocal',
  server: 'wcmsStagedServer',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
  state: 'UP',
};

const configuration = {
  accessToken: 'employee-token',
  enterpriseCode: 'default',
  timeoutMs: 1_000,
};

function url(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function ok(result: unknown): Response {
  return new Response(JSON.stringify({ result }), { status: 200 });
}

describe('documentation governance client', () => {
  it('loads the backend authoring model from the CMS governance route', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      ok({
        contract: 'cms.documentation.authoring/v1',
        ownerModule: 'cms',
        contentAuthority: 'documentationContentCatalog',
        rendererAuthority: 'axis-runtime-renderers',
        publicationAuthority: 'nPublish',
        workspace: {
          route: '/content/designer/documentation',
          landing: '/content/designer/documentation/dashboard',
          previewRoute: '/content/designer/documentation/preview',
          searchRoute: '/content/designer/documentation/search',
          expandableNavigation: true,
          backendDriven: true,
        },
        panels: [
          {
            code: 'navigation',
            label: 'Navigation Builder',
            schemaName: 'cmsDocumentationNode',
          },
        ],
        accessModes: ['PUBLIC', 'AUTHENTICATED', 'PERMISSION_BASED'],
        lifecycle: {
          readerStates: ['ONLINE'],
          authorStates: ['DRAFT', 'ONLINE'],
          targetTypes: ['PAGE', 'SEARCH_METADATA'],
          workflowTriggers: { PAGE: ['CONTENT_CHANGE'] },
        },
        sequence: [
          {
            id: 1,
            group: 'Axis Documentation Workspace',
            code: 'workspace.shell',
            label: 'Documentation workspace shell',
            target: 'workspace',
          },
        ],
      }),
    );
    const client = createDocumentationGovernanceClient(
      connection,
      configuration,
      defaultDocumentationGovernanceRoutes(),
      request,
    );

    const model = await client.loadAuthoringModel();

    expect(model.publicationAuthority).toBe('nPublish');
    expect(model.panels[0]?.schemaName).toBe('cmsDocumentationNode');
    expect(model.sequenceByGroup['Axis Documentation Workspace']?.length).toBe(1);
    const [input, options] = request.mock.calls[0] ?? [];
    if (!input) throw new Error('Expected documentation model request');
    expect(url(input)).toBe(
      'https://cms.example.com/nodics/cms/v0/documentation/governance/model',
    );
    const headers = new Headers(options?.headers);
    expect(headers.get('Authorization')).toBe('Bearer employee-token');
    expect(headers.get('x-enterprise-code')).toBe('default');
  });

  it('executes validation, render, search, handoff, and migration through configured routes', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((input) => {
      const path = new URL(url(input)).pathname;
      if (path.endsWith('/validate')) {
        return Promise.resolve(ok({ status: 'READY', issueCount: 0, issues: [] }));
      }
      if (path.endsWith('/render-projection')) {
        return Promise.resolve(
          ok({
            contract: 'cms.documentation.render/v1',
            channel: 'AXIS',
            navigation: [{ code: 'docs.home' }],
            pages: [{ code: 'docs.page' }],
            dashboards: [],
          }),
        );
      }
      if (path.endsWith('/search')) {
        return Promise.resolve(
          ok({
            contract: 'cms.documentation.search/v1',
            query: 'cache',
            total: 1,
            results: [
              {
                targetType: 'PAGE',
                targetCode: 'docs.cache',
                title: 'Cache Runtime',
                summary: 'Cache provider documentation.',
                score: 2,
              },
            ],
          }),
        );
      }
      if (path.endsWith('/publication-handoff')) {
        return Promise.resolve(
          ok({
            status: 'READY_FOR_NPUBLISH',
            publication: {
              domain: 'cms.documentation',
              rootType: 'documentationContentCatalog',
            },
            readiness: { status: 'READY', issueCount: 0, issues: [] },
          }),
        );
      }
      return Promise.resolve(
        ok({
          contract: 'cms.documentation.migration-plan/v1',
          source: 'generated-content-pack',
          target: 'Axis-managed documentation records',
          pageCount: 1,
          pages: [{ sourcePath: 'docs/pages/cache.md' }],
        }),
      );
    });
    const client = createDocumentationGovernanceClient(
      connection,
      configuration,
      defaultDocumentationGovernanceRoutes(),
      request,
    );

    await expect(client.validateAuthoringRecords()).resolves.toMatchObject({
      status: 'READY',
    });
    await expect(client.renderProjection({}, 'AXIS')).resolves.toMatchObject({
      navigation: [{ code: 'docs.home' }],
    });
    await expect(client.search('cache')).resolves.toMatchObject({
      total: 1,
      results: [{ title: 'Cache Runtime' }],
    });
    await expect(client.publicationHandoff()).resolves.toMatchObject({
      status: 'READY_FOR_NPUBLISH',
      domain: 'cms.documentation',
      rootType: 'documentationContentCatalog',
    });
    await expect(client.migrationPlan()).resolves.toMatchObject({
      recordCount: 1,
      actions: [
        'preserveSourceEvidence',
        'importGeneratedRecords',
        'enableAxisManagement',
      ],
    });
  });
});
