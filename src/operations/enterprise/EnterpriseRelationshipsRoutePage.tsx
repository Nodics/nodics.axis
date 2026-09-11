import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router';

import {
  AxisDataListing,
  type AxisDataListingColumn,
} from '../../app/table/AxisDataListing';
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
} from '../shared/workbenchMetricDashboardModel';
import type { CollectionCentreRecord } from '../location/api/collectionCentresClient';
import {
  loadEnterpriseRelationshipData,
  type EnterpriseLinkedRecord,
} from './api/enterpriseRelationshipsClient';

interface EnterpriseRelationshipsRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
}

const emptyCollectionCentres: readonly CollectionCentreRecord[] = Object.freeze([]);
const emptyLinkedRecords: readonly EnterpriseLinkedRecord[] = Object.freeze([]);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function enterpriseName(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const name = record.name;
  if (typeof name === 'string') return name;
  if (typeof name === 'object' && name !== null && !Array.isArray(name)) {
    const localized = name as Record<string, unknown>;
    return (
      text(localized.en) || text(Object.values(localized).find((item) => text(item)))
    );
  }
  return '';
}

const collectionColumns: readonly AxisDataListingColumn<CollectionCentreRecord>[] =
  Object.freeze([
    {
      key: 'name',
      label: 'Collection centre',
      minWidth: 260,
      render: (record) => record.name,
      exportValue: (record) => record.name,
    },
    {
      key: 'location',
      label: 'Location',
      minWidth: 240,
      render: (record) => record.locationCode,
      exportValue: (record) => record.locationCode,
    },
    {
      key: 'coordinates',
      label: 'Coordinates',
      minWidth: 190,
      render: (record) =>
        `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}`,
      exportValue: (record) => `${record.latitude},${record.longitude}`,
    },
    {
      key: 'visibility',
      label: 'Visibility',
      minWidth: 150,
      render: (record) => record.publicVisibility,
      exportValue: (record) => record.publicVisibility,
    },
    {
      key: 'status',
      label: 'Status',
      minWidth: 130,
      render: (record) => record.operatingStatus,
      exportValue: (record) => record.operatingStatus,
    },
  ]);

const linkedColumns: readonly AxisDataListingColumn<EnterpriseLinkedRecord>[] =
  Object.freeze([
    {
      key: 'name',
      label: 'Record',
      minWidth: 260,
      render: (record) => record.name,
      exportValue: (record) => record.name,
    },
    {
      key: 'type',
      label: 'Type',
      minWidth: 130,
      render: (record) => record.source,
      exportValue: (record) => record.source,
    },
    {
      key: 'relationship',
      label: 'Relationship',
      minWidth: 180,
      render: (record) => record.relationship,
      exportValue: (record) => record.relationship,
    },
    {
      key: 'status',
      label: 'Status',
      minWidth: 130,
      render: (record) => record.status,
      exportValue: (record) => record.status,
    },
    {
      key: '__actions',
      label: '',
      minWidth: 160,
      exportable: false,
      render: (record) => (
        <Button component={RouterLink} size="small" to={record.route} variant="text">
          Open source
        </Button>
      ),
    },
  ]);

function Metric({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <Paper variant="outlined" sx={{ p: dashboardCardPadding }}>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography variant="h5">{value.toString()}</Typography>
    </Paper>
  );
}

