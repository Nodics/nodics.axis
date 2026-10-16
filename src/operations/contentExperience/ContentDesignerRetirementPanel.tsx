import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { ShellIcon } from '../../app/shell/ShellIcon';
import type { AxisModuleConnection } from '../../bootstrap/publicBootstrap';
import {
  retireContentDesignerRecord,
  type ContentDesignerClientConfiguration,
  type ContentDesignerRetirementIntent,
  type ContentDesignerRetirementPresentation,
} from './api/contentDesignerClient';

interface RetirementReview {
  readonly action: ContentDesignerRetirementPresentation['actions'][number];
  readonly intent: ContentDesignerRetirementIntent;
  readonly connection: AxisModuleConnection;
  readonly configuration: ContentDesignerClientConfiguration;
}

interface ContentDesignerRetirementPanelProps {
  readonly connection: AxisModuleConnection | undefined;
  readonly configuration: ContentDesignerClientConfiguration;
  readonly operations: readonly string[];
  readonly presentation: ContentDesignerRetirementPresentation;
  readonly catalogCode: string;
  readonly siteCode: string;
  readonly disabled: boolean;
  readonly onRetired: () => void;
  readonly onPendingChange: (pending: boolean) => void;
}

/** Reviews exact CMS identities and scope; operation admission comes only from the fresh owner model. */
export function ContentDesignerRetirementPanel({
  connection,
  configuration,
  operations,
  presentation: copy,
  catalogCode,
  siteCode,
  disabled,
  onRetired,
  onPendingChange,
}: ContentDesignerRetirementPanelProps) {
  const [selectedOperation, setSelectedOperation] = useState('');
  const [code, setCode] = useState('');
  const [review, setReview] = useState<RetirementReview>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [inspected, setInspected] = useState(false);
  const [uncertain, setUncertain] = useState<RetirementReview>();
  const [outcome, setOutcome] = useState<{
    review: RetirementReview;
    versionId: number;
  }>();
  const inFlight = useRef(false);
  const actions = copy.actions.filter((action) =>
    operations.includes(action.operation),
  );
  const action =
    actions.find((item) => item.operation === selectedOperation) ?? actions[0];
  const current = (candidate: RetirementReview): boolean =>
    Boolean(
      !disabled &&
      connection &&
      operations.includes(candidate.action.operation) &&
      connection.instanceId === candidate.connection.instanceId &&
      connection.endpoint === candidate.connection.endpoint &&
      configuration.accessToken === candidate.configuration.accessToken &&
      configuration.enterpriseCode === candidate.configuration.enterpriseCode &&
      catalogCode === candidate.intent.catalogCode &&
      siteCode === candidate.intent.siteCode,
    );
  const mutation = useMutation({
    mutationFn: (candidate: RetirementReview) => {
      if (!current(candidate)) throw new Error(copy.changedMessage);
      return retireContentDesignerRecord(
        candidate.connection,
        candidate.configuration,
        candidate.action.operation,
        candidate.intent,
      );
    },
  });
  const confirm = async () => {
    if (!review || !acknowledged || uncertain || !current(review) || inFlight.current)
      return;
    const candidate = review;
    inFlight.current = true;
    onPendingChange(true);
    try {
      const result = await mutation.mutateAsync(candidate);
      setOutcome({ review: candidate, versionId: result.versionId });
      setCode('');
      setReview(undefined);
      setAcknowledged(false);
      onRetired();
    } catch {
      setUncertain(candidate);
      setInspected(false);
    } finally {
      inFlight.current = false;
      onPendingChange(false);
    }
  };
  const busy = mutation.isPending;
  const validSelection = [code, catalogCode, siteCode].every((value) =>
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value),
  );
  if (!actions.length && !review && !uncertain && !outcome) return null;

  const scope = (candidate: RetirementReview) => (
    <Stack spacing={0.5} sx={{ overflowWrap: 'anywhere' }}>
      <Typography>
        {copy.targetLabel}: {candidate.action.label}
      </Typography>
      <Typography>
        {copy.codeLabel}: {candidate.intent.code}
      </Typography>
      <Typography>
        {copy.enterpriseLabel}: {candidate.configuration.enterpriseCode}
      </Typography>
      <Typography>
        {copy.catalogLabel}: {candidate.intent.catalogCode}
      </Typography>
      <Typography>
        {copy.siteLabel}: {candidate.intent.siteCode}
      </Typography>
    </Stack>
  );

  return (
    <Box
      component="section"
      aria-label={copy.title}
      sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}
    >
      <Stack spacing={2}>
        <Typography variant="h6">{copy.title}</Typography>
        {outcome && (
          <Alert severity="success">
            {copy.successMessage} {outcome.review.intent.code} (v{outcome.versionId})
            {scope(outcome.review)}
          </Alert>
        )}
        {uncertain && (
          <Alert severity="warning">
            {copy.uncertainMessage}
            {scope(uncertain)}
            <FormControlLabel
              label={copy.inspectionLabel}
              control={
                <Checkbox
                  checked={inspected}
                  disabled={busy}
                  onChange={(_, value) => setInspected(value)}
                />
              }
            />
          </Alert>
        )}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <TextField
            select
            label={copy.targetLabel}
            value={action?.operation ?? ''}
            disabled={busy || Boolean(review) || !actions.length}
            sx={{ minWidth: { sm: 200 } }}
            onChange={(event) => setSelectedOperation(event.target.value)}
          >
            {actions.map((item) => (
              <MenuItem key={item.operation} value={item.operation}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={copy.codeLabel}
            value={code}
            fullWidth
            disabled={busy || Boolean(review)}
            slotProps={{ htmlInput: { maxLength: 128 } }}
            onChange={(event) => setCode(event.target.value)}
          />
          <Tooltip title={copy.reviewLabel}>
            <span>
              <Button
                startIcon={<ShellIcon name="search" />}
                variant="outlined"
                disabled={
                  disabled ||
                  busy ||
                  Boolean(review) ||
                  !connection ||
                  !action ||
                  !validSelection ||
                  Boolean(uncertain && !inspected)
                }
                onClick={() => {
                  if (
                    !connection ||
                    !action ||
                    disabled ||
                    inFlight.current ||
                    !validSelection ||
                    (uncertain && !inspected)
                  )
                    return;
                  setReview({
                    action,
                    intent: { code, siteCode, catalogCode },
                    connection,
                    configuration,
                  });
                  setAcknowledged(false);
                  setUncertain(undefined);
                  setInspected(false);
                  setOutcome(undefined);
                  mutation.reset();
                }}
              >
                {copy.reviewLabel}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <Dialog
        open={Boolean(review)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="cms-retirement-title"
        onClose={() => {
          if (!inFlight.current) setReview(undefined);
        }}
      >
        <DialogTitle id="cms-retirement-title">{copy.reviewTitle}</DialogTitle>
        <DialogContent>
          {review && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {scope(review)}
              <Alert severity="warning">{review.action.consequence}</Alert>
              <Typography variant="body2">{copy.historyMessage}</Typography>
              {!current(review) && (
                <Alert severity="warning">{copy.changedMessage}</Alert>
              )}
              {uncertain && <Alert severity="error">{copy.uncertainMessage}</Alert>}
              <FormControlLabel
                label={copy.acknowledgeLabel}
                control={
                  <Checkbox
                    checked={acknowledged}
                    disabled={busy || Boolean(uncertain)}
                    onChange={(_, value) => setAcknowledged(value)}
                  />
                }
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            startIcon={<ShellIcon name="close" />}
            disabled={busy}
            onClick={() => {
              if (!inFlight.current) setReview(undefined);
            }}
          >
            {copy.cancelLabel}
          </Button>
          <Tooltip title={copy.confirmLabel}>
            <span>
              <Button
                startIcon={<ShellIcon name="approve" />}
                color="warning"
                variant="contained"
                disabled={
                  busy ||
                  !review ||
                  !current(review) ||
                  !acknowledged ||
                  Boolean(uncertain)
                }
                onClick={() => {
                  void confirm();
                }}
              >
                {copy.confirmLabel}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
