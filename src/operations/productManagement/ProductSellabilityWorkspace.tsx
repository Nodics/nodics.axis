import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import type {
  AxisAuthenticatedBootstrap,
  AxisModuleConnection,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../workbench/api/workbenchClient';
import type {
  WorkbenchRecord,
  WorkbenchRecordPage,
  WorkbenchRecordQuery,
  WorkbenchSchema,
} from '../../workbench/api/workbenchContracts';

interface ProductSellabilityWorkspaceProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

interface EvidencePage {
  readonly schema: WorkbenchSchema;
  readonly page: WorkbenchRecordPage;
}

type EvidenceKey = 'product' | 'variants' | 'locales' | 'prices' | 'search';

const evidenceTargets: Readonly<
  Record<EvidenceKey, { moduleName: string; schemaName: string; field: string }>
> = Object.freeze({
  product: { moduleName: 'product', schemaName: 'product', field: 'code' },
  variants: {
    moduleName: 'product',
    schemaName: 'productVariant',
    field: 'productCode',
  },
  locales: {
    moduleName: 'product',
    schemaName: 'productLocalization',
    field: 'productCode',
  },
  prices: { moduleName: 'pricing', schemaName: 'priceRow', field: 'productCode' },
  search: {
    moduleName: 'product',
    schemaName: 'productSearchProjection',
    field: 'productCode',
  },
});

function allConnections(
  bootstrap: AxisAuthenticatedBootstrap,
): readonly AxisModuleConnection[] {
  return Object.freeze(Object.values(bootstrap.moduleConnections).flat());
}

function text(record: WorkbenchRecord | undefined, field: string): string {
  const value = record?.[field];
  return typeof value === 'string' ? value : '';
}

function pageSize(schema: WorkbenchSchema): number {
  const allowed = schema.queryCapabilities.allowedPageSizes.filter(
    (size) => size <= schema.queryCapabilities.maximumPageSize,
  );
  return (
    allowed.find((size) => size >= schema.queryCapabilities.defaultPageSize) ??
    allowed[0] ??
    schema.queryCapabilities.defaultPageSize
  );
}

function queryFor(
  schema: WorkbenchSchema,
  field: string,
  productCode: string,
): WorkbenchRecordQuery {
  return {
    filters: {
      operator: 'AND',
      items: [{ field, operator: 'EQUALS', value: productCode }],
    },
    pageNumber: 1,
    pageSize: pageSize(schema),
    search: '',
    sort: schema.queryCapabilities.defaultSort,
  };
}

function connectionFor(
  bootstrap: AxisAuthenticatedBootstrap,
  schema: WorkbenchSchema,
): AxisModuleConnection | undefined {
  const selector: { server?: string; environment?: string } = {};
  if (schema.connectionServer) selector.server = schema.connectionServer;
  if (schema.connectionEnvironment) selector.environment = schema.connectionEnvironment;
  return selectModuleConnection(bootstrap, schema.moduleName, selector);
}

function readinessSchema(
  schemas: readonly WorkbenchSchema[],
  target: (typeof evidenceTargets)[EvidenceKey],
): WorkbenchSchema | undefined {
  const candidates = schemas.filter(
    (candidate) =>
      candidate.moduleName === target.moduleName &&
      candidate.schemaName === target.schemaName,
  );
  return (
    candidates.find((candidate) => candidate.connectionServer === 'commerceStagedServer') ??
    candidates.find((candidate) => candidate.connectionEnvironment === 'kickoffLocal') ??
    candidates[0]
  );
}

function isReady(record: WorkbenchRecord | undefined): boolean {
  const status = text(record, 'status');
  return status === 'ACTIVE' || status === 'READY' || status === 'CURRENT';
}

function hasAnyText(record: WorkbenchRecord | undefined, fields: readonly string[]): boolean {
  return fields.some((field) => Boolean(text(record, field).trim()));
}

/**
 * Product sellability cockpit composed from backend-owned schema evidence.
 * It does not mutate products, prices, stock, search, or publication state.
 */
export function ProductSellabilityWorkspace(props: ProductSellabilityWorkspaceProps) {
  const navigate = useNavigate();
  const [productCode, setProductCode] = useState('agoraLinenWrapDress');
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
  );
  const connections = useMemo(() => allConnections(props.bootstrap), [props.bootstrap]);
  const evidence = useQuery({
    enabled: Boolean(productCode.trim() && connections.length),
    queryKey: [
      'product-sellability',
      props.runtime.enterpriseCode,
      productCode.trim(),
      connections.map((connection) => connection.instanceId).join('|'),
    ],
    queryFn: async ({ signal }) => {
      const schemas = await loadWorkbenchSchemas(connections, configuration);
      const entries = await Promise.all(
        (Object.entries(evidenceTargets) as readonly [
          EvidenceKey,
          (typeof evidenceTargets)[EvidenceKey],
        ][]).map(async ([key, target]) => {
          const schema = readinessSchema(schemas, target);
          if (!schema) return [key, undefined] as const;
          const connection = connectionFor(props.bootstrap, schema);
          if (!connection) return [key, undefined] as const;
          const page = await loadWorkbenchRecords(
            connection,
            schema,
            configuration,
            queryFor(schema, target.field, productCode.trim()),
            fetch,
            signal,
          );
          return [key, { schema, page }] as const;
        }),
      );
      return Object.freeze(Object.fromEntries(entries)) as Readonly<
        Record<EvidenceKey, EvidencePage | undefined>
      >;
    },
  });

  const data = evidence.data;
  const product = data?.product?.page.records[0];
  const variants = data?.variants?.page.records ?? [];
  const locales = data?.locales?.page.records ?? [];
  const prices = data?.prices?.page.records ?? [];
  const search = data?.search?.page.records ?? [];
  const readyLocales = new Set(
    locales.filter(isReady).map((record) => text(record, 'locale')),
  );
  const checks = [
    {
      label: 'Product identity',
      ready: isReady(product),
      detail: product
        ? `${text(product, 'name') || text(product, 'code')} is ${text(product, 'status') || 'available'}.`
        : 'No product identity record was found.',
      action: '/commerce/catalog/products',
    },
    {
      label: 'Category dependency',
      ready: hasAnyText(product, ['categoryCode', 'primaryCategoryCode', 'defaultCategoryCode']),
      detail:
        'Publication should block when the assigned product category is missing, inactive, or not available in the target catalog version.',
      action: '/commerce/catalog/products',
    },
    {
      label: 'Classification dependency',
      ready: hasAnyText(product, [
        'classificationCode',
        'classificationClassCode',
        'attributeSetCode',
      ]),
      detail:
        'Classification and mandatory attribute readiness must be visible before approval so storefront filters and PDP facts are stable.',
      action: '/commerce/catalog/products',
    },
    {
      label: 'Variants and SKU identity',
      ready: variants.some(isReady),
      detail: `${String(variants.length)} variant record(s) found for this product.`,
      action: '/commerce/catalog/products',
    },
    {
      label: 'Mandatory languages',
      ready: readyLocales.has('en') && readyLocales.has('ar'),
      detail: `READY locales: ${Array.from(readyLocales).sort().join(', ') || 'none'}.`,
      action: '/commerce/catalog/products/languages',
    },
    {
      label: 'Price rows',
      ready: prices.length > 0,
      detail: `${String(prices.length)} price row(s) found through Pricing-owned records.`,
      action: '/commerce/catalog/prices',
    },
    {
      label: 'Search and storefront projection',
      ready: search.some(isReady),
      detail: `${String(search.length)} search projection row(s) found for store/locale visibility.`,
      action: '/commerce/catalog/products/search-locales',
    },
    {
      label: 'Stock authority',
      ready: variants.some((record) => Boolean(text(record, 'sku'))),
      detail:
        'Stock is governed by Inventory Operations by SKU; this workspace links the product variants to that authority and does not mutate stock.',
      action: '/commerce/inventory/balances',
    },
    {
      label: 'Media assets',
      ready:
        hasAnyText(product, ['mediaCode', 'imageCode', 'primaryImageCode']) ||
        variants.some((record) =>
          hasAnyText(record, ['mediaCode', 'imageCode', 'primaryImageCode']),
        ),
      detail:
        'Media readiness must prove required product and variant assets are promotable before Online publication is approved.',
      action: '/commerce/catalog/products',
    },
    {
      label: 'Approval impact summary',
      ready: Boolean(product && variants.length && locales.length),
      detail:
        'Approvers need a compact impact summary covering product identity, variants, locales, price visibility, stock authority, media, and search projection.',
      action: '/publishing/requests',
    },
    {
      label: 'Online verification',
      ready: search.some(isReady) && prices.length > 0,
      detail:
        'After approval, operators must verify Online product, price, stock display, media, and search projection from the publication status and audit trail.',
      action: '/publishing/online',
    },
  ];
  const completed = checks.filter((check) => check.ready).length;
  const policyCards = [
    {
      title: 'Staged vs Online diff',
      body:
        'Catalog publication must expose what changed in Staged before approval and what was promoted Online after completion.',
      action: '/publishing/dependencies',
      cta: 'Review dependencies',
    },
    {
      title: 'Partial and full publish policy',
      body:
        'Partial publish can move a product or selected dependencies when blockers are clean. Full publish belongs to controlled catalog-version promotion and must show broader impact.',
      action: '/publishing/requests',
      cta: 'Open requests',
    },
    {
      title: 'Blocking and warning policy',
      body:
        'Missing category, classification, required locale, price, variant, media, or search evidence should block or warn based on backend-owned policy, not frontend guesswork.',
      action: '/publishing/dependencies',
      cta: 'See policy signals',
    },
    {
      title: 'Rollback, restore, retire, and schedule',
      body:
        'Catalog changes need compatibility with rollback, restore, retire, withdrawal, and scheduled publication so operators are not trapped after approval.',
      action: '/publishing/scheduled',
      cta: 'Open schedule flow',
    },
    {
      title: 'Audit mapping',
      body:
        'Every product publication should map request, approver, dependency manifest, Online verification, failure, and retry events into the audit trail.',
      action: '/publishing/audit',
      cta: 'Open audit',
    },
  ];

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h4">{props.navigation.label}</Typography>
        <Typography color="text.secondary">
          One guided readiness cockpit for product basics, variants, localized
          content, price, stock authority, and search visibility. Each signal is
          read from backend-owned schema evidence.
        </Typography>
      </Stack>
      <Alert severity="info">
        This workspace is read-only. It guides the business user to the owning
        operation instead of creating a parallel product-readiness API or hidden
        frontend rule engine.
      </Alert>
      <TextField
        helperText="Use a staged Product code. Example: agoraLinenWrapDress."
        label="Product code"
        onChange={(event) => setProductCode(event.target.value)}
        size="small"
        value={productCode}
      />
      {evidence.isLoading || evidence.isFetching ? (
        <LinearProgress aria-label="Loading product sellability evidence" />
      ) : null}
      {evidence.error ? (
        <Alert severity="error">{evidence.error.message}</Alert>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Chip
          color={completed === checks.length ? 'success' : 'warning'}
          label={`${String(completed)} of ${String(checks.length)} readiness checks passing`}
        />
        <Chip color="info" label="Approval required before Online" />
        <Chip color="info" label="Backend policy remains authoritative" />
        {product ? <Chip label={`Catalog: ${text(product, 'catalogVersion')}`} /> : null}
        {variants
          .map((record) => text(record, 'sku'))
          .filter(Boolean)
          .slice(0, 3)
          .map((sku) => (
            <Chip key={sku} label={`SKU: ${sku}`} />
          ))}
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ flexWrap: 'wrap' }}>
        {checks.map((check) => (
          <Card key={check.label} sx={{ flex: '1 1 300px' }}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="h6">{check.label}</Typography>
                  <Chip
                    color={check.ready ? 'success' : 'warning'}
                    label={check.ready ? 'Ready' : 'Needs work'}
                    size="small"
                  />
                </Stack>
                <Typography color="text.secondary">{check.detail}</Typography>
                <Button
                  onClick={() => {
                    void navigate(check.action);
                  }}
                  size="small"
                  variant="outlined"
                >
                  Open owning operation
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="h5">Catalog publication policy</Typography>
              <Typography color="text.secondary">
                Product publication is a catalog lifecycle action. Axis should make
                dependency risk, approval impact, Online verification, rollback, and
                auditability obvious before an operator submits anything.
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ flexWrap: 'wrap' }}
            >
              {policyCards.map((policy) => (
                <Card key={policy.title} variant="outlined" sx={{ flex: '1 1 260px' }}>
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="h6">{policy.title}</Typography>
                      <Typography color="text.secondary">{policy.body}</Typography>
                      <Button
                        onClick={() => {
                          void navigate(policy.action);
                        }}
                        size="small"
                        variant="text"
                      >
                        {policy.cta}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
