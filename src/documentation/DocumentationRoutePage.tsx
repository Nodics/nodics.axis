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
import { createDocumentationPublicationClient } from './api/documentationPublicationClient';
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

const queryKey = (enterpriseCode: string, profileCode: string) =>
  ['documentation-publication', enterpriseCode, profileCode] as const;

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
  readonly administrationConnection: AxisModuleConnection;
  readonly connection: AxisModuleConnection;
  readonly source: Extract<AxisDocumentationSource, { readonly type: 'CMS' }>;
}

function CmsDocumentationRoutePage(props: CmsDocumentationRoutePageProps) {
  const source = props.source;
  if (!source.initializationProfile) {
    throw new Error('Documentation initialization profile is unavailable');
  }
  const initializationProfile = source.initializationProfile;
  const queryClient = useQueryClient();
  const client = useMemo(
    () =>
      createDocumentationPublicationClient({
        connection: props.administrationConnection,
        enterpriseCode: props.runtime.enterpriseCode,
        accessToken: props.accessToken,
        timeoutMs: props.runtime.requestTimeoutMs,
        profileCode: initializationProfile,
      }),
    [
      props.accessToken,
      props.administrationConnection,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
      initializationProfile,
    ],
  );
  const status = useQuery({
    queryKey: queryKey(props.runtime.enterpriseCode, initializationProfile),
    queryFn: client.getStatus,
    refetchInterval: (query) =>
      query.state.data?.readiness === 'PUBLICATION_PENDING' ? 2_000 : false,
  });
  const importContent = useMutation({
    mutationFn: client.initiate,
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(
        queryKey(props.runtime.enterpriseCode, initializationProfile),
        nextStatus,
      );
    },
  });

  if (status.data?.readiness === 'READY') {
    return (
      <Stack spacing={2}>
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

  const operation = status.data?.allowedActions[0];
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
                      ['FAILED', 'REJECTED'].includes(status.data.readiness)
                        ? 'warning'
                        : 'default'
                    }
                    label={status.data.readiness.replaceAll('_', ' ')}
                    size="small"
                  />
                ) : null}
              </Stack>
              <WorkspaceHeading
                description={
                  'Install the verified bundle to Staged, then submit it for approval and Online publication.'
                }
                title={source.label}
              />
            </Stack>

            {status.isPending ? (
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <CircularProgress aria-label="Checking documentation" size={24} />
                <Typography>Checking documentation availability…</Typography>
              </Stack>
            ) : null}

            {error ? <Alert severity="error">{error}</Alert> : null}

            {status.data && ['FAILED', 'REJECTED'].includes(status.data.readiness) ? (
              <Alert severity="warning">
                The documentation publication did not complete. Review its Process
                decision and audit evidence before retrying.
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
                  {importContent.isPending
                    ? 'Submitting documentation…'
                    : 'Install and request publication'}
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
                  Retry
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
  const administrationConnection = selectModuleConnection(
    props.bootstrap,
    'backoffice',
  );
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
  } else if (!administrationConnection) {
    content = (
      <WorkspaceContainer>
        <Alert severity="warning">
          Documentation administration is unavailable because Platform BackOffice is not
          active.
        </Alert>
      </WorkspaceContainer>
    );
  } else {
    content = (
      <CmsDocumentationRoutePage
        {...props}
        administrationConnection={administrationConnection}
        connection={connection}
        source={source}
      />
    );
  }
  return (
    <Stack spacing={1}>
      <Box sx={{ minWidth: 0, width: '100%' }}>{navigation}</Box>
      {content}
    </Stack>
  );
}
