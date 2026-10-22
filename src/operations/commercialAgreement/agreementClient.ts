/** Commercial Agreement DTOs and fixed owner transport; the browser never grants scope or evaluates terms. */
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
  'enterpriseCode',
  'code',
  'search',
  'refresh',
  'create',
  'amend',
  'history',
  'version',
  'revision',
  'actor',
  'recordedAt',
  'agreedPrice',
  'empty',
  'selectAgreement',
  'working',
  'unavailable',
  'recorded',
  'uncertain',
  'review',
  'confirm',
  'cancel',
  'discard',
  'discardTitle',
  'retry',
  'inspect',
  'commandId',
  'invalid',
  'model',
  'paymentTerms',
  'packageCode',
  'packageVersion',
  'packageCatalog',
  'priceCode',
  'priceVersion',
  'priceCatalog',
  'services',
  'allowances',
  'effectiveFrom',
  'effectiveTo',
  'serviceStart',
  'paymentSchedule',
  'billingPeriod',
  'renewalMode',
  'renewalPeriod',
  'renewalNotice',
  'renewalEvidence',
  'terminationTerms',
  'financialTreatment',
  'evidenceRef',
  'benefits',
  'benefitCode',
  'source',
  'targetType',
  'productCodes',
  'storeCode',
  'validFrom',
  'validTo',
  'additionalBenefitTerms',
  'financialReferences',
  'financialOwner',
  'referenceCode',
  'referenceVersion',
  'referenceCatalog',
  'addBenefit',
  'addReference',
  'remove',
  'previous',
  'next',
  'none',
  'FIXED_PRICE',
  'SUBSCRIPTION',
  'PREPAID',
  'INVOICE',
  'NONE',
  'MANUAL',
  'AUTOMATIC',
  'PACKAGE_INCLUDED',
  'ADD_ON',
  'SELECTED_COUPONS',
  'ALL_ENTERPRISE_COUPONS',
  'order',
  'paymentCore',
] as const;
export type AgreementCopy = Readonly<Record<(typeof copyKeys)[number], string>>;
export interface AgreementConfiguration {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly accessToken: string;
  readonly sessionGeneration: number;
  readonly enterpriseCode: string;
  readonly timeoutMs: number;
}
export interface AgreementReference {
  module: string;
  schema: string;
  code: string;
  versionId?: number;
  catalogVersion?: string;
}
export interface AgreementBenefit {
  code: string;
  source: string;
  targetType: string;
  productCodes: string[];
  storeCode: string;
  validFrom: string;
  validTo: string;
  evidenceRef: string;
  additionalBenefitTerms?: string;
}
export interface AgreementTerms {
  model: string;
  paymentTerms: string;
  packageRef: AgreementReference;
  priceRef: AgreementReference;
  services: string;
  allowances: string;
  effectiveFrom: string;
  effectiveTo?: string;
  serviceStart: string;
  paymentSchedule: string;
  billingPeriod?: string;
  renewal: {
    mode: string;
    period?: string;
    noticeTerms?: string;
    evidenceRef?: string;
  };
  terminationTerms: string;
  financialTreatment: string;
  evidenceRef: string;
  financialReferences: AgreementReference[];
  benefits: AgreementBenefit[];
}
export interface AgreementCommand {
  code: string;
  enterpriseCode: string;
  commandId: string;
  expectedRevision: number;
  terms: AgreementTerms;
}
export interface AgreementVersion {
  version: number;
  commandId: string;
  actor: string;
  recordedAt: string;
  terms: AgreementTerms;
  command: { commandId: string; expectedRevision: number; terms: AgreementTerms };
  agreedPrice: { reference: AgreementReference; unitAmount: string; currency: string };
}
export interface AgreementRecord {
  code: string;
  revision: number;
  enterpriseRef: { module: 'profile'; schema: 'enterprise'; code: string };
  versions: AgreementVersion[];
}
export interface AgreementSummary {
  code: string;
  revision: number;
  latestVersion: number;
}
export interface AgreementPage {
  agreements: AgreementSummary[];
  hasMore: boolean;
  pageNumber: number;
  pageSize: number;
}
export interface AgreementWorkspace {
  enterpriseCode: string;
  availableCommands: string[];
  options: {
    models: string[];
    paymentTerms: string[];
    benefitSources: string[];
    targetTypes: string[];
    renewalModes: string[];
    financialOwners: { module: string; schema: string }[];
  };
  limits: {
    pageSize: number;
    maximumPageSize: number;
    maximumBenefits: number;
    maximumSelectedProducts: number;
    maximumTextLength: number;
    maximumVersions: number;
    maximumRecordBytes: number;
  };
}
const invalid = (): never => {
  throw new Error('The owner response could not be confirmed.');
};
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
}
function text(value: unknown): string {
  return typeof value === 'string' && !!value.trim() ? value : invalid();
}
function integer(value: unknown, minimum = 1): number {
  return Number.isSafeInteger(value) && Number(value) >= minimum
    ? Number(value)
    : invalid();
}

