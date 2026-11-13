import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import type { ContentDesignerClientConfiguration } from './contentDesignerClient';

export interface PublicationInspection {
  readonly code: string;
  readonly state: string;
  readonly revision: number;
  readonly prerequisitesPassed?: boolean;
  readonly operatorOperations?: readonly ('retry' | 'rollback' | 'withdraw')[];
  readonly operatorGuidance?: string;
  readonly domain?: string | undefined;
  readonly rootType?: string | undefined;
  readonly rootCode?: string | undefined;
  readonly siteCode?: string | undefined;
  readonly catalogCode?: string | undefined;
  readonly sourceVersion?: string | undefined;
  readonly targetVersion?: string | undefined;
  readonly previousOnlineVersion?: string | undefined;
  readonly requestedBy?: string | undefined;
  readonly workflowRef?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly dependencies?:
    | readonly Readonly<{
        schema: string;
        code: string;
        version?: string | undefined;
      }>[]
    | undefined;
  readonly auditTrail?:
    | readonly Readonly<{
        fromState?: string | undefined;
        toState?: string | undefined;
        revision?: number | undefined;
        actor?: string | undefined;
        reason?: string | undefined;
        failureCode?: string | undefined;
      }>[]
    | undefined;
}
export function validPublicationCode(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,511}$/.test(value);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Publication response is incompatible');
  return value as Record<string, unknown>;
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= 2048
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : undefined;
}
function affirmative(value: Record<string, unknown>): boolean {
  return !(
    ['success', 'acknowledged'].some(
      (key) => value[key] !== undefined && value[key] !== true,
    ) ||
    (value.error !== undefined && value.error !== null && value.error !== false) ||
    (value.errors !== undefined &&
      (!Array.isArray(value.errors) || value.errors.length > 0))
  );
}
/** Read-only native lifecycle inspection. Owner identity, revision and response evidence stay exact. */
export async function inspectPublication(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<PublicationInspection> {
  if (connection.moduleName !== 'publish' || !validPublicationCode(code))
    throw new Error('Choose a valid publication and source workspace');
  const endpoint = new URL(connection.endpoint);
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error('Publication source is incompatible');
  const controller = new AbortController();
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetcher(
      new URL(
        `${endpoint.toString().replace(/\/$/, '')}/v0/publications/${encodeURIComponent(code)}`,
      ),
      {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
        },
      },
    );
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? 'You do not have access to this publication workspace.'
          : response.status === 401
            ? 'Sign in again to inspect this publication.'
            : response.status === 404 || response.status === 400
              ? 'The publication could not be found in this source workspace. Check the code and source.'
              : 'Publication evidence is temporarily unavailable.',
      );
    return parsePublicationInspection(await response.json(), code);
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        'Publication inspection timed out. Refresh to try this read again.',
      );
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

/** Parses the same exact owner evidence for read and explicit command acknowledgement. */
export function parsePublicationInspection(
  value: unknown,
  code: string,
): PublicationInspection {
  const envelope = record(value);
  const source = record(envelope.result);
  if (
    envelope.code !== 'SUC_PUB_00000' ||
    (envelope.responseCode !== undefined &&
      envelope.responseCode !== '200' &&
      envelope.responseCode !== 200) ||
    !affirmative(envelope) ||
    !affirmative(source) ||
    source.code !== code ||
    typeof source.state !== 'string' ||
    !/^[A-Z][A-Z_]{0,63}$/.test(source.state) ||
    !Number.isSafeInteger(source.revision) ||
    Number(source.revision) < 0
  )
    throw new Error(
      'Publication evidence could not be confirmed. Refresh before continuing.',
    );
  const optional = Object.fromEntries(
    [
      'domain',
      'rootType',
      'rootCode',
      'siteCode',
      'catalogCode',
      'sourceVersion',
      'targetVersion',
      'requestedBy',
      'workflowRef',
      'correlationId',
    ].flatMap((key) =>
      text(source[key]) === undefined ? [] : [[key, text(source[key])]],
    ),
  );
  let dependencies: PublicationInspection['dependencies'];
  if (source.dependencies !== undefined) {
    if (!Array.isArray(source.dependencies) || source.dependencies.length > 10000)
      throw new Error('Publication dependencies are incompatible');
    dependencies = Object.freeze(
      source.dependencies.map((item) => {
        const x = record(item);
        const schema = text(x.schema),
          identity = text(x.code);
        if (!schema || !identity)
          throw new Error('Publication dependency identity is missing');
        return Object.freeze({ schema, code: identity, version: text(x.version) });
      }),
    );
  }
  let auditTrail: PublicationInspection['auditTrail'];
  if (source.auditTrail !== undefined) {
    if (!Array.isArray(source.auditTrail) || source.auditTrail.length > 10000)
      throw new Error('Publication audit is incompatible');
    auditTrail = Object.freeze(
      source.auditTrail.map((item) => {
        const x = record(item);
        return Object.freeze({
          fromState: text(x.fromState),
          toState: text(x.toState),
          revision: Number.isSafeInteger(x.revision) ? Number(x.revision) : undefined,
          actor: text(x.actor),
          reason: text(x.reason),
          failureCode:
            x.details &&
            typeof x.details === 'object' &&
            !Array.isArray(x.details) &&
            typeof (x.details as Record<string, unknown>).failureCode === 'string' &&
            /^[A-Z][A-Z0-9_]{0,127}$/.test(
              (x.details as Record<string, unknown>).failureCode as string,
            )
              ? ((x.details as Record<string, unknown>).failureCode as string)
              : undefined,
        });
      }),
    );
  }
  const operations = source.operatorOperations;
  const validation = source.validation;
  const prerequisitesPassed =
    validation && typeof validation === 'object' && !Array.isArray(validation)
      ? (validation as Record<string, unknown>).valid
      : undefined;
  if (
    source.previousOnlineVersion !== undefined &&
    source.previousOnlineVersion !== null &&
    (typeof source.previousOnlineVersion !== 'string' ||
      !source.previousOnlineVersion.trim() ||
      source.previousOnlineVersion.length > 131072)
  )
    throw new Error('Publication predecessor evidence is incompatible');
  if (
    operations !== undefined &&
    (!Array.isArray(operations) ||
      operations.length > 3 ||
      new Set(operations).size !== operations.length ||
      operations.some(
        (item: unknown) =>
          typeof item !== 'string' || !['retry', 'rollback', 'withdraw'].includes(item),
      ))
  )
    throw new Error('Publication operator evidence is incompatible');
  if (
    source.operatorGuidance !== undefined &&
    (typeof source.operatorGuidance !== 'string' ||
      !source.operatorGuidance.trim() ||
      source.operatorGuidance.length > 2000)
  )
    throw new Error('Publication operator guidance is incompatible');
  return Object.freeze({
    code,
    state: source.state,
    revision: Number(source.revision),
    ...(typeof prerequisitesPassed === 'boolean' ? { prerequisitesPassed } : {}),
    ...(operations
      ? {
          operatorOperations: Object.freeze(
            operations.map((item: unknown) => String(item)),
          ) as NonNullable<PublicationInspection['operatorOperations']>,
        }
      : {}),
    ...(typeof source.operatorGuidance === 'string'
      ? { operatorGuidance: source.operatorGuidance }
      : {}),
    ...optional,
    ...(typeof source.previousOnlineVersion === 'string'
      ? { previousOnlineVersion: source.previousOnlineVersion }
      : {}),
    ...(dependencies ? { dependencies } : {}),
    ...(auditTrail ? { auditTrail } : {}),
  });
}
