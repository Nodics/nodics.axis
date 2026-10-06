/** @file Enterprise-grade bounded usage inspection; all accounting values and access are backend-owned. */
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import { CopilotUsageInsights } from './CopilotUsageInsights';
import type { CopilotUsage, CopilotUsageQuery } from './api/copilotUsageClient';

/** Renders scoped totals and call attribution without deriving authoritative balances. */
export function CopilotUsageView({
  usage,
  query,
  onQuery,
  onRefresh,
  onBudgets,
  onCall,
}: {
  readonly usage: CopilotUsage;
  readonly query: CopilotUsageQuery;
  readonly onQuery: (query: CopilotUsageQuery) => void;
  readonly onRefresh: () => void;
  readonly onBudgets?: () => void;
  readonly onCall?: (callId: string) => void;
}) {
  const copy = usage.presentation;
  const purposes: Record<string, string> = {
    CONVERSATION: copy.conversationPurpose,
    INDEXING: copy.indexingPurpose,
    EVALUATION: copy.evaluationPurpose,
    RETRY: copy.retryPurpose,
    PLANNING: copy.planningPurpose,
  };
  const states: Record<string, string> = {
    MEASURED: copy.measured,
    RESERVED: copy.inProgress,
    PENDING: copy.reconciliation,
  };
  const [draft, setDraft] = useState(query);
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'start', gap: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" variant="h5">
            {copy.title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {usage.context.tenantCode} / {usage.context.enterpriseCode}
          </Typography>
        </Box>
        <Tooltip title={copy.refresh}>
          <IconButton aria-label={copy.refresh} onClick={onRefresh}>
            <ShellIcon name="refresh" />
          </IconButton>
        </Tooltip>
      </Stack>
      {usage.canViewEnterprise && onBudgets && !usage.history?.offset ? (
        <Button
          startIcon={<ShellIcon name="settings" />}
          onClick={onBudgets}
          sx={{ mt: 2 }}
        >
          {copy.allocations}
        </Button>
      ) : null}
      <Tabs
        value={query.scope}
        onChange={(_, scope: CopilotUsageQuery['scope']) =>
          onQuery({ ...query, scope, principalCode: '', page: 0 })
        }
        sx={{ mt: 2 }}
        aria-label={copy.title}
      >
        <Tab value="PERSONAL" label={copy.personal} />
        {usage.canViewEnterprise ? (
          <Tab value="ENTERPRISE" label={copy.enterprise} />
        ) : null}
      </Tabs>
      {usage.history ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ my: 2 }}>
          <TextField
            select
            size="small"
            label={copy.history}
            value={usage.history.offset}
            sx={{ minWidth: 220 }}
            onChange={(event) =>
              onQuery({ ...query, periodOffset: Number(event.target.value), page: 0 })
            }
          >
            {usage.history.periods.map((period, index) => (
              <MenuItem key={period.key} value={index}>
                {index === 0
                  ? copy.currentPeriod
                  : new Date(period.startsAt).toLocaleDateString(undefined, {
                      timeZone: period.timezone,
                    })}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={copy.calls}
            value={query.calls ?? 'ALL'}
            sx={{ minWidth: 220 }}
            onChange={(event) =>
              onQuery({
                ...query,
                calls: event.target.value as 'ALL' | 'UNRESOLVED',
                page: 0,
              })
            }
          >
            <MenuItem value="ALL">{copy.allCalls}</MenuItem>
            <MenuItem value="UNRESOLVED">{copy.queue}</MenuItem>
          </TextField>
        </Stack>
      ) : null}
      {usage.history && !usage.history.recorded ? (
        <Alert severity="info">{copy.noRecordedUsage}</Alert>
      ) : null}
      {usage.totals ? (
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2,minmax(0,1fr))',
              md: 'repeat(4,minmax(0,1fr))',
            },
            gap: 3,
            py: 2,
            m: 0,
          }}
        >
          {(['consumed', 'reserved', 'pending', 'calls'] as const).map((key) => (
            <Box key={key} sx={{ minWidth: 0 }}>
              <Typography component="dt" variant="body2" color="text.secondary">
                {copy[key]}
              </Typography>
              <Typography
                component="dd"
                variant="h5"
                sx={{ m: 0, mt: 1, overflowWrap: 'anywhere' }}
              >
                {usage.history?.recorded === false
                  ? '-'
                  : usage.totals![key].toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Alert severity="info" sx={{ my: 2 }}>
          {copy.unavailable}
        </Alert>
      )}
      {usage.period ? (
        <Typography variant="body2" color="text.secondary">
          {copy.reset}:{' '}
          {new Date(usage.period.resetsAt).toLocaleString(undefined, {
            timeZone: usage.period.timezone,
          })}{' '}
          ({usage.period.timezone})
        </Typography>
      ) : null}
      {usage.history ? (
        <Box sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography component="h2" variant="h6">
            {copy.comparison}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {copy.comparisonNotice}
          </Typography>
          {usage.history.previous.totals ? (
            <Box
              component="dl"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2,minmax(0,1fr))',
                  md: 'repeat(4,minmax(0,1fr))',
                },
                gap: 2,
                mb: 0,
              }}
            >
              {(['consumed', 'reserved', 'pending', 'calls'] as const).map((key) => (
                <Box key={key} sx={{ minWidth: 0 }}>
                  <Typography component="dt" variant="body2">
                    {copy[key]}
                  </Typography>
                  <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                    {usage.history?.recorded === false
                      ? '-'
                      : (usage.totals?.[key].toLocaleString() ?? '-')}{' '}
                    / {usage.history!.previous.totals![key].toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {copy.noComparison}
            </Typography>
          )}
        </Box>
      ) : null}
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          onQuery({ ...draft, page: 0 });
        }}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 3 }}
      >
        {(['principalCode', 'model', 'purpose'] as const)
          .filter((key) => key !== 'principalCode' || query.scope === 'ENTERPRISE')
          .map((key) => (
            <TextField
              key={key}
              select={key === 'purpose'}
              size="small"
              label={key === 'principalCode' ? copy.principal : copy[key]}
              value={draft[key]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              slotProps={{ htmlInput: { maxLength: 128 } }}
              sx={{ flex: '1 1 180px' }}
            >
              {key === 'purpose'
                ? [
                    <MenuItem key="all" value="">
                      {copy.all}
                    </MenuItem>,
                    ...Object.entries(purposes).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    )),
                  ]
                : null}
            </TextField>
          ))}
        <Button type="submit" startIcon={<ShellIcon name="search" />}>
          {copy.apply}
        </Button>
      </Box>
      <CopilotUsageInsights
        usage={usage}
        query={query}
        onQuery={(value) => onQuery({ ...value, page: 0 })}
      />
      <Typography component="h2" variant="h6">
        {query.calls === 'UNRESOLVED' ? copy.queue : copy.recent}
      </Typography>
      {usage.hasMore ? (
        <Typography variant="caption" color="text.secondary">
          {copy.limited}
        </Typography>
      ) : null}
      {!usage.items.length ? (
        <Typography sx={{ py: 3 }} color="text.secondary">
          {copy.empty}
        </Typography>
      ) : (
        <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {usage.items.map((item) => (
            <Box
              component="li"
              key={item.callId}
              sx={{
                py: 2,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2,minmax(0,1fr))',
                  md: 'repeat(6,minmax(0,1fr))',
                },
                gap: 2,
              }}
            >
              {(
                [
                  [copy.principal, item.principalCode],
                  [copy.model, item.model],
                  [copy.purpose, purposes[item.purpose] ?? item.purpose],
                  [copy.state, states[item.state] ?? item.state],
                  [copy.consumed, item.consumed?.toLocaleString() ?? '-'],
                  [copy.reserved, item.reserved.toLocaleString()],
                  [
                    copy.created,
                    new Date(item.createdAt).toLocaleString(undefined, {
                      timeZone: usage.period?.timezone,
                    }),
                  ],
                ] as const
              ).map(([label, value]) => (
                <Box key={label} sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {value}
                  </Typography>
                </Box>
              ))}
              {usage.queue.find((row) => row.callId === item.callId) ? (
                <Typography variant="body2" sx={{ gridColumn: '1 / -1' }}>
                  {
                    {
                      AVAILABLE: copy.evidenceAvailable,
                      MISSING: copy.evidenceMissing,
                      DISABLED: copy.evidenceDisabled,
                    }[usage.queue.find((row) => row.callId === item.callId)!.evidence]
                  }
                </Typography>
              ) : null}
              {onCall && usage.period?.key ? (
                <Button
                  onClick={() => onCall(item.callId)}
                  startIcon={<ShellIcon name="search" />}
                  sx={{ gridColumn: '1 / -1', justifySelf: 'start' }}
                >
                  {copy.details}
                </Button>
              ) : null}
            </Box>
          ))}
        </Box>
      )}
      {usage.pagination ? (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', py: 2 }}>
          <Tooltip title={copy.previousPage}>
            <span>
              <IconButton
                aria-label={copy.previousPage}
                disabled={usage.pagination.page === 0}
                onClick={() => onQuery({ ...query, page: usage.pagination!.page - 1 })}
              >
                <ShellIcon name="chevron-left" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={copy.nextPage}>
            <span>
              <IconButton
                aria-label={copy.nextPage}
                disabled={!usage.hasMore}
                onClick={() => onQuery({ ...query, page: usage.pagination!.page + 1 })}
              >
                <ShellIcon name="chevron-right" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ) : null}
    </Box>
  );
}
