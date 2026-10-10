import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApplicationReadinessThrottleError,
  createApplicationInitializationClient,
} from '../../../../src/operations/setupAccelerators/api/applicationInitializationClient';

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
  const operatorStep = {
    order: 10,
    type: 'DATA_RELEASE',
    code: 'partner:issuerBudget',
    kind: 'Issuer budget',
    required: true,
    trigger: 'ACTIVATION',
    phase: 'AFTER_PUBLICATION',
    operatorEnterpriseCode: 'issuer',
    dataType: 'core',
    targetServer: 'commerceStagedServer',
    targetRuntimeRole: 'COMMERCE_STAGED',
    status: 'NOT_INSTALLED',
  };
  const foreignStep = {
    ...operatorStep,
    code: 'merchant:issuance',
    operatorEnterpriseCode: 'merchant',
    status: 'AUTHORITY_PENDING',
  };
  function operatorClient(
    preparation: unknown = {
      status: 'BLOCKED',
      selectionRequired: true,
      selectableStepCodes: [operatorStep.code],
      steps: [operatorStep, foreignStep],
    },
  ) {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            result: {
              profileCode: 'circa',
              type: 'CMS_SITE',
              owner: 'cms',
              applicationCode: 'circa',
              siteCode: 'circaSite',
              readiness: 'BLOCKED',
              releaseCode: 'circa:content',
              releaseVersion: '0.0.1',
              allowedActions: ['INITIALIZE'],
              preparation,
            },
          }),
          { status: 200 },
        ),
      ),
    );
    return {
      fetcher,
      client: createApplicationInitializationClient(
        {
          connection,
          enterpriseCode: 'issuer',
          accessToken: 'fixture-access',
          timeoutMs: 1000,
          profileCode: 'circa',
        },
        fetcher,
      ),
    };
  }

  it('retains required operator stages and only owner-projected choices without foreign proof', async () => {
    const { client } = operatorClient();
    const status = await client.getStatus();
    expect(status.readiness).toBe('BLOCKED');
    expect(status.preparation).toMatchObject({
      selectionRequired: true,
      selectableStepCodes: [operatorStep.code],
      steps: [operatorStep, foreignStep],
    });
    expect(Object.isFrozen(status.preparation?.selectableStepCodes)).toBe(true);
  });

  it('accepts scoped pre-AFTER owner gates and sends Initialize and Prepare without a selector', async () => {
    const preparation = {
      status: 'ACTION_REQUIRED',
      selectionRequired: false,
      selectableStepCodes: [],
      steps: [
        {
          ...operatorStep,
          code: 'circa:profile',
          phase: 'BEFORE_PUBLICATION',
          operatorEnterpriseCode: undefined,
        },
        { ...operatorStep, status: 'DEFERRED' },
        foreignStep,
      ],
    };
    const { client, fetcher } = operatorClient(preparation);
    const status = await client.getStatus();
    expect(status.preparation).toMatchObject({
      status: 'ACTION_REQUIRED',
      selectionRequired: false,
      selectableStepCodes: [],
      steps: [
        { code: 'circa:profile', phase: 'BEFORE_PUBLICATION' },
        { code: operatorStep.code, status: 'DEFERRED' },
        foreignStep,
      ],
    });
    await client.initiate();
    await client.prepare({ reason: 'Prepare BEFORE only' });
    const posts = fetcher.mock.calls.filter(
      ([, request]) => request?.method === 'POST',
    );
    expect(posts.map(([url]) => (url as URL).pathname)).toEqual([
      '/nodics/backoffice/v0/applications/circa/initialization/initiate',
      '/nodics/backoffice/v0/applications/circa/initialization/prepare',
    ]);
    for (const [, request] of posts) {
      const body = request?.body;
      expect(JSON.parse(typeof body === 'string' ? body : '{}')).not.toHaveProperty(
        'afterPublicationStepCode',
      );
    }
  });

  it('sends exactly one explicit selector only to initiate, preserving signed transport context', async () => {
    const { client, fetcher } = operatorClient();
    const input = {
      afterPublicationStepCode: operatorStep.code,
      reason: 'Reviewed issuer budget',
      enterpriseCode: 'merchant',
      publicationPlan: { untrusted: true },
      qualified: true,
    };
    await client.initiate(input);
    const [url, request] = fetcher.mock.calls[0]!;
    expect((url as URL).pathname).toBe(
      '/nodics/backoffice/v0/applications/circa/initialization/initiate',
    );
    expect(request?.method).toBe('POST');
    expect(JSON.parse(typeof request?.body === 'string' ? request.body : '{}')).toEqual(
      {
        afterPublicationStepCode: operatorStep.code,
        reason: input.reason,
      },
    );
    expect(request?.headers).toMatchObject({
      'x-enterprise-code': 'issuer',
      Authorization: 'Bearer fixture-access',
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps legacy initialization unselected and ordinary operations selector-free', async () => {
    const { client, fetcher } = operatorClient(undefined);
    await client.initiate();
    await client.prepare();
    await client.reconcileApproval();
    await client.rollback();
    await client.retire();
    for (const [, request] of fetcher.mock.calls)
      expect(
        JSON.parse(typeof request?.body === 'string' ? request.body : '{}'),
      ).not.toHaveProperty('afterPublicationStepCode');
  });

  it.each([
    '',
    'no-release-separator',
    ['partner:issuerBudget'],
    { code: 'partner:issuerBudget' },
  ])('rejects malformed selector before transport: %j', async (selector) => {
    const { client, fetcher } = operatorClient();
    await expect(
      client.initiate({ afterPublicationStepCode: selector as string }),
    ).rejects.toThrow(/selection is invalid/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['prepare', 'reconcileApproval', 'rollback', 'retire'] as const)(
    'rejects selection on %s before transport',
    async (operation) => {
      const { client, fetcher } = operatorClient();
      const input = { reason: 'fixture', afterPublicationStepCode: operatorStep.code };
      await expect(client[operation](input)).rejects.toThrow(/selection is invalid/);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([
    { selectableStepCodes: 'partner:issuerBudget' },
    { selectableStepCodes: ['missing:stage'] },
    { selectableStepCodes: [foreignStep.code] },
    { selectableStepCodes: [operatorStep.code, operatorStep.code] },
    { selectableStepCodes: Array.from({ length: 257 }, (_, i) => `partner:stage${i}`) },
    { selectableStepCodes: undefined },
    { selectionRequired: 'true' },
    { selectionRequired: false },
    { steps: [operatorStep, operatorStep, foreignStep] },
    { steps: [{ ...operatorStep, required: false }] },
    { steps: [{ ...operatorStep, phase: 'BEFORE_PUBLICATION' }] },
    { steps: [{ ...operatorStep, operatorEnterpriseCode: undefined }] },
  ])('rejects incompatible stage choices: %j', async (override) => {
    const { client } = operatorClient({
      status: 'BLOCKED',
      selectionRequired: true,
      selectableStepCodes: [operatorStep.code],
      steps: [operatorStep, foreignStep],
      ...override,
    });
    await expect(client.getStatus()).rejects.toThrow(/stage selection is incompatible/);
  });

  const asset = {
    owner: 'media',
    mediaCode: 'apparel-image',
    versionId: 4,
    checksum: 'c'.repeat(64),
    publicationCode: `cmsMedia_${'a'.repeat(64)}`,
    status: 'NOT_ACTIVATED',
    qualified: false,
    publicationRequest: { method: 'POST', path: '/untrusted-command' },
  };
  function mediaStatus(mediaDependencies: unknown) {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            profileCode: 'agoraapparel',
            type: 'CMS_SITE',
            owner: 'cms',
            applicationCode: 'agora.apparel',
            siteCode: 'apparelSite',
            readiness: 'MEDIA_DEPENDENCIES_PENDING',
            releaseCode: 'apparel:content',
            releaseVersion: '1.0.0',
            allowedActions: [],
            mediaDependencies,
          },
        }),
        { status: 200 },
      ),
    );
    return createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'fixture-access',
        timeoutMs: 1000,
        profileCode: 'agoraapparel',
      },
      fetcher,
    ).getStatus();
  }

  it('retains bounded owner Media identities and pins without projecting command URLs', async () => {
    const status = await mediaStatus({
      owner: 'media',
      contractVersion: 1,
      qualified: false,
      dependencies: [asset],
    });
    expect(status.readiness).toBe('MEDIA_DEPENDENCIES_PENDING');
    expect(status.mediaDependencies).toEqual({
      qualified: false,
      dependencies: [
        {
          mediaCode: asset.mediaCode,
          versionId: 4,
          checksum: asset.checksum,
          publicationCode: asset.publicationCode,
          status: 'NOT_ACTIVATED',
          qualified: false,
        },
      ],
    });
    expect(Object.isFrozen(status.mediaDependencies?.dependencies)).toBe(true);
  });

  it.each([
    { owner: 'cms' },
    { contractVersion: 2 },
    { qualified: 'false' },
    { dependencies: null },
    { dependencies: Array.from({ length: 101 }, () => asset) },
    { dependencies: [undefined] },
    { dependencies: [{ ...asset, checksum: 'invalid' }] },
    { dependencies: [{ ...asset, versionId: -1 }] },
  ])('rejects incompatible owner Media evidence %j', async (override) => {
    await expect(
      mediaStatus({
        owner: 'media',
        contractVersion: 1,
        qualified: false,
        dependencies: [asset],
        ...override,
      }),
    ).rejects.toThrow(/Media dependenc/);
  });

  it.each(['circa', 'agoraapparel', 'agoraelectronics', 'agorahome'])(
    'composes the owner unavailable prerequisite diagnostic for %s without fabricating a command',
    async (profileCode) => {
      // Mirrors capabilityRepairProjection(READINESS_VALIDATION_BLOCKED) and its
      // blocker/repairActions composition; JSON transport omits undefined fields.
      const repair = {
        available: false,
        label: 'Review setup prerequisites',
        action: 'REVIEW_SETUP_PREREQUISITES',
        idempotent: true,
        requiresConfirmation: false,
        owner: 'circa.ewaste:profile',
        targetServer: 'platformServer',
        targetRuntimeRole: 'PLATFORM',
        eligibility: 'NOT_AVAILABLE',
        unavailableReason:
          'The owning module, source release, runtime, or workflow authority must perform this repair.',
      };
      // Captured Circa response uses these three blocked owner releases. Other
      // envelope identities exercise the shared parser, not claimed live data.
      const repairs = ['profile', 'addresses', 'operations'].map((release) => ({
        ...repair,
        owner: `circa.ewaste:${release}`,
      }));
      const payload = {
        profileCode,
        type: 'CMS_SITE',
        owner: 'cms',
        applicationCode: profileCode,
        siteCode: `${profileCode}Site`,
        readiness: 'BLOCKED',
        releaseCode: `${profileCode}:content`,
        releaseVersion: '1.0.0',
        allowedActions: [],
        capability: {
          capabilityCode: profileCode,
          displayName: profileCode,
          owningModule: 'cms',
          capabilityType: 'APPLICATION',
          group: 'PROJECT',
          businessStatus: 'NEEDS_ATTENTION',
          technicalStatus: 'BLOCKED',
          nextAction: 'Review setup prerequisites',
          repairActions: repairs,
          blockers: repairs.map((repair) => ({
            blockerCode: 'READINESS_VALIDATION_BLOCKED',
            code: 'READINESS_VALIDATION_BLOCKED',
            severity: 'REPAIR_REQUIRED',
            owner: repair.owner,
            ownerType: 'DATA_RELEASE',
            source: 'DATA_RELEASE',
            message: 'The import owner refused the selected setup group.',
            action: 'Review setup prerequisites',
            technicalStatus: 'VALIDATION_BLOCKED',
            repair,
          })),
        },
      };
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: payload }), { status: 200 }),
        );
      const client = createApplicationInitializationClient(
        {
          connection,
          enterpriseCode: 'default',
          accessToken: 'fixture-access',
          timeoutMs: 1000,
          profileCode,
        },
        fetcher,
      );
      const status = await client.getStatus();
      expect(status.capability?.blockers.map((blocker) => blocker.repair)).toEqual(
        repairs.map((repair) => ({ ...repair, operation: '' })),
      );
      expect(status.capability?.repairActions).toEqual(
        repairs.map((repair) => ({ ...repair, operation: '' })),
      );
      expect(status.allowedActions).toEqual([]);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
    },
  );

  it.each([
    { available: true },
    { available: undefined },
    { available: 'false' },
    { available: false, operation: '' },
    { available: false, operation: null },
    { available: false, action: '' },
  ])('rejects malformed or enabled operation-less repairs %j', async (override) => {
    const repair = Object.assign(
      {},
      {
        available: false,
        label: 'Review setup prerequisites',
        action: 'REVIEW_SETUP_PREREQUISITES',
      },
      override,
    );
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            profileCode: 'circa',
            type: 'CMS_SITE',
            owner: 'cms',
            applicationCode: 'circa',
            siteCode: 'circaSite',
            readiness: 'BLOCKED',
            releaseCode: 'circa:content',
            releaseVersion: '1.0.0',
            allowedActions: [],
            capability: {
              capabilityCode: 'circa',
              displayName: 'Circa',
              owningModule: 'cms',
              capabilityType: 'APPLICATION',
              group: 'PROJECT',
              businessStatus: 'NEEDS_ATTENTION',
              technicalStatus: 'BLOCKED',
              nextAction: 'Review setup prerequisites',
              blockers: [
                {
                  code: 'READINESS_VALIDATION_BLOCKED',
                  severity: 'REPAIR_REQUIRED',
                  owner: 'selected-group',
                  message: 'Prerequisites held',
                  action: 'Review setup prerequisites',
                  repair,
                },
              ],
            },
          },
        }),
        { status: 200 },
      ),
    );
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'fixture-access',
        timeoutMs: 1000,
        profileCode: 'circa',
      },
      fetcher,
    );
    await expect(client.getStatus()).rejects.toThrow('Capability blocker repair');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([4, -1])(
    'projects only safe owner Media identity and validates pinned version %s',
    async (versionId) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              profileCode: 'nexus',
              type: 'CMS_SITE',
              owner: 'cms',
              applicationCode: 'nexus',
              siteCode: 'nexusSite',
              readiness: 'MEDIA_DEPENDENCIES_PENDING',
              releaseCode: 'nexus:content',
              releaseVersion: '1.0.0',
              allowedActions: [],
              capability: {
                capabilityCode: 'nexus',
                displayName: 'Nexus',
                owningModule: 'nexus',
                capabilityType: 'APPLICATION',
                group: 'PROJECT',
                businessStatus: 'NEEDS_ATTENTION',
                technicalStatus: 'BLOCKED',
                nextAction: 'Inspect Media',
                blockers: [
                  {
                    code: 'MEDIA_DEPENDENCY_NOT_ACTIVATED',
                    severity: 'REPAIR_REQUIRED',
                    owner: 'hero',
                    ownerType: 'MEDIA',
                    source: 'MEDIA_PUBLICATION',
                    message: 'Inspect Media',
                    action: 'Inspect Media',
                    mediaDependency: {
                      owner: 'media',
                      mediaCode: 'hero',
                      versionId,
                      status: 'NOT_ACTIVATED',
                      qualified: false,
                      checksum: 'not-for-rendering',
                      publicationRequest: { method: 'POST', input: {} },
                    },
                  },
                ],
              },
            },
          }),
          { status: 200 },
        ),
      );
      const client = createApplicationInitializationClient(
        {
          connection,
          enterpriseCode: 'default',
          accessToken: 'fixture-access',
          timeoutMs: 1000,
          profileCode: 'nexus',
        },
        fetcher,
      );
      if (versionId < 0)
        await expect(client.getStatus()).rejects.toThrow('Media dependency');
      else {
        const status = await client.getStatus();
        expect(status.capability?.blockers[0]?.mediaDependency).toEqual({
          mediaCode: 'hero',
          versionId: 4,
          status: 'NOT_ACTIVATED',
          qualified: false,
        });
        expect(JSON.stringify(status)).not.toContain('publicationRequest');
        expect(JSON.stringify(status)).not.toContain('not-for-rendering');
        expect(status.allowedActions).toEqual([]);
      }
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
    },
  );
  it('types only a throttled status GET and never retries or types a mutation as read recovery', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'Wait before refreshing' }), {
          status: 429,
          headers: { 'Retry-After': '60' },
        }),
      ),
    );
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'fixture-access',
        timeoutMs: 1_000,
        profileCode: 'nexus',
      },
      fetcher,
    );
    await expect(client.getStatus()).rejects.toBeInstanceOf(
      ApplicationReadinessThrottleError,
    );
    await expect(client.prepare()).rejects.not.toBeInstanceOf(
      ApplicationReadinessThrottleError,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([, options]) => options?.method)).toEqual([
      'GET',
      'POST',
    ]);
  });
  it.each([false, true])(
    'consumes bounded failed receipts, rejects automatic retry authority ($automaticRetry)',
    async (automaticRetry) => {
      const receipt = {
        releaseCode: 'commerce:sample',
        status: 'FAILED',
        version: '1.0.0',
        lastRunId: 'historical-run',
        rawError: { secret: 'discard' },
      };
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              profileCode: 'circa',
              type: 'CMS_SITE',
              owner: 'cms',
              applicationCode: 'circa',
              siteCode: 'circaSite',
              readiness: 'BLOCKED',
              releaseCode: 'cms:circa',
              releaseVersion: '1.0.0',
              allowedActions: [],
              preparation: {
                status: 'BLOCKED',
                steps: [],
                groupReceipts: [
                  {
                    targetServer: 'stagedServer',
                    targetRuntimeRole: 'WCMS_STAGED',
                    dataType: 'sample',
                    releaseCodes: ['commerce:sample'],
                    status: 'FAILED',
                    releases: [receipt],
                  },
                ],
                operationFailure: {
                  owner: 'import',
                  targetServer: 'stagedServer',
                  targetRuntimeRole: 'WCMS_STAGED',
                  dataType: 'sample',
                  releaseCodes: ['commerce:sample'],
                  failureCode: 'ERR_IMP_00004',
                  message: 'Review the owner receipt.',
                  automaticRetry,
                },
              },
            },
          }),
          { status: 200 },
        ),
      );
      const client = createApplicationInitializationClient(
        {
          connection,
          enterpriseCode: 'default',
          accessToken: 'employee-token',
          timeoutMs: 1000,
          profileCode: 'circa',
        },
        fetcher,
      );
      if (automaticRetry)
        await expect(client.getStatus()).rejects.toThrow(
          'Application import failure is incompatible',
        );
      else {
        const status = await client.getStatus();
        expect(status.preparation?.operationFailure?.automaticRetry).toBe(false);
        expect(status.preparation?.groupReceipts?.[0]?.releases[0]).toEqual({
          releaseCode: 'commerce:sample',
          status: 'FAILED',
          version: '1.0.0',
          lastRunId: 'historical-run',
        });
        expect(JSON.stringify(status)).not.toContain('secret');
      }
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts owner Media dependency readiness without adding initialization authority', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            profileCode: 'nexus',
            type: 'CMS_SITE',
            owner: 'cms',
            applicationCode: 'nexus',
            siteCode: 'nexusSite',
            readiness: 'MEDIA_DEPENDENCIES_PENDING',
            releaseCode: 'cms:nexus',
            releaseVersion: '1.0.0',
            allowedActions: [],
            publication: { code: 'nexus-publication', state: 'ONLINE', revision: 1 },
          },
        }),
        { status: 200 },
      ),
    );
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 1000,
        profileCode: 'nexus',
      },
      fetchImplementation,
    );
    const status = await client.getStatus();
    expect(status.readiness).toBe('MEDIA_DEPENDENCIES_PENDING');
    expect(status.allowedActions).toEqual([]);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation.mock.calls[0]?.[1]?.method).toBe('GET');
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

  it('honors a configured six-minute initialization timeout without replaying the mutation', async () => {
    vi.useFakeTimers();
    const fetchImplementation = hangingFetch();
    const client = createApplicationInitializationClient(
      {
        connection,
        enterpriseCode: 'default',
        accessToken: 'employee-token',
        timeoutMs: 360_000,
        profileCode: 'frameworkdocs',
      },
      fetchImplementation,
    );
    const request = client.initiate();
    const failure = expect(request).rejects.toThrow(
      'Application initialization is still running. Refresh status in a moment to continue from the latest backend state.',
    );

    await vi.advanceTimersByTimeAsync(359_999);
    await expect(
      Promise.race([request, Promise.resolve('still waiting')]),
    ).resolves.toBe('still waiting');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ method: 'POST' }),
    );

    await vi.advanceTimersByTimeAsync(1);
    await failure;
    await vi.advanceTimersByTimeAsync(360_000);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
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
              message: 'Publication approval could not be reconciled automatically.',
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
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toMatchObject(
      {
        reason: 'Prepare setup only',
      },
    );
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
    expect(status.capability?.source).toBe('backoffice.applicationInitialization');
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
    expect(status.capability?.blockers[0]?.repair?.eligibility).toBe('NOT_AVAILABLE');
    expect(status.capability?.repairActions?.[0]?.action).toBe('PREPARE_DEPENDENCY');
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