/** Native dispatch is exact and requires the authorized available contributor, not a URL prefix. */
export function admitsAgreementWorkspace(item: AxisNavigationItem): boolean {
  return (
    item.moduleName === 'commercialAgreement' &&
    item.featureState === 'ACTIVE' &&
    ['UP', 'DEGRADED'].includes(item.availability) &&
    item.backendWorkspace?.renderer === 'axis.workspace.native' &&
    item.backendWorkspace.workspaceCode === 'commerce.agreements' &&
    item.backendWorkspace.viewCode === 'commercialAgreement.history'
  );
}

/** Extracts plain CMS copy only; CMS cannot supply endpoints, commands, grants or agreement values. */
export function parseAgreementCopy(page: CmsResolvedPageContract): AgreementCopy {
  const found = page.page.components.filter(
    (item) => item.code === 'commercialAgreementWorkspaceCopy',
  );
  if (
    found.length !== 1 ||
    found[0]?.renderer !== 'axis.component.message' ||
    found[0].rendererContractVersion !== 1
  )
    invalid();
  const properties = found[0]!.properties;
  return Object.fromEntries(
    copyKeys.map((key) => {
      const value = text(properties[key]);
      if (
        value.length > 1000 ||
        Array.from(value).some(
          (character) =>
            character.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(character),
        )
      )
        invalid();
      return [key, value];
    }),
  ) as unknown as AgreementCopy;
}

/** Uses one discovered owner connection and original employee context, with no fallback or mutation retry. */
async function invoke(
  configuration: AgreementConfiguration,
  operation: 'workspace' | 'search' | 'read' | 'record',
  body: unknown,
): Promise<unknown> {
  if (!admitsAgreementWorkspace(configuration.navigation)) invalid();
  const connection = selectModuleConnection(
    configuration.bootstrap,
    'commercialAgreement',
    configuration.navigation.backendWorkspace?.ownerSelector,
  );
  if (!connection?.endpoint) invalid();
  const url = new URL(
    connection!.endpoint.replace(/\/$/, '') + '/v0/agreements/' + operation,
  );
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    invalid();
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), configuration.timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + configuration.accessToken,
        'Content-Type': 'application/json',
        'x-enterprise-code': configuration.enterpriseCode,
      },
      body: JSON.stringify(body),
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

