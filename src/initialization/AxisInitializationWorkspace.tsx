import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

import { ShellIcon } from '../app/shell/ShellIcon';
import type { AxisInitializationStatus } from './axisInitializationClient';

interface AxisInitializationWorkspaceProps {
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly status?: AxisInitializationStatus | undefined;
  readonly onInitiate: () => void;
  readonly onApprove: () => void;
  readonly onRefresh: () => void;
  readonly onLogout: () => void;
  readonly onManageModules?: (() => void) | undefined;
}

const setupWizardSteps = Object.freeze([
  Object.freeze({
    id: 'bootstrap-access',
    number: 1,
    title: 'Bootstrap access',
    summary: 'Temporary recovery login',
    body: 'Use the temporary recovery login only until the first governed admin and enterprise context are ready.',
  }),
  Object.freeze({
    id: 'import-baseline',
    number: 2,
    title: 'Import baseline',
    summary: 'Staged baseline release',
    body: 'Import Axis CMS baseline, documentation templates, and required init/core data into Staged preparation.',
  }),
  Object.freeze({
    id: 'review-impact',
    number: 3,
    title: 'Review impact',
    summary: 'Checksum and entity review',
    body: 'Inspect release checksum, entity counts, validation status, target site, catalog, and workflow reference.',
  }),
  Object.freeze({
    id: 'approve-online',
    number: 4,
    title: 'Approve Online',
    summary: 'Governed maker-checker approval',
    body: 'Approve through the governed Process task; rejection keeps Online unchanged and visible in audit.',
  }),
  Object.freeze({
    id: 'verify-live-axis',
    number: 5,
    title: 'Verify live Axis',
    summary: 'Confirm Online workspace',
    body: 'Refresh status, confirm Online state, and continue to Setup & Accelerators for Nexus, Agora, and docs packs.',
  }),
]);

