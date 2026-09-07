import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router';

import { AxisDataListing, type AxisDataListingColumn } from '../../app/table/AxisDataListing';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  dashboardCardPadding,
  dashboardComponentGap,
  dashboardContentGap,
} from '../shared/workbenchMetricDashboardModel';
import {
  loadCollectionCentreWorkspaceData,
  type CollectionCentreRecord,
} from './api/collectionCentresClient';

interface CollectionCentresRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

const allEnterprises = '__ALL_ENTERPRISES__';
const emptyCollectionCentreRecords: readonly CollectionCentreRecord[] = Object.freeze([]);

function searchRecord(record: CollectionCentreRecord, query: string): boolean {
  if (!query) return true;
  const haystack = [
    record.code,
    record.name,
    record.collectionPointType,
    record.locationCode,
    record.operatorEnterpriseCode,
    record.operatorEnterpriseName,
    record.assetOwnerEnterpriseCode,
    record.assetOwnerEnterpriseName,
    record.addressLine,
    record.city,
    record.countryCode,
    record.operatingStatus,
    record.publicVisibility,
    record.status,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function percent(value: number, minimum: number, maximum: number, invert = false): number {
  const span = Math.max(maximum - minimum, 0.000001);
  const raw = ((value - minimum) / span) * 88 + 6;
  return invert ? 100 - raw : raw;
}

function mapBounds(records: readonly CollectionCentreRecord[]) {
  if (records.length === 0) {
    return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
  }
  const latitudes = records.map((record) => record.latitude);
  const longitudes = records.map((record) => record.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  return { minLat, maxLat, minLon, maxLon };
}

function MapPanel({
  records,
  selectedCode,
  onSelect,
}: {
  readonly records: readonly CollectionCentreRecord[];
  readonly selectedCode: string | undefined;
  readonly onSelect: (record: CollectionCentreRecord) => void;
}) {
  const bounds = useMemo(() => mapBounds(records), [records]);
  return (
    <Paper
      aria-label="Collection centres map"
      variant="outlined"
      sx={{
        background:
          'linear-gradient(135deg, rgba(20,122,85,0.14), rgba(23,105,170,0.10)), linear-gradient(90deg, rgba(37,41,44,0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(37,41,44,0.08) 1px, transparent 1px)',
        backgroundSize: 'auto, 48px 48px, 48px 48px',
        minHeight: { xs: 300, md: 520 },
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          bgcolor: 'rgba(255,255,255,0.74)',
          border: 1,
          borderColor: 'divider',
          left: 12,
          p: 1,
          position: 'absolute',
          top: 12,
          zIndex: 2,
        }}
      >
        <Typography sx={{ fontWeight: 700 }} variant="body2">
          Dubai collection coverage
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {records.length.toString()} centres
        </Typography>
      </Box>
      {records.map((record, index) => {
        const selected = record.code === selectedCode;
        return (
          <Box
            aria-label={`${record.name} marker`}
            component="button"
            key={record.code}
            onClick={() => onSelect(record)}
            sx={{
              alignItems: 'center',
              bgcolor: selected ? 'primary.main' : 'success.main',
              border: selected ? 3 : 2,
              borderColor: selected ? 'text.primary' : 'background.paper',
              boxShadow: selected ? 4 : 2,
              color: 'primary.contrastText',
              cursor: 'pointer',
              display: 'flex',
              height: selected ? 24 : 18,
              justifyContent: 'center',
              left: `${percent(record.longitude, bounds.minLon, bounds.maxLon).toString()}%`,
              minWidth: selected ? 24 : 18,
              p: 0,
              position: 'absolute',
              top: `${percent(record.latitude, bounds.minLat, bounds.maxLat, true).toString()}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'transform 160ms ease, box-shadow 160ms ease',
              width: selected ? 24 : 18,
              zIndex: selected ? 3 : 1,
              '&:hover': { transform: 'translate(-50%, -50%) scale(1.12)' },
            }}
            type="button"
          >
            <Typography sx={{ fontSize: 10, fontWeight: 800, lineHeight: 1 }}>
              {(index + 1).toString()}
            </Typography>
          </Box>
        );
      })}
      {records.length === 0 ? (
        <Stack sx={{ height: '100%', minHeight: 300, placeContent: 'center' }}>
          <Typography align="center" color="text.secondary">
            No matching collection centres
          </Typography>
        </Stack>
      ) : null}
    </Paper>
  );
}

function DetailPanel({ record }: { readonly record: CollectionCentreRecord | undefined }) {
  if (!record) {
    return (
      <Paper variant="outlined" sx={{ p: dashboardCardPadding }}>
        <Typography color="text.secondary">Select a collection centre</Typography>
      </Paper>
    );
  }
  return (
    <Paper variant="outlined" sx={{ p: dashboardCardPadding }}>
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="h6">{record.name}</Typography>
          <Typography color="text.secondary" variant="body2">
            {record.addressLine || record.locationCode}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Chip label={record.operatingStatus} size="small" />
          <Chip label={record.publicVisibility} size="small" variant="outlined" />
          <Chip label={record.status} size="small" variant="outlined" />
        </Stack>
        <Divider />
        <Stack spacing={0.75}>
          <Typography variant="body2">
            Operator: {record.operatorEnterpriseName}
          </Typography>
          {record.assetOwnerEnterpriseName ? (
            <Typography variant="body2">
              Asset owner: {record.assetOwnerEnterpriseName}
            </Typography>
          ) : null}
          <Typography variant="body2">Latitude: {record.latitude.toFixed(6)}</Typography>
          <Typography variant="body2">Longitude: {record.longitude.toFixed(6)}</Typography>
          <Typography variant="body2">Location: {record.locationCode}</Typography>
          <Typography variant="body2">Address: {record.addressCode}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            component={RouterLink}
            size="small"
            to={`/enterprises/${encodeURIComponent(record.operatorEnterpriseCode)}`}
            variant="outlined"
          >
            Enterprise
          </Button>
          {record.assetOwnerEnterpriseCode ? (
            <Button
              component={RouterLink}
              size="small"
              to={`/enterprises/${encodeURIComponent(record.assetOwnerEnterpriseCode)}`}
              variant="outlined"
            >
              Asset owner
            </Button>
          ) : null}
          <Button
            component={RouterLink}
            size="small"
            to="/schema-workbench?module=locationCore&schema=location"
            variant="outlined"
          >
            Location
          </Button>
          <Button
            component={RouterLink}
            size="small"
            to="/waste/collections?module=wasteCollection&schema=wasteCollectionPoint"
            variant="outlined"
          >
            Collection point
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

const columns: readonly AxisDataListingColumn<CollectionCentreRecord>[] =
  Object.freeze([
    {
      key: 'name',
      label: 'Name',
      minWidth: 240,
      render: (record) => record.name,
      exportValue: (record) => record.name,
    },
    {
      key: 'operator',
      label: 'Operator',
      minWidth: 220,
      render: (record) => record.operatorEnterpriseName,
      exportValue: (record) => record.operatorEnterpriseName,
    },
    {
      key: 'assetOwner',
      label: 'Asset owner',
      minWidth: 220,
      render: (record) => record.assetOwnerEnterpriseName || '-',
      exportValue: (record) => record.assetOwnerEnterpriseName,
    },
    {
      key: 'address',
      label: 'Address',
      minWidth: 280,
      render: (record) => record.addressLine,
      exportValue: (record) => record.addressLine,
    },
    {
      key: 'latitude',
      label: 'Latitude',
      minWidth: 120,
      align: 'right',
      render: (record) => record.latitude.toFixed(6),
      exportValue: (record) => record.latitude.toString(),
    },
    {
      key: 'longitude',
      label: 'Longitude',
      minWidth: 120,
      align: 'right',
      render: (record) => record.longitude.toFixed(6),
      exportValue: (record) => record.longitude.toString(),
    },
    {
      key: 'status',
      label: 'Status',
      minWidth: 130,
      render: (record) => record.operatingStatus,
      exportValue: (record) => record.operatingStatus,
    },
  ]);

export function CollectionCentresRoutePage(props: CollectionCentresRoutePageProps) {
  const [query, setQuery] = useState('');
  const [enterpriseCode, setEnterpriseCode] = useState(allEnterprises);
  const [selectedCode, setSelectedCode] = useState<string>();
  const configuration = useMemo(
    () => ({
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [props.accessToken, props.runtime.enterpriseCode, props.runtime.requestTimeoutMs],
  );
  const workspace = useQuery({
    queryKey: [
      'collection-centres',
      props.runtime.enterpriseCode,
      props.navigation.route,
    ],
    queryFn: () =>
      loadCollectionCentreWorkspaceData(props.bootstrap, configuration),
  });
  const records = workspace.data?.records ?? emptyCollectionCentreRecords;
  const enterpriseOptions = useMemo(
    () =>
      Object.freeze(
        [...new Map(records.flatMap((record) => [
          [record.operatorEnterpriseCode, record.operatorEnterpriseName],
          [record.assetOwnerEnterpriseCode, record.assetOwnerEnterpriseName],
        ])).entries()]
          .map(([code, label]) => ({ code, label }))
          .filter((record) => record.code)
          .sort((left, right) => left.label.localeCompare(right.label)),
      ),
    [records],
  );
  const filteredRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          (enterpriseCode === allEnterprises ||
            record.enterpriseRelationshipCodes.includes(enterpriseCode)) &&
          searchRecord(record, query.trim()),
      ),
    [enterpriseCode, query, records],
  );
  const selectedRecord =
    filteredRecords.find((record) => record.code === selectedCode) ?? filteredRecords[0];

  return (
    <Stack spacing={dashboardContentGap}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={dashboardComponentGap}
        sx={{ alignItems: { md: 'flex-end' }, justifyContent: 'space-between' }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4">Collection centres</Typography>
          <Typography color="text.secondary">
            {records.length.toString()} centres from Waste, Location, Profile, and
            Enterprise records.
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Search"
            onChange={(event) => setQuery(event.target.value)}
            size="small"
            value={query}
          />
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="collection-centre-enterprise-filter">Enterprise</InputLabel>
            <Select
              label="Enterprise"
              labelId="collection-centre-enterprise-filter"
              onChange={(event) => {
                setEnterpriseCode(event.target.value);
                setSelectedCode(undefined);
              }}
              value={enterpriseCode}
            >
              <MenuItem value={allEnterprises}>All enterprises</MenuItem>
              {enterpriseOptions.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button onClick={() => void workspace.refetch()} variant="outlined">
            Refresh
          </Button>
        </Stack>
      </Stack>
      {workspace.isLoading ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={18} />
          <Typography color="text.secondary">Loading collection centres</Typography>
        </Stack>
      ) : null}
      {workspace.error ? (
        <Alert severity="error">
          {workspace.error instanceof Error
            ? workspace.error.message
            : 'Collection centres could not be loaded.'}
        </Alert>
      ) : null}
      {workspace.data?.unavailableSources.length ? (
        <Alert severity="warning">
          Missing workbench sources: {workspace.data.unavailableSources.join(', ')}
        </Alert>
      ) : null}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={dashboardComponentGap}>
        <Box sx={{ flex: 1.3, minWidth: 0 }}>
          <MapPanel
            records={filteredRecords}
            selectedCode={selectedRecord?.code}
            onSelect={(record) => setSelectedCode(record.code)}
          />
        </Box>
        <Box sx={{ flex: 0.7, minWidth: { lg: 360 } }}>
          <DetailPanel record={selectedRecord} />
        </Box>
      </Stack>
      <AxisDataListing
        ariaLabel="Collection centres"
        columns={columns}
        emptyMessage="No collection centres matched the current filters."
        exportFileName="collection-centres"
        getRowKey={(record) => record.code}
        maxBodyHeight={420}
        minTableWidth={1110}
        onRowClick={(record) => setSelectedCode(record.code)}
        records={filteredRecords}
        selectedRowKey={selectedRecord?.code}
        size="small"
        toolbarStart={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              label={`${filteredRecords.length.toString()} visible`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${(workspace.data?.sourceCounts.locations ?? 0).toString()} locations`}
              size="small"
              variant="outlined"
            />
            <Link
              component={RouterLink}
              to="/schema-workbench?module=profile&schema=enterprise"
              underline="hover"
              variant="body2"
            >
              Enterprise records
            </Link>
          </Stack>
        }
      />
    </Stack>
  );
}
