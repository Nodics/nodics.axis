import { usePublishingGuidanceCopy } from './publishingGuidanceCopy';
import { useAxisLocalization } from '../../localization/AxisLocalizationContext';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { editorialWorkingArticlePath } from '../editorial/editorialPublicationPresentation';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { PublicationRequestBrowser } from './PublicationRequestBrowser';
import { PublicationCommandPanel } from './PublicationCommandPanel';
import {
  inspectPublication,
  validPublicationCode,
} from './api/publicationInspectionClient';

interface Props {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
}
/** Inspects the native owner response; guidance never substitutes for request state or audit. */
export function PublicationInspectionPanel(props: Props) {
  const location = useLocation();
  const actorScope = useMemo(
    () =>
      props.accessToken
        ? crypto.getRandomValues(new Uint32Array(4)).join('-')
        : 'anonymous',
    [props.accessToken],
  );
  return (
    <PublicationInspectionScope
      key={JSON.stringify([
        actorScope,
        props.bootstrap.tenantCode,
        props.runtime.enterpriseCode,
        props.runtime.projectCode,
        location.search,
      ])}
      {...props}
      actorScope={actorScope}
    />
  );
}
function PublicationInspectionScope({
  bootstrap,
  accessToken,
  runtime,
  actorScope,
}: Props & { readonly actorScope: string }) {
  const { format: workflowText, locale } = useAxisLocalization();
  const publicationText = usePublishingGuidanceCopy();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commandBusy, setCommandBusy] = useState(false);
  const sources = (bootstrap.moduleConnections.publish ?? []).filter((item) =>
    ['UP', 'DEGRADED'].includes(item.state),
  );
  const params = new URLSearchParams(location.search);
  const contextCode = params.get('publicationCode') ?? '';
  const matches = sources.filter(
    (item) =>
      item.server === params.get('sourceServer') &&
      item.environment === params.get('sourceEnvironment'),
  );
  const hasSourceContext =
    params.has('sourceServer') || params.has('sourceEnvironment');
  const initialSource = hasSourceContext
    ? matches.length === 1
      ? matches[0]
      : undefined
    : sources.length === 1
      ? sources[0]
      : undefined;
  const keyOf = (item: (typeof sources)[number]) =>
    JSON.stringify([item.instanceId, item.endpoint]);
  const [sourceKey, setSourceKey] = useState(initialSource ? keyOf(initialSource) : '');
  const [code, setCode] = useState(
    validPublicationCode(contextCode) ? contextCode : '',
  );
  const [lookup, setLookup] = useState<{ source: string; code: string } | undefined>(
    initialSource && validPublicationCode(contextCode)
      ? { source: keyOf(initialSource), code: contextCode }
      : undefined,
  );
  // Only explicit inspection/list actions update history. Back/Forward remounts this scope,
  // retiring prior private command evidence; draft typing never dispatches a request.
  const openRequest = (
    selectedCode: string | undefined,
    selectedSource: (typeof sources)[number],
  ) => {
    if (commandBusy) return;
    const next = new URLSearchParams({
      sourceServer: selectedSource.server ?? '',
      sourceEnvironment: selectedSource.environment ?? '',
    });
    if (selectedCode) next.set('publicationCode', selectedCode);
    setCode(selectedCode ?? '');
    setLookup(
      selectedCode ? { source: keyOf(selectedSource), code: selectedCode } : undefined,
    );
    const search = `?${next.toString()}`;
    if (location.search !== search)
      void navigate({ pathname: location.pathname, search });
  };
  const source = sources.find((item) => keyOf(item) === sourceKey);
  const boundSource = sources.find((item) => keyOf(item) === lookup?.source);
  const inspectionKey = [
    'publication-inspection',
    actorScope,
    bootstrap.tenantCode,
    runtime.enterpriseCode,
    lookup?.source,
    lookup?.code,
  ];
  const inspection = useQuery({
    enabled: Boolean(boundSource && lookup),
    queryKey: inspectionKey,
    queryFn: () => {
      if (!boundSource || !lookup) throw new Error('Choose a publication source');
      return inspectPublication(
        boundSource,
        {
          accessToken,
          enterpriseCode: runtime.enterpriseCode,
          timeoutMs: runtime.requestTimeoutMs,
        },
        lookup.code,
      );
    },
    retry: false,
  });
  const snapshot = boundSource && lookup ? inspection.data : undefined;
  const workingArticlePath =
    snapshot && boundSource
      ? editorialWorkingArticlePath(bootstrap, boundSource, snapshot)
      : undefined;
  const canReview = bootstrap.navigation.some(
    (item) =>
      item.route === '/process/tasks' &&
      ['ACTIVE', 'PREVIEW'].includes(item.featureState ?? 'ACTIVE') &&
      ['UP', 'DEGRADED'].includes(item.availability),
  );
  const workflow = snapshot?.workflowRef;
  const taskPath =
    workflow && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(workflow)
      ? `/process/tasks?instanceCode=${encodeURIComponent(workflow)}`
      : '/process/tasks';
  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h5">
          {workflowText('publishing.ui.inspect-a-publication', 'Inspect a publication')}
        </Typography>
        <Typography color="text.secondary">
          {workflowText(
            'publishing.ui.open-the-request-from-its-source-workspace-to-see-its-current-state-exac',
            'Open the request from its source workspace to see its current state, exact version, approval workflow and recorded history.',
          )}
        </Typography>
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!commandBusy && source && validPublicationCode(code.trim()))
              openRequest(code.trim(), source);
          }}
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) minmax(0,2fr) auto' },
            alignItems: 'start',
          }}
        >
          <TextField
            select
            disabled={commandBusy}
            fullWidth
            label={workflowText('publishing.ui.source-workspace', 'Source workspace')}
            slotProps={{ select: { displayEmpty: true } }}
            value={sourceKey}
            onChange={(event) => {
              setSourceKey(event.target.value);
              setLookup(undefined);
            }}
            helperText={workflowText(
              'publishing.ui.select-where-the-request-was-created',
              'Select where the request was created.',
            )}
          >
            <MenuItem value="">
              {workflowText(
                'publishing.ui.choose-a-source-workspace',
                'Choose a source workspace',
              )}
            </MenuItem>
            {sources.map((item) => (
              <MenuItem key={keyOf(item)} value={keyOf(item)}>
                {item.server ?? item.instanceId} ·{' '}
                {item.environment ?? 'Current environment'}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            disabled={commandBusy}
            label={workflowText('publishing.ui.publication-code', 'Publication code')}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setLookup(undefined);
            }}
            slotProps={{ htmlInput: { maxLength: 512 } }}
            helperText={workflowText(
              'publishing.ui.enter-a-reference-or-choose-a-request-from-the-list-below',
              'Enter a reference, or choose a request from the list below.',
            )}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={
              commandBusy ||
              !source ||
              !validPublicationCode(code.trim()) ||
              inspection.isFetching
            }
          >
            {workflowText('publishing.ui.open-request', 'Open request')}
          </Button>
        </Box>
        {source ? (
          <PublicationRequestBrowser
            key={`${actorScope}:${keyOf(source)}`}
            source={source}
            accessToken={accessToken}
            actorScope={actorScope}
            tenantCode={bootstrap.tenantCode}
            runtime={runtime}
            active={!lookup}
            onInspect={(selected) => {
              openRequest(selected, source);
            }}
          />
        ) : null}
        {lookup ? (
          <Button
            disabled={commandBusy}
            onClick={() => {
              if (boundSource) openRequest(undefined, boundSource);
            }}
          >
            {workflowText('publishing.ui.back-to-request-list', 'Back to request list')}
          </Button>
        ) : null}
        {lookup && !boundSource ? (
          <Alert severity="warning">
            {workflowText(
              'publishing.ui.the-originating-publication-workspace-is-unavailable-refresh-availabilit',
              'The originating publication workspace is unavailable. Refresh availability before inspecting this request again.',
            )}
          </Alert>
        ) : null}
        {!sources.length ? (
          <Alert severity="warning">
            {workflowText(
              'publishing.ui.no-publication-source-workspace-is-currently-available-refresh-module-av',
              'No publication source workspace is currently available. Refresh module availability before continuing.',
            )}
          </Alert>
        ) : null}
        {inspection.isFetching ? (
          <Alert severity="info">
            {workflowText(
              'publishing.ui.checking-the-publication-with-its-owning-workspace',
              'Checking the publication with its owning workspace…',
            )}
          </Alert>
        ) : null}
        {inspection.isError ? (
          <Alert severity="warning">
            {inspection.error instanceof Error
              ? inspection.error.message
              : workflowText(
                  'publishing.ui.publication-evidence-is-unavailable',
                  'Publication evidence is unavailable.',
                )}
          </Alert>
        ) : null}
        {lookup ? (
          <Button
            disabled={commandBusy || inspection.isFetching || !boundSource}
            onClick={() => void inspection.refetch()}
          >
            {workflowText(
              'publishing.ui.refresh-request-evidence',
              'Refresh request evidence',
            )}
          </Button>
        ) : null}
        {snapshot ? (
          <>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip
                label={publicationText(snapshot.state)}
                color={
                  snapshot.state === 'ONLINE'
                    ? 'success'
                    : snapshot.state === 'FAILED'
                      ? 'error'
                      : 'default'
                }
              />
              <Chip
                label={publicationText('Revision {revision, number}', {
                  revision: snapshot.revision,
                })}
                variant="outlined"
              />
            </Stack>
            <Typography sx={{ overflowWrap: 'anywhere', fontWeight: 700 }}>
              {snapshot.code}
            </Typography>
            <Box
              component="dl"
              sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' },
                gap: 2,
              }}
            >
              {(
                [
                  ['Source version', snapshot.sourceVersion],
                  ['Recorded target version', snapshot.targetVersion],
                  ['Website', snapshot.siteCode],
                  ['Content catalog', snapshot.catalogCode],
                  ['Source record', snapshot.rootCode],
                  ['Requested by', snapshot.requestedBy],
                ] as const
              )
                .filter(([, value]) => value !== undefined)
                .map(([label, value]) => (
                  <Box key={label} sx={{ minWidth: 0 }}>
                    <Typography component="dt" color="text.secondary" variant="body2">
                      {publicationText(label)}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                      {typeof value === 'number'
                        ? new Intl.NumberFormat(locale).format(value)
                        : value}
                    </Typography>
                  </Box>
                ))}
            </Box>
            {snapshot.prerequisitesPassed !== undefined ? (
              <Alert severity={snapshot.prerequisitesPassed ? 'success' : 'warning'}>
                {snapshot.prerequisitesPassed
                  ? workflowText(
                      'publishing.ui.publication-prerequisite-checks-passed-for-this-source-version',
                      'Publication prerequisite checks passed for this source version.',
                    )
                  : workflowText(
                      'publishing.ui.publication-prerequisite-checks-reported-a-blocker-for-this-source-versi',
                      'Publication prerequisite checks reported a blocker for this source version.',
                    )}
              </Alert>
            ) : null}
            <Alert
              severity={
                snapshot.state === 'ONLINE'
                  ? 'success'
                  : snapshot.state === 'FAILED'
                    ? 'warning'
                    : 'info'
              }
            >
              {snapshot.state === 'ONLINE'
                ? workflowText(
                    'publishing.ui.this-request-completed-publication-check-the-working-record-and-website-',
                    'This request completed publication. Check the working record and website for current delivery before closing the task.',
                  )
                : snapshot.state === 'PENDING_APPROVAL'
                  ? workflowText(
                      'publishing.ui.this-version-is-waiting-for-an-approval-decision-it-has-not-moved-online',
                      'This version is waiting for an approval decision. It has not moved Online.',
                    )
                  : snapshot.state === 'FAILED'
                    ? workflowText(
                        'publishing.ui.this-publication-reports-a-failure-confirm-its-target-state-and-workflow',
                        'This publication reports a failure. Confirm its target state and workflow history before retrying.',
                      )
                    : workflowText(
                        'publishing.ui.this-is-the-current-owner-confirmed-publication-state-review-its-history',
                        'This is the current owner-confirmed publication state. Review its history before taking another action.',
                      )}
            </Alert>
            {boundSource && lookup ? (
              <PublicationCommandPanel
                key={`${actorScope}:${lookup.source}:${lookup.code}`}
                source={boundSource}
                configuration={{
                  accessToken,
                  enterpriseCode: runtime.enterpriseCode,
                  timeoutMs: runtime.requestTimeoutMs,
                }}
                snapshot={snapshot}
                actions={bootstrap.navigation
                  .filter(
                    (item) =>
                      item.route === '/publishing/requests' &&
                      (item.featureState ?? 'ACTIVE') === 'ACTIVE' &&
                      ['UP', 'DEGRADED'].includes(item.availability),
                  )
                  .flatMap((item) => item.lifecycleActions ?? [])}
                readAvailable={!inspection.isFetching && !inspection.isError}
                observationEpoch={inspection.dataUpdatedAt}
                onBusy={setCommandBusy}
                onCompleted={(receipt) => {
                  queryClient.setQueryData(inspectionKey, receipt);
                  void inspection.refetch();
                }}
              />
            ) : null}
            {workingArticlePath ? (
              <Button component={RouterLink} to={workingArticlePath} variant="outlined">
                {workflowText(
                  'publishing.ui.open-working-article',
                  'Open working article',
                )}
              </Button>
            ) : null}
            {canReview && workflow ? (
              <Button component={RouterLink} to={taskPath} variant="outlined">
                {workflowText(
                  'publishing.ui.review-this-workflow',
                  'Review this workflow',
                )}
              </Button>
            ) : null}
            <Typography component="h3" variant="h6">
              {workflowText('publishing.ui.recorded-history', 'Recorded history')}
            </Typography>
            {snapshot.auditTrail?.length ? (
              <Stack component="ol" spacing={1.5} sx={{ pl: 3 }}>
                {snapshot.auditTrail.map((event, index) => (
                  <Box component="li" key={index}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {event.fromState ? `${publicationText(event.fromState)} → ` : ''}
                      {publicationText(event.toState ?? 'Recorded event')}
                      {event.revision !== undefined
                        ? ' · ' +
                          publicationText('revision {revision, number}', {
                            revision: event.revision,
                          })
                        : ''}
                    </Typography>
                    {event.actor ? (
                      <Typography variant="body2">{event.actor}</Typography>
                    ) : null}
                    {event.reason ? (
                      <Typography color="text.secondary">{event.reason}</Typography>
                    ) : null}
                    {event.failureCode ? (
                      <Typography variant="body2">
                        {workflowText('publishing.ui.support-code', 'Support code:')}{' '}
                        {event.failureCode}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Alert severity="info">
                {workflowText(
                  'publishing.ui.this-response-did-not-include-recorded-history',
                  'This response did not include recorded history.',
                )}
              </Alert>
            )}
            <Accordion disableGutters elevation={0}>
              <AccordionSummary
                id="publication-evidence-1-heading"
                aria-controls="publication-evidence-1-panel"
                expandIcon={<ShellIcon name="chevron-down" />}
              >
                <Typography>
                  {workflowText(
                    'publishing.ui.included-dependencies',
                    'Included dependencies',
                  )}{' '}
                  {snapshot.dependencies
                    ? ` (${new Intl.NumberFormat(locale).format(snapshot.dependencies.length)})`
                    : ''}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {snapshot.dependencies?.length ? (
                  <Stack spacing={1}>
                    {snapshot.dependencies.map((item, index) => (
                      <Typography
                        key={index}
                        variant="body2"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {item.schema} · {item.code}
                        {item.version !== undefined
                          ? ' · ' +
                            publicationText('version {version, number}', {
                              version: item.version,
                            })
                          : ''}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography>
                    {workflowText(
                      'publishing.ui.this-response-did-not-include-dependency-identities',
                      'This response did not include dependency identities.',
                    )}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
            {snapshot.workflowRef || snapshot.correlationId ? (
              <Accordion disableGutters elevation={0}>
                <AccordionSummary
                  id="publication-evidence-2-heading"
                  aria-controls="publication-evidence-2-panel"
                  expandIcon={<ShellIcon name="chevron-down" />}
                >
                  <Typography>
                    {workflowText(
                      'publishing.ui.support-references',
                      'Support references',
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {snapshot.workflowRef ? (
                    <Typography sx={{ overflowWrap: 'anywhere' }}>
                      {workflowText('publishing.ui.workflow', 'Workflow:')}{' '}
                      {snapshot.workflowRef}
                    </Typography>
                  ) : null}
                  {snapshot.correlationId ? (
                    <Typography sx={{ overflowWrap: 'anywhere' }}>
                      {workflowText('publishing.ui.correlation', 'Correlation:')}{' '}
                      {snapshot.correlationId}
                    </Typography>
                  ) : null}
                </AccordionDetails>
              </Accordion>
            ) : null}
          </>
        ) : !inspection.isFetching && !inspection.isError ? (
          <Alert severity="info">
            {workflowText(
              'publishing.ui.choose-a-source-workspace-and-open-a-publication-to-see-its-current-prog',
              'Choose a source workspace and open a publication to see its current progress and recorded history.',
            )}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