export function EnterpriseRelationshipsRoutePage(
  props: EnterpriseRelationshipsRoutePageProps,
) {
  const params = useParams();
  const enterpriseCode = params.enterpriseCode ?? '';
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
  );
  const relationshipQuery = useQuery({
    enabled: enterpriseCode.trim().length > 0,
    queryKey: [
      'enterprise-relationships',
      props.runtime.enterpriseCode,
      enterpriseCode,
    ],
    queryFn: () =>
      loadEnterpriseRelationshipData(props.bootstrap, configuration, enterpriseCode),
  });
  const collectionCentres =
    relationshipQuery.data?.collectionCentres ?? emptyCollectionCentres;
  const commerceRecords = Object.freeze([
    ...(relationshipQuery.data?.promotions ?? emptyLinkedRecords),
    ...(relationshipQuery.data?.coupons ?? emptyLinkedRecords),
  ]);
  const enterpriseLabel =
    enterpriseName(relationshipQuery.data?.enterprise) ||
    enterpriseCode ||
    'Enterprise';

  return (
    <WorkspaceContainer>
      <Stack spacing={dashboardContentGap}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={dashboardComponentGap}
          sx={{ alignItems: { md: 'flex-end' }, justifyContent: 'space-between' }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h4">{enterpriseLabel}</Typography>
            <Typography color="text.secondary">
              Enterprise relationship view across active Nodics modules.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={enterpriseCode} variant="outlined" />
            <Button
              component={RouterLink}
              to="/schema-workbench?module=profile&schema=enterprise"
              variant="outlined"
            >
              Enterprise records
            </Button>
          </Stack>
        </Stack>
        {relationshipQuery.isLoading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography color="text.secondary">
              Loading enterprise relationships
            </Typography>
          </Stack>
        ) : null}
        {relationshipQuery.error ? (
          <Alert severity="error">
            {relationshipQuery.error instanceof Error
              ? relationshipQuery.error.message
              : 'Enterprise relationships could not be loaded.'}
          </Alert>
        ) : null}
        {relationshipQuery.data?.unavailableSources.length ? (
          <Alert severity="info">
            Unavailable relationship sources:{' '}
            {relationshipQuery.data.unavailableSources.join(', ')}
          </Alert>
        ) : null}
        {relationshipQuery.data?.projection.mode === 'AXIS_AGGREGATION' ? (
          <Alert severity="info">
            Relationship view is assembled from owning module records.
          </Alert>
        ) : null}
        <Box
          sx={{
            display: 'grid',
            gap: dashboardComponentGap,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
          }}
        >
          <Metric label="Collection centres" value={collectionCentres.length} />
          <Metric
            label="Promotions"
            value={relationshipQuery.data?.promotions.length ?? 0}
          />
          <Metric label="Coupons" value={relationshipQuery.data?.coupons.length ?? 0} />
          <Metric
            label="Enterprise records"
            value={relationshipQuery.data?.sourceCounts.enterprises ?? 0}
          />
        </Box>
        <AxisDataListing
          ariaLabel="Enterprise collection centres"
          columns={collectionColumns}
          emptyMessage="No collection centres are linked to this enterprise."
          exportFileName={`${enterpriseCode}-collection-centres`}
          getRowKey={(record) => record.code}
          maxBodyHeight={360}
          minTableWidth={930}
          records={collectionCentres}
          size="small"
          toolbarStart={
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Chip label="Waste collection centres" size="small" variant="outlined" />
              <Link
                component={RouterLink}
                to="/waste/collection-centres"
                underline="hover"
                variant="body2"
              >
                Open map
              </Link>
            </Stack>
          }
        />
        <Divider />
        <AxisDataListing
          ariaLabel="Enterprise commerce relationships"
          columns={linkedColumns}
          emptyMessage="No promotion or coupon records are linked to this enterprise."
          exportFileName={`${enterpriseCode}-commerce-relationships`}
          getRowKey={(record) => `${record.source}:${record.code}`}
          maxBodyHeight={320}
          minTableWidth={860}
          records={commerceRecords}
          size="small"
          toolbarStart={
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Chip label="Commerce relationships" size="small" variant="outlined" />
              <Link
                component={RouterLink}
                to="/schema-workbench?module=promotion&schema=coupon"
                underline="hover"
                variant="body2"
              >
                Coupon records
              </Link>
            </Stack>
          }
        />
      </Stack>
    </WorkspaceContainer>
  );
}
