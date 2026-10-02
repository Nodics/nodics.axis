/** Profile-owned committed-stamp recovery transport; never mutates access grants or private stamp locators. */
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';
import type { EnterpriseAdministrationTaskPresentation } from '../EnterpriseAdministrationTaskRenderer';
export interface ConsentStampPresentation extends EnterpriseAdministrationTaskPresentation {
  readonly grantLabel: string;
  readonly revisionLabel: string;
  readonly statusLabel: string;
}
export interface ConsentStampInspection {
  readonly presentation: ConsentStampPresentation;
  readonly enterpriseCode: string;
  readonly revision: number;
  readonly grants: readonly {
    readonly code: string;
    readonly revision: number;
    readonly status: 'ACTIVE' | 'REVOKED';
    readonly canRepair: boolean;
  }[];
}
export interface ConsentStampCommand {
  readonly enterpriseCode: string;
  readonly revision: number;
  readonly operationId: string;
  readonly grantCodes: readonly string[];
}
const fail = (): never => {
  throw new Error('The owner repair could not be confirmed.');
};
const selector = (value: unknown): string =>
  typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value) ? value : fail();
const revision = (value: unknown, minimum = 0): number =>
  Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= 2147483647
    ? Number(value)
    : fail();
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
const route = (target: string) =>
  '/enterprise-administration/' +
  encodeURIComponent(selector(target)) +
  '/consent/stamps/repair';
/** Projects only the exact owner inspection and unique bounded public subjects. */
export function parseConsentStampInspection(
  value: unknown,
  target: string,
): ConsentStampInspection {
  const data = record(value);
  if (
    data.version !== 1 ||
    data.kind !== 'ENTERPRISE_ADMINISTRATION_STAMP_REPAIR' ||
    data.enterpriseCode !== target ||
    !Array.isArray(data.grants) ||
    data.grants.length > 100
  )
    fail();
  const grants = (data.grants as unknown[]).map((value) => {
    const row = record(value);
    if (
      !['ACTIVE', 'REVOKED'].includes(String(row.status)) ||
      typeof row.canRepair !== 'boolean'
    )
      fail();
    return {
      code: selector(row.code),
      revision: revision(row.revision, 1),
      status: row.status as 'ACTIVE' | 'REVOKED',
      canRepair: row.canRepair as boolean,
    };
  });
  if (new Set(grants.map((row) => row.code)).size !== grants.length) fail();
  const copy = record(data.presentation);
  const keys = [
    'title',
    'inspectLabel',
    'emptyMessage',
    'workingLabel',
    'reviewTitle',
    'confirmLabel',
    'cancelLabel',
    'uncertainMessage',
    'unavailableMessage',
    'recordedMessage',
    'grantLabel',
    'revisionLabel',
    'statusLabel',
  ] as const;
  if (Object.keys(copy).length !== keys.length) fail();
  const presentation = {} as Record<(typeof keys)[number], string>;
  for (const key of keys) {
    const value = copy[key];
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > (key === 'title' ? 160 : 500)
    )
      fail();
    presentation[key] = value as string;
  }
  return {
    presentation,
    enterpriseCode: selector(target),
    revision: revision(data.revision),
    grants,
  };
}
/** Performs one empty-body, empty-query inspection with unchanged acting issuer headers. */
export async function inspectConsentStamps(
  configuration: OperationalOwnerConfiguration,
  target: string,
) {
  return parseConsentStampInspection(
    await invokeOperationalOwner(configuration, 'profile', route(target)),
    target,
  );
}
/** Executes one explicit original command; response proof is exact, never a write count or replayed grant. */
export async function repairConsentStamps(
  configuration: OperationalOwnerConfiguration,
  inspection: ConsentStampInspection,
  input: ConsentStampCommand,
  originalSubjects: ConsentStampInspection['grants'],
) {
  if (
    input.enterpriseCode !== inspection.enterpriseCode ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.operationId) ||
    revision(input.revision, 1) >= 2147483647 ||
    !input.grantCodes.length ||
    input.grantCodes.length > 100 ||
    new Set(input.grantCodes).size !== input.grantCodes.length ||
    ![input.revision, input.revision + 1].includes(inspection.revision)
  )
    fail();
  for (const code of input.grantCodes) {
    selector(code);
    const original = originalSubjects.find((row) => row.code === code),
      current = inspection.grants.find((row) => row.code === code);
    if (
      !original ||
      !current ||
      current.canRepair !== true ||
      current.revision !== original.revision ||
      current.status !== original.status
    )
      fail();
  }
  const body: ConsentStampCommand = {
    enterpriseCode: input.enterpriseCode,
    revision: input.revision,
    operationId: input.operationId,
    grantCodes: [...input.grantCodes],
  };
  const result = record(
    await invokeOperationalOwner(
      configuration,
      'profile',
      route(body.enterpriseCode),
      body,
      'POST',
    ),
  );
  if (
    result.enterpriseCode !== body.enterpriseCode ||
    result.operationId !== body.operationId ||
    result.status !== 'COMPLETE' ||
    result.revision !== body.revision + 1 ||
    !Array.isArray(result.grantCodes) ||
    result.grantCodes.length !== body.grantCodes.length ||
    new Set(result.grantCodes).size !== result.grantCodes.length ||
    result.grantCodes.some(
      (code) => typeof code !== 'string' || !body.grantCodes.includes(code),
    )
  )
    fail();
}
