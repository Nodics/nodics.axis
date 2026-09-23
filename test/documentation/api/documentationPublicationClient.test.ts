import { describe, expect, it, vi } from 'vitest';

import { createDocumentationPublicationClient } from '../../../src/documentation/api/documentationPublicationClient';

const connection = {
  moduleName: 'backoffice',
  instanceId: 'platform/backoffice',
  endpoint: 'http://localhost:4300',
  environment: 'kickoffLocal',
  state: 'UP' as const,
};

function response(readiness = 'READY', allowedActions = ['ROLLBACK', 'RETIRE']) {
  return {
    code: 'SUC_BOF_00021',
    data: {
      profileCode: 'frameworkdocs',
      siteCode: 'nodicsDocumentationSite',
      readiness,
      releaseCode: 'contentPack:nodicsDocumentation',
      releaseVersion: '0.0.0',
      releaseStatus: 'CURRENT',
      allowedActions,
      publication: {
        code: 'cms-baseline-frameworkdocs',
        state: readiness === 'READY' ? 'ONLINE' : readiness,
        revision: 7,
      },
      repair: {
        action: 'RECONCILE_APPROVAL_TASK',
        status: 'REPAIRED_OR_REPLAYED',
        idempotent: true,
        workflowRef: 'workflow-after',
        publicationCode: 'cms-baseline-frameworkdocs',
        message:
          'Publication approval workflow was reconciled. Review the Process task for decision.',
      },
    },
  };
}

