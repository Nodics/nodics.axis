/** @file Native BackOffice composition lifecycle transport; export reads the authorized snapshot, without a legacy-route fallback. */
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface NavigationCompositionClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly projectCode: string;
  readonly timeoutMs: number;
}

export type NavigationCompositionAction =
  | 'preview'
  | 'export'
  | 'createDraft'
  | 'submit'
  | 'approve'
  | 'publish'
  | 'rollback';

export interface NavigationCompositionAuthoring {
  readonly version: number;
  readonly checksum: string;
  readonly availableOperations: readonly string[];
  readonly rollbackCandidates: readonly unknown[];
  readonly draft?: {
    readonly draftId: string;
    readonly checksum: string;
    readonly lifecycleState: string;
  };
}
export interface NavigationCompositionPrecondition {
  readonly expectedVersion: number;
  readonly expectedChecksum: string;
  readonly expectedDraftId?: string;
}

/** Reads the current owner revision once; a later decision must carry this observed revision. */
export async function loadNavigationCompositionAuthoring(
  connection: AxisModuleConnection,
  configuration: NavigationCompositionClientConfiguration,
): Promise<NavigationCompositionAuthoring> {
  const value = await request(
    connection,
    navigationPath('/navigation/composition/authoring', configuration),
    configuration,
    {},
    fetch,
    'SUC_BOF_00016',
  );
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Navigation lifecycle status is invalid');
  const data = value as Record<string, unknown>;
  const checksum = (item: unknown): item is string =>
    typeof item === 'string' && /^[a-f0-9]{64}$/.test(item);
  if (
    !Number.isSafeInteger(data.version) ||
    Number(data.version) < 0 ||
    !checksum(data.checksum) ||
    !Array.isArray(data.availableOperations) ||
    data.availableOperations.some((item) => typeof item !== 'string') ||
    !Array.isArray(data.rollbackCandidates)
  )
    throw new Error('Navigation lifecycle status is invalid');
  let draft: NavigationCompositionAuthoring['draft'];
  if (data.draft !== undefined) {
    if (!data.draft || typeof data.draft !== 'object' || Array.isArray(data.draft))
      throw new Error('Navigation draft status is invalid');
    const item = data.draft as Record<string, unknown>;
    if (
      typeof item.draftId !== 'string' ||
      !/^nav-draft-[0-9]+$/.test(item.draftId) ||
      !checksum(item.checksum) ||
      typeof item.lifecycleState !== 'string' ||
      !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(item.lifecycleState)
    )
      throw new Error('Navigation draft status is invalid');
    draft = Object.freeze({
      draftId: item.draftId,
      checksum: item.checksum,
      lifecycleState: item.lifecycleState,
    });
  }
  return Object.freeze({
    version: Number(data.version),
    checksum: data.checksum,
    availableOperations: Object.freeze(data.availableOperations as string[]),
    rollbackCandidates: Object.freeze([...(data.rollbackCandidates as unknown[])]),
    ...(draft ? { draft } : {}),
  });
}

function envelopeData(value: unknown, expectedCode: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Navigation composition returned an invalid response');
  }
  if (
    !('code' in value) ||
    value.code !== expectedCode ||
    ('result' in value && 'data' in value)
  ) {
    throw new Error(
      'Navigation composition did not return the expected owner acknowledgement. Inspect the owner state before repeating a lifecycle action.',
    );
  }
  if ('result' in value) return (value as { readonly result: unknown }).result;
  if ('data' in value) return (value as { readonly data: unknown }).data;
  throw new Error('Navigation composition response does not contain data');
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
    // Preserve bounded HTTP fallback.
  }
  return `Navigation composition request returned HTTP ${String(response.status)}`;
}

function navigationPath(
  path: string,
  configuration: NavigationCompositionClientConfiguration,
): string {
  return `${path}${path.includes('?') ? '&' : '?'}project=${encodeURIComponent(
    configuration.projectCode,
  )}`;
}

async function request(
  connection: AxisModuleConnection,
  path: string,
  configuration: NavigationCompositionClientConfiguration,
  options: RequestInit = {},
  fetchImplementation: typeof fetch,
  expectedCode: string,
): Promise<unknown> {
  const endpoint = new URL(connection.endpoint);
  if (
    !['http:', 'https:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
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
    return envelopeData(await response.json(), expectedCode);
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error(
        'Navigation composition request timed out. Refresh lifecycle to inspect the owner state before another action.',
      );
    }
    if (error instanceof TypeError || error instanceof SyntaxError)
      throw new Error(
        'The navigation response could not be confirmed. Refresh lifecycle to inspect the owner state before another action.',
      );
    throw error instanceof Error
      ? error
      : new Error('Navigation composition request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/** Invokes one fixed native action under the current employee; transport failure never retries lifecycle commands. */
export async function executeNavigationCompositionAction(
  connection: AxisModuleConnection,
  configuration: NavigationCompositionClientConfiguration,
  action: NavigationCompositionAction,
  candidate?: unknown,
  fetchImplementation: typeof fetch = fetch,
  precondition?: NavigationCompositionPrecondition,
): Promise<unknown> {
  const body =
    candidate === undefined && precondition === undefined
      ? undefined
      : JSON.stringify({
          candidate,
          ...precondition,
          reason: 'Axis Navigation Composition governed lifecycle action.',
        });
  const routes: Record<
    NavigationCompositionAction,
    Readonly<{ method: 'GET' | 'POST'; path: string }>
  > = {
    preview: { method: 'POST', path: '/navigation/composition/preview' },
    export: { method: 'GET', path: '/navigation/composition/snapshot' },
    createDraft: { method: 'POST', path: '/navigation/composition/draft' },
    submit: { method: 'POST', path: '/navigation/composition/draft/submit' },
    approve: { method: 'POST', path: '/navigation/composition/draft/approve' },
    publish: { method: 'POST', path: '/navigation/composition/draft/publish' },
    rollback: { method: 'POST', path: '/navigation/composition/rollback' },
  };
  const route = routes[action];
  return request(
    connection,
    navigationPath(route.path, configuration),
    configuration,
    {
      method: route.method,
      ...(body && route.method === 'POST' ? { body } : {}),
    },
    fetchImplementation,
    {
      preview: 'SUC_BOF_00017',
      export: 'SUC_BOF_00018',
      createDraft: 'SUC_BOF_00023',
      submit: 'SUC_BOF_00024',
      approve: 'SUC_BOF_00025',
      publish: 'SUC_BOF_00026',
      rollback: 'SUC_BOF_00027',
    }[action],
  );
}
