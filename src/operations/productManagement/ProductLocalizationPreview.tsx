import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';

import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  loadWorkbenchRecords,
  loadWorkbenchSchemas,
} from '../../workbench/api/workbenchClient';
import type { WorkbenchSchema } from '../../workbench/api/workbenchContracts';

interface ProductLocalizationPreviewProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly productCode: string;
  readonly runtime: AxisRuntimeConfig;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function previewPageSize(schema: WorkbenchSchema): number {
  const allowed = schema.queryCapabilities.allowedPageSizes.filter(
    (size) => size <= schema.queryCapabilities.maximumPageSize,
  );
  return (
    allowed.find((size) => size >= schema.queryCapabilities.defaultPageSize) ??
    allowed[0] ??
    schema.queryCapabilities.defaultPageSize
  );
}

function previewSort(schema: WorkbenchSchema): WorkbenchSchema['queryCapabilities']['defaultSort'] {
  const defaultSort = schema.queryCapabilities.defaultSort;
  if (schema.queryCapabilities.sortableFields.includes('locale')) {
    return { field: 'locale', direction: 'ASC' };
  }
  return defaultSort;
}

function productLocalizationSchema(
  schemas: readonly WorkbenchSchema[],
): WorkbenchSchema | undefined {
  const candidates = schemas.filter(
    (candidate) =>
      candidate.moduleName === 'product' &&
      candidate.schemaName === 'productLocalization',
  );
  return (
    candidates.find((candidate) => candidate.connectionServer === 'commerceStagedServer') ??
    candidates.find((candidate) => candidate.connectionEnvironment === 'kickoffLocal') ??
    candidates[0]
  );
}

/**
 * Renders a read-only side-by-side preview from backend-owned Product
 * localization records. Publication decisions remain exclusively backend-owned.
 */
export function ProductLocalizationPreview(props: ProductLocalizationPreviewProps) {
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
  );
  const productConnections = props.bootstrap.moduleConnections.product ?? [];
  const preview = useQuery({
    enabled: Boolean(productConnections.length && props.productCode.trim()),
    queryKey: [
      'product-localization-preview',
      props.runtime.enterpriseCode,
      productConnections.map((connection) => connection.instanceId).join('|'),
      props.productCode.trim(),
    ],
    queryFn: async ({ signal }) => {
      if (productConnections.length === 0) {
        throw new Error('Product module is unavailable');
      }
      const schemas = await loadWorkbenchSchemas(productConnections, configuration);
      const schema = productLocalizationSchema(schemas);
      if (!schema) throw new Error('Product localization schema is unavailable');
      const connection =
        selectModuleConnection(props.bootstrap, 'product', {
          ...(schema.connectionServer ? { server: schema.connectionServer } : {}),
          ...(schema.connectionEnvironment
            ? { environment: schema.connectionEnvironment }
            : {}),
        }) ?? selectModuleConnection(props.bootstrap, 'product');
      if (!connection) throw new Error('Product module is unavailable');
      return loadWorkbenchRecords(
        connection,
        schema,
        configuration,
        {
          filters: {
            operator: 'AND',
            items: [
              {
                field: 'productCode',
                operator: 'EQUALS',
                value: props.productCode.trim(),
              },
            ],
          },
          pageNumber: 1,
          pageSize: previewPageSize(schema),
          search: '',
          sort: previewSort(schema),
        },
        fetch,
        signal,
      );
    },
  });

  if (!props.productCode.trim()) {
    return (
      <Alert severity="warning">Select a Product code before opening preview.</Alert>
    );
  }
  if ((props.bootstrap.moduleConnections.product ?? []).length === 0) {
    return (
      <Alert severity="error">The Product module is not currently available.</Alert>
    );
  }
  if (preview.isLoading) {
    return <Skeleton aria-label="Loading localized Product preview" height={180} />;
  }
  if (preview.error) {
    return <Alert severity="error">{preview.error.message}</Alert>;
  }

  const records = preview.data?.records ?? [];
  const requiredLocales = ['en', 'ar'] as const;
  const readyLocales = new Set(
    records
      .filter((record) => text(record.status) === 'READY')
      .map((record) => text(record.locale)),
  );
  const complete = requiredLocales.every((locale) => readyLocales.has(locale));

  return (
    <Stack spacing={2}>
      <Alert severity={complete ? 'success' : 'warning'}>
        {complete
          ? 'English and Arabic records are READY. The backend still performs the authoritative publication check.'
          : 'Preview is incomplete. English and Arabic must both be READY before publication.'}
      </Alert>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {requiredLocales.map((locale) => {
          const record = records.find((candidate) => text(candidate.locale) === locale);
          const direction = locale === 'ar' ? 'rtl' : 'ltr';
          return (
            <Card key={locale} sx={{ flex: 1 }}>
              <CardContent dir={direction} lang={locale}>
                <Stack spacing={1}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="overline">
                      {locale === 'ar' ? 'Arabic' : 'English'}
                    </Typography>
                    <Chip
                      color={text(record?.status) === 'READY' ? 'success' : 'default'}
                      label={text(record?.status) || 'MISSING'}
                      size="small"
                    />
                  </Stack>
                  <Typography variant="h5">{text(record?.name) || '—'}</Typography>
                  <Typography color="text.secondary">
                    {text(record?.description) || 'No localized description'}
                  </Typography>
                  <Typography variant="caption">
                    {text(record?.slug) || 'No localized slug'}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
