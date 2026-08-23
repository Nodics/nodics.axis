import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  parseFunctionalModuleCatalogue,
  parseFunctionalModuleRegistration,
  type FunctionalModuleActivationReceipt,
  type FunctionalModuleRegistration,
} from './functionalModuleRegistryContracts';

export interface FunctionalModuleRegistryClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly projectCode: string;
  readonly timeoutMs: number;
}

export interface FunctionalModuleSampleDataResult {
  readonly dataType: 'sample';
  readonly releaseCount: number;
}

export type FunctionalModuleLifecycleAction =
  | 'register'
  | 'activate'
  | 'rollback'
  | 'deactivate'
  | 'deregister';

const ACTION_REASONS: Record<FunctionalModuleLifecycleAction, string> = {
  register: 'Axis Module Registry registration requested by an authorized employee.',
  activate: 'Axis Module Registry activation requested by an authorized employee.',
  rollback:
    'Axis Module Registry activation rollback requested by an authorized employee.',
  deactivate: 'Axis Module Registry deactivation requested by an authorized employee.',
  deregister:
    'Axis Module Registry deregistration requested by an authorized employee.',
};

function safeIdentifier(value: string, name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(`${name} is invalid`);
  }
  return encodeURIComponent(value);
}

function envelopeData(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Functional-module registry returned an invalid response');
  }
  if ('result' in value) return (value as { readonly result: unknown }).result;
  if ('data' in value) return (value as { readonly data: unknown }).data;
  throw new Error('Functional-module registry response does not contain data');
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const message = (value as Record<string, unknown>).message;
      if (typeof message === 'string' && message.trim() && message.length <= 500) {
        return message;
      }
    }
  } catch {
    // Preserve the bounded HTTP fallback.
  }
  return `Functional-module registry request returned HTTP ${String(response.status)}`;
}

function registryPath(
  path: string,
  configuration: FunctionalModuleRegistryClientConfiguration,
): string {
  return `${path}${
    path.includes('?') ? '&' : '?'
  }project=${safeIdentifier(configuration.projectCode, 'Project code')}`;
}

async function request(
  connection: AxisModuleConnection,
  path: string,
  configuration: FunctionalModuleRegistryClientConfiguration,
  options: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('BackOffice endpoint is invalid');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(`${endpoint.toString().replace(/\/$/, '')}/v0${path}`),
      {
        ...options,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'Content-Type': 'application/json',
          'x-enterprise-code': configuration.enterpriseCode,
          ...options.headers,
        },
      },
    );
    if (!response.ok) throw new Error(await errorMessage(response));
    return envelopeData(await response.json());
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error('Functional-module registry request timed out');
    }
    throw error instanceof Error
      ? error
      : new Error('Functional-module registry request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function loadAvailableFunctionalModules(
  connection: AxisModuleConnection,
  configuration: FunctionalModuleRegistryClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly FunctionalModuleRegistration[]> {
  return parseFunctionalModuleCatalogue(
    await request(
      connection,
      registryPath('/runtime/modules/available', configuration),
      configuration,
      {},
      fetchImplementation,
    ),
  );
}

export async function loadRegisteredFunctionalModules(
  connection: AxisModuleConnection,
  configuration: FunctionalModuleRegistryClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<readonly FunctionalModuleRegistration[]> {
  return parseFunctionalModuleCatalogue(
    await request(
      connection,
      registryPath('/runtime/modules/registrations', configuration),
      configuration,
      {},
      fetchImplementation,
    ),
  );
}

export async function applyFunctionalModuleLifecycleAction(
  connection: AxisModuleConnection,
  module: FunctionalModuleRegistration,
  action: FunctionalModuleLifecycleAction,
  configuration: FunctionalModuleRegistryClientConfiguration,
  options: Readonly<{ dryRun?: boolean | undefined }> | typeof fetch = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<FunctionalModuleRegistration> {
  const lifecycleOptions = typeof options === 'function' ? {} : options;
  const effectiveFetch = typeof options === 'function' ? options : fetchImplementation;
  const body = JSON.stringify({
    project: configuration.projectCode,
    expectedRevision: module.catalogueRevision,
    reason: ACTION_REASONS[action],
    dryRun: lifecycleOptions.dryRun === true,
    includeActivationData: true,
  });
  return parseFunctionalModuleRegistration(
    await request(
      connection,
      `/runtime/modules/registrations/${safeIdentifier(
        module.functionalModule,
        'Functional-module identity',
      )}/${action}`,
      configuration,
      { body, method: 'POST' },
      effectiveFetch,
    ),
  );
}

export async function installFunctionalModuleSampleData(
  connection: AxisModuleConnection,
  module: FunctionalModuleRegistration,
  configuration: FunctionalModuleRegistryClientConfiguration,
  fetchImplementation: typeof fetch = fetch,
): Promise<FunctionalModuleSampleDataResult> {
  const releaseCodes = (module.activationData?.receipts ?? [])
    .filter(
      (receipt: FunctionalModuleActivationReceipt) =>
        receipt.dataType === 'sample' && receipt.trigger === 'USER',
    )
    .map((receipt) => receipt.code);
  if (releaseCodes.length === 0) {
    throw new Error(
      'No user-triggered sample data package is declared for this module',
    );
  }
  const value = await request(
    connection,
    '/sample/install',
    configuration,
    {
      method: 'POST',
      body: JSON.stringify({
        dataType: 'sample',
        releaseCodes: [...new Set(releaseCodes)],
      }),
    },
    fetchImplementation,
  );
  const result = record(value, 'Sample data operation');
  const releases = Array.isArray(result.releases) ? result.releases : [];
  return Object.freeze({
    dataType: 'sample' as const,
    releaseCount: releases.length,
  });
}
