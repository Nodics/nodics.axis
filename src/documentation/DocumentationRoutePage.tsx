import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
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
import { alpha } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { axisTokens } from '../app/axisTheme';
import { CmsRoutePage } from '../app/CmsRoutePage';
import { WorkspaceHeading } from '../app/help/WorkspaceHelp';
import { ShellIcon } from '../app/shell/ShellIcon';
import { WorkspaceContainer } from '../app/shell/ShellPrimitives';
import {
  selectModuleConnection,
  type AxisAuthenticatedBootstrap,
  type AxisDocumentationSource,
  type AxisModuleConnection,
} from '../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../runtime/runtimeConfig';
import { createDocumentationContentPackClient } from './api/documentationContentPackClient';
import {
  createDocumentationPublicationClient,
  type DocumentationPublicationReadiness,
  type DocumentationPublicationStatus,
} from './api/documentationPublicationClient';
import { DocumentationDashboard } from './DocumentationDashboard';
import { DocumentationSourceNavigation } from './DocumentationSourceNavigation';
import { OpenApiDocumentationRenderer } from './OpenApiDocumentationRenderer';

interface DocumentationRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly onPublicationStatusChange?:
    | ((status: DocumentationPublicationStatus) => void | Promise<void>)
    | undefined;
  readonly path: string;
  readonly runtime: AxisRuntimeConfig;
}

const publicationQueryKey = (enterpriseCode: string, profileCode: string) =>
  ['documentation-publication', enterpriseCode, profileCode] as const;
const packQueryKey = (enterpriseCode: string, packCode: string) =>
  ['documentation-content-pack', enterpriseCode, packCode] as const;
const documentationActionButtonSx = {
  minHeight: 40,
  minWidth: { xs: 0, sm: 128 },
  px: 1.5,
  whiteSpace: 'nowrap',
} as const;
const documentationSecondaryActionButtonSx = {
  ...documentationActionButtonSx,
  bgcolor: 'background.paper',
  borderColor: 'divider',
  color: 'text.primary',
  '&:hover': {
    bgcolor: 'rgba(250, 191, 0, 0.08)',
    borderColor: 'rgba(250, 191, 0, 0.55)',
  },
} as const;

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

function documentationPublicationReadinessLabel(
  readiness: DocumentationPublicationReadiness | undefined,
): string {
  switch (readiness) {
    case 'NOT_IMPORTED':
      return 'Not initialized';
    case 'IMPORTED':
      return 'Approval needed';
    case 'PUBLICATION_PENDING':
      return 'Approval in progress';
    case 'READY':
      return 'Online ready';
    case 'REJECTED':
      return 'Rejected';
    case 'FAILED':
      return 'Failed';
    case 'ROLLED_BACK':
      return 'Rolled back';
    case 'RETIRED':
      return 'Retired';
    default:
      return 'Checking';
  }
}

function documentationPublicationColor(
  readiness: DocumentationPublicationReadiness | undefined,
): 'default' | 'success' | 'warning' | 'error' {
  if (['FAILED', 'REJECTED'].includes(readiness ?? '')) return 'error';
  if (readiness === 'READY') return 'success';
  if (readiness === 'IMPORTED' || readiness === 'PUBLICATION_PENDING') return 'warning';
  return 'default';
}

