/** Fixed LoyaltyAPI contracts. Profile and Wallet retain all ownership and command authority. */
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import {
  envelopeData,
  backendWorkspaceResponseError,
} from '../../app/backendWorkspaceClient';
import { observeEmployeeSessionResponse } from '../../auth/employeeSessionEvents';
import type { CmsResolvedPageContract } from '../../cms/cmsContract';

export const copyKeys = [
  'title',
  'message',
  'walletTitle',
  'settingsTitle',
  'creditTitle',
  'load',
  'refresh',
  'unavailable',
  'emptyWallet',
  'emptyBalances',
  'emptyEntries',
  'owner',
  'actor',
  'walletCode',
  'status',
  'programCode',
  'rewardTypeCode',
  'name',
  'precision',
  'available',
  'reserved',
  'earned',
  'spent',
  'expired',
  'reversed',
  'transferEligible',
  'transferFeeAmount',
  'ledger',
  'code',
  'entryType',
  'amount',
  'sourceType',
  'sourceCode',
  'postedAt',
  'outgoingEnabled',
  'incomingEnabled',
  'maximumAmount',
  'maximumDailyAmount',
  'maximumDailyCount',
  'inherited',
  'selected',
  'inherit',
  'enabled',
  'disabled',
  'noLimit',
  'effective',
  'selections',
  'feeAmount',
  'timeZone',
  'revision',
  'review',
  'confirm',
  'cancel',
  'saved',
  'uncertain',
  'inspect',
  'retry',
  'reason',
  'idempotencyKey',
  'recoverOriginal',
  'testOnly',
  'creditConfirmed',
  'newCredit',
  'operationCode',
  'ledgerEntryCode',
  'creditedAt',
  'invalid',
  'conflict',
  'working',
  'policyWarning',
] as const;
export type LoyaltyCopy = Record<(typeof copyKeys)[number], string>;
export type LoyaltyView = 'wallet' | 'transferSettings' | 'enterpriseTestCredit';
export interface LoyaltyConfiguration {
  bootstrap: AxisAuthenticatedBootstrap;
  navigation: AxisNavigationItem;
  accessToken: string;
  sessionGeneration: number;
  enterpriseCode: string;
  timeoutMs: number;
}
export interface Selections {
  incomingEnabled?: boolean;
  outgoingEnabled?: boolean;
  maximumAmount?: string | null;
  maximumDailyAmount?: string | null;
  maximumDailyCount?: number | null;
}
export interface EffectivePolicy extends Required<Selections> {
  enabled: boolean;
  feeAmount: string;
  timeZone: string;
}
export interface TransferSettings {
  ownerType: 'ENTERPRISE';
  ownerCode: string;
  programCode: string;
  rewardTypeCode: string;
  revision: number | null;
  selections: Selections;
  effective: EffectivePolicy;
}
export interface SettingsCommand {
  programCode: string;
  rewardTypeCode: string;
  expectedRevision: number | null;
  selections: Selections;
}
export interface CreditCommand {
  walletCode: string;
  programCode: string;
  rewardTypeCode: string;
  amount: string;
  reason: string;
  idempotencyKey: string;
  confirmed: true;
}
export interface CreditReceipt {
  status: 'CREDITED' | 'CURRENT';
  testOnly: true;
  operationCode: string;
  walletCode: string;
  ownerType: 'ENTERPRISE';
  ownerCode: string;
  programCode: string;
  rewardTypeCode: string;
  amount: string;
  ledgerEntryCode: string;
  actorCode: string;
  creditedAt: string;
}
export const counters = [
  'available',
  'reserved',
  'earned',
  'spent',
  'expired',
  'reversed',
] as const;
export interface WalletBalance extends Record<(typeof counters)[number], string> {
  code: string;
  programCode: string;
  rewardTypeCode: string;
  name: string;
  precision: number;
  transferEligible: boolean;
  transferFeeAmount: string;
}
export interface LedgerEntry {
  code: string;
  programCode: string;
  rewardTypeCode: string;
  entryType: string;
  amount: string;
  sourceType: string;
  sourceCode: string;
  postedAt: string;
}
export interface ParticipantWallet {
  owner: { ownerType: 'ENTERPRISE'; ownerCode: string; actorCode: string };
  wallet: null | {
    code: string;
    ownerType: 'ENTERPRISE';
    ownerCode: string;
    status: string;
  };
  balances: WalletBalance[];
  entries: LedgerEntry[];
}
export function invalid(): never {
  throw new Error('Invalid Loyalty owner evidence.');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return invalid();
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') return invalid();
  return value;
}
function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return invalid();
  return value as number;
}
export function decimal(value: unknown): string {
  const v = text(value);
  if (!/^\d+(?:\.\d+)?$/.test(v)) return invalid();
  return v;
}
function date(value: unknown): string {
  const v = text(value);
  if (!Number.isFinite(Date.parse(v))) return invalid();
  return v;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) return invalid();
  return value;
}
/** Order-independent identity for authority replacement and exact selection reconciliation. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stable(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value) ?? 'undefined';
}
export function loyaltyView(navigation: AxisNavigationItem): LoyaltyView | undefined {
  const binding = navigation.backendWorkspace;
  if (
    navigation.moduleName !== 'loyaltyWallet' ||
    navigation.featureState !== 'ACTIVE' ||
    !['UP', 'DEGRADED'].includes(navigation.availability) ||
    binding?.renderer !== 'axis.workspace.native' ||
    binding.contractVersion !== 1 ||
    binding.workspaceCode !== 'loyalty.participation'
  )
    return;
  return (
    {
      'loyalty.wallet': 'wallet',
      'loyalty.transferSettings': 'transferSettings',
      'loyalty.enterpriseTestCredit': 'enterpriseTestCredit',
    } as const
  )[binding.viewCode as 'loyalty.wallet'];
}
export function parseLoyaltyCopy(page: CmsResolvedPageContract): LoyaltyCopy {
  const found = page.page.components.filter(
    (c) => c.code === 'loyaltyParticipationWorkspaceCopy',
  );
  if (
    found.length !== 1 ||
    found[0]?.renderer !== 'axis.component.message' ||
    found[0].rendererContractVersion !== 1
  )
    return invalid();
  const properties = found[0].properties;
  return Object.fromEntries(
    copyKeys.map((key) => {
      const value = properties[key];
      if (
        typeof value !== 'string' ||
        (key !== 'message' && !value.trim()) ||
        value.length > 1000
      )
        return invalid();
      return [key, value];
    }),
  ) as LoyaltyCopy;
}
type Operation = 'wallet' | 'settings' | 'saveSettings' | 'credit';
const operations = {
  wallet: { view: 'wallet', method: 'GET', path: '/participant/wallet' },
  settings: {
    view: 'transferSettings',
    method: 'POST',
    path: '/participant/transfer-policy/read',
  },
  saveSettings: {
    view: 'transferSettings',
    method: 'PUT',
    path: '/participant/transfer-policy',
  },
  credit: {
    view: 'enterpriseTestCredit',
    method: 'POST',
    path: '/admin/enterprise-test-credits',
  },
} as const;
async function invoke(
  configuration: LoyaltyConfiguration,
  operation: Operation,
  body?: unknown,
): Promise<unknown> {
  const target = operations[operation];
  if (loyaltyView(configuration.navigation) !== target.view) return invalid();
  const connection = selectModuleConnection(
    configuration.bootstrap,
    'loyaltyApi',
    configuration.navigation.backendWorkspace?.ownerSelector,
  );
  if (!connection?.endpoint) return invalid();
  const url = new URL(connection.endpoint.replace(/\/$/, '') + '/v0' + target.path);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return invalid();
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), configuration.timeoutMs);
  try {
    const response = await fetch(url, {
      method: target.method,
      cache: 'no-store',
      redirect: 'error',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + configuration.accessToken,
        'x-enterprise-code': configuration.enterpriseCode,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    observeEmployeeSessionResponse(
      response,
      configuration.accessToken,
      configuration.sessionGeneration,
    );
    if (!response.ok) throw await backendWorkspaceResponseError(response);
    let value: unknown = await response.json();
    for (let depth = 0; depth < 4; depth++) {
      const next = envelopeData(value);
      if (next === value) break;
      value = next;
    }
    return value;
  } finally {
    clearTimeout(timer);
  }
}
export function parseSelections(value: unknown): Selections {
  const row = object(value),
    result: Selections = {};
  for (const key of Object.keys(row)) {
    if (key === 'incomingEnabled' || key === 'outgoingEnabled')
      result[key] = boolean(row[key]);
    else if (key === 'maximumAmount' || key === 'maximumDailyAmount')
      result[key] = row[key] === null ? null : decimal(row[key]);
    else if (key === 'maximumDailyCount') {
      result[key] = row[key] === null ? null : integer(row[key]);
      if (result[key] === 0) invalid();
    } else invalid();
  }
  return result;
}
export function parseSettings(
  value: unknown,
  enterprise: string,
  selectors: { programCode: string; rewardTypeCode: string },
): TransferSettings {
  const row = object(value),
    effective = object(row.effective);
  if (
    row.ownerType !== 'ENTERPRISE' ||
    row.ownerCode !== enterprise ||
    row.programCode !== selectors.programCode ||
    row.rewardTypeCode !== selectors.rewardTypeCode
  )
    return invalid();
  const selections = parseSelections(row.selections);
  const selected = parseSelections(
    Object.fromEntries(
      [
        'incomingEnabled',
        'outgoingEnabled',
        'maximumAmount',
        'maximumDailyAmount',
        'maximumDailyCount',
      ].map((key) => [key, effective[key]]),
    ),
  ) as Required<Selections>;
  return {
    ownerType: 'ENTERPRISE',
    ownerCode: enterprise,
    programCode: selectors.programCode,
    rewardTypeCode: selectors.rewardTypeCode,
    revision: row.revision === null ? null : integer(row.revision),
    selections,
    effective: {
      ...selected,
      enabled: boolean(effective.enabled),
      feeAmount: decimal(effective.feeAmount),
      timeZone: text(effective.timeZone),
    },
  };
}
export async function readSettings(
  c: LoyaltyConfiguration,
  s: { programCode: string; rewardTypeCode: string },
): Promise<TransferSettings> {
  return parseSettings(
    await invoke(c, 'settings', {
      programCode: s.programCode,
      rewardTypeCode: s.rewardTypeCode,
    }),
    c.enterpriseCode,
    s,
  );
}
export async function saveSettings(
  c: LoyaltyConfiguration,
  command: SettingsCommand,
): Promise<TransferSettings> {
  const result = parseSettings(
    await invoke(c, 'saveSettings', command),
    c.enterpriseCode,
    command,
  );
  if (
    result.revision !== (command.expectedRevision ?? -1) + 1 ||
    stable(result.selections) !== stable(command.selections)
  )
    return invalid();
  return result;
}
export function parseCreditReceipt(
  value: unknown,
  command: CreditCommand,
): CreditReceipt {
  const row = object(value);
  if (
    !['CREDITED', 'CURRENT'].includes(text(row.status)) ||
    row.testOnly !== true ||
    row.ownerType !== 'ENTERPRISE'
  )
    return invalid();
  for (const key of ['walletCode', 'programCode', 'rewardTypeCode', 'amount'] as const)
    if (row[key] !== command[key]) return invalid();
  return {
    status: row.status as CreditReceipt['status'],
    testOnly: true,
    ownerType: 'ENTERPRISE',
    walletCode: command.walletCode,
    programCode: command.programCode,
    rewardTypeCode: command.rewardTypeCode,
    amount: command.amount,
    ownerCode: text(row.ownerCode),
    operationCode: text(row.operationCode),
    ledgerEntryCode: text(row.ledgerEntryCode),
    actorCode: text(row.actorCode),
    creditedAt: date(row.creditedAt),
  };
}
export async function credit(
  c: LoyaltyConfiguration,
  command: CreditCommand,
): Promise<CreditReceipt> {
  return parseCreditReceipt(await invoke(c, 'credit', command), command);
}
export async function readWallet(c: LoyaltyConfiguration): Promise<ParticipantWallet> {
  const row = object(await invoke(c, 'wallet')),
    owner = object(row.owner);
  if (owner.ownerType !== 'ENTERPRISE' || owner.ownerCode !== c.enterpriseCode)
    return invalid();
  const identity = {
    ownerType: 'ENTERPRISE' as const,
    ownerCode: c.enterpriseCode,
    actorCode: text(owner.actorCode),
  };
  const balances = array(row.balances).map((value) => {
    const item = object(value);
    return {
      code: text(item.code),
      programCode: text(item.programCode),
      rewardTypeCode: text(item.rewardTypeCode),
      name: text(item.name),
      precision: integer(item.precision),
      ...(Object.fromEntries(
        counters.map((key) => [key, decimal(item[key])]),
      ) as Record<(typeof counters)[number], string>),
      transferEligible: boolean(item.transferEligible),
      transferFeeAmount: decimal(item.transferFeeAmount),
    };
  });
  const entries = array(row.entries).map((value) => {
    const item = object(value);
    return {
      code: text(item.code),
      programCode: text(item.programCode),
      rewardTypeCode: text(item.rewardTypeCode),
      entryType: text(item.entryType),
      amount: decimal(item.amount),
      sourceType: text(item.sourceType),
      sourceCode: text(item.sourceCode),
      postedAt: date(item.postedAt),
    };
  });
  if (
    new Set(balances.map((b) => stable([b.programCode, b.rewardTypeCode]))).size !==
      balances.length ||
    new Set(entries.map((e) => e.code)).size !== entries.length
  )
    return invalid();
  if (row.wallet === null) {
    if (balances.length || entries.length) return invalid();
    return { owner: identity, wallet: null, balances, entries };
  }
  const wallet = object(row.wallet);
  if (
    wallet.ownerType !== identity.ownerType ||
    wallet.ownerCode !== identity.ownerCode
  )
    return invalid();
  return {
    owner: identity,
    wallet: {
      code: text(wallet.code),
      ...{ ownerType: identity.ownerType, ownerCode: identity.ownerCode },
      status: text(wallet.status),
    },
    balances,
    entries,
  };
}
