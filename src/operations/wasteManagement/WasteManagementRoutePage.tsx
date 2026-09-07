import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

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

interface WasteManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly employeeId: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}

type WasteReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'LISTED';

interface WasteSubmission {
  readonly code: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly generatedName: string;
  readonly verifiedName: string;
  readonly type: string;
  readonly category: string;
  readonly centre: string;
  readonly evidenceUrl: string;
  readonly rewardEstimate: number;
  readonly carbonEstimate: number;
  readonly rewardApproved: number;
  readonly carbonApproved: number;
  readonly confidence: number;
  readonly status: WasteReviewStatus;
  readonly submittedAt: string;
  readonly tradeable: boolean;
}

interface CouponDraft {
  readonly code: string;
  readonly enterprise: string;
  readonly title: string;
  readonly rewardCost: number;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'PAUSED';
  readonly settlementPolicy: string;
}

const statusOptions: readonly ('ALL' | WasteReviewStatus)[] = Object.freeze([
  'ALL',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'LISTED',
]);

const initialSubmissions: readonly WasteSubmission[] = Object.freeze([
  {
    code: 'EWA-AX-1042',
    customerName: 'Circa Customer',
    customerEmail: 'customer@circa.local',
    generatedName: 'AI named smartphone evidence',
    verifiedName: 'Retired iPhone 12',
    type: 'Smartphone',
    category: 'Small electronics',
    centre: 'Circa Green Hub Al Quoz',
    evidenceUrl: '/media/waste-smartphone.svg',
    rewardEstimate: 12,
    carbonEstimate: 14,
    rewardApproved: 10,
    carbonApproved: 10,
    confidence: 0.91,
    status: 'PENDING_REVIEW',
    submittedAt: '2026-09-07',
    tradeable: true,
  },
  {
    code: 'EWA-AX-1038',
    customerName: 'Maya Shah',
    customerEmail: 'maya@example.com',
    generatedName: 'Laptop with broken display',
    verifiedName: 'Damaged ThinkPad T480',
    type: 'Laptop',
    category: 'Computing',
    centre: 'TechCycle Collection Desk',
    evidenceUrl: '/media/waste-laptop.svg',
    rewardEstimate: 24,
    carbonEstimate: 30,
    rewardApproved: 22,
    carbonApproved: 28,
    confidence: 0.86,
    status: 'APPROVED',
    submittedAt: '2026-09-03',
    tradeable: false,
  },
  {
    code: 'EWA-AX-1029',
    customerName: 'Amal R.',
    customerEmail: 'amal@example.com',
    generatedName: 'Mesh router pair',
    verifiedName: 'Mesh Router Pair',
    type: 'Network device',
    category: 'Connectivity',
    centre: 'Emirates Circular Drop Box',
    evidenceUrl: '/media/waste-router.svg',
    rewardEstimate: 8,
    carbonEstimate: 13,
    rewardApproved: 8,
    carbonApproved: 13,
    confidence: 0.94,
    status: 'LISTED',
    submittedAt: '2026-09-05',
    tradeable: true,
  },
]);

const initialCoupons: readonly CouponDraft[] = Object.freeze([
  {
    code: 'CPN-GRN-30',
    enterprise: 'GreenTech Store',
    title: 'AED 30 repair credit',
    rewardCost: 14,
    status: 'PUBLISHED',
    settlementPolicy: 'Default enterprise settlement bucket',
  },
  {
    code: 'CPN-ECO-15',
    enterprise: 'EcoMart',
    title: '15% recycled accessories offer',
    rewardCost: 9,
    status: 'DRAFT',
    settlementPolicy: 'Enterprise carbon settlement',
  },
  {
    code: 'CPN-SVC-50',
    enterprise: 'FixPoint',
    title: 'AED 50 device diagnosis',
    rewardCost: 20,
    status: 'PAUSED',
    settlementPolicy: 'No carbon movement for coupon',
  },
]);

const initialSelectedSubmissionCode = 'EWA-AX-1042';

const operationContracts = Object.freeze([
  {
    title: 'Create waste submission',
    owner: 'Waste API',
    route: '/nodics/waste/v0/customer/submissions',
    permission: 'waste.submission.create',
  },
  {
    title: 'Approve or reject evidence',
    owner: 'Waste + Workflow',
    route: '/nodics/waste/v0/backoffice/assets/{assetCode}/{approve|reject}',
    permission: 'waste.asset.approve',
  },
  {
    title: 'Credit wallet appreciation',
    owner: 'Loyalty Wallet',
    route: '/nodics/loyalty/v0/wallets/{customerCode}/ledger',
    permission: 'loyalty.wallet.credit',
  },
  {
    title: 'Project asset to product',
    owner: 'Commerce Product',
    route: '/nodics/commerce/v0/products/projections/waste-assets',
    permission: 'commerce.product.project',
  },
  {
    title: 'Publish enterprise coupon',
    owner: 'Promotion API',
    route: '/nodics/promotion/v0/backoffice/promotions/{promotionCode}/publish',
    permission: 'commerce.promotion.manage',
  },
]);

