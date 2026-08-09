import { describe, expect, it } from 'vitest';

import {
  mediaLifecycleActionPolicies,
  mediaLifecycleStatusTone,
  normalizeMediaLifecycleStatus,
} from '../../../src/operations/mediaManagement/mediaLifecyclePolicy';

function actionPolicy(
  status: string,
  options: { activeUsageCount?: number; canUpdate?: boolean; pending?: boolean } = {},
) {
  const policies = mediaLifecycleActionPolicies({
    activeUsageCount: options.activeUsageCount ?? 0,
    canUpdate: options.canUpdate ?? true,
    pending: options.pending ?? false,
    status,
  });
  return {
    restore: policies.find((policy) => policy.action === 'restore'),
    retire: policies.find((policy) => policy.action === 'retire'),
  };
}

describe('mediaLifecyclePolicy', () => {
  it('allows ready media to be retired and keeps restore hidden or disabled', () => {
    const { retire, restore } = actionPolicy('READY');

    expect(retire).toMatchObject({
      disabled: false,
      label: 'Retire',
      nextStatus: 'RETIRED',
    });
    expect(restore).toMatchObject({
      disabled: true,
      nextStatus: 'READY',
    });
  });

  it('blocks retire when active media references are still present', () => {
    const { retire } = actionPolicy('READY', { activeUsageCount: 2 });

    expect(retire).toMatchObject({
      disabled: true,
      nextStatus: 'RETIRED',
    });
    expect(retire?.reason).toContain('2 active references');
  });

  it('allows retired media to be restored and prevents double retire', () => {
    const { retire, restore } = actionPolicy('RETIRED');

    expect(retire).toMatchObject({
      disabled: true,
      nextStatus: 'RETIRED',
    });
    expect(restore).toMatchObject({
      disabled: false,
      label: 'Restore',
      nextStatus: 'READY',
    });
  });

  it('blocks lifecycle changes when generated update is not available', () => {
    const { retire, restore } = actionPolicy('READY', { canUpdate: false });

    expect(retire?.disabled).toBe(true);
    expect(restore?.disabled).toBe(true);
    expect(retire?.reason).toContain('unavailable');
    expect(restore?.reason).toContain('unavailable');
  });

  it('normalizes statuses and assigns presentation tones', () => {
    expect(normalizeMediaLifecycleStatus(' ready ')).toBe('READY');
    expect(mediaLifecycleStatusTone('READY')).toBe('success');
    expect(mediaLifecycleStatusTone('UPLOADED')).toBe('info');
    expect(mediaLifecycleStatusTone('RETIRED')).toBe('warning');
    expect(mediaLifecycleStatusTone('FAILED')).toBe('error');
  });
});
