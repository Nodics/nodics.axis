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

interface ProductLocalizationPreviewProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly productCode: string;
  readonly runtime: AxisRuntimeConfig;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Renders a read-only side-by-side preview from backend-owned Product
 * localization records. Publication decisions remain exclusively backend-owned.
 */
export function ProductLocalizationPreview(props: ProductLocalizationPreviewProps) {
  const connection = selectModuleConnection(props.bootstrap, 'product');
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
  );
  const preview = useQuery({
    enabled: Boolean(connection && props.productCode.trim()),
    queryKey: [
      'product-localization-preview',
      props.runtime.enterpriseCode,
      connection?.instanceId,
      props.productCode.trim(),
    ],
    queryFn: async ({ signal }) => {
      if (!connection) throw new Error('Product module is unavailable');
      const schemas = await loadWorkbenchSchemas([connection], configuration);
      const schema = schemas.find(
        (candidate) =>
          candidate.moduleName === 'product' &&
          candidate.schemaName === 'productLocalization',
      );
      if (!schema) throw new Error('Product localization schema is unavailable');
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
          pageSize: 100,
          search: '',
          sort: { field: 'locale', direction: 'ASC' },
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
  if (!connection) {
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
