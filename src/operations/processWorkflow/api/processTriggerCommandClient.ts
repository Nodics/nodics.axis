import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  request,
  type ProcessDefinitionClientConfiguration,
} from './processDefinitionClient';
import type { ProcessTriggerCommandKind } from './processCommandCapabilitiesClient';

/** One immutable in-memory request. Never persist its body/key or reconstruct it from current relationship state. */
export interface ProcessTriggerCommandIntent {
  readonly kind: ProcessTriggerCommandKind;
  readonly triggerCode: string;
  readonly bodyJson: string;
  readonly idempotencyKey?: string;
}
export interface ProcessTriggerCommandAcknowledgement {
  readonly triggerCode: string;
  readonly instanceCode?: string;
}
export interface ProcessTriggerCommandReceipt extends ProcessTriggerCommandAcknowledgement {
  readonly state: 'COMPLETED' | 'OUTCOME_UNKNOWN';
}

const isCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);

/** Matches the existing nDatabase bounded JSON fingerprint contract; never evaluates a submitted value. */
function canonical(value: unknown, depth = 0): unknown {
  if (depth > 24) throw new Error('Trigger command input is invalid');
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item) => canonical(item, depth + 1));
  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item, depth + 1)]),
    );
  throw new Error('Trigger command input is invalid');
}

/** Serializes the exact original JSON body within the owner's supported bound. */
function serialized(value: unknown): string {
  const json = JSON.stringify(canonical(value));
  if (new TextEncoder().encode(json).length > 65536)
    throw new Error('Trigger command input is invalid');
  return json;
}

/** Computes an owner-compatible original-input/receipt fingerprint in memory only. */
async function fingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialized(value)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Allocates a key only after the owner explicitly advertises recording. Disabled recording preserves unkeyed native API behavior. */
export function createProcessTriggerCommandIntent(
  kind: ProcessTriggerCommandKind,
  triggerCode: string,
  body: Readonly<Record<string, unknown>>,
  recording: 'ENABLED' | 'DISABLED',
): ProcessTriggerCommandIntent {
  if (
    !['create', 'update', 'archive', 'execute'].includes(kind) ||
    !isCode(triggerCode) ||
    !['ENABLED', 'DISABLED'].includes(recording)
  )
    throw new Error('Trigger command input is invalid');
  serialized({ triggerCode, body });
  return Object.freeze({
    kind,
    triggerCode,
    bodyJson: serialized(body),
    ...(recording === 'ENABLED'
      ? { idempotencyKey: `axis-trigger-${crypto.randomUUID()}` }
      : {}),
  });
}

/** Rejects failed, absent or ambiguous owner acknowledgements. */
function ownerRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Original trigger command evidence is unconfirmed');
  const record = value as Record<string, unknown>;
  if (
    record.success === false ||
    record.acknowledged === false ||
    record.error ||
    (record.errors !== undefined &&
      (!Array.isArray(record.errors) || record.errors.length))
  )
    throw new Error('Original trigger command evidence is unconfirmed');
  return record;
}

/** Reads the native success envelope without guessing a record from submitted fields. */
function ownerData(value: unknown, code: string): Record<string, unknown> {
  const envelope = ownerRecord(value);
  if (envelope.code !== code || ('data' in envelope && 'result' in envelope))
    throw new Error('Original trigger command evidence is unconfirmed');
  return ownerRecord(envelope.data ?? envelope.result);
}

/** Missing or malformed returned fields are uncertain acknowledgement, never a submitted-input error. */
function sameJson(actual: unknown, expected: unknown): boolean {
  try {
    return serialized(actual) === serialized(expected);
  } catch {
    return false;
  }
}

/** Validates the exact immutable intent before transport; the server still owns all domain validation and authorization. */
function originalBody(intent: ProcessTriggerCommandIntent): Record<string, unknown> {
  if (
    !isCode(intent.triggerCode) ||
    !['create', 'update', 'archive', 'execute'].includes(intent.kind) ||
    (intent.idempotencyKey !== undefined &&
      (typeof intent.idempotencyKey !== 'string' ||
        !intent.idempotencyKey.trim() ||
        intent.idempotencyKey.length > 512 ||
        Array.from(intent.idempotencyKey).some(
          (character) => character.charCodeAt(0) < 32,
        )))
  )
    throw new Error('Trigger command input is invalid');
  const body = ownerRecord(JSON.parse(intent.bodyJson) as unknown);
  if (serialized(body) !== intent.bodyJson)
    throw new Error('Trigger command input is invalid');
  return body;
}

/** Returns only the bounded instance reference originally requested for inquiry. It is not an acknowledgement or permission to act on that instance. */
export function requestedProcessTriggerInstanceCode(
  intent: ProcessTriggerCommandIntent,
): string | undefined {
  if (intent.kind !== 'execute') return undefined;
  try {
    const body = originalBody(intent);
    return isCode(body.instanceCode) ? body.instanceCode : undefined;
  } catch {
    return undefined;
  }
}

