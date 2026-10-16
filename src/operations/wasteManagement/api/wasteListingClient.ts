import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';

export const listingStates = [
  'OWNER_INSPECTION_REQUIRED',
  'OWNER_UNAVAILABLE',
  'AWAITING_AUTHORING',
  'AWAITING_PUBLICATION',
  'AWAITING_BINDING',
  'LISTED',
  'RECONCILIATION_REQUIRED',
] as const;
export type WasteListingState = (typeof listingStates)[number];
export const listingLabelKeys = [
  'title',
  'refresh',
  'loading',
  'empty',
  'unavailable',
  'details',
  'close',
  'previous',
  'next',
  'page',
  'asset',
  'name',
  'status',
  'rewardPrice',
  'signedEnterprise',
  'requiredEnterprise',
  'store',
  'product',
  'priceRow',
  'publication',
  'unknown',
  'readOnly',
  'wrongEnterprise',
  'ownerUnavailable',
  'reconciliationRequired',
  'commandUnavailable',
  'authorProduct',
  'openPublication',
] as const;
export type WasteListingLabels = Readonly<
  Record<(typeof listingLabelKeys)[number], string>
>;
export interface WasteListingPresentation {
  readonly reconciliation?: Readonly<
    Record<
      | 'inspectLabel'
      | 'withdrawLabel'
      | 'reasonLabel'
      | 'confirmLabel'
      | 'cancelLabel'
      | 'holdMessage'
      | 'uncertainMessage'
      | 'unavailableMessage',
      string
    >
  >;
  readonly labels: WasteListingLabels;
  readonly states: Readonly<Record<WasteListingState, string>>;
  readonly authoring?: Readonly<
    Record<
      | 'reviewTitle'
      | 'confirmLabel'
      | 'cancelLabel'
      | 'workingLabel'
      | 'savedMessage'
      | 'uncertainMessage'
      | 'inspectLabel',
      string
    >
  >;
}
export const listingActions = [
  'READ_DETAILS',
  'AUTHOR_PRODUCT_SOURCE',
  'OPEN_PUBLICATION_WORKFLOW',
] as const;
export type WasteListingAction = (typeof listingActions)[number];
export const listingPublicationStates = [
  'STAGED',
  'VALIDATING',
  'VALIDATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVATING',
  'ONLINE',
  'ROLLING_BACK',
  'ROLLED_BACK',
  'WITHDRAWING',
  'WITHDRAWN',
  'REJECTED',
  'FAILED',
  'APPROVAL_PENDING',
  'DRAFT',
  'SUBMITTED',
  'PUBLISHED',
  'ACTIVE',
  'RETIRED',
] as const;
export type WasteListingPublicationState = (typeof listingPublicationStates)[number];
interface ProductSource {
  readonly productCode: string;
  readonly variantCode: string;
  readonly sku: string;
  readonly catalogVersion: string;
  readonly versionId: number;
  readonly locales: readonly string[];
}
/** Read-only presentation of retained intent. Private command bodies and unknown owner fields are not copied. */
export interface WasteListingRequest {
  readonly contractVersion: 1;
  readonly assetCode: string;
  readonly assetRevision: number;
  readonly assetStatus: 'LISTING_REQUESTED' | 'LISTED';
  readonly state: WasteListingState;
  readonly listingKey: string | null;
  readonly requestRevision: number | null;
  readonly intentDigest: string | null;
  readonly rewardPrice: number | null;
  readonly ownerRef: Readonly<{ module: 'profile'; schema: 'customer'; code: string }>;
  readonly storeContext: Readonly<{
    code: string;
    enterpriseCode: string;
    revision: number;
  }> | null;
  readonly authoringContext: Readonly<{
    catalogVersion: string;
    locales: readonly string[];
  }> | null;
  readonly productCommand: Readonly<{
    name: string;
    description: string;
    sample: boolean;
  }> | null;
  readonly product: ProductSource | null;
  readonly productReference: Readonly<{
    publicationCode: string;
    productCode: string;
    storeCode: string;
    sourceVersion: string;
    targetVersion: string;
  }> | null;
  readonly priceRowIntent: Readonly<{
    code: string;
    priceBookCode: string;
    currency: string;
    unitAmount: string;
    minQuantity: '1';
  }> | null;
  readonly publicationReferences: readonly Readonly<{
    domain: 'product' | 'pricing';
    code: string;
    state: WasteListingPublicationState;
    processCode?: string;
  }>[];
  readonly eligibility: Readonly<{
    signedEnterpriseCode: string;
    requiredEnterpriseCode: string | null;
    canAuthor: boolean;
    blockerCode: string | null;
  }>;
  readonly actions: readonly WasteListingAction[];
}
export interface WasteListingPage {
  readonly contractVersion: 1;
  readonly items: readonly WasteListingRequest[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}
function invalid(): never {
  throw new Error('Listing owner response is incompatible.');
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = 180): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maximum ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code === 127 || (code < 32 && code !== 10 && code !== 13);
    })
  )
    return invalid();
  return value;
}
function id(value: unknown): string {
  const result = text(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:@|-]{0,179}$/.test(result)) return invalid();
  return result;
}
function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum)
    return invalid();
  return value;
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return invalid();
  return value;
}
function nullable<T>(value: unknown, parse: (input: unknown) => T): T | null {
  return value === null ? null : parse(value);
}
function choices<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) return invalid();
  return value as T;
}
function locales(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) return invalid();
  const result = value.map((item) => {
    const locale = text(item, 32);
    if (!/^[A-Za-z0-9_-]+$/.test(locale)) return invalid();
    return locale;
  });
  if (new Set(result).size !== result.length) return invalid();
  return result;
}
/** Only inert, bounded copy for this exact owner binding is admitted. */
export function parseWasteListingWorkspace(value: unknown): WasteListingPresentation {
  const input = record(value),
    presentation = record(input.presentation),
    labels = record(presentation.labels),
    states = record(presentation.states);
  if (
    input.contractVersion !== 1 ||
    input.workspaceCode !== 'waste.listing' ||
    input.viewCode !== 'ewaste.listingRequests'
  )
    return invalid();
  return {
    labels: Object.fromEntries(
      listingLabelKeys.map((key) => [key, text(labels[key], 500)]),
    ) as WasteListingLabels,
    states: Object.fromEntries(
      listingStates.map((key) => [key, text(states[key], 500)]),
    ) as WasteListingPresentation['states'],
    ...(presentation.reconciliation === undefined
      ? {}
      : {
          reconciliation: Object.fromEntries(
            [
              'inspectLabel',
              'withdrawLabel',
              'reasonLabel',
              'confirmLabel',
              'cancelLabel',
              'holdMessage',
              'uncertainMessage',
              'unavailableMessage',
            ].map((key) => [key, text(record(presentation.reconciliation)[key], 500)]),
          ) as NonNullable<WasteListingPresentation['reconciliation']>,
        }),
    ...(presentation.authoring === undefined
      ? {}
      : {
          authoring: Object.fromEntries(
            [
              'reviewTitle',
              'confirmLabel',
              'cancelLabel',
              'workingLabel',
              'savedMessage',
              'uncertainMessage',
              'inspectLabel',
            ].map((key) => [key, text(record(presentation.authoring)[key], 500)]),
          ) as NonNullable<WasteListingPresentation['authoring']>,
        }),
  };
}
/** Reads only the frozen owner presentation endpoint, under the current human namespace. */
export async function loadWasteListingWorkspace(
  configuration: OperationalOwnerConfiguration,
): Promise<WasteListingPresentation> {
  return parseWasteListingWorkspace(
    await invokeOperationalOwner<unknown>(
      configuration,
      'eWaste',
      '/listing-workspace',
    ),
  );
}
/** Validates identity, namespace and finite owner states; no returned URL or command is executable. */
export function parseWasteListing(
  value: unknown,
  signedEnterpriseCode: string,
): WasteListingRequest {
  const row = record(value),
    owner = record(row.ownerRef),
    eligibility = record(row.eligibility);
  if (
    row.contractVersion !== 1 ||
    owner.module !== 'profile' ||
    owner.schema !== 'customer' ||
    typeof eligibility.canAuthor !== 'boolean'
  )
    return invalid();
  const storeContext = nullable(row.storeContext, (input) => {
    const item = record(input);
    return {
      code: id(item.code),
      enterpriseCode: id(item.enterpriseCode),
      revision: integer(item.revision, 1),
    };
  });
  const authoringContext = nullable(row.authoringContext, (input) => {
    const item = record(input);
    return { catalogVersion: id(item.catalogVersion), locales: locales(item.locales) };
  });
  const product = nullable(row.product, (input) => {
    const item = record(input);
    return {
      productCode: id(item.productCode),
      variantCode: id(item.variantCode),
      sku: id(item.sku),
      catalogVersion: id(item.catalogVersion),
      versionId: integer(item.versionId),
      locales: locales(item.locales),
    };
  });
  const productReference = nullable(row.productReference, (input) => {
    const item = record(input),
      sourceVersion = text(item.sourceVersion, 32);
    if (
      !/^(0|[1-9]\d*)$/.test(sourceVersion) ||
      !Number.isSafeInteger(Number(sourceVersion))
    )
      return invalid();
    const result = {
      publicationCode: id(item.publicationCode),
      productCode: id(item.productCode),
      storeCode: id(item.storeCode),
      sourceVersion,
      targetVersion: hash(item.targetVersion),
    };
    if (
      !product ||
      result.productCode !== product.productCode ||
      result.sourceVersion !== String(product.versionId) ||
      result.storeCode !== storeContext?.code
    )
      return invalid();
    return result;
  });
  const priceRowIntent = nullable(row.priceRowIntent, (input) => {
    const item = record(input),
      unitAmount = text(item.unitAmount, 100);
    if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(unitAmount) || item.minQuantity !== '1')
      return invalid();
    return {
      code: id(item.code),
      priceBookCode: id(item.priceBookCode),
      currency: id(item.currency),
      unitAmount,
      minQuantity: '1' as const,
    };
  });
  const productCommand = nullable(row.productCommand, (input) => {
    const item = record(input);
    if (typeof item.sample !== 'boolean') return invalid();
    return {
      name: text(item.name, 1000),
      description: text(item.description, 4000),
      sample: item.sample,
    };
  });
  if (
    !Array.isArray(row.publicationReferences) ||
    row.publicationReferences.length > 20 ||
    !Array.isArray(row.actions) ||
    row.actions.length > listingActions.length
  )
    return invalid();
  const publicationReferences = row.publicationReferences.map((input) => {
    const item = record(input);
    return {
      domain: choices(item.domain, ['product', 'pricing'] as const),
      code: id(item.code),
      state: choices(item.state, listingPublicationStates),
      ...(item.processCode === undefined ? {} : { processCode: id(item.processCode) }),
    };
  });
  const actions = row.actions.map((input) => choices(input, listingActions));
  const state = choices(row.state, listingStates);
  const signed = id(eligibility.signedEnterpriseCode),
    required = nullable(eligibility.requiredEnterpriseCode, id);
  if (
    signed !== signedEnterpriseCode ||
    new Set(actions).size !== actions.length ||
    !actions.includes('READ_DETAILS') ||
    new Set(publicationReferences.map((item) => `${item.domain}:${item.code}`)).size !==
      publicationReferences.length
  )
    return invalid();
  if (
    eligibility.canAuthor &&
    (required !== signed ||
      state !== 'AWAITING_AUTHORING' ||
      product !== null ||
      !actions.includes('AUTHOR_PRODUCT_SOURCE'))
  )
    return invalid();
  if (
    state === 'RECONCILIATION_REQUIRED' &&
    actions.some((action) => action !== 'READ_DETAILS')
  )
    return invalid();
  return {
    contractVersion: 1,
    assetCode: id(row.assetCode),
    assetRevision: integer(row.assetRevision),
    assetStatus: choices(row.assetStatus, ['LISTING_REQUESTED', 'LISTED'] as const),
    state,
    listingKey: nullable(row.listingKey, hash),
    requestRevision: nullable(row.requestRevision, (input) => integer(input, 1)),
    intentDigest: nullable(row.intentDigest, hash),
    rewardPrice: nullable(row.rewardPrice, integer),
    ownerRef: { module: 'profile', schema: 'customer', code: id(owner.code) },
    storeContext,
    authoringContext,
    productCommand,
    product,
    productReference,
    priceRowIntent,
    publicationReferences,
    eligibility: {
      signedEnterpriseCode: signed,
      requiredEnterpriseCode: required,
      canAuthor: eligibility.canAuthor,
      blockerCode: nullable(eligibility.blockerCode, (input) => {
        const code = text(input, 120);
        if (!/^ERR_EWASTE_LISTING_[A-Z0-9_]+$/.test(code)) return invalid();
        return code;
      }),
    },
    actions,
  };
}
/** Single canonical GET; paging, identity and namespace must match before any rows are admitted. */
export async function loadWasteListings(
  configuration: OperationalOwnerConfiguration,
  page = 1,
  limit = 25,
): Promise<WasteListingPage> {
  if (integer(page, 1) > 10000 || integer(limit, 1) > 100) return invalid();
  const result = record(
    await invokeOperationalOwner<unknown>(
      configuration,
      'eWaste',
      `/listing-requests?page=${page}&limit=${limit}`,
    ),
  );
  if (
    result.contractVersion !== 1 ||
    result.page !== page ||
    result.limit !== limit ||
    !Array.isArray(result.items)
  )
    return invalid();
  const total = integer(result.total),
    items = result.items.map((item) =>
      parseWasteListing(item, configuration.enterpriseCode),
    );
  if (
    items.length !== Math.min(limit, Math.max(0, total - (page - 1) * limit)) ||
    new Set(items.map((item) => item.assetCode)).size !== items.length
  )
    return invalid();
  return {
    contractVersion: 1,
    items,
    total,
    page,
    limit,
  };
}
/** Reads only the selected asset, with no command/body, mutation retry or namespace substitution. */
export async function loadWasteListing(
  configuration: OperationalOwnerConfiguration,
  assetCode: string,
): Promise<WasteListingRequest> {
  id(assetCode);
  const result = parseWasteListing(
    await invokeOperationalOwner<unknown>(
      configuration,
      'eWaste',
      '/listing-requests/' + encodeURIComponent(assetCode),
    ),
    configuration.enterpriseCode,
  );
  if (result.assetCode !== assetCode) return invalid();
  return result;
}
