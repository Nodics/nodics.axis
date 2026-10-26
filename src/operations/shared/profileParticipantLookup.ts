import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from './operationalOwnerClient';
import type { ProfileEnterpriseOption } from './profileEnterpriseLookup';

const invalid = (): never => {
  throw new Error('The participant directory response is invalid.');
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();

/** Same-tenant public directory selection never replaces the original signed Enterprise header. */
export async function searchProfileParticipantEnterprises(
  c: OperationalOwnerConfiguration,
  search: string,
  signal?: AbortSignal,
): Promise<ProfileEnterpriseOption[]> {
  if (!search.trim() || signal?.aborted) return [];
  const profile = {
    bootstrap: c.bootstrap,
    accessToken: c.accessToken,
    enterpriseCode: c.enterpriseCode,
    timeoutMs: c.timeoutMs,
  };
  const row = object(
    await invokeOperationalOwner(
      profile,
      'profile',
      '/participants/search',
      { ownerType: 'ENTERPRISE', search },
      'POST',
      { signal },
    ),
  );
  if (signal?.aborted) return [];
  if (
    row.contractVersion !== 1 ||
    row.tenant !== c.bootstrap.tenantCode ||
    !Array.isArray(row.items)
  )
    invalid();
  const seen = new Set<string>();
  return (row.items as unknown[]).map((item) => {
    const entry = object(item),
      code = entry.ownerCode;
    if (
      entry.ownerType !== 'ENTERPRISE' ||
      typeof code !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(code) ||
      seen.has(code) ||
      typeof entry.displayName !== 'string' ||
      !entry.displayName
    )
      return invalid();
    seen.add(code);
    return { code, label: `${entry.displayName} (${code})` };
  });
}