/** Submits one native command once and validates its original persisted/start acknowledgement. No retry or fallback route is used. */
export async function executeProcessTriggerCommand(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  intent: ProcessTriggerCommandIntent,
): Promise<ProcessTriggerCommandAcknowledgement> {
  const body = originalBody(intent);
  const path =
    intent.kind === 'create'
      ? '/triggers'
      : `/triggers/${encodeURIComponent(intent.triggerCode)}${['archive', 'execute'].includes(intent.kind) ? `/${intent.kind}` : ''}`;
  const raw = await request(connection, path, configuration, {
    method: intent.kind === 'update' ? 'PATCH' : 'POST',
    body: intent.bodyJson,
    ...(intent.idempotencyKey
      ? { headers: { 'Idempotency-Key': intent.idempotencyKey } }
      : {}),
  });
  const data = ownerData(
    raw,
    intent.kind === 'execute' ? 'SUC_PROCESS_00011' : 'SUC_PROCESS_00010',
  );
  const trigger = intent.kind === 'execute' ? ownerRecord(data.trigger) : data;
  if (trigger.code !== intent.triggerCode)
    throw new Error('Original trigger command evidence is unconfirmed');
  if (intent.kind === 'create' || intent.kind === 'update') {
    for (const [key, value] of Object.entries(body))
      if (!sameJson(trigger[key], value))
        throw new Error('Original trigger command evidence is unconfirmed');
  }
  if (
    intent.kind === 'archive' &&
    (trigger.status !== 'ARCHIVED' || trigger.active !== false)
  )
    throw new Error('Original trigger command evidence is unconfirmed');
  if (intent.kind === 'execute') {
    const execution = ownerRecord(data.execution);
    const instance = ownerRecord(execution.instance);
    if (
      !isCode(instance.code) ||
      instance.startCompleted !== true ||
      instance.definitionCode !== trigger.definitionCode ||
      (body.version !== undefined && instance.version !== body.version) ||
      (body.instanceCode !== undefined && instance.code !== body.instanceCode) ||
      !['RUNNING', 'WAITING', 'COMPLETED'].includes(String(instance.status))
    )
      throw new Error('Original trigger command evidence is unconfirmed');
    return Object.freeze({
      triggerCode: intent.triggerCode,
      instanceCode: instance.code,
    });
  }
  return Object.freeze({ triggerCode: intent.triggerCode });
}

/** Inspects only the original private receipt. Current records and absent/STARTED receipts never prove the original acknowledgement or authorize replay. */
export async function inspectProcessTriggerCommandReceipt(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  intent: ProcessTriggerCommandIntent,
  tenantCode: string,
  signal?: AbortSignal,
): Promise<ProcessTriggerCommandReceipt> {
  const body = originalBody(intent);
  if (!intent.idempotencyKey)
    throw new Error(
      'Original trigger command recording was not enabled for this request',
    );
  const raw = await request(
    connection,
    `/triggers/${encodeURIComponent(intent.triggerCode)}/commands/${intent.kind}/receipt/query`,
    configuration,
    {
      method: 'POST',
      body: JSON.stringify({ command: body, idempotencyKey: intent.idempotencyKey }),
      ...(signal ? { signal } : {}),
    },
  );
  const receipt = ownerData(raw, 'SUC_PROCESS_00010');
  const fields = [
    'contractVersion',
    'tenantCode',
    'enterpriseCode',
    'principalCode',
    'moduleName',
    'operation',
    'commandCode',
    'argumentsDigest',
    'state',
    ...(receipt.state === 'COMPLETED' ? ['resultIdentity', 'resultDigest'] : []),
  ];
  if (
    Object.keys(receipt).sort().join() !== fields.sort().join() ||
    receipt.contractVersion !== 1 ||
    receipt.tenantCode !== tenantCode ||
    receipt.enterpriseCode !== configuration.enterpriseCode ||
    receipt.moduleName !== 'workflow' ||
    receipt.operation !== `trigger.${intent.kind}` ||
    !['COMPLETED', 'OUTCOME_UNKNOWN'].includes(String(receipt.state)) ||
    typeof receipt.principalCode !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,191}$/.test(receipt.principalCode)
  )
    throw new Error('Original trigger command evidence is unconfirmed');
  // The native API binds principal to the current authenticated caller. Axis does
  // not decode credentials or infer an employee identity from presentation data.
  const scope = {
    tenantCode,
    enterpriseCode: configuration.enterpriseCode,
    principalCode: receipt.principalCode,
    moduleName: 'workflow',
    operation: `trigger.${intent.kind}`,
  };
  const argumentsDigest = await fingerprint({ triggerCode: intent.triggerCode, body });
  if (
    receipt.argumentsDigest !== argumentsDigest ||
    receipt.commandCode !==
      `command-${await fingerprint({ scope, key: intent.idempotencyKey })}` ||
    (receipt.state === 'COMPLETED' &&
      (receipt.resultIdentity !== intent.triggerCode ||
        receipt.resultDigest !==
          (await fingerprint({ argumentsDigest, resultIdentity: intent.triggerCode }))))
  )
    throw new Error('Original trigger command evidence is unconfirmed');
  return Object.freeze({
    state: receipt.state,
    triggerCode: intent.triggerCode,
    ...(receipt.state === 'COMPLETED' &&
    intent.kind === 'execute' &&
    isCode(body.instanceCode)
      ? { instanceCode: body.instanceCode }
      : {}),
  }) as ProcessTriggerCommandReceipt;
}
