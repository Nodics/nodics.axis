import { describe, expect, it, vi } from 'vitest';

import {
  initiateAxisInitialization,
  loadAxisInitializationStatus,
} from '../../src/initialization/axisInitializationClient';

const status = {
  code: 'SUC_BOF_00017',
  data: {
    baselineCode: 'axis',
    releaseCode: 'axis:axisBaseline',
    releaseVersion: '0.0.0',
    releaseStatus: 'CURRENT',
    readiness: 'PUBLICATION_PENDING',
    publication: {
      code: 'cmsBaseline_axis_1_0_0',
      state: 'PENDING_APPROVAL',
      revision: 2,
      workflowRef: 'workflow-1',
    },
    review: {
      title: 'Publish Axis',
      summary: 'Review Axis.',
      sourceRole: 'WCMS_STAGED',
      targetRole: 'WCMS_ONLINE',
      siteCode: 'axisCmsSite',
      catalogCode: 'axisContentCatalog',
      impactMessage: 'Axis becomes Online.',
      rollbackMessage: 'Restore the previous release when available.',
      releaseChecksum: 'checksum-1',
      publicationCode: 'cmsBaseline_axis_1_0_0',
      workflowRef: 'workflow-1',
      tenant: 'default',
      validation: { status: 'PASSED', warnings: [] },
      entities: [
        {
          type: 'page',
          label: 'Pages',
          total: 10,
          added: 10,
          updated: 0,
          unchanged: 0,
          removed: 0,
        },
      ],
      postPublicationCapabilities: [
        { title: 'Open Axis', description: 'Use the managed workspace.' },
      ],
    },
  },
};

describe('Axis initialization client', () => {
  it('reads readiness only from the secured Platform endpoint', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(status), { status: 200 }));
    const result = await loadAxisInitializationStatus(
      'http://platform.local',
      'employee-token',
      1_000,
      fetchImplementation,
    );
    expect(result.readiness).toBe('PUBLICATION_PENDING');
    expect(result.review?.releaseChecksum).toBe('checksum-1');
    expect(result.review?.entities[0]?.added).toBe(10);
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(
      url instanceof URL ? url.href : typeof url === 'string' ? url : url?.url,
    ).toBe('http://platform.local/nodics/backoffice/v0/axis/initialization');
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit' });
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer employee-token',
    );
  });

  it('initiates through Platform without accepting a release, runtime, or approval choice', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(status), { status: 200 }));
    await initiateAxisInitialization(
      'http://platform.local',
      'employee-token',
      1_000,
      fetchImplementation,
    );
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(
      url instanceof URL ? url.href : typeof url === 'string' ? url : url?.url,
    ).toBe('http://platform.local/nodics/backoffice/v0/axis/initialization/initiate');
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toEqual({
      reason: 'Initialize the Axis CMS baseline',
    });
  });

  it('fails closed on an unknown readiness state', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...status,
          data: { ...status.data, readiness: 'AUTO_APPROVED' },
        }),
        { status: 200 },
      ),
    );
    await expect(
      loadAxisInitializationStatus(
        'http://platform.local',
        'employee-token',
        1_000,
        fetchImplementation,
      ),
    ).rejects.toThrow('incompatible');
  });
});
