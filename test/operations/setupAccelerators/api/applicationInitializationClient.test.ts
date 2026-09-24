import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplicationInitializationClient } from '../../../../src/operations/setupAccelerators/api/applicationInitializationClient';

const connection = {
  moduleName: 'backoffice',
  instanceId: 'platformServer/backoffice',
  endpoint: 'http://localhost:3000/nodics/backoffice',
  environment: 'kickoffLocal',
  state: 'UP' as const,
};

function hangingFetch(): typeof fetch {
  return vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    const signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  });
}

describe('application initialization client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives setup status checks enough time for backend aggregation', async () => {
    vi.useFakeTimers();
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      hangingFetch(),
    );

    const request = client.getStatus();

    await vi.advanceTimersByTimeAsync(59_999);
    await expect(
      Promise.race([request, Promise.resolve('still waiting')]),
    ).resolves.toBe('still waiting');

    await vi.advanceTimersByTimeAsync(1);
    await expect(request).rejects.toThrow(
      'Setup status is taking longer than expected. Refresh status in a moment to continue from the latest backend state.',
    );
  });

  it('allows managed initialization operations to outlive the standard UI timeout', async () => {
    vi.useFakeTimers();
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'frameworkdocs',
      },
      hangingFetch(),
    );

    const request = client.initiate();

    await vi.advanceTimersByTimeAsync(179_999);
    await expect(
      Promise.race([request, Promise.resolve('still waiting')]),
    ).resolves.toBe('still waiting');

    await vi.advanceTimersByTimeAsync(1);
    await expect(request).rejects.toThrow(
      'Application initialization is still running. Refresh status in a moment to continue from the latest backend state.',
    );
  });

  it('calls the governed prepare-only operation for capability preparation', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SUC_BOF_00021',
          data: {
            profileCode: 'agoraapparel',
            type: 'STOREFRONT_DOMAIN_BUNDLE',
            owner: 'agora.apparel',
            applicationCode: 'agora',
            siteCode: 'agoraApparelSite',
            readiness: 'IMPORTED',
            releaseCode: 'agora.apparel:agoraApparelContentCatalog',
            releaseVersion: '0.0.8',
            allowedActions: ['INITIALIZE'],
            preparationOperation: {
              operation: 'applicationInitialization.prepareCapability',
              capabilityCode: 'agoraapparel',
              beforeStatus: 'UPDATE_AVAILABLE',
              afterStatus: 'CURRENT',
              attempted: true,
              stepCount: 2,
              changed: true,
            },
            repair: {
              action: 'RECONCILE_APPROVAL_TASK',
              status: 'NEEDS_PROCESS_REVIEW',
              idempotent: true,
              previousWorkflowRef: 'workflow-before',
              message:
                'Publication approval could not be reconciled automatically.',
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'agoraapparel',
      },
      fetchImplementation,
    );

    const status = await client.prepare({ reason: 'Prepare setup only' });

    const [url, init] = fetchImplementation.mock.calls[0]!;
    expect((url as URL).pathname).toBe(
      '/nodics/backoffice/v0/applications/agoraapparel/initialization/prepare',
    );
    expect(init?.method).toBe('POST');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toMatchObject({
      reason: 'Prepare setup only',
    });
    expect(status.preparationOperation).toMatchObject({
      operation: 'applicationInitialization.prepareCapability',
      beforeStatus: 'UPDATE_AVAILABLE',
      afterStatus: 'CURRENT',
      attempted: true,
      changed: true,
    });
    expect(status.repair).toMatchObject({
      action: 'RECONCILE_APPROVAL_TASK',
      status: 'NEEDS_PROCESS_REVIEW',
      previousWorkflowRef: 'workflow-before',
    });
  });

  it('parses backend-owned capability readiness projection', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'SUC_BOF_00021',
          data: {
            profileCode: 'agoraapparel',
            type: 'STOREFRONT_DOMAIN_BUNDLE',
            owner: 'agora.apparel',
            applicationCode: 'agora',
            siteCode: 'agoraApparelSite',
            readiness: 'BLOCKED',
            releaseCode: 'agora.apparel:agoraApparelContentCatalog',
            releaseVersion: '0.0.8',
            allowedActions: [],
            capability: {
              subject: {
                type: 'APPLICATION_CAPABILITY',
                code: 'agoraapparel',
                owner: 'agora.apparel',
                applicationCode: 'agora',
                siteCode: 'agoraApparelSite',
              },
              status: 'NEEDS_ATTENTION',
              capabilityCode: 'agoraapparel',
              displayName: 'Agora Apparel',
              owningModule: 'agora.apparel',
              capabilityType: 'ACCELERATOR',
              group: 'PROJECT_ACCELERATOR',
              businessStatus: 'NEEDS_ATTENTION',
              technicalStatus: 'BLOCKED',
              releaseStatus: 'PREPARATION_BLOCKED',
              lastEvaluatedAt: '2026-09-23T10:00:00.000Z',
              source: 'backoffice.applicationInitialization',
              stale: false,
              dependencies: [
                {
                  kind: 'MODULE',
                  code: 'nodics.commerce',
	                  label: 'Commerce',
	                  required: true,
	                  classification: 'FUNCTIONAL_MODULE',
	                  status: 'NOT_STARTED',
	                  evidence: {
	                    classification: 'FUNCTIONAL_MODULE',
	                    runtimeState: 'OFFLINE',
	                    registrationState: 'REGISTERED',
	                    observedServers: [],
	                    runtimeEvidence: {
	                      source: 'FUNCTIONAL_MODULE_CATALOGUE',
	                      status: 'OFFLINE',
	                      registrationState: 'REGISTERED',
	                      enabled: true,
	                      stale: true,
	                      observedServers: [],
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
                    id: 'agoraapparel',
                    kind: 'CAPABILITY',
                    label: 'Agora Apparel',
                  },
                  {
                    id: 'MODULE:nodics.commerce',
	                    kind: 'MODULE',
	                    label: 'Commerce',
	                    status: 'NOT_STARTED',
	                    evidence: {
	                      runtimeEvidence: {
	                        source: 'FUNCTIONAL_MODULE_CATALOGUE',
	                        status: 'OFFLINE',
	                        stale: true,
	                      },
	                    },
	                  },
	                ],
                edges: [
                  {
                    from: 'MODULE:nodics.commerce',
                    to: 'agoraapparel',
                    relationship: 'REQUIRED_FOR',
                  },
                ],
              },
              publicationSummary: {
                installed: 'BLOCKED',
                staged: 'PREPARATION_BLOCKED',
                approval: 'TASK_REFERENCE_MISSING',
                online: 'NOT_ONLINE',
                runtime: 'NEEDS_ATTENTION',
                media: 'READY_OR_NOT_REQUIRED',
              },
              approvalDiagnostic: {
                source: 'PUBLICATION_APPROVAL',
                status: 'TASK_REFERENCE_MISSING',
                publicationState: 'PENDING_APPROVAL',
                suggestedAction: 'Reconcile publication approval.',
              },
              disabledReason: 'A required framework capability is not ready.',
              nextAction: 'Prepare required dependency',
              blockers: [
                {
                  blockerCode: 'MISSING_DEPENDENCY',
                  code: 'MISSING_DEPENDENCY',
                  severity: 'BLOCKED',
                  owner: 'nodics.commerce',
                  ownerType: 'MODULE_REGISTRY',
                  source: 'MODULE_REGISTRY',
                  message: 'Commerce must be registered and activated.',
                  action: 'Prepare required dependency',
                  disabledReason: 'A required framework capability is not ready.',
                  targetServer: 'platform',
                  targetRuntimeRole: 'PLATFORM',
                  technicalStatus: 'NOT_REGISTERED',
                  runtimeDiagnostic: {
                    phase: 'runtimeResolution',
                    sourceServer: 'platformServer',
                    sourceRuntimeRole: 'PLATFORM',
                    targetModule: 'import',
                    targetServer: 'commerceStagedServer',
                    targetRuntimeRole: 'COMMERCE_STAGED',
                    failureCode: 'REMOTE_ENDPOINT_UNAVAILABLE',
                    suggestedAction: 'Start commerceStagedServer.',
                  },
                  approvalDiagnostic: {
                    source: 'PUBLICATION_APPROVAL',
                    status: 'TASK_REFERENCE_MISSING',
                    publicationState: 'PENDING_APPROVAL',
                  },
                  repair: {
                    available: false,
                    label: 'Prepare required dependency',
                    operation: 'moduleRegistry.prepareDependency',
                    action: 'PREPARE_DEPENDENCY',
                    idempotent: true,
                    requiresConfirmation: true,
                    owner: 'nodics.commerce',
                    eligibility: 'NOT_AVAILABLE',
                    unavailableReason:
                      'The owning module authority must perform this repair.',
                  },
                },
              ],
              repairActions: [
                {
                  available: false,
                  label: 'Prepare required dependency',
                  operation: 'moduleRegistry.prepareDependency',
                  action: 'PREPARE_DEPENDENCY',
                  idempotent: true,
                  requiresConfirmation: true,
                  eligibility: 'NOT_AVAILABLE',
                },
              ],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1_000,
        profileCode: 'agoraapparel',
      },
      fetchImplementation,
    );

    const status = await client.getStatus();

    expect(status.capability?.businessStatus).toBe('NEEDS_ATTENTION');
    expect(status.capability?.subject?.owner).toBe('agora.apparel');
    expect(status.capability?.status).toBe('NEEDS_ATTENTION');
    expect(status.capability?.source).toBe(
      'backoffice.applicationInitialization',
    );
    expect(status.capability?.stale).toBe(false);
	    expect(status.capability?.dependencies?.[0]).toMatchObject({
	      kind: 'MODULE',
	      code: 'nodics.commerce',
	      status: 'NOT_STARTED',
	      classification: 'FUNCTIONAL_MODULE',
	      evidence: {
	        classification: 'FUNCTIONAL_MODULE',
	        runtimeState: 'OFFLINE',
	        runtimeEvidence: {
	          source: 'FUNCTIONAL_MODULE_CATALOGUE',
	          stale: true,
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
	    expect(status.capability?.dependencyGraph?.nodes[1]?.evidence).toMatchObject({
	      runtimeEvidence: {
	        source: 'FUNCTIONAL_MODULE_CATALOGUE',
	        status: 'OFFLINE',
	      },
	    });
    expect(status.capability?.dependencyGraph?.edges[0]).toMatchObject({
      relationship: 'REQUIRED_FOR',
    });
    expect(status.capability?.publicationSummary?.runtime).toBe('NEEDS_ATTENTION');
    expect(status.capability?.publicationSummary?.approval).toBe(
      'TASK_REFERENCE_MISSING',
    );
    expect(status.capability?.approvalDiagnostic).toMatchObject({
      status: 'TASK_REFERENCE_MISSING',
      publicationState: 'PENDING_APPROVAL',
    });
    expect(status.capability?.disabledReason).toContain('required framework');
    expect(status.capability?.blockers[0]?.code).toBe('MISSING_DEPENDENCY');
    expect(status.capability?.blockers[0]?.blockerCode).toBe('MISSING_DEPENDENCY');
    expect(status.capability?.blockers[0]?.severity).toBe('BLOCKED');
    expect(status.capability?.blockers[0]?.ownerType).toBe('MODULE_REGISTRY');
    expect(status.capability?.blockers[0]?.source).toBe('MODULE_REGISTRY');
    expect(status.capability?.blockers[0]?.disabledReason).toContain(
      'required framework',
    );
    expect(status.capability?.blockers[0]?.repair?.operation).toBe(
      'moduleRegistry.prepareDependency',
    );
    expect(status.capability?.blockers[0]?.repair?.eligibility).toBe(
      'NOT_AVAILABLE',
    );
    expect(status.capability?.repairActions?.[0]?.action).toBe(
      'PREPARE_DEPENDENCY',
    );
    expect(status.capability?.blockers[0]?.runtimeDiagnostic).toMatchObject({
      phase: 'runtimeResolution',
      sourceServer: 'platformServer',
      targetModule: 'import',
      targetRuntimeRole: 'COMMERCE_STAGED',
      failureCode: 'REMOTE_ENDPOINT_UNAVAILABLE',
    });
    expect(status.capability?.blockers[0]?.approvalDiagnostic).toMatchObject({
      status: 'TASK_REFERENCE_MISSING',
      publicationState: 'PENDING_APPROVAL',
    });
    expect(status.capability?.nextAction).toBe('Prepare required dependency');
  });
});