describe('documentation publication client', () => {
  it('uses only the governed initialization lifecycle endpoints', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(response()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const client = createDocumentationPublicationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      fetchImplementation,
    );

    const status = await client.getStatus();
    expect(status.allowedActions).toEqual(['ROLLBACK', 'RETIRE']);
    expect(status.repair).toMatchObject({
      action: 'RECONCILE_APPROVAL_TASK',
      status: 'REPAIRED_OR_REPLAYED',
      workflowRef: 'workflow-after',
    });
    await client.initiate();
    await client.rollback();
    await client.retire();

    expect(
      fetchImplementation.mock.calls.map(([url, init]) => [
        url instanceof URL ? url.href : 'unexpected-request',
        init?.method,
      ]),
    ).toEqual([
      ['http://localhost:4300/v0/applications/frameworkdocs/initialization', 'GET'],
      [
        'http://localhost:4300/v0/applications/frameworkdocs/initialization/initiate',
        'POST',
      ],
      [
        'http://localhost:4300/v0/applications/frameworkdocs/initialization/rollback',
        'POST',
      ],
      [
        'http://localhost:4300/v0/applications/frameworkdocs/initialization/retire',
        'POST',
      ],
    ]);
  });

  it('rejects backend actions outside the bounded lifecycle contract', async () => {
    const client = createDocumentationPublicationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(response('READY', ['DELETE'])), {
          status: 200,
        }),
      ),
    );

    await expect(client.getStatus()).rejects.toThrow(
      'Documentation publication action is unsupported',
    );
  });

  it('preserves capability runtime diagnostics for dashboard guidance', async () => {
    const payload = response('PUBLICATION_PENDING', ['INITIALIZE']) as ReturnType<
      typeof response
    > & {
      data: ReturnType<typeof response>['data'] & {
        capability?: Record<string, unknown>;
      };
    };
    payload.data.capability = {
      subject: {
        type: 'APPLICATION_CAPABILITY',
        code: 'frameworkdocs',
        owner: 'nodics.docs',
        applicationCode: 'axis',
        siteCode: 'nodicsDocumentationSite',
      },
      status: 'NEEDS_ATTENTION',
      capabilityCode: 'frameworkdocs',
      displayName: 'Framework docs',
      owningModule: 'nodics.docs',
      capabilityType: 'DOCUMENTATION_PACK',
      group: 'DOCUMENTATION_PACK',
      businessStatus: 'NEEDS_ATTENTION',
      technicalStatus: 'BLOCKED',
      lastEvaluatedAt: '2026-09-23T10:00:00.000Z',
      source: 'backoffice.applicationInitialization',
      stale: false,
      dependencies: [
        {
          kind: 'RUNTIME',
          code: 'wcmsStaged',
          label: 'Publication target runtime',
          required: true,
          server: 'wcmsStaged',
	          runtimeRole: 'WCMS_STAGED',
	          classification: 'RUNTIME_CONFIG',
	          status: 'UNAVAILABLE',
	          evidence: {
	            targetServer: 'wcmsStagedServer',
	            targetRuntimeRole: 'WCMS_STAGED',
	            classification: 'RUNTIME_CONFIG',
	            runtimeDiagnostic: {
	              phase: 'transport',
	              targetModule: 'import',
	              targetRuntimeRole: 'WCMS_STAGED',
	              failureCode: 'ETIMEDOUT',
	            },
	          },
	        },
        {
          kind: 'PROCESS',
          code: 'publicationApproval',
          label: 'Governed publication approval',
          required: true,
          status: 'UNAVAILABLE',
          evidence: {
            approvalDiagnostic: {
              source: 'PUBLICATION_APPROVAL',
              status: 'TASK_REFERENCE_MISSING',
              publicationState: 'PENDING_APPROVAL',
              suggestedAction: 'Reconcile publication approval.',
            },
          },
        },
	      ],
      dependencyGraph: {
        nodes: [
          {
            id: 'frameworkdocs',
            kind: 'CAPABILITY',
            label: 'Framework docs',
          },
          {
            id: 'RUNTIME:wcmsStaged',
	            kind: 'RUNTIME',
	            label: 'Publication target runtime',
	            status: 'UNAVAILABLE',
	            evidence: {
	              runtimeDiagnostic: {
	                phase: 'transport',
	                targetModule: 'import',
	                targetRuntimeRole: 'WCMS_STAGED',
	              },
	            },
	          },
	        ],
        edges: [
          {
            from: 'RUNTIME:wcmsStaged',
            to: 'frameworkdocs',
            relationship: 'REQUIRED_FOR',
          },
        ],
      },
      publicationSummary: {
        installed: 'BLOCKED',
        staged: 'PREPARATION_BLOCKED',
        approval: 'TASK_REFERENCE_MISSING',
        runtime: 'UNAVAILABLE',
      },
      approvalDiagnostic: {
        source: 'PUBLICATION_APPROVAL',
        status: 'TASK_REFERENCE_MISSING',
        publicationState: 'PENDING_APPROVAL',
        suggestedAction: 'Reconcile publication approval.',
      },
      disabledReason: 'No active runtime currently owns the required module route.',
      nextAction: 'Restore target runtime',
      blockers: [
        {
          blockerCode: 'RUNTIME_UNAVAILABLE',
          code: 'RUNTIME_UNAVAILABLE',
          severity: 'BLOCKED',
          owner: 'frameworkdocs',
          ownerType: 'DATA_RELEASE',
          source: 'IMPORT_PREFLIGHT',
          message: 'Target runtime is unavailable.',
          action: 'Restore target runtime',
          disabledReason:
            'No active runtime currently owns the required module route.',
          targetServer: 'wcmsStagedServer',
          targetRuntimeRole: 'WCMS_STAGED',
          technicalStatus: 'UNAVAILABLE',
          runtimeDiagnostic: {
            phase: 'transport',
            sourceServer: 'platformServer',
            targetModule: 'import',
            targetServer: 'wcmsStagedServer',
            targetRuntimeRole: 'WCMS_STAGED',
            failureCode: 'ETIMEDOUT',
            suggestedAction: 'Start wcmsStagedServer.',
          },
          approvalDiagnostic: {
            source: 'PUBLICATION_APPROVAL',
            status: 'TASK_REFERENCE_MISSING',
            publicationState: 'PENDING_APPROVAL',
          },
        },
      ],
    };
    const client = createDocumentationPublicationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200 }),
      ),
    );

    const status = await client.getStatus();

    expect(status.capability?.subject?.code).toBe('frameworkdocs');
    expect(status.capability?.status).toBe('NEEDS_ATTENTION');
	    expect(status.capability?.dependencies?.[0]).toMatchObject({
	      kind: 'RUNTIME',
	      status: 'UNAVAILABLE',
	      classification: 'RUNTIME_CONFIG',
	      evidence: {
	        targetServer: 'wcmsStagedServer',
	        classification: 'RUNTIME_CONFIG',
	        runtimeDiagnostic: {
	          targetModule: 'import',
	          failureCode: 'ETIMEDOUT',
	        },
	      },
	    });
    expect(status.capability?.dependencies?.[1]).toMatchObject({
      kind: 'PROCESS',
      status: 'UNAVAILABLE',
      evidence: {
        approvalDiagnostic: {
          status: 'TASK_REFERENCE_MISSING',
          publicationState: 'PENDING_APPROVAL',
        },
      },
    });
	    expect(status.capability?.dependencyGraph?.nodes[1]).toMatchObject({
	      id: 'RUNTIME:wcmsStaged',
	      evidence: {
	        runtimeDiagnostic: {
	          phase: 'transport',
	          targetRuntimeRole: 'WCMS_STAGED',
	        },
	      },
	    });
    expect(status.capability?.publicationSummary?.runtime).toBe('UNAVAILABLE');
    expect(status.capability?.publicationSummary?.approval).toBe(
      'TASK_REFERENCE_MISSING',
    );
    expect(status.capability?.approvalDiagnostic).toMatchObject({
      status: 'TASK_REFERENCE_MISSING',
      publicationState: 'PENDING_APPROVAL',
    });
    expect(status.capability?.blockers[0]?.blockerCode).toBe(
      'RUNTIME_UNAVAILABLE',
    );
    expect(status.capability?.blockers[0]?.ownerType).toBe('DATA_RELEASE');
    expect(status.capability?.blockers[0]?.disabledReason).toContain(
      'No active runtime',
    );
    expect(status.capability?.blockers[0]?.runtimeDiagnostic).toMatchObject({
      phase: 'transport',
      sourceServer: 'platformServer',
      targetModule: 'import',
      targetRuntimeRole: 'WCMS_STAGED',
      failureCode: 'ETIMEDOUT',
    });
    expect(status.capability?.blockers[0]?.approvalDiagnostic).toMatchObject({
      status: 'TASK_REFERENCE_MISSING',
      publicationState: 'PENDING_APPROVAL',
    });
  });
});
