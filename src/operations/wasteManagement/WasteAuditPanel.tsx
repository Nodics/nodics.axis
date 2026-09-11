import { useEffect, useId, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { loadWasteAudit, type WasteAuditEntry } from './api/wasteReviewClient';

/** Lazily reads the authorized audit, keeping collapse available during loading and failure.
 * Each opening refreshes owner data; stale/unmounted responses cannot reopen the panel.
 * The bounded scroll region keeps the review workspace within reach on long histories.
 */
export function WasteAuditPanel({
  configuration,
  labels,
  centreLabel,
}: {
  configuration: Parameters<typeof loadWasteAudit>[0];
  labels: Record<string, string>;
  centreLabel?: string | undefined;
}) {
  const id = useId();
  const generation = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<WasteAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [configuration],
  );
  const toggle = (_: React.SyntheticEvent, open: boolean) => {
    setExpanded(open);
    const current = ++generation.current;
    if (!open) return;
    setLoading(true);
    setEntries([]);
    setError('');
    void loadWasteAudit(configuration)
      .then((records) => {
        if (generation.current === current) setEntries(records);
      })
      .catch((cause: unknown) => {
        if (generation.current === current)
          setError(
            cause instanceof Error ? cause.message : 'Audit could not be loaded.',
          );
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
  };
  return (
    <Accordion
      expanded={expanded}
      onChange={toggle}
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px !important',
        '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary
        id={`${id}-toggle`}
        aria-controls={`${id}-content`}
        expandIcon={<ShellIcon name="chevron-down" fontSize="small" />}
        sx={{
          px: 2.5,
          minHeight: 56,
          '& .MuiAccordionSummary-content': {
            my: 1.5,
            gap: 1.5,
            alignItems: 'center',
            minWidth: 0,
          },
        }}
      >
        <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
          {expanded ? labels.auditTitle : labels.auditAction}
        </Typography>
        {expanded &&
          (loading ? (
            <CircularProgress size={16} aria-label={labels.auditTitle} />
          ) : (
            !error && (
              <Chip
                component="span"
                size="small"
                label={entries.length}
                sx={{ height: 22 }}
              />
            )
          ))}
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, borderTop: '1px solid', borderColor: 'divider' }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
        {!loading && !error && (
          <Box
            tabIndex={0}
            role="region"
            aria-label={labels.auditTitle}
            sx={{
              maxHeight: { xs: 320, md: 360 },
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              scrollbarGutter: 'stable',
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          >
            {entries.length === 0 && (
              <Typography color="text.secondary" sx={{ p: 2.5 }}>
                —
              </Typography>
            )}
            {entries.map((entry) => {
              const date = entry.reviewedAt ? new Date(entry.reviewedAt) : null;
              const reviewers = [entry.verifiedBy?.code, entry.approvedBy?.code]
                .filter(Boolean)
                .join(' → ');
              return (
                <Box
                  key={entry.code}
                  sx={{
                    px: 2.5,
                    py: 1.75,
                    '& + &': { borderTop: '1px solid', borderColor: 'divider' },
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: { sm: 'center' },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}
                    >
                      {entry.code}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={entry.status.replaceAll('_', ' ')}
                      color={
                        entry.status === 'APPROVED'
                          ? 'success'
                          : entry.status === 'REJECTED'
                            ? 'error'
                            : 'default'
                      }
                      sx={{ alignSelf: 'flex-start', flexShrink: 0, height: 24 }}
                    />
                  </Stack>
                  <Stack
                    direction="row"
                    useFlexGap
                    spacing={1.5}
                    sx={{ mt: 0.75, color: 'text.secondary', overflowWrap: 'anywhere' }}
                  >
                    {entry.collectionPointCode && (
                      <Typography variant="caption">
                        {centreLabel ? `${centreLabel}: ` : ''}
                        {entry.collectionPointCode}
                      </Typography>
                    )}
                    {reviewers && (
                      <Typography variant="caption">{reviewers}</Typography>
                    )}
                    {date && Number.isFinite(date.getTime()) && (
                      <Typography
                        component="time"
                        dateTime={entry.reviewedAt}
                        variant="caption"
                      >
                        {date.toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </Typography>
                    )}
                  </Stack>
                  {entry.publicReason && (
                    <Typography
                      variant="body2"
                      sx={{ mt: 1, overflowWrap: 'anywhere' }}
                    >
                      {entry.publicReason}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
