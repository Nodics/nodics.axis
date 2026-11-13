import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  request,
  type ProcessDefinitionClientConfiguration,
} from './processDefinitionClient';

export type ProcessTriggerCommandKind = 'create' | 'update' | 'archive' | 'execute';
export type ProcessCommandAuthorization = 'AUTHORIZED' | 'DENIED' | 'UNAVAILABLE';
export interface ProcessCommandCapabilities {
  readonly contractVersion: 1;
  readonly newRecording: 'ENABLED' | 'DISABLED' | 'UNAVAILABLE';
  readonly triggerCommands: Readonly<
    Record<
      ProcessTriggerCommandKind,
      Readonly<{
        authorization: ProcessCommandAuthorization;
        receiptInspection: ProcessCommandAuthorization;
      }>
    >
  >;
}

/** Requires explicit native admission and a usable protocol mode. Recorded UI requests also require authorized original-receipt inspection; there is no silent unkeyed downgrade. */
export function canSubmitProcessTriggerCommand(
  capabilities: ProcessCommandCapabilities | undefined,
  kind: ProcessTriggerCommandKind,
): boolean {
  return Boolean(
    capabilities &&
    capabilities.newRecording !== 'UNAVAILABLE' &&
    capabilities.triggerCommands[kind].authorization === 'AUTHORIZED' &&
    (capabilities.newRecording === 'DISABLED' ||
      capabilities.triggerCommands[kind].receiptInspection === 'AUTHORIZED'),
  );
}

/** Rejects unknown/contradictory command metadata rather than inferring grants from routes, roles or record state. */
function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== [...keys].sort().join()
  )
    throw new Error('Process command availability could not be verified');
  return value as Record<string, unknown>;
}

/** Reads private advisory metadata once through the canonical Workflow owner. No failed read falls back to a grant or enables command recording. */
export async function loadProcessCommandCapabilities(
  connection: AxisModuleConnection,
  configuration: ProcessDefinitionClientConfiguration,
  signal?: AbortSignal,
): Promise<ProcessCommandCapabilities> {
  const response = await request(
    connection,
    '/operations/capabilities',
    configuration,
    {
      method: 'GET',
      ...(signal ? { signal } : {}),
    },
  );
  if (!response || typeof response !== 'object' || Array.isArray(response))
    throw new Error('Process command availability could not be verified');
  const envelope = response as Record<string, unknown>;
  if (
    envelope.code !== 'SUC_PROCESS_00000' ||
    envelope.success === false ||
    envelope.error ||
    envelope.acknowledged === false ||
    (envelope.errors !== undefined &&
      (!Array.isArray(envelope.errors) || envelope.errors.length)) ||
    ('data' in envelope && 'result' in envelope)
  )
    throw new Error('Process command availability could not be verified');
  const data = exactRecord(envelope.data ?? envelope.result, [
    'contractVersion',
    'newRecording',
    'triggerCommands',
  ]);
  if (
    data.contractVersion !== 1 ||
    !['ENABLED', 'DISABLED', 'UNAVAILABLE'].includes(String(data.newRecording))
  )
    throw new Error('Process command availability could not be verified');
  const commands = exactRecord(data.triggerCommands, [
    'create',
    'update',
    'archive',
    'execute',
  ]);
  const parsed = Object.fromEntries(
    Object.entries(commands).map(([kind, value]) => {
      const entry = exactRecord(value, ['authorization', 'receiptInspection']);
      if (
        ![entry.authorization, entry.receiptInspection].every(
          (state) =>
            typeof state === 'string' &&
            ['AUTHORIZED', 'DENIED', 'UNAVAILABLE'].includes(state),
        )
      )
        throw new Error('Process command availability could not be verified');
      return [kind, Object.freeze({ ...entry })];
    }),
  );
  return Object.freeze({
    contractVersion: 1,
    newRecording: data.newRecording,
    triggerCommands: Object.freeze(parsed),
  }) as ProcessCommandCapabilities;
}
