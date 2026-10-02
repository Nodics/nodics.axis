/** Authored exact committed-stamp DTO fixtures; behavioral execution remains joint. */
import { afterEach, expect, it, vi } from 'vitest';
import { stampPresentation } from './consentStampFixtures';
import {
  parseConsentStampInspection,
  repairConsentStamps,
} from '../../src/operations/enterprise/api/enterpriseConsentStampClient';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../src/operations/shared/operationalOwnerClient';
vi.mock('../../src/operations/shared/operationalOwnerClient', () => ({
  invokeOperationalOwner: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
const grant = {
  code: 'consent_' + 'a'.repeat(64),
  revision: 2,
  status: 'REVOKED',
  canRepair: true,
};
const dto = {
  presentation: stampPresentation,
  version: 1,
  kind: 'ENTERPRISE_ADMINISTRATION_STAMP_REPAIR',
  enterpriseCode: 'child',
  revision: 3,
  grants: [grant],
};
it('requires exactly the owner plain-text presentation keys with bounded title and copy', () => {
  for (const presentation of [
    undefined,
    { ...stampPresentation, grantLabel: undefined },
    { ...stampPresentation, html: '<script />' },
    { ...stampPresentation, title: 'x'.repeat(161) },
  ]) {
    expect(() =>
      parseConsentStampInspection({ ...dto, presentation }, 'child'),
    ).toThrow();
  }
  expect(parseConsentStampInspection(dto, 'child').presentation).toEqual(
    stampPresentation,
  );
});
const input = {
  enterpriseCode: 'child',
  revision: 3,
  operationId: 'original_operation',
  grantCodes: [grant.code],
};
it('projects only explicit repair capability and rejects wrong targets or duplicate subjects', () => {
  expect(
    parseConsentStampInspection({ ...dto, identity: 'private' }, 'child'),
  ).not.toHaveProperty('identity');
  expect(() => parseConsentStampInspection(dto, 'other')).toThrow();
  expect(() =>
    parseConsentStampInspection({ ...dto, grants: [grant, grant] }, 'child'),
  ).toThrow();
  expect(() =>
    parseConsentStampInspection(
      { ...dto, grants: [{ ...grant, canRepair: undefined }] },
      'child',
    ),
  ).toThrow();
});
it('sends only the exact original command and verifies a complete receipt, including a same-command repeat', async () => {
  const inspection = parseConsentStampInspection(dto, 'child');
  vi.mocked(invokeOperationalOwner).mockResolvedValue({
    ...input,
    revision: 4,
    status: 'COMPLETE',
  });
  await repairConsentStamps(
    {} as OperationalOwnerConfiguration,
    inspection,
    { ...input, privateStampKey: 'not-sent' } as typeof input,
    inspection.grants,
  );
  expect(vi.mocked(invokeOperationalOwner).mock.calls[0]?.slice(1)).toEqual([
    'profile',
    '/enterprise-administration/child/consent/stamps/repair',
    input,
    'POST',
  ]);
  await repairConsentStamps(
    {} as OperationalOwnerConfiguration,
    { ...inspection, revision: 4 },
    input,
    inspection.grants,
  );
  expect(vi.mocked(invokeOperationalOwner).mock.calls[1]?.[3]).toEqual(input);
});
it('never sends denied, changed-subject or stale-revision selections', async () => {
  const inspection = parseConsentStampInspection(dto, 'child');
  await expect(
    repairConsentStamps(
      {} as OperationalOwnerConfiguration,
      { ...inspection, grants: [{ ...inspection.grants[0]!, canRepair: false }] },
      input,
      inspection.grants,
    ),
  ).rejects.toThrow();
  await expect(
    repairConsentStamps(
      {} as OperationalOwnerConfiguration,
      { ...inspection, revision: 5 },
      input,
      inspection.grants,
    ),
  ).rejects.toThrow();
  expect(invokeOperationalOwner).not.toHaveBeenCalled();
});