/** Accepts only implemented option vocabularies and complete positive owner limits. */
export function parseAgreementWorkspace(
  value: unknown,
  enterpriseCode: string,
): AgreementWorkspace {
  const row = object(value),
    options = object(row.options),
    limits = object(row.limits),
    mutation = object(row.mutation);
  if (
    row.contractVersion !== 1 ||
    row.workspaceCode !== 'commerce.agreements' ||
    row.viewCode !== 'commercialAgreement.history' ||
    row.enterpriseCode !== enterpriseCode ||
    mutation.expectedRevisionRequired !== true ||
    mutation.commandIdRequired !== true ||
    mutation.automaticRetry !== false
  )
    invalid();
  const choices = (key: string, allowed: string[]): string[] => {
    const list = options[key];
    if (
      !Array.isArray(list) ||
      !list.length ||
      list.some((v) => !allowed.includes(String(v))) ||
      new Set(list).size !== list.length
    )
      invalid();
    return list as string[];
  };
  const commands = row.availableCommands;
  if (
    !Array.isArray(commands) ||
    !commands.includes('read') ||
    !commands.includes('search') ||
    commands.some((v) => !['read', 'search', 'record'].includes(String(v))) ||
    new Set(commands).size !== commands.length
  )
    invalid();
  const owners = options.financialOwners;
  if (
    !Array.isArray(owners) ||
    owners.length > 2 ||
    owners.some((v) => {
      const ref = object(v);
      return !(
        (ref.module === 'order' && ref.schema === 'commerceOrder') ||
        (ref.module === 'paymentCore' && ref.schema === 'paymentTransaction')
      );
    })
  )
    invalid();
  const result: AgreementWorkspace = {
    enterpriseCode,
    availableCommands: commands as string[],
    options: {
      models: choices('models', ['FIXED_PRICE', 'SUBSCRIPTION']),
      paymentTerms: choices('paymentTerms', ['PREPAID', 'INVOICE']),
      benefitSources: choices('benefitSources', ['PACKAGE_INCLUDED', 'ADD_ON']),
      targetTypes: choices('targetTypes', [
        'SELECTED_COUPONS',
        'ALL_ENTERPRISE_COUPONS',
      ]),
      renewalModes: choices('renewalModes', ['NONE', 'MANUAL', 'AUTOMATIC']),
      financialOwners: owners as AgreementWorkspace['options']['financialOwners'],
    },
    limits: {
      pageSize: integer(limits.pageSize),
      maximumPageSize: integer(limits.maximumPageSize),
      maximumBenefits: integer(limits.maximumBenefits),
      maximumSelectedProducts: integer(limits.maximumSelectedProducts),
      maximumTextLength: integer(limits.maximumTextLength),
      maximumVersions: integer(limits.maximumVersions),
      maximumRecordBytes: integer(limits.maximumRecordBytes),
    },
  };
  if (result.limits.pageSize > result.limits.maximumPageSize) invalid();
  return result;
}
export async function loadAgreementWorkspace(
  configuration: AgreementConfiguration,
  enterpriseCode: string,
) {
  return parseAgreementWorkspace(
    await invoke(configuration, 'workspace', { enterpriseCode }),
    enterpriseCode,
  );
}

/** Requires exact scoped, bounded summary responses; an unknown envelope is not an empty list. */
export async function searchAgreements(
  configuration: AgreementConfiguration,
  workspace: AgreementWorkspace,
  pageNumber: number,
): Promise<AgreementPage> {
  const pageSize = workspace.limits.pageSize;
  const row = object(
    await invoke(configuration, 'search', {
      enterpriseCode: workspace.enterpriseCode,
      pageNumber,
      pageSize,
    }),
  );
  if (
    row.pageNumber !== pageNumber ||
    row.pageSize !== pageSize ||
    typeof row.hasMore !== 'boolean' ||
    !Array.isArray(row.agreements) ||
    row.agreements.length > pageSize
  )
    invalid();
  const agreements = (row.agreements as unknown[]).map((value) => {
    const item = object(value),
      ref = object(item.enterpriseRef);
    if (
      ref.module !== 'profile' ||
      ref.schema !== 'enterprise' ||
      ref.code !== workspace.enterpriseCode
    )
      invalid();
    return {
      code: text(item.code),
      revision: integer(item.revision),
      latestVersion: integer(item.latestVersion),
    };
  });
  if (new Set(agreements.map((row) => row.code)).size !== agreements.length) invalid();
  return { agreements, hasMore: row.hasMore as boolean, pageNumber, pageSize };
}

