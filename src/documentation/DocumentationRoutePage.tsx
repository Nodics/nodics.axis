import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

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

const publicationQueryKey = (enterpriseCode: string, profileCode: string) =>
  ['documentation-publication', enterpriseCode, profileCode] as const;
const packQueryKey = (enterpriseCode: string, packCode: string) =>
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

const documentationLifecycleSteps = Object.freeze([
  Object.freeze({
    title: '1. Import to Staged',
    body: 'Install or update backend-owned content templates and documentation data from the content pack.',
  }),
  Object.freeze({
    title: '2. Submit for approval',
    body: 'Create the governed publication request. Online documentation must not change before approval.',
  }),
  Object.freeze({
    title: '3. Approve and publish',
    body: 'Use Process approval and nPublish to move the approved documentation release Online.',
  }),
  Object.freeze({
    title: '4. Verify Online',
    body: 'Open the documentation route in the browser, then inspect Publishing status, history, and audit.',
  }),
]);

function documentationReadinessLabel(readiness: string | undefined): string {
  if (!readiness) return 'Unknown';
  if (readiness === 'NOT_IMPORTED') return 'Not initialized';
  if (readiness === 'PUBLICATION_PENDING') return 'Waiting for approval';
  if (readiness === 'READY') return 'Online and ready';
  return readiness.replaceAll('_', ' ').toLowerCase();
}

interface CmsDocumentationRoutePageProps extends DocumentationRoutePageProps {
  readonly administrationConnection: AxisModuleConnection;
  readonly source: Extract<AxisDocumentationSource, { readonly type: 'CMS' }>;
}

