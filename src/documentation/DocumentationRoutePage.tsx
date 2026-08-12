import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { CmsRoutePage } from '../app/CmsRoutePage';
import { WorkspaceHeading } from '../app/help/WorkspaceHelp';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisDocumentationSource,
  type AxisModuleConnection,
} from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { createDocumentationContentPackClient } from './api/documentationContentPackClient';
import { DocumentationDashboard } from './DocumentationDashboard';
import { DocumentationSourceNavigation } from './DocumentationSourceNavigation';
import { OpenApiDocumentationRenderer } from './OpenApiDocumentationRenderer';

interface DocumentationRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly locale: string;
  readonly path: string;
  readonly runtime: AxisRuntimeConfig;
}

const queryKey = (enterpriseCode: string, packCode: string) =>
  ['documentation-content-pack', enterpriseCode, packCode] as const;

function sourceForPath(
  sources: readonly AxisDocumentationSource[],
  path: string,
): AxisDocumentationSource | undefined {
  return (
    sources
      .filter((source) => path === source.route || path.startsWith(`${source.route}/`))
      .sort((left, right) => right.route.length - left.route.length)[0] ??
    sources.find((source) => source.id === 'framework') ??
    sources[0]
  );
}

interface CmsDocumentationRoutePageProps extends DocumentationRoutePageProps {
  readonly connection: AxisModuleConnection;
  readonly source: Extract<AxisDocumentationSource, { readonly type: 'CMS' }>;
}

function CmsDocumentationRoutePage(props: CmsDocumentationRoutePageProps) {
  const source = props.source;
  const connection = props.connection;
  const queryClient = useQueryClient();
  const client = useMemo(
    () =>
      createDocumentationContentPackClient({
        connection,
        enterpriseCode: props.runtime.enterpriseCode,
        accessToken: props.accessToken,
        timeoutMs: props.runtime.requestTimeoutMs,
        packCode: source.packCode,
      }),
    [
      props.accessToken,
      connection,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
      source.packCode,
    ],
  );
  const status = useQuery({
    queryKey: queryKey(props.runtime.enterpriseCode, source.packCode),
    queryFn: client.getStatus,
    refetchInterval: (query) =>
      query.state.data?.state === 'IMPORTING' ? 2_000 : false,
  });
  const importContent = useMutation({
    mutationFn: client.importOrUpdate,
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(
        queryKey(props.runtime.enterpriseCode, source.packCode),
        nextStatus,
      );
    },
  });

  if (
    status.data?.installedVersion &&
    ['CURRENT', 'UPDATE_AVAILABLE'].includes(status.data.state)
  ) {
    const updateAvailable = status.data.state === 'UPDATE_AVAILABLE';
    return (
      <Stack spacing={2}>
        {updateAvailable ? (
          <Alert
            action={
              <Button
                disabled={importContent.isPending}
                onClick={() => importContent.mutate()}
                size="small"
                variant="outlined"
              >
                {importContent.isPending
                  ? 'Updating…'
                  : status.data.presentation.updateAction}
              </Button>
            }
            severity={importContent.isError ? 'error' : 'info'}
          >
            {importContent.error instanceof Error
              ? importContent.error.message
              : `Documentation version ${String(status.data.availableVersion)} is available.`}
          </Alert>
        ) : null}
        <CmsRoutePage
          channel={props.channel}
          cmsBaseUrl={props.cmsBaseUrl}
          enterpriseCode={props.runtime.enterpriseCode}
          locale={props.locale}
          path={props.path === source.route ? source.defaultPage : props.path}
          site={source.site}
          timeoutMs={props.runtime.requestTimeoutMs}
        />
      </Stack>
    );
  }

  const presentation = status.data?.presentation;
  const operation = status.data?.allowedOperations[0];
  const actionLabel =
    operation === 'UPDATE' ? presentation?.updateAction : presentation?.importAction;
  const error =
    status.error instanceof Error
      ? status.error.message
      : importContent.error instanceof Error
        ? importContent.error.message
        : undefined;

  return (
    <WorkspaceContainer>
      <Stack>
        <Paper
          component="section"
          aria-label="Documentation availability"
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
            p: { xs: 2.5, md: 4 },
          }}
        >
          <Stack spacing={3} sx={{ maxWidth: 820 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip label="Wiki" size="small" variant="outlined" />
                {status.data ? (
                  <Chip
                    color={
                      status.data.state === 'UPDATE_AVAILABLE' ? 'warning' : 'default'
                    }
                    label={status.data.state.replaceAll('_', ' ')}
                    size="small"
                  />
                ) : null}
              </Stack>
              <WorkspaceHeading
                description={
                  status.data?.state === 'DISABLED'
                    ? presentation?.disabledMessage
                    : (presentation?.unavailableMessage ??
                      'Checking documentation availability.')
                }
                title={presentation?.title ?? 'Nodics documentation'}
              />
            </Stack>

            {status.isPending ? (
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <CircularProgress aria-label="Checking documentation" size={24} />
                <Typography>Checking documentation availability…</Typography>
              </Stack>
            ) : null}

            {error ? <Alert severity="error">{error}</Alert> : null}

            {status.data?.state === 'SOURCE_UNAVAILABLE' ? (
              <Alert severity="warning">
                The configured documentation release could not be validated. Contact an
                administrator or retry after the source is available.
              </Alert>
            ) : null}

            {operation ? (
              <Box sx={{ pt: 1 }}>
                <Button
                  disabled={importContent.isPending}
                  onClick={() => importContent.mutate()}
                  size="large"
                  variant="contained"
                >
                  {importContent.isPending ? 'Importing documentation…' : actionLabel}
                </Button>
              </Box>
            ) : null}

            {error ? (
              <Box>
                <Button
                  onClick={() => {
                    importContent.reset();
                    void status.refetch();
                  }}
                  variant="outlined"
                >
                  {presentation?.retryAction ?? 'Retry'}
                </Button>
              </Box>
            ) : null}
          </Stack>
        </Paper>
      </Stack>
    </WorkspaceContainer>
  );
}

export function DocumentationRoutePage(props: DocumentationRoutePageProps) {
  if (props.path === '/docs') {
    return (
      <WorkspaceContainer>
        <DocumentationDashboard bootstrap={props.bootstrap} />
      </WorkspaceContainer>
    );
  }
  const source = sourceForPath(props.bootstrap.documentationSources, props.path);
  if (!source) {
    return (
      <Alert severity="warning">
        No authorized documentation sources are available.
      </Alert>
    );
  }
  const connection = selectModuleConnection(props.bootstrap, source.connectionModule);
  const navigation = (
    <DocumentationSourceNavigation
      activeSourceId={source.id}
      sources={props.bootstrap.documentationSources}
    />
  );
  let content;
  if (!connection) {
    content = (
      <WorkspaceContainer>
        <Alert severity="warning">
          {source.label} is unavailable because its owning runtime connection is not
          active.
        </Alert>
      </WorkspaceContainer>
    );
  } else if (source.type === 'OPENAPI') {
    content = (
      <OpenApiDocumentationRenderer
        accessToken={props.accessToken}
        connection={connection}
        enterpriseCode={props.runtime.enterpriseCode}
        moduleCatalog={props.bootstrap.moduleCatalog}
        runtime={props.runtime}
        source={source}
      />
    );
  } else {
    content = (
      <CmsDocumentationRoutePage {...props} connection={connection} source={source} />
    );
  }
  return (
    <Stack spacing={1}>
      <Box sx={{ minWidth: 0, width: '100%' }}>{navigation}</Box>
      {content}
    </Stack>
  );
}
