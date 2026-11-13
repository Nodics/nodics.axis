/** Profile-owned fresh administration definition. Static capability metadata never supplies role choices. */
import {
  parseBackendWorkspace,
  type AxisBackendWorkspace,
} from '../../../bootstrap/publicBootstrap';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';

/** Validates the owner task discriminator and original enterprise before parsing executable-free workspace metadata. */
export function parseEnterpriseManagementWorkspace(
  value: unknown,
  enterpriseCode: string,
): AxisBackendWorkspace {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Enterprise management workspace could not be confirmed.');
  const task = value as Record<string, unknown>;
  if (
    task.contractVersion !== 1 ||
    task.kind !== 'ENTERPRISE_MANAGEMENT' ||
    task.enterpriseCode !== enterpriseCode
  )
    throw new Error('Enterprise management scope could not be confirmed.');
  const workspace = parseBackendWorkspace(task.workspace);
  if (workspace.renderer !== 'axis.workspace.backend-operations')
    throw new Error('Enterprise management renderer could not be confirmed.');
  return workspace;
}

/** Performs one scoped owner GET, with no scope selector, role fallback or business command retry. */
export async function loadEnterpriseManagementWorkspace(
  configuration: OperationalOwnerConfiguration,
  signal?: AbortSignal,
): Promise<AxisBackendWorkspace> {
  return parseEnterpriseManagementWorkspace(
    await invokeOperationalOwner(
      configuration,
      'profile',
      '/enterprises/workspace',
      undefined,
      'GET',
      { signal },
    ),
    configuration.enterpriseCode,
  );
}
