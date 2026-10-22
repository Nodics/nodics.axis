/** Digital-owned participation commands. Axis never derives defaults or edits private policy records. */
import type { AxisNavigationItem } from '../../bootstrap/publicBootstrap';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../shared/operationalOwnerClient';

export const switches = [
  'giftingEnabled',
  'receivingEnabled',
  'couponPurchasingEnabled',
] as const;
export const copyKeys = [
  'title',
  'navigationLabel',
  'summary',
  ...switches,
  'reason',
  'review',
  'confirm',
  'cancel',
  'refresh',
  'inspect',
  'retry',
  'saved',
  'unavailable',
  'uncertain',
  'conflict',
  'owner',
  'revision',
  'inherited',
  'enabled',
  'disabled',
] as const;
export type Selections = Record<(typeof switches)[number], boolean>;
export type ParticipationCopy = Record<(typeof copyKeys)[number], string>;
export interface ParticipationSettings {
  contractVersion: 1;
  ownerRef: { module: 'profile'; schema: 'enterprise'; code: string };
  revision: number | null;
  effective: Selections;
}
export interface ParticipationCommand extends Selections {
  expectedRevision: number | null;
  idempotencyKey: string;
  reason: string;
}
export interface ParticipationConfiguration extends OperationalOwnerConfiguration {
  navigation: AxisNavigationItem;
}
/** Exact owner/native key validation prevents hidden or foreign workspace dispatch. */
export function admitsParticipation(n: AxisNavigationItem): boolean {
  const b = n.backendWorkspace;
  return (
    n.moduleName === 'digitalCore' &&
    n.featureState === 'ACTIVE' &&
    ['UP', 'DEGRADED'].includes(n.availability) &&
    b?.contractVersion === 1 &&
    b.renderer === 'axis.workspace.native' &&
    b.workspaceCode === 'digitalCore.enterpriseParticipation' &&
    b.viewCode === 'settings' &&
    b.ownerSelector?.runtimeRoleCode === 'COMMERCE' &&
    b.ownerSelector.publicationRole === 'ONLINE'
  );
}
/** Validates a plain owner DTO without interpreting failed envelopes as selections. */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid owner response.');
  const row = value as Record<string, unknown>;
  if (
    row.success === false ||
    row.acknowledged === false ||
    row.error ||
    (typeof row.code === 'string' && row.code.startsWith('ERR_'))
  )
    throw new Error('Invalid owner response.');
  return row;
}
/** Never accept a personal, foreign-Enterprise, malformed or default-filled policy. */
export function parseSettings(
  value: unknown,
  enterprise: string,
): ParticipationSettings {
  const row = record(value),
    owner = record(row.ownerRef),
    effective = record(row.effective);
  if (
    row.contractVersion !== 1 ||
    owner.module !== 'profile' ||
    owner.schema !== 'enterprise' ||
    owner.code !== enterprise ||
    !(
      row.revision === null ||
      (typeof row.revision === 'number' &&
        Number.isSafeInteger(row.revision) &&
        row.revision >= 0)
    ) ||
    switches.some((k) => typeof effective[k] !== 'boolean')
  )
    throw new Error('Invalid owner response.');
  return {
    contractVersion: 1,
    ownerRef: { module: 'profile', schema: 'enterprise', code: enterprise },
    revision: row.revision,
    effective: Object.fromEntries(switches.map((k) => [k, effective[k]])) as Selections,
  };
}
/** Presentation is owner-supplied inert text, not a client-owned policy or permission catalogue. */
export function parseCopy(value: unknown): ParticipationCopy {
  const row = record(value);
  if (
    copyKeys.some(
      (k) => typeof row[k] !== 'string' || !row[k].trim() || row[k].length > 1000,
    )
  )
    throw new Error('Invalid owner presentation.');
  return Object.fromEntries(copyKeys.map((k) => [k, row[k]])) as ParticipationCopy;
}
/** Uses only the authorized discovered COMMERCE owner and fixed capability routes. */
async function invoke(c: ParticipationConfiguration, path: string, body?: unknown) {
  if (!admitsParticipation(c.navigation)) throw new Error('Workspace unavailable.');
  return invokeOperationalOwner<unknown>(
    { ...c, ownerSelector: c.navigation.backendWorkspace?.ownerSelector },
    'digitalCore',
    path,
    body,
    body === undefined ? 'GET' : 'POST',
  );
}
/** Reads the current signed Enterprise only; no owner selector is sent in the body. */
export async function readParticipation(c: ParticipationConfiguration) {
  const row = record(await invoke(c, '/gifts/settings'));
  return {
    ...parseSettings(row, c.enterpriseCode),
    presentation: parseCopy(row.presentation),
  };
}
/** Submits one reviewed intent and requires exact retained selections/revision in its acknowledgement. */
export async function saveParticipation(
  c: ParticipationConfiguration,
  command: ParticipationCommand,
) {
  const result = parseSettings(
    await invoke(c, '/gifts/settings', command),
    c.enterpriseCode,
  );
  if (
    result.revision !== (command.expectedRevision ?? -1) + 1 ||
    switches.some((k) => result.effective[k] !== command[k])
  )
    throw new Error('Change acknowledgement is unconfirmed.');
  return result;
}
/** Inspects the exact original current-actor command, not merely coincidentally matching policy values. */
export async function inspectParticipation(
  c: ParticipationConfiguration,
  command: ParticipationCommand,
) {
  const row = record(
    await invoke(c, '/gifts/settings/status', {
      idempotencyKey: command.idempotencyKey,
    }),
  );
  const owner = record(row.ownerRef);
  if (
    row.contractVersion !== 1 ||
    owner.module !== 'profile' ||
    owner.schema !== 'enterprise' ||
    owner.code !== c.enterpriseCode ||
    !['APPLIED', 'UNCONFIRMED'].includes(String(row.status))
  )
    throw new Error('Original change is unconfirmed.');
  if (row.status === 'UNCONFIRMED') return undefined;
  const receipt = parseSettings(row.receipt, c.enterpriseCode);
  if (
    receipt.revision !== (command.expectedRevision ?? -1) + 1 ||
    switches.some((k) => receipt.effective[k] !== command[k])
  )
    throw new Error('Original change is unconfirmed.');
  return receipt;
}
