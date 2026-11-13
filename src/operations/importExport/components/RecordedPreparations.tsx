import { useId, useRef } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import type { AxisModuleConnection } from '../../../bootstrap/publicBootstrap';
import {
  installDataReleases,
  loadDataReleaseExecutions,
  type DataReleaseClientConfiguration,
} from '../api/dataReleaseClient';
import type {
  DataReleaseExecution,
  DataReleaseType,
} from '../api/dataReleaseContracts';
import { dataCatalogueSourceKey } from '../api/dataCatalogueSources';

/** Original-actor owner receipts survive navigation and reload; no browser state authorizes continuation. */
export function RecordedPreparations(props: {
  readonly connections: readonly AxisModuleConnection[];
  readonly configuration: DataReleaseClientConfiguration;
  readonly dataType: DataReleaseType;
  readonly scopeId: string;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const queryClient = useQueryClient();
  const queryRoot = ['import-executions', props.scopeId, props.dataType] as const;
  const reads = useQueries({
    queries: props.connections.map((connection) => ({
      queryKey: [...queryRoot, dataCatalogueSourceKey(connection)],
      queryFn: () =>
        loadDataReleaseExecutions(connection, props.configuration, props.dataType),
      retry: false,
      refetchOnMount: 'always' as const,
    })),
  });
  const operation = useMutation({
    retry: false,
    mutationFn: async ({
      connection,
      execution,
    }: {
      connection: AxisModuleConnection;
      execution: DataReleaseExecution;
    }) => {
      if (!execution.canContinue)
        throw new Error('Your current access does not allow continuation.');
      const result = await installDataReleases(connection, props.configuration, {
        dataType: execution.dataType,
        releaseCodes: execution.releaseCodes,
        expectedReleases: execution.expectedReleases,
        continuation: true,
        executionCode: execution.code,
      });
      if (result.execution?.code !== execution.code)
        throw new Error(
          'The continuation acknowledgement differs from the recorded plan. Refresh its receipt before taking another action.',
        );
      return result.execution;
    },
    onSuccess: (result) => {
      if (result.status === 'COMPLETED') heading.current?.focus();
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryRoot }),
        queryClient.invalidateQueries({ queryKey: ['import-catalogue'] }),
      ]);
    },
  });
  if (!props.connections.length) return null;
  const hasRows = reads.some((read) => !read.isError && read.data?.length);
  return (
    <Box component="section" aria-labelledby={id} sx={{ mt: 2 }}>
      <Typography component="h2" variant="h6" id={id} tabIndex={-1} ref={heading}>
        Recorded preparations
      </Typography>
      <Typography color="text.secondary" variant="body2">
        Completed stages are retained by the Import owner. Continue one stage at a time;
        refreshing this page does not repeat an import.
      </Typography>
      {reads.some((read) => read.isPending) ? (
        <LinearProgress aria-label="Loading recorded preparations" sx={{ mt: 1 }} />
      ) : null}
      {reads.some((read) => read.isError) ? (
        <Alert severity="warning">
          Some preparation receipts could not be read. Refresh to inspect their state
          before continuing.
        </Alert>
      ) : null}
      {operation.isPending ? (
        <Alert severity="info" role="status">
          The owner is processing this stage. Wait for its receipt before starting
          another action.
        </Alert>
      ) : null}
      {operation.isError ? (
        <Alert severity="error">
          {operation.error.message} Refresh the recorded receipt; do not repeat the
          original import.
        </Alert>
      ) : null}
      <Button
        disabled={operation.isPending || reads.some((read) => read.isFetching)}
        onClick={() => {
          void queryClient.invalidateQueries({ queryKey: queryRoot });
        }}
      >
        Refresh preparations
      </Button>
      {!hasRows && reads.every((read) => !read.isPending && !read.isError) ? (
        <Typography variant="body2">
          No recorded preparations for your current account and selected data type.
        </Typography>
      ) : null}
      <Stack spacing={2}>
        {reads.flatMap((read, index) =>
          read.isError
            ? []
            : (read.data ?? []).map((execution) => {
                const connection = props.connections[index]!;
                return (
                  <Box
                    key={dataCatalogueSourceKey(connection) + execution.code}
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
                  >
                    <Typography variant="subtitle2">
                      {connection.server ?? connection.moduleName}
                    </Typography>
                    <Typography role="status">
                      {execution.completed} of {execution.total} release stages prepared
                      ·{' '}
                      {execution.status === 'READY'
                        ? 'Ready to continue'
                        : execution.status === 'COMPLETED'
                          ? 'Complete'
                          : 'Receipt inspection required'}
                    </Typography>
                    <Typography variant="body2">{execution.nextAction}</Typography>
                    <Box component="details" sx={{ my: 1 }}>
                      <summary>Preparation evidence</summary>
                      <Typography
                        variant="caption"
                        component="p"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        Receipt: {execution.code}
                      </Typography>
                      {execution.releaseCodes.map((code) => (
                        <Typography key={code} variant="body2">
                          {code} · {execution.expectedReleases[code]}
                        </Typography>
                      ))}
                    </Box>
                    {execution.canContinue ? (
                      <Button
                        variant="outlined"
                        disabled={operation.isPending || read.isFetching}
                        onClick={() => operation.mutate({ connection, execution })}
                      >
                        {execution.status === 'READY'
                          ? 'Continue preparation'
                          : 'Reconcile receipt'}
                      </Button>
                    ) : null}
                  </Box>
                );
              }),
        )}
      </Stack>
    </Box>
  );
}
