import { Box, Paper, Stack, Typography } from '@mui/material';
import { WasteRefinementPanel } from './WasteRefinementPanel';
import type { WasteDashboardData, WasteReviewFilters } from './api/wasteReviewClient';
/** Displays exact owner-scoped counts and time buckets, with declarative presentation supplied by Waste. */
export function WasteDashboard({
  data,
  showSummary = true,
  fixedFamily,
  counts,
  labels,
  filters,
  appliedFilters,
  setFilters,
  apply,
  reset,
  busy,
}: {
  data: WasteDashboardData | null;
  showSummary?: boolean;
  fixedFamily?: string | undefined;
  counts: Record<string, number>;
  labels: Record<string, string>;
  filters: WasteReviewFilters;
  appliedFilters: WasteReviewFilters;
  setFilters: (value: WasteReviewFilters) => void;
  apply: () => void;
  reset: () => void;
  onStatus: (status: string) => void;
  busy: boolean;
}) {
  const maximum = Math.max(1, ...(data?.trend || []).map((bucket) => bucket.count));
  return (
    <Stack spacing={2.5}>
      <WasteRefinementPanel
        data={data}
        fixedFamily={fixedFamily}
        labels={labels}
        filters={filters}
        appliedFilters={appliedFilters}
        setFilters={setFilters}
        apply={apply}
        reset={reset}
        busy={busy}
      />
      {showSummary && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2,minmax(0,1fr))',
                lg: 'repeat(4,minmax(0,1fr))',
              },
              gap: 2,
            }}
          >
            {(
              [
                ['ALL', 'total', '#315e50'],
                ['OPEN', 'pending', '#b58034'],
                ['APPROVED', 'approved', '#477950'],
                ['REJECTED', 'rejected', '#a8665c'],
              ] as const
            ).map(([status, label, color]) => (
              <Paper
                key={status}
                component="section"
                elevation={0}
                sx={{
                  textAlign: 'left',
                  p: { xs: 2, md: 3 },
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '12px',
                  cursor: 'default',
                  background: 'background.paper',
                  '&:hover': { borderColor: color },
                  '&:focus-visible': { outline: '3px solid', outlineColor: color },
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {labels[label]}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: 30, md: 40 },
                    fontWeight: 600,
                    color: 'text.primary',
                    mt: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {(counts[status] || 0).toLocaleString()}
                </Typography>
                <Box
                  sx={{ width: 30, height: 3, bgcolor: color, borderRadius: 2, mt: 1 }}
                />
              </Paper>
            ))}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: 2,
            }}
          >
            <Paper variant="outlined" sx={{ p: 3, borderRadius: '12px' }}>
              <Typography variant="h6">{labels.trend}</Typography>
              <Typography variant="caption" color="text.secondary">
                {labels.dateBasis}{' '}
                {data?.trend.length
                  ? `${data.trend[0]?.from.slice(0, 10)} – ${data.trend[data.trend.length - 1]?.to.slice(0, 10)}`
                  : ''}
              </Typography>
              <Box
                role="img"
                aria-label={(data?.trend || [])
                  .map(
                    (bucket) =>
                      `${bucket.from.slice(0, 10)} to ${bucket.to.slice(0, 10)}: ${bucket.count}`,
                  )
                  .join('; ')}
                sx={{ display: 'flex', gap: 2, alignItems: 'end', height: 160, mt: 3 }}
              >
                {data?.trend.map((bucket) => (
                  <Box
                    key={bucket.from}
                    title={`${bucket.from.slice(0, 10)} to ${bucket.to.slice(0, 10)} · ${bucket.count} submissions`}
                    sx={{ flex: 1, textAlign: 'center', minWidth: 0 }}
                  >
                    <Typography variant="caption">{bucket.count}</Typography>
                    <Box
                      sx={{
                        height: Math.max(3, (bucket.count / maximum) * 110),
                        background: 'linear-gradient(180deg,#779d80,#3f6d59)',
                        borderRadius: '6px 6px 0 0',
                        minWidth: 10,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', mt: 1, fontSize: 10 }}
                    >
                      {new Date(bucket.from).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Box>
        </>
      )}
    </Stack>
  );
}
