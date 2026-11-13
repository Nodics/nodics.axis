import type {
  AxisModuleConnection,
  AxisNavigationLifecycleAction,
} from '../../../bootstrap/publicBootstrap';
import type { ContentDesignerClientConfiguration } from './contentDesignerClient';
import {
  parsePublicationInspection,
  validPublicationCode,
  type PublicationInspection,
} from './publicationInspectionClient';

export type PublicationCommand = 'retry' | 'rollback' | 'withdraw';
const paths: Record<PublicationCommand, string> = {
  retry: '/publications/:publicationCode/retry',
  rollback: '/publications/:publicationCode/rollback',
  withdraw: '/publications/:publicationCode/withdraw',
};
/** Intersects owner-read business eligibility with permission-filtered declared transports; this grants no API authority. */
export function publicationCommandAvailable(
  action: AxisNavigationLifecycleAction,
  snapshot: PublicationInspection,
): action is AxisNavigationLifecycleAction & { id: PublicationCommand } {
  return (
    ['retry', 'rollback', 'withdraw'].includes(action.id) &&
    action.ownerModule === 'publish' &&
    action.permission === `publish.lifecycle.${action.id}` &&
    action.featureState === 'ACTIVE' &&
    action.httpMethod === 'POST' &&
    action.operationRoute === paths[action.id as PublicationCommand] &&
    Boolean(action.targetStatuses?.includes(snapshot.state)) &&
    Boolean(snapshot.operatorOperations?.includes(action.id as PublicationCommand)) &&
    (action.id !== 'rollback' || Boolean(snapshot.previousOnlineVersion?.trim())) &&
    [
      snapshot.domain,
      snapshot.rootType,
      snapshot.rootCode,
      snapshot.sourceVersion,
    ].every((value) => typeof value === 'string' && Boolean(value.trim()))
  );
}
export function samePublicationSource(
  left: PublicationInspection,
  right: PublicationInspection,
): boolean {
  return ['code', 'domain', 'rootType', 'rootCode', 'sourceVersion'].every(
    (key) =>
      left[key as keyof PublicationInspection] ===
      right[key as keyof PublicationInspection],
  );
}
/** Ambiguous declarations never select the first command as authority. */
export function qualifiedPublicationActions(
  actions: readonly AxisNavigationLifecycleAction[],
  snapshot: PublicationInspection,
): readonly AxisNavigationLifecycleAction[] {
  return actions.filter(
    (action) =>
      actions.filter((candidate) => candidate.id === action.id).length === 1 &&
      publicationCommandAvailable(action, snapshot),
  );
}
/** Sends exactly one explicitly confirmed owner command, using the inspected publication revision. Never retries or acquires service credentials. */
export async function executePublicationCommand(
  connection: AxisModuleConnection,
  configuration: ContentDesignerClientConfiguration,
  action: AxisNavigationLifecycleAction,
  snapshot: PublicationInspection,
  reason: string,
  fetcher: typeof fetch = fetch,
): Promise<PublicationInspection> {
  if (
    connection.moduleName !== 'publish' ||
    !validPublicationCode(snapshot.code) ||
    !publicationCommandAvailable(action, snapshot) ||
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    reason.length > 1000
  )
    throw new Error('Refresh the declared publication operation before continuing.');
  const endpoint = new URL(connection.endpoint);
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error('Publication source is incompatible');
  const abort = new AbortController(),
    timer = globalThis.setTimeout(() => abort.abort(), configuration.timeoutMs);
  try {
    const path = paths[action.id].replace(
      ':publicationCode',
      encodeURIComponent(snapshot.code),
    );
    const response = await fetcher(
      `${endpoint.toString().replace(/\/$/, '')}/v0${path}`,
      {
        method: 'POST',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: abort.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
        },
        body: JSON.stringify({
          expectedRevision: snapshot.revision,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      },
    );
    if (!response.ok) {
      let support = '';
      try {
        const failure: unknown = await response.json();
        if (failure && typeof failure === 'object' && !Array.isArray(failure)) {
          const code = (failure as Record<string, unknown>).code;
          if (typeof code === 'string' && /^ERR_[A-Z0-9_]{1,120}$/.test(code))
            support = ` Support code: ${code}.`;
        }
      } catch {
        /* Non-JSON failures confer no owner evidence. */
      }
      throw new Error(
        (response.status === 401
          ? 'Sign in again, then inspect this request before continuing.'
          : response.status === 403
            ? 'This publication operation is not permitted for your current access.'
            : response.status === 409
              ? 'The request changed. Inspect its current state before preparing another operation.'
              : 'The operation could not be confirmed. Inspect the original request before continuing.') +
          support,
      );
    }
    const result = parsePublicationInspection(await response.json(), snapshot.code);
    const terminal =
      action.id === 'retry'
        ? ['VALIDATED', 'ROLLED_BACK', 'WITHDRAWN']
        : action.id === 'rollback'
          ? ['ROLLED_BACK']
          : ['WITHDRAWN'];
    if (
      !samePublicationSource(snapshot, result) ||
      result.revision <= snapshot.revision ||
      !terminal.includes(result.state)
    )
      throw new Error(
        'The original operation acknowledgement is unverified. Inspect the request before continuing.',
      );
    return result;
  } catch (error) {
    if (abort.signal.aborted)
      throw new Error(
        'The response timed out. Inspect the original request; do not assume the operation failed.',
      );
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}
