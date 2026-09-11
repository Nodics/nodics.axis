import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { WasteImpactAssessments } from './WasteImpactAssessments';
import { WasteSearchPanel } from './WasteSearchPanel';
import { WasteSubmissionList } from './WasteSubmissionList';
import { WasteSubmissionDialog } from './WasteSubmissionDialog';
import { exportWasteSubmissions } from './wasteSubmissionExport';
import { WasteAuditPanel } from './WasteAuditPanel';
import { WasteDashboard } from './WasteDashboard';
import { wasteName } from './wastePresentation';
import { WastePropertyDetails } from './WastePropertyDetails';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  MenuItem,
  Typography,
} from '@mui/material';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  decideWasteReview,
  loadWasteOperationsContext,
  verifyWasteSubmission,
  type WasteOperationsContext,
  loadWasteReviewPhoto,
  loadWasteReviewPage,
  loadWasteReviewDetail,
  assignWasteReview,
  retryWasteOutcome,
  resolveWasteOutcome,
  recoverWasteReview,
  type WasteReviewFacts,
  type WasteReviewFilters,
  type WasteDashboardData,
  type WasteReviewSubmission,
} from './api/wasteReviewClient';
interface WasteManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly employeeId: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
}
/** Renders the backend-owned Waste approval queue; explicit decisions persist through the eWaste domain accelerator. */
export function WasteManagementRoutePage(props: WasteManagementRoutePageProps) {
  const [records, setRecords] = useState<WasteReviewSubmission[]>([]),
    [operations, setOperations] = useState<WasteOperationsContext | null>(null),
    [selectedCode, setSelectedCode] = useState(''),
    [query, setQuery] = useState(''),
    [searchQuery, setSearchQuery] = useState(''),
    [status, setStatus] = useState(''),
    [dashboard, setDashboard] = useState<WasteDashboardData | null>(null),
    [filters, setFilters] = useState<WasteReviewFilters>({}),
    [appliedFilters, setAppliedFilters] = useState<WasteReviewFilters>({}),
    [detailLoading, setDetailLoading] = useState(false),
    [detailFailed, setDetailFailed] = useState(false),
    [pendingSelection, setPendingSelection] = useState<string | null>(null),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [limit, setLimit] = useState(25),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [editedFacts, setEditedFacts] = useState<WasteReviewFacts>({}),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [notificationAction, setNotificationAction] = useState<
      'MARK_DELIVERED' | 'AUTHORIZE_RESEND' | 'CANCEL' | null
    >(null),
    [notificationReason, setNotificationReason] = useState(''),
    [busy, setBusy] = useState(false),
    [assignmentAction, setAssignmentAction] = useState<'CLAIM' | 'RELEASE' | null>(
      null,
    ),
    [exporting, setExporting] = useState(false),
    [loading, setLoading] = useState(true),
    [loadFailed, setLoadFailed] = useState(false),
    [photo, setPhoto] = useState(''),
    [name, setName] = useState(''),
    [reason, setReason] = useState(''),
    [evidenceReviewed, setEvidenceReviewed] = useState(false),
    [decision, setDecision] = useState<
      'APPROVED' | 'REJECTED' | 'VERIFIED' | 'RECOVER' | null
    >(null);
  const configuration = useMemo(
    () => ({
      bootstrap: props.bootstrap,
      accessToken: props.accessToken,
      enterpriseCode: props.runtime.enterpriseCode,
      timeoutMs: props.runtime.requestTimeoutMs,
    }),
    [
      props.bootstrap,
      props.accessToken,
      props.runtime.enterpriseCode,
      props.runtime.requestTimeoutMs,
    ],
  );
  const loadGeneration = useRef(0);
  const refreshAfterClose = useRef(false);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    let availableContext: WasteOperationsContext | null = null;
    try {
      const context = await loadWasteOperationsContext(configuration);
      const viewCode = props.navigation.backendWorkspace?.viewCode;
      const view = viewCode ? context.reviewWorkspace?.views?.[viewCode] : undefined;
      if (viewCode && (!view || view.ownerModule !== props.navigation.moduleName))
        throw new Error('This Waste workspace is unavailable in the current runtime.');
      availableContext = context;
      const records = await loadWasteReviewPage(configuration, {
        ...appliedFilters,
        ...(viewCode ? { viewCode } : {}),
        familyCode: view?.familyCode || appliedFilters.familyCode || '',
        page,
        status: status || (view?.mode === 'REVIEW_QUEUE' ? 'OPEN' : 'ALL'),
        q: searchQuery,
        dashboard: true,
      });
      if (generation !== loadGeneration.current) return;
      setRecords(view?.mode === 'OVERVIEW' ? [] : records.items);
      setTotal(records.total);
      setLimit(records.limit);
      setCounts(records.counts);
      setOperations(context);
      setDashboard(records.dashboard || null);
    } catch (e) {
      if (generation !== loadGeneration.current) return;
      setRecords([]);
      setLoadFailed(true);
      setTotal(0);
      setCounts({});
      setOperations(availableContext);
      setError(e instanceof Error ? e.message : 'The review queue is unavailable.');
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [
    configuration,
    page,
    status,
    searchQuery,
    appliedFilters,
    props.navigation.moduleName,
    props.navigation.backendWorkspace?.viewCode,
  ]);
  useEffect(() => {
    void load();
    const generation = loadGeneration.current;
    return () => {
      loadGeneration.current = generation + 1;
    };
  }, [load]);
  useEffect(() => {
    if (!selectedCode && refreshAfterClose.current) {
      refreshAfterClose.current = false;
      void load();
    }
  }, [selectedCode, load]);
  const selected = records.find((r) => r.code === selectedCode);
  useEffect(() => {
    let active = true;
    setDetailFailed(false);
    if (!selected || selected.descriptor) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    void loadWasteReviewDetail(configuration, selected.code)
      .then((detail) => {
        if (active)
          setRecords((current) =>
            current.map((item) =>
              item.code === detail.code && item.revision <= detail.revision
                ? detail
                : item,
            ),
          );
      })
      .catch((error) => {
        if (active) {
          setDetailFailed(true);
          setError(
            error instanceof Error ? error.message : 'Review detail unavailable.',
          );
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configuration, selected]);
  useEffect(() => {
    let active = true;
    setPhoto('');
    setReason(selected?.metadata.publicReason || '');
    setEditedFacts({});
    setName(
      selected?.metadata.reviewedFacts?.name ||
        selected?.metadata.verifiedFacts?.name ||
        selected?.confirmedFacts?.name ||
        selected?.submittedFacts.name ||
        '',
    );
    if (selected?.metadata.photo && operations?.canReadEvidence)
      void loadWasteReviewPhoto(configuration, selected.code)
        .then((src) => {
          if (active) setPhoto(src);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Photo unavailable.');
        });
    return () => {
      active = false;
    };
  }, [configuration, selected, operations?.canReadEvidence]);
  const settled = ['APPROVED', 'REJECTED'].includes(selected?.submissionStatus || '');
  const settlementRetry = selected?.submissionStatus === 'APPROVED';
  const facts =
    selected?.metadata.reviewedFacts ||
    selected?.metadata.verifiedFacts ||
    selected?.confirmedFacts ||
    selected?.submittedFacts;
  const labels = operations?.presentation || {};
  const verificationMissing =
    operations?.requireVerification &&
    !selected?.metadata.preApprovalVerificationRef &&
    !settlementRetry;
  const sameVerifier =
    operations?.requireDifferentApprover &&
    selected?.metadata.verifiedBy?.code === operations?.principalCode;
  const assignedElsewhere =
    selected?.metadata.reviewAssignment?.type === 'EMPLOYEE' &&
    selected.metadata.reviewAssignment.principalCode !== operations?.principalCode;
  const assignedToMe = Boolean(
    operations?.principalCode &&
    selected?.metadata.reviewAssignment?.type === 'EMPLOYEE' &&
    selected.metadata.reviewAssignment.principalCode === operations.principalCode,
  );
  const canDecide =
    !detailLoading &&
    !detailFailed &&
    operations?.canApprove &&
    !verificationMissing &&
    !sameVerifier &&
    !assignedElsewhere &&
    (assignedToMe || settlementRetry) &&
    selected?.submissionStatus !== 'REJECTED';
  const evidenceReview =
    selected?.evidenceReview || selected?.descriptor?.evidenceReview;
  const needsEvidenceAcknowledgement =
    decision === 'APPROVED' &&
    !settlementRetry &&
    evidenceReview?.acknowledgementRequired === true;
  const startDecision = (next: typeof decision) => {
    setEvidenceReviewed(false);
    setDecision(next);
  };
  const workspaceLabels = operations?.reviewWorkspace?.labels || {};
  const dashboardLabels = operations?.reviewWorkspace?.dashboardLabels || {};
  const canEdit =
    !detailLoading &&
    !detailFailed &&
    !!(
      operations?.canVerify ||
      (operations?.canApprove && !operations?.requireVerification)
    ) &&
    !settled &&
    assignedToMe &&
    !selected?.reviewPending;
  const dirty =
    !!selected &&
    (name !== (facts?.name || '') ||
      reason !== (selected.metadata.publicReason || '') ||
      Object.entries(editedFacts).some(
        ([key, value]) =>
          JSON.stringify(value) !==
          JSON.stringify(facts?.[key as keyof WasteReviewFacts]),
      ));
  useEffect(() => {
    if (busy || dirty || exporting || query.trim() === searchQuery) return;
    const timer = window.setTimeout(() => {
      setSearchQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, searchQuery, busy, dirty, exporting]);
  const view =
    operations?.reviewWorkspace?.views?.[
      props.navigation.backendWorkspace?.viewCode || ''
    ];
  const showReview = props.navigation.backendWorkspace
    ? Boolean(view) && view?.mode !== 'OVERVIEW'
    : true;
  const requestSelection = (code: string) => {
    if (busy) return;
    if (dirty) setPendingSelection(code);
    else {
      setError('');
      setNotice('');
      setSelectedCode(code);
    }
  };
  /** Applies the persisted assignment without closing the dialog or optimistically enabling edits. */
  const changeAssignment = async () => {
    if (!selected || busy || dirty || detailLoading || detailFailed) return;
    const action = assignedToMe ? 'RELEASE' : 'CLAIM';
    setBusy(true);
    setAssignmentAction(action);
    setError('');
    setNotice('');
    try {
      const result = await assignWasteReview(configuration, selected, action);
      const assignment = result?.metadata?.reviewAssignment;
      if (
        !result ||
        result.code !== selected.code ||
        !Number.isSafeInteger(result.revision) ||
        result.revision < selected.revision ||
        (action === 'CLAIM'
          ? assignment?.type !== 'EMPLOYEE' ||
            assignment.principalCode !== operations?.principalCode
          : assignment?.type !== 'QUEUE')
      )
        throw new Error(
          'The review service did not confirm the assignment. Reopen the details and try again.',
        );
      setRecords((current) =>
        current.map((item) =>
          item.code === result.code
            ? { ...result, ...(item.descriptor ? { descriptor: item.descriptor } : {}) }
            : item,
        ),
      );
      refreshAfterClose.current = true;
      setNotice(
        (action === 'CLAIM'
          ? workspaceLabels.assignmentSaved
          : workspaceLabels.releaseSaved) || '',
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : workspaceLabels.assignmentFailed || 'The request could not be completed.',
      );
    } finally {
      setAssignmentAction(null);
      setBusy(false);
    }
  };
  const effectiveStatus = status || (view?.mode === 'REVIEW_QUEUE' ? 'OPEN' : 'ALL');
  const displayValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '')
      return dashboardLabels.unknown || '—';
    if (Array.isArray(value))
      return value.map((item: unknown) => displayValue(item)).join(', ');
    if (typeof value === 'object') {
      const item = value as Record<string, unknown>;
      if (
        item.ref &&
        typeof item.ref === 'object' &&
        'code' in item.ref &&
        typeof item.ref.code === 'string'
      ) {
        const code = item.ref.code;
        return (
          wasteName(
            dashboard?.materials.find((material) => material.code === code)?.name,
          ) || code
        );
      }
      if ('min' in item)
        return `${displayValue(item.min)}–${displayValue(item.max)} ${displayValue(item.unit)}`;
      if ('value' in item) return displayValue(item.value);
      return Object.entries(item)
        .filter(([key]) => !['basis', 'confidence'].includes(key))
        .map(([key, entry]) => `${dashboardLabels[key] || key}: ${displayValue(entry)}`)
        .join('; ');
    }
    return ['string', 'number', 'boolean'].includes(typeof value)
      ? (value as string | number | boolean).toString()
      : '—';
  };
  const dashboardPanel = (
    <>
      {operations?.reviewWorkspace?.dashboardLabels && (
        <WasteDashboard
          showSummary={!showReview}
          fixedFamily={view?.familyCode}
          data={dashboard}
          counts={counts}
          labels={dashboardLabels}
          filters={filters}
          appliedFilters={appliedFilters}
          setFilters={setFilters}
          busy={busy || loading || dirty}
          apply={() => {
            setAppliedFilters(filters);
            setPage(1);
          }}
          reset={() => {
            setFilters({});
            setAppliedFilters({});
            setPage(1);
          }}
          onStatus={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      )}
    </>
  );
  return (
    <WorkspaceContainer>
      <Stack
        spacing={2}
        data-functional-module={props.navigation.moduleName}
        sx={{
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, letterSpacing: '-.025em' }}>
              {view?.label || dashboardLabels.title || labels.title}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.75, maxWidth: '78ch', lineHeight: 1.6 }}
            >
              {dashboardLabels.subtitle}
            </Typography>
          </Box>
          <Button
            color="inherit"
            size="small"
            sx={{ flexShrink: 0 }}
            disabled={loading || busy || dirty}
            onClick={() => void load()}
          >
            {dashboardLabels.refresh || 'Refresh'}
          </Button>
        </Stack>
        {error && !selected && <Alert severity="error">{error}</Alert>}
        {notice && !selected && <Alert severity="success">{notice}</Alert>}
        {!showReview && dashboardPanel}
        {showReview && (
          <>
            <WasteSubmissionList
              searchPanel={
                <WasteSearchPanel
                  ownerModule={props.navigation.moduleName}
                  labels={workspaceLabels}
                  filterLabels={dashboardLabels}
                  data={dashboard}
                  fixedFamily={view?.familyCode}
                  query={query}
                  appliedQuery={searchQuery}
                  setQuery={setQuery}
                  onSearch={() => {
                    setSearchQuery(query.trim());
                    setPage(1);
                  }}
                  status={effectiveStatus}
                  defaultStatus={view?.mode === 'REVIEW_QUEUE' ? 'OPEN' : 'ALL'}
                  statuses={(operations?.reviewWorkspace?.statuses || []).filter(
                    (item) =>
                      view?.mode !== 'REVIEW_QUEUE' ||
                      ['OPEN', 'SUBMITTED', 'UNDER_REVIEW'].includes(item.code),
                  )}
                  counts={counts}
                  onStatus={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                  filters={filters}
                  appliedFilters={appliedFilters}
                  setFilters={setFilters}
                  apply={() => {
                    setAppliedFilters(filters);
                    setSearchQuery(query.trim());
                    setPage(1);
                  }}
                  removeFilter={(key) => {
                    setFilters((current) => {
                      const next = { ...current };
                      delete next[key];
                      return next;
                    });
                    setAppliedFilters((current) => {
                      const next = { ...current };
                      delete next[key];
                      return next;
                    });
                    setPage(1);
                  }}
                  reset={() => {
                    setQuery('');
                    setSearchQuery('');
                    setStatus('');
                    setFilters({});
                    setAppliedFilters({});
                    setPage(1);
                  }}
                  loading={loading}
                  disabled={busy || dirty || exporting}
                  exporting={exporting}
                  total={total}
                  onExport={() => {
                    setExporting(true);
                    setError('');
                    void exportWasteSubmissions(
                      configuration,
                      {
                        ...appliedFilters,
                        ...(props.navigation.backendWorkspace?.viewCode
                          ? { viewCode: props.navigation.backendWorkspace.viewCode }
                          : {}),
                        familyCode: view?.familyCode || appliedFilters.familyCode || '',
                        status: effectiveStatus,
                        q: searchQuery,
                      },
                      workspaceLabels,
                    )
                      .catch((error: unknown) => {
                        setError(
                          error instanceof Error
                            ? error.message
                            : 'Export unavailable.',
                        );
                      })
                      .finally(() => setExporting(false));
                  }}
                />
              }
              failed={loadFailed}
              records={records}
              configuration={configuration}
              canReadEvidence={operations?.canReadEvidence === true}
              labels={workspaceLabels}
              dashboard={dashboard}
              onOpen={requestSelection}
              loading={loading}
              disabled={busy || dirty || exporting}
              page={page}
              total={total}
              limit={limit}
              onPage={setPage}
            />
            {operations?.canAudit && (
              <WasteAuditPanel
                key={`${props.navigation.moduleName}:${props.navigation.backendWorkspace?.viewCode || ''}:${props.employeeId}`}
                configuration={configuration}
                labels={labels}
                centreLabel={dashboardLabels.centre}
              />
            )}
            <WasteSubmissionDialog
              open={!!selected}
              title={workspaceLabels.details || 'Submission details'}
              closeLabel={workspaceLabels.close || 'Close details'}
              busy={busy}
              onClose={() => requestSelection('')}
              header={
                selected && (
                  <Box
                    sx={{
                      px: { xs: 2, sm: 3 },
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      sx={{
                        alignItems: { sm: 'center' },
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box role="status" aria-live="polite">
                        <Typography variant="subtitle2">
                          {settled
                            ? workspaceLabels.reviewComplete
                            : assignedToMe
                              ? workspaceLabels.assignedToYou
                              : assignedElsewhere
                                ? workspaceLabels.assignedTo
                                : workspaceLabels.readOnlyMode}
                          {assignedElsewhere && !settled
                            ? `: ${selected.metadata.reviewAssignment?.principalCode}`
                            : ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {settled
                            ? workspaceLabels.completedReadOnly
                            : assignedToMe
                              ? workspaceLabels.assignmentOwned
                              : assignedElsewhere
                                ? workspaceLabels.assignmentElsewhere
                                : operations?.canAssign
                                  ? workspaceLabels.assignmentRequired
                                  : labels.readOnly}
                        </Typography>
                        {dirty && assignedToMe && (
                          <Typography variant="caption">
                            {workspaceLabels.releaseDirty}
                          </Typography>
                        )}
                      </Box>
                      {operations?.canAssign &&
                        !settled &&
                        !assignedElsewhere &&
                        !selected.reviewPending && (
                          <Button
                            variant={assignedToMe ? 'outlined' : 'contained'}
                            disabled={busy || dirty || detailLoading || detailFailed}
                            onClick={() => void changeAssignment()}
                            sx={{ flexShrink: 0 }}
                          >
                            {assignmentAction === 'CLAIM'
                              ? workspaceLabels.assigning
                              : assignmentAction === 'RELEASE'
                                ? workspaceLabels.releasing
                                : assignedToMe
                                  ? workspaceLabels.release
                                  : workspaceLabels.assign}
                          </Button>
                        )}
                    </Stack>
                  </Box>
                )
              }
            >
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              {notice && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {notice}
                </Alert>
              )}
              {selected ? (
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    {photo ? (
                      <Box
                        component="img"
                        src={photo}
                        alt={
                          selected.metadata.sample
                            ? 'Reference image'
                            : 'Original submission evidence'
                        }
                        referrerPolicy="no-referrer"
                        sx={{
                          width: { xs: '100%', sm: 220 },
                          height: 220,
                          bgcolor: 'action.hover',
                          objectFit: 'contain',
                          borderRadius: 1,
                        }}
                      />
                    ) : (
                      <Typography>Photo preview unavailable</Typography>
                    )}
                    <Box>
                      <Chip
                        label={selected.submissionStatus.replaceAll('_', ' ')}
                        size="small"
                      />
                      <Typography variant="h6" sx={{ mt: 1 }}>
                        {facts?.name}
                      </Typography>
                      <Typography variant="body2">
                        Customer: {selected.submitterRef.code}
                      </Typography>
                      <Typography variant="caption">{selected.code}</Typography>
                    </Box>
                  </Stack>
                  {evidenceReview?.manualApprovalRequired && (
                    <Alert severity="warning">
                      <Typography variant="subtitle2">
                        {evidenceReview.label}
                      </Typography>
                      <Typography variant="body2">{evidenceReview.message}</Typography>
                      <Typography variant="body2">
                        {evidenceReview.sourceLabel}
                      </Typography>
                      {evidenceReview.reason && (
                        <Typography variant="body2">{evidenceReview.reason}</Typography>
                      )}
                    </Alert>
                  )}
                  {selected.metadata.sample && (
                    <Alert severity="info">This record uses reference imagery.</Alert>
                  )}
                  <Typography>
                    Type: {facts?.itemTypeCode} · Quantity: {facts?.quantity} ·
                    Condition: {facts?.conditionGrade}
                  </Typography>
                  <Typography>
                    Collection centre: {facts?.preferredCollectionPointCode}
                  </Typography>
                  <Typography>{facts?.description}</Typography>
                  {detailLoading && (
                    <Typography role="status">Loading item properties…</Typography>
                  )}
                  <WastePropertyDetails
                    record={selected}
                    data={dashboard}
                    labels={dashboardLabels}
                    options={operations?.reviewWorkspace?.descriptorOptions}
                    edits={editedFacts}
                    onChange={setEditedFacts}
                    disabled={busy || detailLoading || !canEdit}
                  />
                  <Typography variant="h6">
                    {settled ? dashboardLabels.detail : dashboardLabels.correction}
                  </Typography>
                  {selected.metadata.suggestion?.facts && (
                    <Alert severity="info">
                      AI suggestion:{' '}
                      {selected.metadata.suggestion.facts.name ||
                        selected.metadata.suggestion.facts.itemTypeCode}
                      . Original photo-analysis suggestion.
                    </Alert>
                  )}
                  {selected.submissionStatus === 'APPROVED' &&
                    operations?.impactAssessment && (
                      <WasteImpactAssessments
                        key={selected.code}
                        configuration={configuration}
                        code={selected.code}
                        canAssess={operations.canVerify}
                        canSelect={operations.canApprove}
                        labels={operations.impactAssessment.labels}
                      />
                    )}
                  {selected.submissionStatus !== 'APPROVED' &&
                    selected.metadata.verifiedEstimate && (
                      <Alert severity="info">
                        Verified impact assessment:{' '}
                        {selected.metadata.verifiedEstimate.calculationStatus}.{' '}
                        {selected.metadata.verifiedEstimate.reason}
                        {selected.metadata.verifiedEstimate.metrics?.map((metric) => (
                          <Typography key={metric.metricCode}>
                            {metric.metricCode}: {metric.value} {metric.unitOfMeasure}{' '}
                            (estimate)
                          </Typography>
                        ))}
                        {selected.metadata.verifiedEstimate.formulaVersion && (
                          <Typography variant="caption">
                            Method version:{' '}
                            {selected.metadata.verifiedEstimate.formulaVersion}
                          </Typography>
                        )}
                      </Alert>
                    )}
                  {['APPROVED', 'REJECTED'].includes(selected.submissionStatus) && (
                    <Alert
                      severity={
                        selected.metadata.outcomeDelivery?.status === 'DELIVERED'
                          ? 'success'
                          : 'info'
                      }
                    >
                      Outcome notification:{' '}
                      {selected.metadata.outcomeDelivery?.status || 'PENDING'}.
                      {selected.metadata.outcomeDelivery?.status === 'UNCERTAIN'
                        ? ' Telegram may have accepted the message. Check delivery before taking further action.'
                        : ![
                            'DELIVERED',
                            'SUPPRESSED',
                            'FAILED',
                            'DEAD_LETTER',
                          ].includes(
                            selected.metadata.outcomeDelivery?.status || '',
                          ) && (
                            <Button
                              disabled={busy}
                              onClick={() => {
                                setBusy(true);
                                void retryWasteOutcome(configuration, selected)
                                  .then(() => load())
                                  .catch((error: unknown) =>
                                    setError(
                                      error instanceof Error
                                        ? error.message
                                        : 'The request could not be completed.',
                                    ),
                                  )
                                  .finally(() => setBusy(false));
                              }}
                            >
                              Retry notification
                            </Button>
                          )}
                    </Alert>
                  )}
                  {selected.metadata.outcomeDelivery?.status === 'UNCERTAIN' &&
                    operations?.canApprove && (
                      <Stack direction="row" spacing={1}>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            setNotificationReason('');
                            setNotificationAction('MARK_DELIVERED');
                          }}
                        >
                          Record delivered
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            setNotificationReason('');
                            setNotificationAction('AUTHORIZE_RESEND');
                          }}
                        >
                          Authorize one resend
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            setNotificationReason('');
                            setNotificationAction('CANCEL');
                          }}
                        >
                          Stop delivery
                        </Button>
                      </Stack>
                    )}
                  {selected.metadata.publicReason && (
                    <Alert
                      severity={
                        selected.submissionStatus === 'REJECTED' ? 'warning' : 'info'
                      }
                    >
                      {selected.metadata.publicReason}
                    </Alert>
                  )}
                  <TextField
                    label="Final verified name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy || detailLoading || !canEdit}
                  />
                  {(operations?.reviewWorkspace?.fields || [])
                    .filter((field) =>
                      [
                        'description',
                        'categoryCode',
                        'itemTypeCode',
                        'quantity',
                        'conditionGrade',
                        'brand',
                        'model',
                        'weight',
                        'sizeClass',
                      ].includes(field.key),
                    )
                    .map((field) => {
                      const selectedItemCode =
                        editedFacts.itemTypeCode || facts?.itemTypeCode;
                      const selectedCategoryCode =
                        editedFacts.categoryCode || facts?.categoryCode;
                      const choices =
                        field.key === 'categoryCode'
                          ? dashboard?.categories
                          : field.key === 'itemTypeCode'
                            ? dashboard?.itemTypes.filter(
                                (item) => item.categoryCode === selectedCategoryCode,
                              )
                            : field.key === 'sizeClass'
                              ? operations?.reviewWorkspace?.descriptorOptions?.sizeClasses.map(
                                  (code) => ({ code, name: code.toLowerCase() }),
                                )
                              : field.key === 'conditionGrade'
                                ? dashboard?.itemTypes
                                    .find((item) => item.code === selectedItemCode)
                                    ?.allowedConditionGrades?.map((code) => ({
                                      code,
                                      name: code.toLowerCase(),
                                    }))
                                : undefined;
                      return (
                        <TextField
                          key={field.key}
                          label={field.label}
                          select={!!choices}
                          type={field.type === 'number' ? 'number' : 'text'}
                          multiline={field.type === 'text'}
                          value={
                            editedFacts[field.key] ??
                            selected.metadata.verifiedFacts?.[field.key] ??
                            facts?.[field.key] ??
                            ''
                          }
                          disabled={busy || detailLoading || !canEdit}
                          onChange={(event) =>
                            setEditedFacts((current) => ({
                              ...current,
                              ...(field.key === 'categoryCode'
                                ? { itemTypeCode: '' }
                                : {}),
                              [field.key]:
                                field.type === 'number'
                                  ? Number(event.target.value)
                                  : event.target.value,
                            }))
                          }
                        >
                          {choices?.map((item) => (
                            <MenuItem key={item.code} value={item.code}>
                              {wasteName(item.name)}
                            </MenuItem>
                          ))}
                        </TextField>
                      );
                    })}
                  {dirty && (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setName(facts?.name || '');
                        setEditedFacts({});
                        setReason(selected.metadata.publicReason || '');
                      }}
                    >
                      Discard unsaved changes
                    </Button>
                  )}
                  <TextField
                    label="Review feedback"
                    multiline
                    disabled={
                      settled ||
                      busy ||
                      detailLoading ||
                      detailFailed ||
                      !assignedToMe ||
                      !operations?.canApprove
                    }
                    minRows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    helperText="A reason is required when rejecting. The customer can see this feedback."
                  />
                  {!settled && verificationMissing && (
                    <Alert severity="info">{labels.verificationRequired}</Alert>
                  )}
                  {!settled && sameVerifier && (
                    <Alert severity="info">{labels.differentApproverRequired}</Alert>
                  )}
                  {!operations?.canVerify && !operations?.canApprove && (
                    <Alert severity="info">{labels.readOnly}</Alert>
                  )}
                  {selected.reviewPending &&
                    operations?.canApprove &&
                    !sameVerifier && (
                      <Button
                        disabled={busy || detailLoading || detailFailed}
                        onClick={() => startDecision('RECOVER')}
                      >
                        Resume recorded {selected.reviewPending.decision.toLowerCase()}
                      </Button>
                    )}
                  <Stack direction="row" spacing={1}>
                    {operations?.canVerify && !settled && (
                      <Button
                        variant="contained"
                        disabled={
                          busy ||
                          settled ||
                          detailLoading ||
                          detailFailed ||
                          !!assignedElsewhere ||
                          !assignedToMe ||
                          !!selected.reviewPending ||
                          !name.trim()
                        }
                        onClick={() => startDecision('VERIFIED')}
                      >
                        {labels.verifyAction}
                      </Button>
                    )}
                    {operations?.canApprove && (
                      <Button
                        variant="contained"
                        disabled={
                          busy || !name.trim() || !canDecide || !!selected.reviewPending
                        }
                        onClick={() => startDecision('APPROVED')}
                      >
                        {settlementRetry
                          ? 'Review settlement retry'
                          : 'Review approval'}
                      </Button>
                    )}
                    {operations?.canApprove && (
                      <Button
                        color="error"
                        variant="outlined"
                        disabled={
                          busy ||
                          settled ||
                          !reason.trim() ||
                          !canDecide ||
                          !!selected.reviewPending
                        }
                        onClick={() => startDecision('REJECTED')}
                      >
                        Review rejection
                      </Button>
                    )}
                  </Stack>
                </Stack>
              ) : (
                <Typography>Select a submission to review.</Typography>
              )}
            </WasteSubmissionDialog>
            <Typography variant="caption" color="text.secondary">
              Operator: {props.employeeId}
            </Typography>
          </>
        )}
        <Dialog
          open={pendingSelection !== null}
          onClose={() => setPendingSelection(null)}
        >
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogContent>
            Your changes have not been saved. Discard them to leave these details.
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPendingSelection(null)}>Keep editing</Button>
            <Button
              onClick={() => {
                setSelectedCode(pendingSelection || '');
                setPendingSelection(null);
              }}
            >
              Discard changes
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!notificationAction}
          onClose={() => {
            if (!busy) setNotificationAction(null);
          }}
        >
          <DialogTitle>Confirm notification resolution</DialogTitle>
          <DialogContent>
            <Typography>
              {notificationAction === 'AUTHORIZE_RESEND'
                ? 'Telegram may already have accepted this message. Authorizing a resend can create a duplicate. This records permission for one retry; use Retry notification afterwards.'
                : notificationAction === 'MARK_DELIVERED'
                  ? 'Confirm that you checked delivery and have evidence that the customer received this message.'
                  : 'Stop further delivery attempts for this message.'}
            </Typography>
            <TextField
              fullWidth
              label="Reason or delivery evidence"
              value={notificationReason}
              onChange={(event) => setNotificationReason(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setNotificationAction(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !notificationReason.trim() || !selected}
              onClick={() => {
                if (!selected || !notificationAction) return;
                setBusy(true);
                void resolveWasteOutcome(
                  configuration,
                  selected,
                  notificationAction,
                  notificationReason,
                )
                  .then(() => {
                    setNotificationAction(null);
                    return load();
                  })
                  .catch((error: unknown) =>
                    setError(
                      error instanceof Error
                        ? error.message
                        : 'The request could not be completed.',
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Confirm resolution
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!decision}
          onClose={() => {
            if (!busy) setDecision(null);
          }}
        >
          <DialogTitle>
            {decision === 'RECOVER'
              ? 'Resume recorded decision'
              : decision === 'VERIFIED'
                ? labels.verifyTitle
                : decision === 'APPROVED'
                  ? settlementRetry
                    ? 'Confirm reward settlement retry'
                    : 'Confirm asset approval'
                  : 'Confirm rejection'}
          </DialogTitle>
          <DialogContent>
            <Typography>{name}</Typography>
            <Typography sx={{ mt: 1 }}>
              {decision === 'RECOVER'
                ? 'Continue the decision already recorded by the backend. Its facts, reviewer, and reward references stay unchanged.'
                : decision === 'VERIFIED'
                  ? labels.verifyExplanation
                  : decision === 'APPROVED'
                    ? settlementRetry
                      ? 'Approval is already recorded. Retry its configured reward settlement with the original ledger references.'
                      : 'The backend will create the asset and settle the configured rewards.'
                    : 'The customer will receive the recorded review feedback.'}
            </Typography>
            {reason && <Typography sx={{ mt: 1 }}>{reason}</Typography>}
            {needsEvidenceAcknowledgement && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="warning">{evidenceReview?.message}</Alert>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={evidenceReviewed}
                      onChange={(event) => setEvidenceReviewed(event.target.checked)}
                      disabled={busy}
                    />
                  }
                  label={evidenceReview?.acknowledgementLabel}
                />
              </Box>
            )}
            {decision === 'VERIFIED' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">{dashboardLabels.confirmation}</Typography>
                {Object.entries({ name: name.trim(), ...editedFacts })
                  .filter(
                    ([key, value]) =>
                      JSON.stringify(value) !==
                      JSON.stringify(facts?.[key as keyof WasteReviewFacts]),
                  )
                  .map(([key, value]) => (
                    <Box
                      key={key}
                      sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}
                    >
                      <Typography variant="subtitle2">
                        {operations?.reviewWorkspace?.fields?.find(
                          (field) => field.key === key,
                        )?.label ||
                          dashboardLabels[key] ||
                          key}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {dashboardLabels.original}:{' '}
                        {displayValue(facts?.[key as keyof WasteReviewFacts])}
                      </Typography>
                      <Typography variant="body2">
                        {dashboardLabels.proposed}: {displayValue(value)}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={
                busy ||
                !selected ||
                !decision ||
                (needsEvidenceAcknowledgement && !evidenceReviewed)
              }
              onClick={() => {
                if (!selected || !decision) return;
                setBusy(true);
                setError('');
                const mutation =
                  decision === 'RECOVER'
                    ? recoverWasteReview(configuration, selected)
                    : decision === 'VERIFIED'
                      ? verifyWasteSubmission(configuration, selected, {
                          name: name.trim(),
                          ...editedFacts,
                        })
                      : decideWasteReview(
                          configuration,
                          selected,
                          decision,
                          reason,
                          operations?.requireVerification
                            ? {}
                            : { name: name.trim(), ...editedFacts },
                          evidenceReviewed,
                        );
                void mutation
                  .then((result) => {
                    setNotice(
                      result.settlementStatus === 'PENDING'
                        ? result.settlementMessage ||
                            'Decision saved. Reward settlement needs retry.'
                        : decision === 'VERIFIED'
                          ? labels.verifySaved || 'Verification saved.'
                          : 'Review decision saved.',
                    );
                    setDecision(null);
                    return load();
                  })
                  .catch((e) =>
                    setError(e instanceof Error ? e.message : 'Review failed.'),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? 'Saving…' : 'Confirm decision'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