function reviewStatusLabel(status: WasteReviewStatus): string {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Pending review';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'LISTED':
      return 'Listed';
  }
}

function metricCount(
  records: readonly WasteSubmission[],
  status: WasteReviewStatus,
): number {
  return records.filter((record) => record.status === status).length;
}

export function WasteManagementRoutePage(props: WasteManagementRoutePageProps) {
  const [tab, setTab] = useState<'review' | 'coupons' | 'contracts'>('review');
  const [records, setRecords] = useState<readonly WasteSubmission[]>(initialSubmissions);
  const [coupons, setCoupons] = useState<readonly CouponDraft[]>(initialCoupons);
  const [statusFilter, setStatusFilter] = useState<'ALL' | WasteReviewStatus>('ALL');
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState(initialSelectedSubmissionCode);
  const [notice, setNotice] = useState(
    'Local visual workspace is active until Waste-owned review APIs are connected.',
  );

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const statusMatches = statusFilter === 'ALL' || record.status === statusFilter;
        const text = [
          record.code,
          record.customerName,
          record.customerEmail,
          record.generatedName,
          record.verifiedName,
          record.type,
          record.category,
          record.centre,
        ]
          .join(' ')
          .toLowerCase();
        return statusMatches && text.includes(query.toLowerCase());
      }),
    [query, records, statusFilter],
  );
  const selected =
    records.find((record) => record.code === selectedCode) ?? filteredRecords[0];

  const updateSelected = (
    patch: Partial<Pick<WasteSubmission, 'verifiedName' | 'rewardApproved' | 'carbonApproved'>>,
  ) => {
    setRecords((current) =>
      current.map((record) =>
        record.code === selected?.code ? { ...record, ...patch } : record,
      ),
    );
  };

  const setSelectedStatus = (status: WasteReviewStatus) => {
    if (!selected) return;
    setRecords((current) =>
      current.map((record) =>
        record.code === selected.code ? { ...record, status } : record,
      ),
    );
    setNotice(
      status === 'APPROVED'
        ? `${selected.code} approved. Wallet credit and carbon asset projection are queued through backend-owned ledgers.`
        : `${selected.code} moved to ${reviewStatusLabel(status)}.`,
    );
  };

  const publishCoupon = (coupon: CouponDraft) => {
    setCoupons((current) =>
      current.map((item) =>
        item.code === coupon.code ? { ...item, status: 'PUBLISHED' } : item,
      ),
    );
    setNotice(`${coupon.code} published through Promotion-owned coupon policy.`);
  };

  return (
    <Stack spacing={dashboardContentGap}>
      <Stack spacing={0.75}>
        <Typography variant="h4">Circa Waste Operations</Typography>
        <Typography color="text.secondary">
          Review customer eWaste evidence, finalize verified asset values, monitor
          tradeability, and manage enterprise coupons without moving backend ownership
          into Axis.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={dashboardComponentGap} sx={{ flexWrap: 'wrap' }}>
        <Paper variant="outlined" sx={{ minWidth: 210, p: dashboardCardPadding }}>
          <Typography color="text.secondary" variant="body2">Pending review</Typography>
          <Typography variant="h4">{metricCount(records, 'PENDING_REVIEW')}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ minWidth: 210, p: dashboardCardPadding }}>
          <Typography color="text.secondary" variant="body2">Approved assets</Typography>
          <Typography variant="h4">{metricCount(records, 'APPROVED')}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ minWidth: 210, p: dashboardCardPadding }}>
          <Typography color="text.secondary" variant="body2">Listed assets</Typography>
          <Typography variant="h4">{metricCount(records, 'LISTED')}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ minWidth: 210, p: dashboardCardPadding }}>
          <Typography color="text.secondary" variant="body2">Published coupons</Typography>
          <Typography variant="h4">
            {coupons.filter((coupon) => coupon.status === 'PUBLISHED').length}
          </Typography>
        </Paper>
      </Stack>

      <Alert severity="info">
        {notice} Operator: {props.employeeId}. Enterprise: {props.runtime.enterpriseCode}.
      </Alert>

      <Paper variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, value: 'review' | 'coupons' | 'contracts') => setTab(value)}
          aria-label="Waste operations tabs"
        >
          <Tab label="Asset approval" value="review" />
          <Tab label="Coupon management" value="coupons" />
          <Tab label="Operation contracts" value="contracts" />
        </Tabs>
      </Paper>

      {tab === 'review' ? (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={dashboardComponentGap}>
          <Paper variant="outlined" sx={{ flex: 1, p: dashboardCardPadding }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField
                  fullWidth
                  label="Search submissions"
                  onChange={(event) => setQuery(event.target.value)}
                  size="small"
                  value={query}
                />
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="waste-review-status">Status</InputLabel>
                  <Select
                    label="Status"
                    labelId="waste-review-status"
                    onChange={(event) =>
                      setStatusFilter(event.target.value as 'ALL' | WasteReviewStatus)
                    }
                    value={statusFilter}
                  >
                    {statusOptions.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status === 'ALL' ? 'All statuses' : reviewStatusLabel(status)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack spacing={1}>
                {filteredRecords.map((record) => (
                  <Paper
                    component="button"
                    key={record.code}
                    onClick={() => setSelectedCode(record.code)}
                    variant="outlined"
                    sx={{
                      bgcolor: record.code === selected?.code ? 'action.selected' : 'background.paper',
                      cursor: 'pointer',
                      p: 1.5,
                      textAlign: 'left',
                    }}
                    type="button"
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>{record.verifiedName}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {record.code} - {record.customerName} - {record.centre}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        <Chip label={reviewStatusLabel(record.status)} size="small" />
                        <Chip label={`${Math.round(record.confidence * 100).toString()}% AI`} size="small" variant="outlined" />
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ flex: 0.86, p: dashboardCardPadding }}>
            {selected ? (
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Box
                    component="img"
                    src={selected.evidenceUrl}
                    alt={`${selected.verifiedName} evidence`}
                    sx={{ borderRadius: 1, maxWidth: { sm: 180 }, width: '100%' }}
                  />
                  <Stack spacing={0.75}>
                    <Typography variant="h6">{selected.code}</Typography>
                    <Typography color="text.secondary">
                      {selected.generatedName} submitted by {selected.customerName}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Chip label={selected.type} size="small" />
                      <Chip label={selected.category} size="small" variant="outlined" />
                      <Chip label={selected.tradeable ? 'Tradeable' : 'Hold'} size="small" color={selected.tradeable ? 'success' : 'default'} />
                    </Stack>
                  </Stack>
                </Stack>
                <Divider />
                <TextField
                  label="Final verified name"
                  onChange={(event) => updateSelected({ verifiedName: event.target.value })}
                  size="small"
                  value={selected.verifiedName}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    label="Approved rewards"
                    onChange={(event) =>
                      updateSelected({ rewardApproved: Number(event.target.value) })
                    }
                    size="small"
                    type="number"
                    value={selected.rewardApproved}
                  />
                  <TextField
                    label="Approved carbon credits"
                    onChange={(event) =>
                      updateSelected({ carbonApproved: Number(event.target.value) })
                    }
                    size="small"
                    type="number"
                    value={selected.carbonApproved}
                  />
                </Stack>
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    AI estimate: {selected.rewardEstimate} rewards and{' '}
                    {selected.carbonEstimate} carbon credits.
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Approval creates a customer-owned asset, credits reward appreciation,
                    and updates carbon asset projection through backend-owned contracts.
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Button
                    onClick={() => setSelectedStatus('APPROVED')}
                    variant="contained"
                  >
                    Approve
                  </Button>
                  <Button color="error" onClick={() => setSelectedStatus('REJECTED')} variant="outlined">
                    Reject
                  </Button>
                  <Button onClick={() => setSelectedStatus('LISTED')} variant="outlined">
                    Mark listed
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Typography color="text.secondary">Select a submission to review.</Typography>
            )}
          </Paper>
        </Stack>
      ) : null}

      {tab === 'coupons' ? (
        <Stack spacing={dashboardComponentGap}>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            {coupons.map((coupon) => (
              <Paper key={coupon.code} variant="outlined" sx={{ maxWidth: 360, p: dashboardCardPadding }}>
                <Stack spacing={1.2}>
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 700 }}>{coupon.title}</Typography>
                    <Chip label={coupon.status} size="small" />
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    {coupon.enterprise} - {coupon.rewardCost} reward points
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {coupon.settlementPolicy}
                  </Typography>
                  <Button
                    disabled={coupon.status === 'PUBLISHED'}
                    onClick={() => publishCoupon(coupon)}
                    variant="outlined"
                  >
                    Publish coupon
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
          <Alert severity="warning">
            Enterprise hierarchy, coupon maker-checker roles, and settlement-policy
            permissions are captured in the continued implementation actions file.
          </Alert>
        </Stack>
      ) : null}

      {tab === 'contracts' ? (
        <Stack direction="row" spacing={dashboardComponentGap} sx={{ flexWrap: 'wrap' }}>
          {operationContracts.map((operation) => (
            <Paper key={operation.title} variant="outlined" sx={{ maxWidth: 380, p: dashboardCardPadding }}>
              <Stack spacing={1}>
                <Typography sx={{ fontWeight: 700 }}>{operation.title}</Typography>
                <Typography color="text.secondary" variant="body2">
                  Owner: {operation.owner}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                  variant="body2"
                >
                  {operation.route}
                </Typography>
                <Chip label={operation.permission} size="small" variant="outlined" />
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
