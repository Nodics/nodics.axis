import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import type { AxisInitializationStatus } from './axisInitializationClient';

interface AxisInitializationWorkspaceProps {
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly status?: AxisInitializationStatus | undefined;
  readonly onInitiate: () => void;
  readonly onApprove: () => void;
  readonly onRefresh: () => void;
  readonly onLogout: () => void;
}

const setupWizardSteps = Object.freeze([
  Object.freeze({
    title: '1. Bootstrap access',
    body: 'Use the temporary recovery login only until the first governed admin and enterprise context are ready.',
  }),
  Object.freeze({
    title: '2. Import baseline',
    body: 'Import Axis CMS baseline, documentation templates, and required init/core data into Staged preparation.',
  }),
  Object.freeze({
    title: '3. Review impact',
    body: 'Inspect release checksum, entity counts, validation status, target site, catalog, and workflow reference.',
  }),
  Object.freeze({
    title: '4. Approve Online',
    body: 'Approve through the governed Process task; rejection keeps Online unchanged and visible in audit.',
  }),
  Object.freeze({
    title: '5. Verify live Axis',
    body: 'Refresh status, confirm Online state, and continue to Setup & Accelerators for Nexus, Agora, and docs packs.',
  }),
]);

/** Renders the bundled recovery workspace until the CMS-driven Axis site has an Online receipt. */
export function AxisInitializationWorkspace(props: AxisInitializationWorkspaceProps) {
  const [approvalOpen, setApprovalOpen] = useState(false);
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
      <Paper sx={{ maxWidth: 720, p: 4, width: '100%' }}>
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
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Chip
                label={props.status.readiness}
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
          <Paper sx={{ bgcolor: 'background.default', p: 2.5 }} variant="outlined">
            <Stack spacing={1.5}>
              <Box>
                <Typography component="h2" variant="h6">
                  Empty-database setup wizard
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  First start should feel like a guided enterprise onboarding journey,
                  not a hidden script. Axis shows what is prepared, what is approved,
                  and what must be verified before the recovery shell retires.
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(5, minmax(0, 1fr))' },
                }}
              >
                {setupWizardSteps.map((step) => (
                  <Paper key={step.title} sx={{ p: 1.5 }} variant="outlined">
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                      {step.title}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      {step.body}
                    </Typography>
                  </Paper>
                ))}
              </Box>
              <Alert severity="info">
                Temporary bootstrap access should be retired after the first governed
                admin and enterprise-scoped user model is active.
              </Alert>
            </Stack>
          </Paper>
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
            <Paper sx={{ bgcolor: 'background.default', p: 2.5 }} variant="outlined">
              <Stack spacing={1.25}>
                <Box>
                  <Typography component="h2" variant="h6">
                    {review.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {review.summary}
                  </Typography>
                </Box>
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
                <Typography variant="body2">
                  <strong>After approval:</strong> {review.impactMessage}
                </Typography>
                <Typography color="text.secondary" variant="caption">
                  Open the detailed review to inspect every entity group, change count,
                  immutable checksum, workflow reference, recovery guidance, and
                  available next actions.
                </Typography>
              </Stack>
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
      >
        <DialogTitle>{review?.title ?? 'Review Axis publication'}</DialogTitle>
        <DialogContent>
          {review ? (
            <Stack spacing={2.5}>
              <DialogContentText>{review.summary}</DialogContentText>
              <Box>
                <Typography component="h2" variant="h6">
                  What you are approving
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {props.status?.releaseCode} {props.status?.releaseVersion} ·{' '}
                  {review.sourceRole} → {review.targetRole}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Tenant: {review.tenant ?? 'Current tenant'} · Site: {review.siteCode}{' '}
                  · Catalog: {review.catalogCode}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Publication: {review.publicationCode} · Workflow: {review.workflowRef}
                </Typography>
                {review.requestedBy ? (
                  <Typography color="text.secondary" variant="body2">
                    Submitted by {review.requestedBy}
                    {review.requestedAt
                      ? ` at ${new Date(review.requestedAt).toLocaleString()}`
                      : ''}
                  </Typography>
                ) : null}
                <Typography
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                  variant="caption"
                >
                  Immutable release checksum: {review.releaseChecksum}
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography component="h2" sx={{ mb: 1 }} variant="h6">
                  Included changes
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  {review.entities.map((entity) => (
                    <Paper
                      key={entity.type}
                      sx={{ bgcolor: 'action.hover', p: 1.5 }}
                      variant="outlined"
                    >
                      <Typography sx={{ fontWeight: 600 }}>
                        {entity.label}: {entity.total}
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        Added {entity.added} · Updated {entity.updated} · Unchanged{' '}
                        {entity.unchanged} · Removed {entity.removed}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
              <Alert
                severity={review.validation.warnings.length > 0 ? 'warning' : 'success'}
              >
                Validation {review.validation.status.toLowerCase()}.
                {review.validation.warnings.length > 0
                  ? ` ${review.validation.warnings.join(' ')}`
                  : ' No warnings were reported for this immutable release.'}
              </Alert>
              <Box>
                <Typography component="h2" variant="h6">
                  What happens after approval
                </Typography>
                <Typography color="text.secondary">{review.impactMessage}</Typography>
              </Box>
              <Box>
                <Typography component="h2" sx={{ mb: 1 }} variant="h6">
                  What you can do next
                </Typography>
                <Stack component="ul" spacing={1} sx={{ m: 0, pl: 3 }}>
                  {review.postPublicationCapabilities.map((capability) => (
                    <Box component="li" key={capability.title}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {capability.title}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {capability.description}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Alert severity="info">{review.rollbackMessage}</Alert>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
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
