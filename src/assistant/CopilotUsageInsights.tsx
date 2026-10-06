/** @file Accessible current-period charts and breakdowns from authorized backend aggregates. */
import { useState } from 'react';
import { Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { CopilotUsage, CopilotUsageQuery } from './api/copilotUsageClient';
/** Renders numerical labels alongside visual bars; bar width is presentation, never budget authority. */
export function CopilotUsageInsights({
  usage,
  query,
  onQuery,
}: {
  readonly usage: CopilotUsage;
  readonly query: CopilotUsageQuery;
  readonly onQuery: (query: CopilotUsageQuery) => void;
}) {
  const [dimension, setDimension] = useState<'model' | 'purpose' | 'principalCode'>(
    'model',
  );
  if (!usage.insights) return null;
  const copy = usage.presentation,
    insights = usage.insights;
  const maximum = Math.max(
    1,
    ...insights.daily.map((day) => day.consumed + day.reserved),
  );
  const group = insights.breakdowns[dimension];
  return (
    <Box component="section" sx={{ my: 3 }}>
      <Typography component="h2" variant="h6">
        {copy.daily}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ my: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="success.main">
          {copy.consumed}
        </Typography>
        <Typography variant="caption" color="warning.main">
          {copy.reserved}
        </Typography>
      </Stack>
      {!insights.daily.length ? (
        <Typography color="text.secondary">{copy.noBreakdown}</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', p: 0 }}>
          {insights.daily.map((day) => (
            <Box
              component="li"
              key={day.day}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '100px minmax(0,1fr)',
                  md: '110px minmax(0,1fr) 190px',
                },
                gap: 1,
                alignItems: 'center',
                my: 1,
              }}
            >
              <Typography variant="body2">{day.day}</Typography>
              <Box
                aria-hidden="true"
                sx={{ height: 12, display: 'flex', bgcolor: 'action.hover' }}
              >
                <Box
                  sx={{
                    bgcolor: 'success.main',
                    width: `${(100 * day.consumed) / maximum}%`,
                  }}
                />
                <Box
                  sx={{
                    bgcolor: 'warning.main',
                    width: `${(100 * day.reserved) / maximum}%`,
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
              >
                {copy.consumed}: {day.consumed.toLocaleString()} / {copy.reserved}:{' '}
                {day.reserved.toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      <Typography component="h2" variant="h6" sx={{ mt: 3 }}>
        {copy.breakdown}
      </Typography>
      <Tabs
        value={dimension}
        onChange={(_, value: typeof dimension) => setDimension(value)}
        aria-label={copy.breakdown}
        variant="scrollable"
      >
        <Tab value="model" label={copy.model} />
        <Tab value="purpose" label={copy.purpose} />
        {usage.canViewEnterprise && query.scope === 'ENTERPRISE' ? (
          <Tab value="principalCode" label={copy.principal} />
        ) : null}
      </Tabs>
      {group.hasMore ? <Typography variant="caption">{copy.limited}</Typography> : null}
      {!group.items.length ? (
        <Typography sx={{ py: 2 }}>{copy.noBreakdown}</Typography>
      ) : (
        group.items.map((row) => (
          <Box
            key={row.value}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2,minmax(0,1fr))',
                md: 'minmax(160px,2fr) repeat(3,minmax(0,1fr)) 44px',
              },
              py: 1.5,
              gap: 1,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography sx={{ overflowWrap: 'anywhere' }}>{row.value}</Typography>
            {(['consumed', 'reserved', 'calls'] as const).map((key) => (
              <Box key={key}>
                <Typography variant="caption">{copy[key]}</Typography>
                <Typography>{row[key].toLocaleString()}</Typography>
              </Box>
            ))}
            <Button
              aria-label={`${copy.apply}: ${row.value}`}
              onClick={() => onQuery({ ...query, [dimension]: row.value })}
              sx={{ minWidth: 40 }}
            >
              <ShellIcon name="search" />
            </Button>
          </Box>
        ))
      )}
    </Box>
  );
}