/** Validates presentation shape; legal, monetary, targeting and temporal admission remain backend responsibilities. */
function parseTerms(value: unknown): AgreementTerms {
  const row = object(value),
    renewal = object(row.renewal);
  for (const key of [
    'model',
    'paymentTerms',
    'services',
    'allowances',
    'effectiveFrom',
    'serviceStart',
    'paymentSchedule',
    'terminationTerms',
    'financialTreatment',
    'evidenceRef',
  ])
    text(row[key]);
  for (const key of ['packageRef', 'priceRef']) {
    const ref = object(row[key]);
    text(ref.code);
    integer(ref.versionId, 0);
  }
  text(renewal.mode);
  if (!Array.isArray(row.benefits) || !Array.isArray(row.financialReferences))
    invalid();
  for (const item of row.benefits as unknown[]) {
    const benefit = object(item);
    for (const key of [
      'code',
      'source',
      'targetType',
      'storeCode',
      'validFrom',
      'validTo',
      'evidenceRef',
    ])
      text(benefit[key]);
    if (
      !Array.isArray(benefit.productCodes) ||
      benefit.productCodes.some((code) => typeof code !== 'string')
    )
      invalid();
  }
  for (const value of row.financialReferences as unknown[]) {
    const ref = object(value);
    text(ref.module);
    text(ref.schema);
    text(ref.code);
  }
  return structuredClone(row) as unknown as AgreementTerms;
}

/** Reads persisted history with exact identity and contiguous versions before permitting an amendment. */
export async function readAgreement(
  configuration: AgreementConfiguration,
  workspace: AgreementWorkspace,
  code: string,
): Promise<AgreementRecord> {
  const row = object(
      await invoke(configuration, 'read', {
        code,
        enterpriseCode: workspace.enterpriseCode,
      }),
    ),
    ref = object(row.enterpriseRef);
  const revision = integer(row.revision);
  if (
    row.code !== code ||
    ref.module !== 'profile' ||
    ref.schema !== 'enterprise' ||
    ref.code !== workspace.enterpriseCode ||
    !Array.isArray(row.versions) ||
    row.versions.length !== revision ||
    revision > workspace.limits.maximumVersions ||
    new TextEncoder().encode(JSON.stringify(row)).length >
      workspace.limits.maximumRecordBytes * 2
  )
    invalid();
  const versions = (row.versions as unknown[]).map((value, index): AgreementVersion => {
    const item = object(value),
      command = object(item.command),
      price = object(item.agreedPrice);
    if (
      item.version !== index + 1 ||
      command.commandId !== item.commandId ||
      command.expectedRevision !== index
    )
      invalid();
    const terms = parseTerms(item.terms),
      commandTerms = parseTerms(command.terms);
    if (canonical(terms) !== canonical(commandTerms)) invalid();
    text(price.unitAmount);
    text(price.currency);
    object(price.reference);
    return {
      version: index + 1,
      commandId: text(item.commandId),
      actor: text(item.actor),
      recordedAt: text(item.recordedAt),
      terms,
      command: {
        commandId: text(item.commandId),
        expectedRevision: index,
        terms: commandTerms,
      },
      agreedPrice: price as unknown as AgreementVersion['agreedPrice'],
    };
  });
  if (new Set(versions.map((item) => item.commandId)).size !== versions.length)
    invalid();
  return {
    code,
    revision,
    enterpriseRef: {
      module: 'profile',
      schema: 'enterprise',
      code: workspace.enterpriseCode,
    },
    versions,
  };
}
/** Order-independent structural equality for retained command evidence, never a business evaluation. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
/** Matches retained exact command evidence after an uncertain acknowledgement. */
export function retainedCommand(
  record: AgreementRecord,
  command: AgreementCommand,
): boolean {
  return (
    record.code === command.code &&
    record.enterpriseRef.code === command.enterpriseCode &&
    record.versions.some(
      (version) =>
        version.commandId === command.commandId &&
        version.command.expectedRevision === command.expectedRevision &&
        canonical(version.terms) === canonical(command.terms),
    )
  );
}
/** Sends one reviewed command; a matching acknowledgement still requires an explicit persisted readback. */
export async function recordAgreement(
  configuration: AgreementConfiguration,
  workspace: AgreementWorkspace,
  command: AgreementCommand,
) {
  if (
    !workspace.availableCommands.includes('record') ||
    command.enterpriseCode !== workspace.enterpriseCode
  )
    invalid();
  const result = object(await invoke(configuration, 'record', command));
  if (
    result.code !== command.code ||
    result.version !== command.expectedRevision + 1 ||
    integer(result.revision) < Number(result.version) ||
    typeof result.replayed !== 'boolean'
  )
    invalid();
}
