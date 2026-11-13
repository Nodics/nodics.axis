import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { DataCatalogueRead } from '../api/dataCatalogueSources';

/** Generic transport recovery only: never converts missing source reads into installation or readiness policy. */
export function DataCatalogueCoverage(props: {
  readonly read: DataCatalogueRead<unknown>;
  readonly commandPending: boolean;
  readonly onRefresh: () => void;
}) {
  const loaded = props.read.sources.filter(
    (source) => source.status === 'LOADED',
  ).length;
  const pending = props.read.sources.filter(
    (source) => source.status === 'LOADING',
  ).length;
  const refresh = (
    <Button disabled={props.commandPending || pending > 0} onClick={props.onRefresh}>
      Refresh data
    </Button>
  );
  if (!props.read.isPartial && !props.read.isError)
    return <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>{refresh}</Box>;
  return (
    <Alert severity={props.read.isLoading ? 'info' : 'warning'} action={refresh}>
      <Stack spacing={1}>
        <Typography variant="body2">
          Source coverage is incomplete: {loaded} of {props.read.sources.length} reads
          completed.
          {pending > 0
            ? ` ${pending} still loading.`
            : ' Some information could not be verified.'}{' '}
          Actionable rows use fresh successful reads. Pending operations retain their
          original context.
        </Typography>
        {props.read.conflicts.length ? (
          <Typography variant="body2">
            Conflicting record evidence was excluded.
          </Typography>
        ) : null}
        <Box component="details">
          <Box component="summary" sx={{ cursor: 'pointer' }}>
            Connection details
          </Box>
          <Box component="ul" sx={{ pl: 2.5, mb: 0 }}>
            {props.read.sources.map((state) => (
              <Typography component="li" variant="body2" key={state.source.key}>
                {state.source.connection.server ?? state.source.connection.moduleName} ·{' '}
                {state.source.connection.runtimeRole?.code ??
                  state.source.connection.environment}
                : {state.status}
                {state.message ? ` · ${state.message}` : ''}
              </Typography>
            ))}
          </Box>
        </Box>
      </Stack>
    </Alert>
  );
}
