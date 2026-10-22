/** Checkout-owned spend selector. It never edits Profile roles, permissions or a Wallet balance. */
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';
import type { CmsResolvedPageContract } from '../../../cms/cmsContract';
export interface EnterpriseSpendCmsContext {
  baseUrl: string;
  site: string;
  locale: string;
  channel: string;
}
export const spendCopyKeys = [
  'title',
  'currency',
  'perPurchaseLimit',
  'noLimit',
  'load',
  'review',
  'confirm',
  'cancel',
  'inspect',
  'retry',
  'saved',
  'uncertain',
  'conflict',
  'unavailable',
  'invalid',
  'revision',
  'actor',
] as const;
export type SpendCopy = Record<(typeof spendCopyKeys)[number], string>;
export interface SpendSelection {
  enterpriseCode: string;
  actorCode: string;
  currency: string;
  perPurchaseLimit: string | null;
  revision: number | null;
}
export interface SpendCommand {
  actorCode: string;
  currency: string;
  perPurchaseLimit: string | null;
  expectedRevision: number | null;
}
export function parseSpendCopy(page: CmsResolvedPageContract): SpendCopy {
  const components = page.page.components.filter(
    (c) => c.code === 'checkoutEnterpriseSpendCopy',
  );
  if (
    components.length !== 1 ||
    components[0]?.renderer !== 'axis.component.message' ||
    components[0].rendererContractVersion !== 1
  )
    throw new Error('Spending presentation is unavailable.');
  return Object.fromEntries(
    spendCopyKeys.map((key) => {
      const value = components[0]!.properties[key];
      if (typeof value !== 'string' || !value.trim() || value.length > 1000)
        throw new Error('Spending presentation is unavailable.');
      return [key, value];
    }),
  ) as SpendCopy;
}
export function parseSpendSelection(
  value: unknown,
  c: OperationalOwnerConfiguration,
  actorCode: string,
  currency: string,
): SpendSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Spending selection is invalid.');
  const row = value as Record<string, unknown>;
  if (
    row.enterpriseCode !== c.enterpriseCode ||
    row.actorCode !== actorCode ||
    row.currency !== currency ||
    (row.revision !== null &&
      (!Number.isSafeInteger(row.revision) || (row.revision as number) < 0)) ||
    (row.perPurchaseLimit !== null &&
      (typeof row.perPurchaseLimit !== 'string' ||
        !/^\d+(?:\.\d+)?$/.test(row.perPurchaseLimit)))
  )
    throw new Error('Spending selection is invalid.');
  return {
    enterpriseCode: c.enterpriseCode,
    actorCode,
    currency,
    revision: row.revision as number | null,
    perPurchaseLimit: row.perPurchaseLimit,
  };
}
/** Profile instance selectors must not leak into discovery for the independent Checkout owner. */
function checkoutConfiguration(
  configuration: OperationalOwnerConfiguration,
): OperationalOwnerConfiguration {
  return {
    bootstrap: configuration.bootstrap,
    accessToken: configuration.accessToken,
    enterpriseCode: configuration.enterpriseCode,
    timeoutMs: configuration.timeoutMs,
  };
}
export async function readSpend(
  c: OperationalOwnerConfiguration,
  actorCode: string,
  currency: string,
): Promise<SpendSelection> {
  const result = await invokeOperationalOwner<unknown>(
    checkoutConfiguration(c),
    'checkoutCore',
    '/checkout/enterprise-spending/read',
    { actorCode, currency },
    'POST',
  );
  return parseSpendSelection(result, c, actorCode, currency);
}
export async function updateSpend(
  c: OperationalOwnerConfiguration,
  command: SpendCommand,
): Promise<SpendSelection> {
  const result = parseSpendSelection(
    await invokeOperationalOwner<unknown>(
      checkoutConfiguration(c),
      'checkoutCore',
      '/checkout/enterprise-spending/update',
      command,
      'POST',
    ),
    c,
    command.actorCode,
    command.currency,
  );
  if (
    result.perPurchaseLimit !== command.perPurchaseLimit ||
    result.revision !== (command.expectedRevision ?? -1) + 1
  )
    throw new Error('Spending selection was not confirmed.');
  return result;
}