/** Renders the bundled recovery workspace until the CMS-driven Axis site has an Online receipt. */
export function AxisInitializationWorkspace(props: AxisInitializationWorkspaceProps) {
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [expandedSetupSteps, setExpandedSetupSteps] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const review = props.status?.review;
  const publication = props.status?.publication;
  const reviewedEntityCount = review?.entities.reduce(
    (total, entity) => total + entity.total,
    0,
  );
  const reviewMatchesPublication = Boolean(
    review &&
    publication &&
    review.releaseChecksum &&
    review.publicationCode === publication.code &&
    review.workflowRef === publication.workflowRef,
  );
  const canInitiate =
    props.status?.readiness === 'NOT_IMPORTED' ||
    props.status?.readiness === 'IMPORTED' ||
    props.status?.readiness === 'FAILED';
  const readinessLabel =
    props.status?.readiness === 'NOT_IMPORTED'
      ? 'Not imported'
      : props.status?.readiness === 'IMPORTING'
        ? 'Import in progress'
        : props.status?.readiness === 'PUBLICATION_PENDING'
          ? 'Approval pending'
          : props.status?.readiness === 'READY'
            ? 'Online'
            : (props.status?.readiness ?? 'Checking');
  const toggleSetupStep = (stepId: string) => {
    setExpandedSetupSteps((current) => {
      const next = new Set(current);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };
  const toggleSection = (sectionId: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };
  return (
    <Box
      component="main"
      sx={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
      }}
    >
      <Paper sx={{ maxWidth: 820, p: { xs: 2.5, sm: 4 }, width: '100%' }}>
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4">
              Initialize Axis
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Axis is using its bundled recovery workspace until the managed CMS
              baseline is approved and Online.
            </Typography>
          </Box>
          {props.status ? (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
            >
              <Chip
                label={readinessLabel}
                color={props.status.readiness === 'READY' ? 'success' : 'warning'}
              />
              <Chip
                label={`${props.status.releaseCode} ${props.status.releaseVersion}`}
                variant="outlined"
              />
              {props.status.publication ? (
                <Chip label={props.status.publication.state} variant="outlined" />
              ) : null}
            </Stack>
          ) : null}
          <Paper sx={{ bgcolor: 'background.default' }} variant="outlined">
            <Button
              aria-controls="axis-first-run-setup-details"
              aria-expanded={expandedSections.has('first-run-setup')}
              aria-label={`${expandedSections.has('first-run-setup') ? 'Collapse' : 'Expand'} First-run setup`}
              color="inherit"
              fullWidth
              onClick={() => toggleSection('first-run-setup')}
              sx={{
                borderRadius: 0,
                justifyContent: 'stretch',
                p: 2.5,
                textAlign: 'left',
                textTransform: 'none',
              }}
            >
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: 'center', minWidth: 0, width: '100%' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h2" variant="h6">
                    First-run setup
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    Bring the CMS-managed Axis workspace Online through a governed
                    baseline release.
                  </Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                <Chip
                  label={`${String(setupWizardSteps.length)} steps`}
                  size="small"
                  sx={{ flexShrink: 0, fontWeight: 800 }}
                />
                <IconButton
                  aria-hidden
                  component="span"
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'divider', flexShrink: 0 }}
                  tabIndex={-1}
                >
                  <ShellIcon
                    fontSize="small"
                    name={
                      expandedSections.has('first-run-setup')
                        ? 'chevron-up'
                        : 'chevron-down'
                    }
                  />
                </IconButton>
              </Stack>
            </Button>
            <Collapse
              id="axis-first-run-setup-details"
              in={expandedSections.has('first-run-setup')}
              timeout="auto"
              unmountOnExit
            >
              <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2.5 }}>
                <Stack spacing={1.5}>
                  <Typography color="text.secondary" variant="body2">
                    The recovery shell retires after approval.
                  </Typography>
                  <Stack spacing={1}>
                    {setupWizardSteps.map((step) => {
                      const expanded = expandedSetupSteps.has(step.id);
                      return (
                        <Paper
                          key={step.id}
                          elevation={0}
                          sx={{
                            border: 1,
                            borderColor: expanded ? 'primary.light' : 'divider',
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                          variant="outlined"
                        >
                          <Button
                            aria-controls={`axis-setup-step-${step.id}`}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} setup step ${String(step.number)} ${step.title}`}
                            color="inherit"
                            fullWidth
                            onClick={() => toggleSetupStep(step.id)}
                            sx={{
                              borderRadius: 0,
                              justifyContent: 'stretch',
                              minHeight: 64,
                              px: 1.5,
                              py: 1.25,
                              textAlign: 'left',
                              textTransform: 'none',
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1.25}
                              sx={{
                                alignItems: 'center',
                                minWidth: 0,
                                width: '100%',
                              }}
                            >
                              <Box
                                sx={{
                                  alignItems: 'center',
                                  bgcolor: 'primary.main',
                                  borderRadius: 1,
                                  color: 'primary.contrastText',
                                  display: 'flex',
                                  flexShrink: 0,
                                  fontWeight: 800,
                                  height: 34,
                                  justifyContent: 'center',
                                  width: 34,
                                }}
                              >
                                {step.number}
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 800 }} variant="body1">
                                  {step.title}
                                </Typography>
                                <Typography color="text.secondary" variant="body2">
                                  {step.summary}
                                </Typography>
                              </Box>
                              <Box sx={{ flexGrow: 1 }} />
                              <Tooltip
                                title={
                                  expanded ? 'Collapse setup step' : 'Expand setup step'
                                }
                              >
                                <IconButton
                                  aria-hidden
                                  component="span"
                                  edge="end"
                                  size="small"
                                  sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    flexShrink: 0,
                                  }}
                                  tabIndex={-1}
                                >
                                  <ShellIcon
                                    fontSize="small"
                                    name={expanded ? 'chevron-up' : 'chevron-down'}
                                  />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Button>
                          <Collapse
                            id={`axis-setup-step-${step.id}`}
                            in={expanded}
                            timeout="auto"
                            unmountOnExit
                          >
                            <Box
                              sx={{
                                borderTop: 1,
                                borderColor: 'divider',
                                px: 1.5,
                                py: 1.25,
                              }}
                            >
                              <Typography color="text.secondary" variant="body2">
                                {step.body}
                              </Typography>
                            </Box>
                          </Collapse>
                        </Paper>
                      );
                    })}
                  </Stack>
                  <Alert severity="info">
                    Temporary bootstrap access should be retired after the first
                    governed admin and enterprise-scoped user model is active.
                  </Alert>
                </Stack>
              </Box>
            </Collapse>
          </Paper>
          {props.status?.readiness === 'IMPORTING' ? (
            <Alert severity="info">
              Axis is importing the baseline into Staged. Leave this screen open or
              refresh status after a moment; approval becomes available when the import
              finishes.
            </Alert>
          ) : null}
          {props.error ? <Alert severity="error">{props.error}</Alert> : null}
          {props.status?.readiness === 'PUBLICATION_PENDING' ? (
            <Alert severity="info">
              The baseline is waiting for its governed Process approval and Online
              deployment. Review the publication details before making the approval
              decision.
            </Alert>
          ) : null}
          {props.status?.readiness === 'PUBLICATION_PENDING' &&
          reviewMatchesPublication &&
          review ? (
            <Paper sx={{ bgcolor: 'background.default' }} variant="outlined">
              <Button
                aria-controls="axis-publication-review-summary"
                aria-expanded={expandedSections.has('publication-review')}
                aria-label={`${expandedSections.has('publication-review') ? 'Collapse' : 'Expand'} publication review summary`}
                color="inherit"
                fullWidth
                onClick={() => toggleSection('publication-review')}
                sx={{
                  borderRadius: 0,
                  justifyContent: 'stretch',
                  p: 2.5,
                  textAlign: 'left',
                  textTransform: 'none',
                }}
              >
                <Stack spacing={1.25} sx={{ minWidth: 0, width: '100%' }}>
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: 'flex-start', minWidth: 0 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography component="h2" variant="h6">
                        {review.title}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {review.summary}
                      </Typography>
                    </Box>
                    <Box sx={{ flexGrow: 1 }} />
                    <IconButton
                      aria-hidden
                      component="span"
                      size="small"
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        flexShrink: 0,
                      }}
                      tabIndex={-1}
                    >
                      <ShellIcon
                        fontSize="small"
                        name={
                          expandedSections.has('publication-review')
                            ? 'chevron-up'
                            : 'chevron-down'
                        }
                      />
                    </IconButton>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Chip
                      label={`${review.sourceRole} → ${review.targetRole}`}
                      size="small"
                    />
                    <Chip
                      label={`${String(reviewedEntityCount ?? 0)} records`}
                      size="small"
                    />
                    <Chip
                      color={
                        review.validation.warnings.length > 0 ? 'warning' : 'success'
                      }
                      label={`Validation ${review.validation.status}`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </Stack>
              </Button>
              <Collapse
                id="axis-publication-review-summary"
                in={expandedSections.has('publication-review')}
                timeout="auto"
                unmountOnExit
              >
                <Box sx={{ borderTop: 1, borderColor: 'divider', p: 2.5 }}>
                  <Stack spacing={1.25}>
                    <Typography variant="body2">
                      <strong>After approval:</strong> {review.impactMessage}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      Open the detailed review to inspect every entity group, change
                      count, immutable checksum, workflow reference, recovery guidance,
                      and available next actions.
                    </Typography>
                  </Stack>
                </Box>
              </Collapse>
            </Paper>
          ) : null}
          {props.status?.readiness === 'PUBLICATION_PENDING' &&
          !reviewMatchesPublication ? (
            <Alert severity="warning">
              Approval is unavailable until the authoritative publication review for
              this exact release and workflow task can be loaded. Refresh the status
              before continuing.
            </Alert>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {canInitiate ? (
              <Button
                disabled={props.busy}
                onClick={props.onInitiate}
                variant="contained"
              >
                {props.status?.readiness === 'FAILED'
                  ? 'Retry validation'
                  : 'Initialize and submit'}
              </Button>
            ) : null}
            {props.status?.readiness === 'PUBLICATION_PENDING' &&
            props.status.publication?.state === 'PENDING_APPROVAL' &&
            props.status.publication.workflowRef &&
            reviewMatchesPublication ? (
              <Button
                disabled={props.busy}
                onClick={() => setApprovalOpen(true)}
                variant="contained"
              >
                Review publication details
              </Button>
            ) : null}
            <Button disabled={props.busy} onClick={props.onRefresh} variant="outlined">
              Refresh status
            </Button>
            {props.onManageModules ? (
              <Button
                disabled={props.busy}
                onClick={props.onManageModules}
                variant="outlined"
              >
                Prepare required modules
              </Button>
            ) : null}
            <Button disabled={props.busy} onClick={props.onLogout} variant="text">
              Sign out
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <Dialog
        fullWidth
        maxWidth="md"
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              maxHeight: 'calc(100% - 32px)',
              overflow: 'hidden',
            },
          },
        }}
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box
            sx={{
              bgcolor: 'background.default',
              borderBottom: 1,
              borderColor: 'divider',
              p: { xs: 2.5, sm: 3 },
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
            >
              <Box
                sx={{
                  alignItems: 'center',
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                  color: 'primary.contrastText',
                  display: 'flex',
                  flexShrink: 0,
                  height: 52,
                  justifyContent: 'center',
                  width: 52,
                }}
              >
                <ShellIcon name="approve" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h2" variant="h5">
                  {review?.title ?? 'Review Axis publication'}
                </Typography>
                {review ? (
                  <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                    {review.summary}
                  </Typography>
                ) : null}
                {review ? (
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ mt: 2 }}
                  >
                    <Chip
                      label={`${review.sourceRole} → ${review.targetRole}`}
                      sx={{ fontWeight: 800 }}
                    />
                    <Chip
                      label={`${String(reviewedEntityCount ?? 0)} records`}
                      sx={{ fontWeight: 800 }}
                    />
                    <Chip
                      color={
                        review.validation.warnings.length > 0 ? 'warning' : 'success'
                      }
                      label={`Validation ${review.validation.status}`}
                      sx={{ fontWeight: 800 }}
                      variant="outlined"
                    />
                  </Stack>
                ) : null}
              </Box>
            </Stack>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {review ? (
            <Stack spacing={0}>
              <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Typography component="h2" variant="h6">
                  What you are approving
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                    },
                    mt: 1.5,
                  }}
                >
                  {[
                    {
                      label: 'Release',
                      value:
                        `${props.status?.releaseCode ?? 'axis'} ${props.status?.releaseVersion ?? ''}`.trim(),
                    },
                    {
                      label: 'Tenant',
                      value: review.tenant ?? 'Current tenant',
                    },
                    {
                      label: 'Site',
                      value: review.siteCode,
                    },
                    {
                      label: 'Catalog',
                      value: review.catalogCode,
                    },
                    {
                      label: 'Publication',
                      value: review.publicationCode,
                    },
                    {
                      label: 'Workflow',
                      value: review.workflowRef,
                    },
                  ].map((item) => (
                    <Paper
                      key={item.label}
                      elevation={0}
                      sx={{
                        bgcolor: 'background.default',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1.5,
                      }}
                    >
                      <Typography color="text.secondary" variant="caption">
                        {item.label}
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          mt: 0.25,
                          overflowWrap: 'anywhere',
                        }}
                        variant="body2"
                      >
                        {item.value}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
                {review.requestedBy ? (
                  <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
                    Submitted by {review.requestedBy}
                    {review.requestedAt
                      ? ` at ${new Date(review.requestedAt).toLocaleString()}`
                      : ''}
                  </Typography>
                ) : null}
                <Paper
                  elevation={0}
                  sx={{
                    bgcolor: 'background.default',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mt: 1.5,
                    p: 1.5,
                  }}
                >
                  <Typography
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                    variant="caption"
                  >
                    Immutable release checksum: {review.releaseChecksum}
                  </Typography>
                </Paper>
              </Box>
              <Divider />
              <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ alignItems: { xs: 'stretch', sm: 'center' }, mb: 1.5 }}
                >
                  <Typography component="h2" variant="h6">
                    Included changes
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Chip
                    label={`${String(reviewedEntityCount ?? 0)} total records`}
                    size="small"
                    sx={{ fontWeight: 800 }}
                  />
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.25,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  {review.entities.map((entity) => (
                    <Paper
                      key={entity.type}
                      sx={{
                        bgcolor: 'background.default',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1.5,
                      }}
                      variant="outlined"
                    >
                      <Typography sx={{ fontWeight: 800 }}>
                        {entity.label}: {entity.total}
                      </Typography>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}
                      >
                        <Chip label={`Added ${entity.added}`} size="small" />
                        <Chip
                          label={`Updated ${entity.updated}`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`Unchanged ${entity.unchanged}`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`Removed ${entity.removed}`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </Paper>
                  ))}
                </Box>
              </Box>
              <Divider />
              <Box sx={{ p: { xs: 2.5, sm: 3 }, pt: 2 }}>
                <Alert
                  severity={
                    review.validation.warnings.length > 0 ? 'warning' : 'success'
                  }
                  variant="outlined"
                >
                  Validation {review.validation.status.toLowerCase()}.
                  {review.validation.warnings.length > 0
                    ? ` ${review.validation.warnings.join(' ')}`
                    : ' No warnings were reported for this immutable release.'}
                </Alert>
              </Box>
              <Box sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  sx={{ alignItems: 'stretch' }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      flex: 1,
                      p: 1.5,
                    }}
                  >
                    <Typography component="h2" variant="h6">
                      What happens after approval
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                      {review.impactMessage}
                    </Typography>
                  </Paper>
                  <Paper
                    elevation={0}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      flex: 1,
                      p: 1.5,
                    }}
                  >
                    <Typography component="h2" sx={{ mb: 1 }} variant="h6">
                      What you can do next
                    </Typography>
                    <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5 }}>
                      {review.postPublicationCapabilities.map((capability) => (
                        <Box component="li" key={capability.title}>
                          <Typography sx={{ fontWeight: 800 }} variant="body2">
                            {capability.title}
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            {capability.description}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Stack>
              </Box>
              <Box sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
                <Alert severity="info" variant="outlined">
                  {review.rollbackMessage}
                </Alert>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            gap: 1,
            justifyContent: 'flex-end',
            p: { xs: 2, sm: 2.5 },
          }}
        >
          <Button onClick={() => setApprovalOpen(false)}>Cancel</Button>
          <Button
            autoFocus
            disabled={!reviewMatchesPublication}
            onClick={() => {
              setApprovalOpen(false);
              props.onApprove();
            }}
            variant="contained"
          >
            Approve and publish
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