interface CmsDocumentationRoutePageProps extends DocumentationRoutePageProps {
  readonly administrationConnection: AxisModuleConnection;
  readonly onPublicationStatusChange?:
    | ((status: DocumentationPublicationStatus) => void | Promise<void>)
    | undefined;
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
  const [journeyExpanded, setJourneyExpanded] = useState(false);
  const [verificationExpanded, setVerificationExpanded] = useState(false);
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
      await Promise.all([
        pack.refetch(),
        props.onPublicationStatusChange?.(nextStatus),
      ]);
    },
  });
  const busy = packMutation.isPending || publicationMutation.isPending;

  if (publication.data?.readiness === 'READY') {
    return (
      <Stack spacing={2}>
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', overflow: 'hidden' }}
        >
          <Box
            aria-controls="online-verification-checklist"
            aria-expanded={verificationExpanded}
            component="button"
            onClick={() => setVerificationExpanded((current) => !current)}
            sx={{
              alignItems: 'center',
              bgcolor: 'background.paper',
              border: 0,
              color: 'text.primary',
              cursor: 'pointer',
              display: 'grid',
              font: 'inherit',
              gap: 1.5,
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr) auto',
                md: 'auto minmax(0, 1fr) auto',
              },
              minHeight: 48,
              px: 2,
              py: 1,
              textAlign: 'left',
              width: '100%',
              '&:hover': {
                bgcolor: alpha(axisTokens.color.signatureGold, 0.06),
              },
            }}
            type="button"
          >
            <Chip
              label="Online verification"
              size="small"
              sx={{
                bgcolor: alpha(axisTokens.color.signatureGold, 0.16),
                color: axisTokens.color.charcoal[900],
                display: { xs: 'none', md: 'inline-flex' },
                fontWeight: 700,
                justifySelf: 'start',
              }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="span" sx={{ fontWeight: 700 }} variant="body2">
                Online version {publication.data.releaseVersion}
              </Typography>
              <Typography
                color="text.secondary"
                component="span"
                sx={{ display: { xs: 'none', sm: 'inline' }, ml: 1 }}
                variant="caption"
              >
                Verification evidence, history, audit, and retirement controls
              </Typography>
            </Box>
            <ShellIcon
              fontSize="small"
              name={verificationExpanded ? 'chevron-up' : 'chevron-down'}
            />
          </Box>
          <Collapse
            id="online-verification-checklist"
            in={verificationExpanded}
            timeout="auto"
            unmountOnExit
          >
            <Stack
              spacing={1.5}
              sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}
            >
              {publicationMutation.error instanceof Error ? (
                <Alert severity="error">{publicationMutation.error.message}</Alert>
              ) : null}
              <Typography color="text.secondary" variant="body2">
                This documentation release is Online. Verification should capture the
                browser page, publication receipt, rollback candidate, and audit trail
                before the task is closed.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, minmax(0, 1fr))',
                  },
                }}
              >
                {documentationLifecycleSteps.map((step) => (
                  <Box
                    key={step.title}
                    sx={{
                      bgcolor: alpha(axisTokens.color.signatureGold, 0.05),
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      px: 1.25,
                      py: 1,
                    }}
                  >
                    <Typography component="div" variant="subtitle2">
                      {step.title}
                    </Typography>
                    <Typography component="div" variant="body2">
                      {step.body}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  label={`Site: ${publication.data.siteCode}`}
                  size="small"
                />
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
                    label={`Revision: ${String(
                      publication.data.publication.revision,
                    )}`}
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
            </Stack>
          </Collapse>
        </Paper>
        <CmsRoutePage
          accessToken={props.accessToken}
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
  const packActionLabel =
    packOperation === 'UPDATE' ? 'Update staged' : 'Install staged';
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
          <Stack spacing={2.25}>
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
                    color={documentationPublicationColor(publication.data.readiness)}
                    label={`Online readiness: ${documentationPublicationReadinessLabel(
                      publication.data.readiness,
                    )}`}
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

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                pt: 0.5,
              }}
            >
              {packOperation ? (
                <Button
                  disabled={busy}
                  onClick={() => packMutation.mutate()}
                  size="large"
                  sx={documentationActionButtonSx}
                  variant="contained"
                >
                  {packMutation.isPending ? 'Working...' : packActionLabel}
                </Button>
              ) : null}
              {pack.data?.state === 'CURRENT' ? (
                <Button
                  disabled={busy}
                  onClick={() => void reconcile()}
                  sx={documentationSecondaryActionButtonSx}
                  variant="outlined"
                >
                  Validate staged
                </Button>
              ) : null}
              {canPublish ? (
                <Button
                  disabled={busy}
                  onClick={() => publicationMutation.mutate('INITIALIZE')}
                  sx={documentationActionButtonSx}
                  variant="contained"
                >
                  {publicationMutation.isPending
                    ? 'Requesting...'
                    : publication.data?.readiness === 'FAILED'
                      ? 'Retry publication'
                      : 'Request approval'}
                </Button>
              ) : null}
              {error ? (
                <Button
                  onClick={() => {
                    packMutation.reset();
                    publicationMutation.reset();
                    void reconcile();
                  }}
                  sx={documentationSecondaryActionButtonSx}
                  variant="outlined"
                >
                  Refresh status
                </Button>
              ) : null}
            </Box>

            <Paper
              component="section"
              elevation={0}
              sx={{ border: 1, borderColor: 'divider', overflow: 'hidden' }}
            >
              <Box
                aria-controls="documentation-initialization-journey"
                aria-expanded={journeyExpanded}
                component="button"
                onClick={() => setJourneyExpanded((current) => !current)}
                sx={{
                  alignItems: 'center',
                  bgcolor: 'background.paper',
                  border: 0,
                  color: 'text.primary',
                  cursor: 'pointer',
                  display: 'grid',
                  font: 'inherit',
                  gap: 1.5,
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  minHeight: 52,
                  px: 2,
                  py: 1.25,
                  textAlign: 'left',
                  width: '100%',
                  '&:hover': {
                    bgcolor: alpha(axisTokens.color.signatureGold, 0.06),
                  },
                }}
                type="button"
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="div" sx={{ fontWeight: 800 }} variant="body1">
                    Publication journey
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    See the governed path from Staged content to Online delivery.
                  </Typography>
                </Box>
                <ShellIcon
                  fontSize="small"
                  name={journeyExpanded ? 'chevron-up' : 'chevron-down'}
                />
              </Box>
              <Collapse
                id="documentation-initialization-journey"
                in={journeyExpanded}
                timeout="auto"
                unmountOnExit
              >
                <Stack sx={{ borderTop: 1, borderColor: 'divider', p: 0 }}>
                  <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {documentationLifecycleSteps.map((step) => (
                      <Box
                        key={step.title}
                        component="li"
                        sx={{
                          alignItems: 'flex-start',
                          borderBottom: 1,
                          borderColor: 'divider',
                          display: 'grid',
                          gap: 1.5,
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: '220px minmax(0, 1fr)',
                          },
                          px: 2,
                          py: 1.25,
                          '&:last-of-type': {
                            borderBottom: 0,
                          },
                        }}
                      >
                        <Typography component="div" sx={{ fontWeight: 800 }} variant="body2">
                          {step.title}
                        </Typography>
                        <Typography color="text.secondary" component="div" variant="body2">
                          {step.body}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      borderTop: 1,
                      borderColor: 'divider',
                      flexWrap: 'wrap',
                      gap: 1,
                      px: 2,
                      py: 1.25,
                    }}
                  >
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
                      label={`Online readiness: ${documentationPublicationReadinessLabel(
                        publication.data?.readiness,
                      )}`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Alert
                    severity="warning"
                    sx={{ borderRadius: 0, borderTop: 1, borderColor: 'divider' }}
                  >
                    Documentation version 0 is valid while Nodics is pre-release.
                    Content changes still require regenerated backend-owned releases and
                    must not bypass approval before Online publication.
                  </Alert>
                </Stack>
              </Collapse>
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
          onPublicationStatusChange={props.onPublicationStatusChange}
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
        onPublicationStatusChange={props.onPublicationStatusChange}
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
