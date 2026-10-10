import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import type { ProcessDefinitionClientConfiguration } from '../../processWorkflow/api/processDefinitionClient';

export interface MediaPublicationRequest {
  readonly publicationCode: string;
  readonly mediaCode: string;
  readonly versionId: number;
  readonly expectedChecksum: string;
}

export interface MediaPublicationResult {
  readonly state: string;
  readonly workflowRef?: string;
}

/** Uses Media's native employee-authorized entry, never an evidence-supplied command URL. */
export async function requestMediaPublication(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  input: MediaPublicationRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<MediaPublicationResult> {
  if (
    connection.moduleName !== 'media' ||
    connection.runtimeRole?.publication !== 'STAGED' ||
    !['UP', 'DEGRADED'].includes(connection.state) ||
    !/^cmsMedia_[a-f0-9]{64}$/.test(input.publicationCode) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(input.mediaCode) ||
    !Number.isSafeInteger(input.versionId) ||
    input.versionId < 0 ||
    !/^[a-f0-9]{64}$/.test(input.expectedChecksum)
  ) {
    throw new Error('Exact Staged Media publication is unavailable');
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    configuration.timeoutMs,
  );
  try {
    const response = await fetchImplementation(
      new URL(connection.endpoint.replace(/\/$/, '') + '/v0/publication/requests'),
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${configuration.accessToken}`,
          'x-enterprise-code': configuration.enterpriseCode,
        },
        body: JSON.stringify(input),
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    if (!response.ok)
      throw new Error(`Media publication returned HTTP ${String(response.status)}`);
    const envelope = (await response.json()) as { result?: Record<string, unknown> };
    const result = envelope.result;
    if (
      !result ||
      result.publicationCode !== input.publicationCode ||
      result.mediaCode !== input.mediaCode ||
      result.versionId !== input.versionId ||
      result.approvalRequired !== true ||
      !Number.isSafeInteger(result.revision) ||
      !['PENDING_APPROVAL', 'APPROVED', 'ACTIVATING', 'ONLINE'].includes(
        String(result.state),
      ) ||
      (result.state === 'PENDING_APPROVAL' &&
        (typeof result.workflowRef !== 'string' ||
          !/^publicationApproval-[a-f0-9]{64}$/.test(result.workflowRef)))
    ) {
      throw new Error('Media publication acknowledgement is incompatible');
    }
    return {
      state: String(result.state),
      ...(typeof result.workflowRef === 'string'
        ? { workflowRef: result.workflowRef }
        : {}),
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
