import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';

export interface ProcessDefinitionClientConfiguration {
  readonly accessToken: string;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}

export interface ProcessGraphNode {
  readonly code: string;
  readonly type: string;
  readonly name?: string | undefined;
  readonly action?:
    | {
        readonly moduleName: string;
        readonly operation: string;
      }
    | undefined;
}

export interface ProcessGraphTransition {
  readonly code: string;
  readonly source: string;
  readonly target: string;
  readonly name?: string | undefined;
}

export interface ProcessGraph {
  readonly nodes: readonly ProcessGraphNode[];
  readonly transitions: readonly ProcessGraphTransition[];
}

export interface ProcessValidationResult {
  readonly valid: boolean;
  readonly nodeCount: number;
  readonly transitionCount: number;
  readonly issues: readonly { readonly code: string; readonly message: string }[];
}

export interface ProcessDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly category: string | undefined;
  readonly status: string;
  readonly currentVersion: number;
  readonly draftRevision: number;
  readonly graph: ProcessGraph | undefined;
  readonly validation: ProcessValidationResult | undefined;
}

export interface ProcessRuntimeInstance {
  readonly code: string;
  readonly definitionCode: string | undefined;
  readonly status: string;
  readonly currentNode: string | undefined;
}

export interface ProcessHumanTask {
  readonly code: string;
  readonly instanceCode: string | undefined;
  readonly assignee: string | undefined;
  readonly status: string;
  readonly dueAt: string | undefined;
}

export interface ProcessAuditEvent {
  readonly eventType: string;
  readonly outcome: string;
  readonly definitionCode: string | undefined;
  readonly instanceCode: string | undefined;
}

export interface ProcessOperationsSummary {
  readonly instances: readonly ProcessRuntimeInstance[];
  readonly tasks: readonly ProcessHumanTask[];
  readonly auditEvents: readonly ProcessAuditEvent[];
}

export interface CreateProcessDefinitionInput {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly graph: ProcessGraph;
}

export interface UpdateProcessDraftInput {
  readonly name: string;
  readonly description: string;
  readonly category: string;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as Record<string, unknown>;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function text(value: unknown, fallback: string): string {
  return optionalText(value) ?? fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function envelopeData(value: unknown): unknown {
  const envelope = record(value, 'Process response');
  if ('result' in envelope) return envelope.result;
  if ('data' in envelope) return envelope.data;
  return envelope;
}

function listPayload(value: unknown): readonly unknown[] {
  const data = envelopeData(value);
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const result = (data as Record<string, unknown>).result;
    const nestedData = (data as Record<string, unknown>).data;
    if (Array.isArray(result)) return result;
    if (Array.isArray(nestedData)) return nestedData;
  }
  return Object.freeze([]);
}

function parseValidation(value: unknown): ProcessValidationResult | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;
  const data = value as Record<string, unknown>;
  return Object.freeze({
    valid: data.valid === true,
    nodeCount: numberValue(data.nodeCount, 0),
    transitionCount: numberValue(data.transitionCount, 0),
    issues: Array.isArray(data.issues)
      ? Object.freeze(
          data.issues.map((issue) => {
            const issueRecord = record(issue, 'Process validation issue');
            return Object.freeze({
              code: text(issueRecord.code, 'ISSUE'),
              message: text(issueRecord.message, 'Validation issue'),
            });
          }),
        )
      : Object.freeze([]),
  });
}

function parseGraph(value: unknown): ProcessGraph | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;
  const data = value as Record<string, unknown>;
  return Object.freeze({
    nodes: Array.isArray(data.nodes)
      ? Object.freeze(
          data.nodes.map((node) => {
            const nodeRecord = record(node, 'Process graph node');
            return Object.freeze({
              code: text(nodeRecord.code, 'node'),
              type: text(nodeRecord.type, 'ACTION'),
              name: optionalText(nodeRecord.name),
            });
          }),
        )
      : Object.freeze([]),
    transitions: Array.isArray(data.transitions)
      ? Object.freeze(
          data.transitions.map((transition) => {
            const transitionRecord = record(transition, 'Process graph transition');
            return Object.freeze({
              code: text(transitionRecord.code, 'transition'),
              source: text(transitionRecord.source, ''),
              target: text(transitionRecord.target, ''),
              name: optionalText(transitionRecord.name),
            });
          }),
        )
      : Object.freeze([]),
  });
}

function parseDefinition(value: unknown): ProcessDefinition {
  const data = record(value, 'Process definition');
  return Object.freeze({
    code: text(data.code, 'unknown'),
    name: text(data.name, text(data.code, 'Untitled process')),
    description: optionalText(data.description),
    category: optionalText(data.category),
    status: text(data.status, 'UNKNOWN'),
    currentVersion: numberValue(data.currentVersion, 0),
    draftRevision: numberValue(data.draftRevision, 0),
    graph: parseGraph(data.graph),
    validation: parseValidation(data.validation),
  });
}

