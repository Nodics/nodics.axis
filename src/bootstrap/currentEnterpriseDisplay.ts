import type { OperationalOwnerConfiguration } from '../operations/shared/operationalOwnerClient';
import { invokeOperationalOwner } from '../operations/shared/operationalOwnerClient';

export interface CurrentEnterpriseDisplay {
  readonly code: string;
  readonly displayName: string | null;
}

/** Projects only the original signed Enterprise's display. Scope/permission data never becomes browser authority. */
export function parseCurrentEnterpriseDisplay(
  value: unknown,
  enterpriseCode: string,
): CurrentEnterpriseDisplay {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Current enterprise display is unavailable.');
  const enterprise = (value as Record<string, unknown>).enterprise;
  if (!enterprise || typeof enterprise !== 'object' || Array.isArray(enterprise))
    throw new Error('Current enterprise display is unavailable.');
  const record = enterprise as Record<string, unknown>;
  if (
    record.code !== enterpriseCode ||
    (record.displayName !== null &&
      (typeof record.displayName !== 'string' ||
        !record.displayName.trim() ||
        Array.from(record.displayName).some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        )))
  )
    throw new Error('Current enterprise display could not be confirmed.');
  return Object.freeze({
    code: enterpriseCode,
    displayName:
      typeof record.displayName === 'string' ? record.displayName.trim() : null,
  });
}

/** One current-principal GET to the discovered Profile owner; no directory selector, fallback, persistence or retry. */
export async function loadCurrentEnterpriseDisplay(
  configuration: OperationalOwnerConfiguration,
  signal?: AbortSignal,
): Promise<CurrentEnterpriseDisplay> {
  return parseCurrentEnterpriseDisplay(
    await invokeOperationalOwner(
      configuration,
      'profile',
      '/identity/scopes/me',
      undefined,
      'GET',
      { signal },
    ),
    configuration.enterpriseCode,
  );
}
