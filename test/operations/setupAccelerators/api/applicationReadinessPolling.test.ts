/** Browser scheduling tests; no owner operations or runtime activation. */
import { describe, expect, it } from 'vitest';
import {
  ApplicationReadinessThrottleError,
  type ApplicationInitializationStatus,
} from '../../../../src/operations/setupAccelerators/api/applicationInitializationClient';
import {
  applicationReadinessInProgress,
  applicationReadinessCooldownUntil,
  applicationReadinessPollInterval,
} from '../../../../src/operations/setupAccelerators/api/applicationReadinessPolling';

const base: ApplicationInitializationStatus = {
  profileCode: 'nexus',
  type: 'CMS_SITE',
  owner: 'cms',
  applicationCode: 'nexus',
  siteCode: 'nexusSite',
  readiness: 'IMPORTED',
  releaseCode: 'nexus:content',
  releaseVersion: '1.0.0',
  releaseStatus: 'CURRENT',
  allowedActions: [],
};
describe('Setup status GET scheduling', () => {
  it.each(['IMPORTED', 'PUBLICATION_PENDING', 'READY', 'FAILED'] as const)(
    'does not poll stable %s',
    (readiness) => {
      const status = {
        ...base,
        readiness,
        publication: { code: 'publication', state: 'PENDING_APPROVAL', revision: 1 },
      };
      expect(applicationReadinessInProgress(status)).toBe(false);
      expect(applicationReadinessPollInterval(status, null, 1, 0, 0)).toBe(false);
    },
  );
  it('backs off real importing work and stops at the bounded window', () => {
    const status = { ...base, readiness: 'IMPORTING' } as const;
    expect(
      [1, 2, 3, 4, 5, 50].map((count) =>
        applicationReadinessPollInterval(status, null, count, 0, 0),
      ),
    ).toEqual([2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
    expect(applicationReadinessPollInterval(status, null, 5, 0, 290_000)).toBe(false);
    expect(
      applicationReadinessPollInterval(status, new Error('Denied read'), 1, 0, 0),
    ).toBe(false);
  });
  it('honors typed throttle cooldown without restarting stable work', () => {
    const error = new ApplicationReadinessThrottleError('Wait', '60', 0);
    expect(applicationReadinessCooldownUntil(base, error, 0)).toBe(60_000);
    expect(
      applicationReadinessPollInterval(
        { ...base, readiness: 'IMPORTING' },
        error,
        1,
        0,
        0,
      ),
    ).toBe(60_000);
    expect(applicationReadinessPollInterval(base, error, 1, 0, 0)).toBe(false);
  });
  it.each([
    [null, 30_000],
    ['invalid', 30_000],
    ['0', 5_000],
    ['999999', 300_000],
  ])('bounds Retry-After %s to %s ms', (header, expected) => {
    const error = new ApplicationReadinessThrottleError('Wait', header, 0);
    expect(error.retryAt).toBe(expected);
  });
  it('uses a bounded owner-projected rate-limit cooldown without authorizing preparation', () => {
    const status = {
      ...base,
      capability: {
        capabilityCode: 'nexus',
        displayName: 'Nexus',
        owningModule: 'nexus',
        capabilityType: 'ACCELERATOR',
        group: 'PROJECT',
        businessStatus: 'NEEDS_ATTENTION',
        technicalStatus: 'BLOCKED',
        nextAction: 'Wait',
        blockers: [
          {
            code: 'READINESS_RATE_LIMITED',
            owner: 'release',
            severity: 'BLOCKED',
            message: 'Wait',
            action: 'Refresh readiness',
          },
        ],
      },
    };
    expect(applicationReadinessCooldownUntil(status, null, 1_000)).toBe(31_000);
    expect(applicationReadinessPollInterval(status, null, 1, 0, 0)).toBe(false);
    for (const active of [
      { ...status, readiness: 'IMPORTING' as const },
      {
        ...status,
        publication: { code: 'publication', state: 'ACTIVATING', revision: 1 },
      },
    ]) {
      expect(applicationReadinessPollInterval(active, null, 1, 0, 2_000, 1_000)).toBe(
        29_000,
      );
      expect(applicationReadinessPollInterval(active, null, 1, 0, 30_000, 1_000)).toBe(
        2_000,
      );
      expect(applicationReadinessPollInterval(active, null, 1, 0, 31_000, 1_000)).toBe(
        2_000,
      );
      expect(
        applicationReadinessPollInterval(active, null, 1, 0, 290_000, 289_000),
      ).toBe(false);
    }
    expect(status.allowedActions).toEqual([]);
  });
});