function parseRuntimeInstance(value: unknown): ProcessRuntimeInstance {
  const data = record(value, 'Process runtime instance');
  return Object.freeze({
    code: text(data.code, 'unknown-instance'),
    definitionCode: optionalText(data.definitionCode),
    status: text(data.status, 'UNKNOWN'),
    currentNode: optionalText(data.currentNode),
  });
}

function parseHumanTask(value: unknown): ProcessHumanTask {
  const data = record(value, 'Process human task');
  return Object.freeze({
    code: text(data.code, 'unknown-task'),
    instanceCode: optionalText(data.instanceCode),
    assignee: optionalText(data.assignee),
    status: text(data.status, 'UNKNOWN'),
    dueAt: optionalText(data.dueAt),
  });
}

function parseAuditEvent(value: unknown): ProcessAuditEvent {
  const data = record(value, 'Process audit event');
  return Object.freeze({
    eventType: text(data.eventType, 'unknown.event'),
    outcome: text(data.outcome, 'unknown'),
    definitionCode: optionalText(data.definitionCode),
    instanceCode: optionalText(data.instanceCode),
  });
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
    // Preserve bounded fallback.
  }
  return `Process request returned HTTP ${String(response.status)}`;
}

async function request(
  connection: AxisModuleConnection,
  path: string,
  configuration: ProcessDefinitionClientConfiguration,
  options: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  const endpoint = new URL(connection.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('Process endpoint is invalid');
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
          'content-type': 'application/json',
          'x-enterprise-code': configuration.enterpriseCode,
          ...options.headers,
        },
      },
    );
    if (!response.ok) throw new Error(await errorMessage(response));
    return response.status === 204 ? undefined : await response.json();
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('Process request timed out');
    throw error instanceof Error ? error : new Error('Process request failed');
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function createSampleGraph(operation = 'review'): ProcessGraph {
  return Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ code: 'start', type: 'START', name: 'Start' }),
      Object.freeze({
        code: operation,
        type: 'TASK',
        name: 'Business review',
      }),
      Object.freeze({ code: 'end', type: 'END', name: 'End' }),
    ]),
    transitions: Object.freeze([
      Object.freeze({ code: 'start_to_review', source: 'start', target: operation }),
      Object.freeze({ code: 'review_to_end', source: operation, target: 'end' }),
    ]),
  });
}

export async function loadProcessDefinitions(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
): Promise<readonly ProcessDefinition[]> {
  return Object.freeze(
    listPayload(await request(connection, '/definitions', configuration)).map(
      parseDefinition,
    ),
  );
}

export async function createProcessDefinition(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  input: CreateProcessDefinitionInput,
): Promise<ProcessDefinition> {
  return parseDefinition(
    envelopeData(
      await request(connection, '/definitions', configuration, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    ),
  );
}

export async function validateProcessDraft(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  definitionCode: string,
): Promise<ProcessValidationResult> {
  return parseValidation(
    envelopeData(
      await request(
        connection,
        `/definitions/${encodeURIComponent(definitionCode)}/draft/validate`,
        configuration,
        { method: 'POST' },
      ),
    ),
  ) as ProcessValidationResult;
}

export async function updateProcessDraft(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  definitionCode: string,
  input: UpdateProcessDraftInput,
): Promise<unknown> {
  return envelopeData(
    await request(
      connection,
      `/definitions/${encodeURIComponent(definitionCode)}/draft`,
      configuration,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    ),
  );
}

export async function publishProcessDraft(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  definitionCode: string,
): Promise<unknown> {
  return envelopeData(
    await request(
      connection,
      `/definitions/${encodeURIComponent(definitionCode)}/draft/publish`,
      configuration,
      { method: 'POST' },
    ),
  );
}

export async function deleteOrArchiveProcessDefinition(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  definitionCode: string,
): Promise<unknown> {
  return envelopeData(
    await request(
      connection,
      `/definitions/${encodeURIComponent(definitionCode)}`,
      configuration,
      { method: 'DELETE' },
    ),
  );
}

export async function loadProcessOperationsSummary(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
): Promise<ProcessOperationsSummary> {
  const [instances, tasks, auditEvents] = await Promise.all([
    request(connection, '/instances?limit=25', configuration),
    request(connection, '/tasks?limit=25', configuration),
    request(connection, '/audit-events?limit=25', configuration),
  ]);
  return Object.freeze({
    instances: Object.freeze(listPayload(instances).map(parseRuntimeInstance)),
    tasks: Object.freeze(listPayload(tasks).map(parseHumanTask)),
    auditEvents: Object.freeze(listPayload(auditEvents).map(parseAuditEvent)),
  });
}