function CmsDocumentationRoutePage(props: CmsDocumentationRoutePageProps) {
  const source = props.source;
  if (!source.initializationProfile) {
    throw new Error('Documentation initialization profile is unavailable');
  }
  const initializationProfile = source.initializationProfile;
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState<'ROLLBACK' | 'RETIRE'>();
  const publicationClient = useMemo(
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
  const packClient = useMemo(
    () =>
      createDocumentationContentPackClient({
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
  const publication = useQuery({
    queryKey: publicationQueryKey(props.runtime.enterpriseCode, initializationProfile),
    queryFn: publicationClient.getStatus,
    refetchInterval: (query) =>
      query.state.data?.readiness === 'PUBLICATION_PENDING' ? 2_000 : false,
  });
  const pack = useQuery({
    queryKey: packQueryKey(props.runtime.enterpriseCode, source.packCode),
    queryFn: packClient.getStatus,
    refetchInterval: (query) =>
      query.state.data?.state === 'IMPORTING' ? 2_000 : false,
  });
  const reconcile = async () => {
    await Promise.all([pack.refetch(), publication.refetch()]);
  };
  const packMutation = useMutation({
    mutationFn: packClient.importOrUpdate,
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(
        packQueryKey(props.runtime.enterpriseCode, source.packCode),
        nextStatus,
      );
      await publication.refetch();
    },
  });
  const publicationMutation = useMutation({
    mutationFn: (operation: 'INITIALIZE' | 'ROLLBACK' | 'RETIRE') =>
      operation === 'ROLLBACK'
        ? publicationClient.rollback()
        : operation === 'RETIRE'
          ? publicationClient.retire()
          : publicationClient.initiate(),
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(
        publicationQueryKey(props.runtime.enterpriseCode, initializationProfile),
        nextStatus,
      );
      setConfirmation(undefined);
      await pack.refetch();
    },
  });
  const busy = packMutation.isPending || publicationMutation.isPending;

  if (publication.data?.readiness === 'READY') {
    return (
      <Stack spacing={2}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: 2 }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { sm: 'center' } }}
          >
            <Chip color="success" label="Online" size="small" />
            <Typography sx={{ flex: 1 }} variant="body2">
              Version {publication.data.releaseVersion} is available through Online
              delivery.
            </Typography>
            {publication.data.allowedActions.includes('ROLLBACK') ? (
              <Button
                disabled={busy}
                onClick={() => setConfirmation('ROLLBACK')}
                variant="outlined"
              >
                Rollback
              </Button>
            ) : null}
            {publication.data.allowedActions.includes('RETIRE') ? (
              <Button
                color="warning"
                disabled={busy}
                onClick={() => setConfirmation('RETIRE')}
                variant="outlined"
              >
                Retire
              </Button>
            ) : null}
          </Stack>
          {publicationMutation.error instanceof Error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {publicationMutation.error.message}
            </Alert>
          ) : null}
        </Paper>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', p: 2 }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Online verification checklist</Typography>
              <Typography color="text.secondary" variant="body2">
                This documentation release is Online. Verification should still capture
                the browser page, publication receipt, rollback candidate, and audit
                trail before the task is closed.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {documentationLifecycleSteps.map((step) => (
                <Alert key={step.title} severity="info">
                  <Typography component="div" variant="subtitle2">
                    {step.title}
                  </Typography>
                  <Typography component="div" variant="body2">
                    {step.body}
                  </Typography>
                </Alert>
              ))}
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label={`Site: ${publication.data.siteCode}`} size="small" />
              <Chip
                label={`Content pack: ${source.packCode}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`Release: ${publication.data.releaseCode} ${publication.data.releaseVersion}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`Profile: ${initializationProfile}`}
                size="small"
                variant="outlined"
              />
              {publication.data.publication ? (
                <Chip
                  label={`Revision: ${String(publication.data.publication.revision)}`}
                  size="small"
                  variant="outlined"
                />
              ) : null}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button onClick={() => void reconcile()} variant="outlined">
                Refresh evidence
              </Button>
              <Button
                onClick={() => window.open('/publishing/status', '_blank')}
                variant="outlined"
              >
                Check Online status
              </Button>
              <Button
                onClick={() => window.open('/publishing/history', '_blank')}
                variant="outlined"
              >
                View history
              </Button>
              <Button
                onClick={() => window.open('/publishing/audit', '_blank')}
                variant="outlined"
              >
                Inspect audit
              </Button>
            </Stack>
          </Stack>
        </Paper>
        <CmsRoutePage
          channel={props.channel}
          cmsBaseUrl={props.cmsBaseUrl}
          enterpriseCode={props.runtime.enterpriseCode}
          locale={props.locale}
          path={props.path === source.route ? source.defaultPage : props.path}
          site={source.site}
          timeoutMs={props.runtime.requestTimeoutMs}
        />
        <Dialog onClose={() => setConfirmation(undefined)} open={Boolean(confirmation)}>
          <DialogTitle>
            {confirmation === 'ROLLBACK'
              ? 'Rollback documentation?'
              : 'Retire documentation?'}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {confirmation === 'ROLLBACK'
                ? 'Restore the previous Online release. The current release will no longer be served.'
                : 'Remove this documentation from Online delivery. It remains governed by its release history.'}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmation(undefined)}>Cancel</Button>
            <Button
              color="warning"
              disabled={publicationMutation.isPending}
              onClick={() => confirmation && publicationMutation.mutate(confirmation)}
              variant="contained"
            >
              Confirm {confirmation === 'ROLLBACK' ? 'rollback' : 'retirement'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    );
  }

  const packOperation = pack.data?.allowedOperations[0];
  const canPublish =
    pack.data?.state === 'CURRENT' &&
    publication.data?.allowedActions.includes('INITIALIZE');
  const error =
    pack.error instanceof Error
      ? pack.error.message
      : publication.error instanceof Error
        ? publication.error.message
        : packMutation.error instanceof Error
          ? packMutation.error.message
          : publicationMutation.error instanceof Error
            ? publicationMutation.error.message
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
                {pack.data ? (
                  <Chip
                    color={
                      pack.data.state === 'UPDATE_AVAILABLE' ? 'warning' : 'default'
                    }
                    label={`Staged: ${pack.data.state.replaceAll('_', ' ')}`}
                    size="small"
                  />
                ) : null}
                {publication.data ? (
                  <Chip
                    color={
                      ['FAILED', 'REJECTED'].includes(publication.data.readiness)
                        ? 'error'
                        : 'default'
                    }
                    label={`Online: ${publication.data.readiness.replaceAll('_', ' ')}`}
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

            {pack.isPending || publication.isPending ? (
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <CircularProgress aria-label="Checking documentation" size={24} />
                <Typography>Checking documentation availability…</Typography>
              </Stack>
            ) : null}

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Paper
              component="section"
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', p: 2 }}
            >
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">
                    Documentation initialization journey
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Install content templates and docs data to Staged first. Then
                    request approval-backed publication and verify the Online
                    documentation route in the browser.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  {documentationLifecycleSteps.map((step) => (
                    <Alert key={step.title} severity="info">
                      <Typography component="div" variant="subtitle2">
                        {step.title}
                      </Typography>
                      <Typography component="div" variant="body2">
                        {step.body}
                      </Typography>
                    </Alert>
                  ))}
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  <Chip
                    label={`Content pack: ${source.packCode}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`Profile: ${initializationProfile}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`Staged: ${pack.data?.state ?? 'checking'}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`Online: ${documentationReadinessLabel(publication.data?.readiness)}`}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
                <Alert severity="warning">
                  Documentation version `0` is valid while Nodics is pre-release.
                  Content changes still require regenerated backend-owned releases and
                  must not bypass approval before Online publication.
                </Alert>
              </Stack>
            </Paper>

            {publication.data &&
            ['FAILED', 'REJECTED'].includes(publication.data.readiness) ? (
              <Alert severity="warning">
                The documentation publication did not complete. Review its Process
                decision and audit evidence before retrying.
              </Alert>
            ) : null}

            {pack.data?.state === 'INVALID_RELEASE' ||
            publication.data?.releaseStatus === 'INVALID_RELEASE' ? (
              <Alert severity="error">
                This release is invalid because its content changed without a new
                version. Correct and regenerate the backend-owned release before
                continuing.
              </Alert>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pt: 1 }}>
              {packOperation ? (
                <Button
                  disabled={busy}
                  onClick={() => packMutation.mutate()}
                  size="large"
                  variant="contained"
                >
                  {packMutation.isPending
                    ? 'Installing to Staged…'
                    : packOperation === 'UPDATE'
                      ? pack.data?.presentation.updateAction
                      : pack.data?.presentation.importAction}
                </Button>
              ) : null}
              {pack.data?.state === 'CURRENT' ? (
                <Button
                  disabled={busy}
                  onClick={() => void reconcile()}
                  variant="outlined"
                >
                  Validate staged release
                </Button>
              ) : null}
              {canPublish ? (
                <Button
                  disabled={busy}
                  onClick={() => publicationMutation.mutate('INITIALIZE')}
                  variant="contained"
                >
                  {publicationMutation.isPending
                    ? 'Requesting publication…'
                    : publication.data?.readiness === 'FAILED'
                      ? 'Retry publication'
                      : 'Publish / request approval'}
                </Button>
              ) : null}
            </Stack>

            {publication.data?.readiness === 'PUBLICATION_PENDING' ? (
              <Alert severity="info">
                Publication is waiting for completion or approval. Open Publishing
                Requests to review the workflow task, then use Staged-to-Online Status
                to confirm when Online delivery has been activated.
              </Alert>
            ) : null}

            {publication.data &&
            ['ROLLED_BACK', 'RETIRED'].includes(publication.data.readiness) ? (
              <Alert severity="info">
                This release is{' '}
                {publication.data.readiness === 'ROLLED_BACK'
                  ? 'rolled back'
                  : 'retired'}
                . Revalidate the staged release before requesting publication again.
              </Alert>
            ) : null}

            {error ? (
              <Box>
                <Button
                  onClick={() => {
                    packMutation.reset();
                    publicationMutation.reset();
                    void reconcile();
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
        <DocumentationDashboard
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          runtime={props.runtime}
        />
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
