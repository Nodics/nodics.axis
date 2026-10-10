import { describe, expect, it, vi } from 'vitest';
import { coordinatePublicationAssets } from '../../../src/operations/readiness/coordinatePublicationAssets';
import { requestMediaPublication } from '../../../src/operations/mediaManagement/api/mediaPublicationClient';
import type { AxisModuleConnection } from '../../../src/bootstrap/publicBootstrap';
import type { MediaPublicationDependency } from '../../../src/operations/readiness/mediaPublicationHandoff';

const dependency = {
  mediaCode: 'hero',
  versionId: 4,
  checksum: 'a'.repeat(64),
  publicationCode: 'cmsMedia_' + 'b'.repeat(64),
  status: 'NOT_ACTIVATED',
  qualified: false,
};
const connection: AxisModuleConnection = {
  moduleName: 'media',
  instanceId: 'staged',
  endpoint: 'https://fixture.test/nodics/media',
  environment: 'fixture',
  state: 'UP',
  runtimeRole: { code: 'WCMS_STAGED', publication: 'STAGED' },
};
const configuration = { accessToken: 'fixture', enterpriseCode: 'one', timeoutMs: 500 };

describe('explicit pack asset coordination', () => {
  it('requests every missing exact asset and uses normal Process decisions, skipping active assets', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ state: 'PENDING_APPROVAL', workflowRef: 'workflow-one' });
    const decide = vi.fn().mockResolvedValue(undefined);
    await coordinatePublicationAssets(
      [dependency, { ...dependency, mediaCode: 'active', qualified: true }],
      request,
      decide,
    );
    expect(request).toHaveBeenCalledExactlyOnceWith({
      publicationCode: dependency.publicationCode,
      mediaCode: 'hero',
      versionId: 4,
      expectedChecksum: dependency.checksum,
    });
    expect(decide).toHaveBeenCalledExactlyOnceWith('workflow-one');
  });
  it.each([
    { versionId: undefined },
    { checksum: undefined },
    { checksum: 'wrong' },
    { publicationCode: 'injected' },
  ])('validates the entire pack before any command: %j', async (patch) => {
    const request = vi.fn();
    await expect(
      coordinatePublicationAssets(
        [
          dependency,
          {
            ...dependency,
            mediaCode: 'other',
            ...patch,
          } as unknown as MediaPublicationDependency,
        ],
        request,
        vi.fn(),
      ),
    ).rejects.toThrow('exact version');
    expect(request).not.toHaveBeenCalled();
  });
  it('rejects duplicate identities and oversized selections', async () => {
    const request = vi.fn();
    await expect(
      coordinatePublicationAssets([dependency, dependency], request, vi.fn()),
    ).rejects.toThrow('boundary');
    await expect(
      coordinatePublicationAssets(
        Array.from({ length: 101 }, (_, i) => ({
          ...dependency,
          mediaCode: `asset${i}`,
        })),
        request,
        vi.fn(),
      ),
    ).rejects.toThrow('boundary');
    expect(request).not.toHaveBeenCalled();
  });
  it('stops on a denied decision without retrying or publishing later assets', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ state: 'PENDING_APPROVAL', workflowRef: 'workflow-one' });
    const decide = vi.fn().mockRejectedValue(new Error('HTTP 403'));
    await expect(
      coordinatePublicationAssets(
        [dependency, { ...dependency, mediaCode: 'later' }],
        request,
        decide,
      ),
    ).rejects.toThrow('403');
    expect(request).toHaveBeenCalledTimes(1);
    expect(decide).toHaveBeenCalledTimes(1);
  });
  it('does not reapprove completed workflows on an explicit resume', async () => {
    const request = vi.fn().mockResolvedValue({ state: 'ONLINE' });
    const decide = vi.fn();
    await coordinatePublicationAssets([dependency], request, decide);
    expect(decide).not.toHaveBeenCalled();
  });
  it('rejects missing workflow evidence and failed publications', async () => {
    for (const result of [{ state: 'PENDING_APPROVAL' }, { state: 'FAILED' }]) {
      const decide = vi.fn();
      await expect(
        coordinatePublicationAssets(
          [dependency],
          vi.fn().mockResolvedValue(result),
          decide,
        ),
      ).rejects.toThrow();
      expect(decide).not.toHaveBeenCalled();
    }
  });
});

describe('native Media publication client', () => {
  const input = {
    mediaCode: dependency.mediaCode,
    versionId: dependency.versionId,
    publicationCode: dependency.publicationCode,
    expectedChecksum: dependency.checksum,
  };
  const response = {
    ...input,
    state: 'PENDING_APPROVAL',
    revision: 3,
    approvalRequired: true,
    workflowRef: 'publicationApproval-' + 'c'.repeat(64),
  };
  it('sends the employee token to the fixed owner API and returns only approval evidence', async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ result: response })));
    const result = await requestMediaPublication(
      connection,
      configuration,
      input,
      transport,
    );
    expect(String(transport.mock.calls[0]![0])).toBe(
      'https://fixture.test/nodics/media/v0/publication/requests',
    );
    expect(transport.mock.calls[0]![1]).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: 'Bearer fixture', 'x-enterprise-code': 'one' },
      body: JSON.stringify(input),
    });
    expect(result).toEqual({
      state: 'PENDING_APPROVAL',
      workflowRef: response.workflowRef,
    });
  });
  it('rejects Online selection before sending credentials and never retries denial', async () => {
    const transport = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
    await expect(
      requestMediaPublication(
        { ...connection, runtimeRole: { code: 'ONLINE', publication: 'ONLINE' } },
        configuration,
        input,
        transport,
      ),
    ).rejects.toThrow('Staged');
    expect(transport).not.toHaveBeenCalled();
    await expect(
      requestMediaPublication(connection, configuration, input, transport),
    ).rejects.toThrow('403');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    { mediaCode: 'other' },
    { versionId: 5 },
    { workflowRef: '//outside.test' },
    { approvalRequired: false },
    { state: 'FAILED' },
  ])('rejects incompatible acknowledgement: %j', async (patch) => {
    await expect(
      requestMediaPublication(
        connection,
        configuration,
        input,
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ result: { ...response, ...patch } })),
          ),
      ),
    ).rejects.toThrow('acknowledgement');
  });
});
