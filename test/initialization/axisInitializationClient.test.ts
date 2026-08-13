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
    releaseVersion: '1.0.0',
    releaseStatus: 'CURRENT',
    readiness: 'PUBLICATION_PENDING',
    publication: {
      code: 'cmsBaseline_axis_1_0_0',
      state: 'PENDING_APPROVAL',
      revision: 2,
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
