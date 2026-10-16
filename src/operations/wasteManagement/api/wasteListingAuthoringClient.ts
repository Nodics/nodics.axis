import { selectModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';
import { parseWasteListing, type WasteListingRequest } from './wasteListingClient';

export interface ListingAuthoringSelectors {
  readonly contractVersion: 1;
  readonly assetCode: string;
  readonly listingKey: string;
  readonly expectedRevision: number;
  readonly intentDigest: string;
  readonly storeCode: string;
}
export type ListingAuthoredProduct = NonNullable<WasteListingRequest['product']>;
/** The current signed Store employee must use one discovered, same-environment Staged Product owner. */
export function listingProductConfiguration(
  configuration: OperationalOwnerConfiguration,
): OperationalOwnerConfiguration | undefined {
  const waste = selectModuleConnection(
    configuration.bootstrap,
    'eWaste',
    configuration.ownerSelector,
  );
  const owners = (configuration.bootstrap.moduleConnections.product ?? []).filter(
    (connection) =>
      connection.runtimeRole?.publication === 'STAGED' &&
      connection.environment === waste?.environment &&
      ['UP', 'DEGRADED'].includes(connection.state),
  );
  if (!waste || owners.length !== 1) return undefined;
  return {
    ...configuration,
    ownerSelector: { instanceId: owners[0]!.instanceId, publicationRole: 'STAGED' },
  };
}
/** No editable Product body, namespace, policy or caller-selected service enters the command. */
export function listingAuthoringSelectors(
  configuration: OperationalOwnerConfiguration,
  row: WasteListingRequest,
): ListingAuthoringSelectors {
  const value = parseWasteListing(row, configuration.enterpriseCode);
  if (
    value.state !== 'AWAITING_AUTHORING' ||
    !value.actions.includes('AUTHOR_PRODUCT_SOURCE') ||
    !value.eligibility.canAuthor ||
    value.eligibility.blockerCode ||
    value.product ||
    value.eligibility.requiredEnterpriseCode !== configuration.enterpriseCode ||
    value.storeContext?.enterpriseCode !== configuration.enterpriseCode ||
    !value.listingKey ||
    !value.intentDigest ||
    !value.requestRevision ||
    !value.authoringContext
  )
    throw new Error('The listing source command is not admitted.');
  return Object.freeze({
    contractVersion: 1,
    assetCode: value.assetCode,
    listingKey: value.listingKey,
    expectedRevision: value.assetRevision,
    intentDigest: value.intentDigest,
    storeCode: value.storeContext.code,
  });
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The Product outcome could not be confirmed.');
  return value as Record<string, unknown>;
}
function productIdentity(product: ListingAuthoredProduct): string {
  return JSON.stringify([
    product.productCode,
    product.variantCode,
    product.sku,
    product.catalogVersion,
    product.versionId,
    [...product.locales].sort(),
  ]);
}
/** Validates the acknowledgment against the exact retained intent, not just HTTP success. */
export function parseListingAuthoringOutcome(
  value: unknown,
  original: WasteListingRequest,
): ListingAuthoredProduct {
  const result = object(value),
    proof = object(result.sourceProof),
    store = object(proof.storeContext);
  const product = parseWasteListing(
    {
      ...original,
      product: result,
      state: 'AWAITING_PUBLICATION',
      eligibility: { ...original.eligibility, canAuthor: false },
      actions: ['READ_DETAILS', 'OPEN_PUBLICATION_WORKFLOW'],
    },
    original.eligibility.signedEnterpriseCode,
  ).product;
  if (
    !product ||
    result.publicationRequired !== true ||
    proof.contractVersion !== 1 ||
    proof.assetCode !== original.assetCode ||
    proof.listingKey !== original.listingKey ||
    proof.requestRevision !== original.requestRevision ||
    proof.intentDigest !== original.intentDigest ||
    store.code !== original.storeContext?.code ||
    store.enterpriseCode !== original.storeContext?.enterpriseCode ||
    store.revision !== original.storeContext?.revision ||
    product.catalogVersion !== original.authoringContext?.catalogVersion ||
    JSON.stringify(product.locales) !==
      JSON.stringify([...(original.authoringContext?.locales ?? [])].sort())
  )
    throw new Error('The Product outcome could not be confirmed.');
  return product;
}
/** A single explicit human command. Lost replies never trigger a second POST. */
export async function authorListingProduct(
  configuration: OperationalOwnerConfiguration,
  original: WasteListingRequest,
): Promise<ListingAuthoredProduct> {
  const body = listingAuthoringSelectors(configuration, original);
  const product = listingProductConfiguration(configuration);
  if (!product) throw new Error('The Staged Product owner is unavailable.');
  return parseListingAuthoringOutcome(
    await invokeOperationalOwner<unknown>(
      product,
      'product',
      '/products/listings',
      body,
      'POST',
    ),
    original,
  );
}
/** Only a fresh, same-intent Waste owner read can reconcile an uncertain response. */
export function listingAuthoringReadback(
  original: WasteListingRequest,
  fresh: WasteListingRequest,
  acknowledged?: ListingAuthoredProduct,
): boolean {
  const pins = (row: WasteListingRequest) =>
    JSON.stringify([
      row.assetCode,
      row.assetRevision,
      row.listingKey,
      row.requestRevision,
      row.intentDigest,
      row.ownerRef,
      row.storeContext,
      row.authoringContext,
      row.rewardPrice,
      row.productCommand,
      row.eligibility.signedEnterpriseCode,
    ]);
  return (
    pins(original) === pins(fresh) &&
    Boolean(fresh.product) &&
    !fresh.eligibility.canAuthor &&
    ['AWAITING_PUBLICATION', 'AWAITING_BINDING', 'LISTED'].includes(fresh.state) &&
    (!acknowledged || productIdentity(acknowledged) === productIdentity(fresh.product!))
  );
}
/** Uses only an admitted existing navigation destination; no made-up Process reference or query selectors. */
export function listingPublicationRoute(
  configuration: OperationalOwnerConfiguration,
  row: WasteListingRequest,
): string | undefined {
  if (
    !row.product ||
    !row.actions.includes('OPEN_PUBLICATION_WORKFLOW') ||
    row.eligibility.signedEnterpriseCode !== configuration.enterpriseCode ||
    row.eligibility.requiredEnterpriseCode !== configuration.enterpriseCode
  )
    return undefined;
  const process = row.publicationReferences.some((reference) => reference.processCode);
  const destinations = process
    ? ['publishing-approval-tasks', 'publishing-requests']
    : ['publishing-requests'];
  for (const id of destinations) {
    const items = configuration.bootstrap.navigation.filter(
      (item) =>
        item.id === id &&
        ['UP', 'DEGRADED'].includes(item.availability) &&
        !['HIDDEN', 'DISABLED'].includes(item.featureState ?? 'ACTIVE') &&
        (id === 'publishing-approval-tasks'
          ? item.route === '/process/tasks'
          : item.route === '/publishing/requests' &&
            item.workbenchTarget?.moduleName === 'publish' &&
            item.workbenchTarget.schemaName === 'publicationRequest'),
    );
    if (items.length === 1) return items[0]!.route;
  }
  return undefined;
}
