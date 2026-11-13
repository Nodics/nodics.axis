import { useAxisLocalization } from '../localization/AxisLocalizationContext';
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { AxisAuthenticatedBootstrap } from './publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { useOperationalReadinessObservation } from './useOperationalReadinessObservation';

/** Renders one explicitly opened owner observation across every shell workspace; no local readiness or action authority. */
export function OperationalReadinessInspector(props: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly runtime: AxisRuntimeConfig;
  readonly accessToken: string;
  readonly scope: string;
}) {
  const [open, setOpen] = useState(false);
  const { format, locale } = useAxisLocalization();
  const presentation = props.bootstrap.operationalReadinessObservation?.presentation;
  const copy =
    presentation &&
    (Object.keys(presentation) as (keyof typeof presentation)[]).reduce(
      (result, key) => {
        const source = presentation[key];
        return {
          ...result,
          [key]:
            format('backoffice.readiness.' + key.toLowerCase() + '.source', '') ===
            source
              ? format('backoffice.readiness.' + key.toLowerCase(), source)
              : source,
        };
      },
      presentation,
    );
  const observation = useOperationalReadinessObservation({
    ...props,
    scope: JSON.stringify([props.scope, props.bootstrap.moduleConnections.backoffice]),
    active: open && Boolean(copy),
    retainObservation: true,
  });
  const report = observation.bootstrap.operationalReadiness;
  if (!copy) return null;
  const snapshot = report?.summary.latestSnapshot;
  const receipt =
    snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? (snapshot as Record<string, unknown>)
      : undefined;
  const build =
    receipt?.buildIdentity &&
    typeof receipt.buildIdentity === 'object' &&
    !Array.isArray(receipt.buildIdentity)
      ? (receipt.buildIdentity as Record<string, unknown>)
      : undefined;
  const loading = observation.query.isFetching || (open && observation.query.isPending);
  return (
    <>
      <Tooltip title={copy.openLabel}>
        <IconButton
          aria-label={copy.openLabel}
          onClick={() => setOpen(true)}
          sx={{ width: 44, height: 44 }}
        >
          <ShellIcon name="health" />
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
        aria-labelledby="readiness-inspector-title"
      >
        <DialogTitle id="readiness-inspector-title">{copy.title}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography>{copy.description}</Typography>
            {loading ? (
              <Box role="status">
                <Typography>{copy.loadingMessage}</Typography>
                <LinearProgress />
              </Box>
            ) : null}
            {observation.query.isError ? (
              <Alert severity="error">{copy.errorMessage}</Alert>
            ) : null}
            {!loading && !observation.query.isError && report ? (
              <>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Chip
                    label={report.state}
                    color={report.state === 'READY' ? 'success' : 'warning'}
                  />
                  <Typography variant="body2">
                    {copy.checkedAtLabel}:{' '}
                    <time dateTime={report.checkedAt}>
                      {new Date(report.checkedAt).toLocaleString(locale)}
                    </time>
                  </Typography>
                </Stack>
                <Box component="details" sx={{ overflowWrap: 'anywhere' }}>
                  <summary>{copy.receiptLabel}</summary>
                  <Typography variant="body2">
                    {typeof receipt?.evidenceCode === 'string'
                      ? receipt.evidenceCode
                      : report.source}
                  </Typography>
                  {typeof build?.inputDigest === 'string' ? (
                    <Typography variant="body2">
                      {copy.buildLabel}: {build.inputDigest}
                    </Typography>
                  ) : null}
                  <Typography variant="body2">{copy.historicalMessage}</Typography>
                </Box>
                {report.sections.map((section) => (
                  <Box
                    key={section.key}
                    component="section"
                    aria-label={section.title}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 2,
                      minWidth: 0,
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}
                    >
                      <Typography component="h3" variant="subtitle1">
                        {section.title}
                      </Typography>
                      <Chip size="small" label={section.businessStatus} />
                    </Stack>
                    <Typography sx={{ overflowWrap: 'anywhere', mt: 1 }}>
                      {section.nextAction}
                    </Typography>
                    {section.blockers.length ? (
                      <Box component="details" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                        <summary>
                          {copy.nextActionLabel} ·{' '}
                          {new Intl.NumberFormat(locale).format(
                            section.blockers.length,
                          )}
                        </summary>
                        <Stack component="ul" spacing={1} sx={{ pl: 2 }}>
                          {section.blockers.map((blocker, index) => (
                            <li key={index}>
                              <Typography>{blocker.message}</Typography>
                              <Typography variant="body2">{blocker.action}</Typography>
                              <Typography variant="caption">{blocker.code}</Typography>
                            </li>
                          ))}
                        </Stack>
                      </Box>
                    ) : null}
                  </Box>
                ))}
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              void observation.query.refetch();
            }}
            disabled={loading}
          >
            {copy.refreshLabel}
          </Button>
          <Button onClick={() => setOpen(false)}>{copy.closeLabel}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
