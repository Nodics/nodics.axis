import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  loadWasteAssessments,
  mutateWasteAssessment,
  type WasteAssessmentHistory,
  type WasteReviewClientConfiguration,
  type WasteSavedAssessment,
} from './api/wasteReviewClient';

type Action = 'ASSESS' | 'SELECT' | 'RECOVER';
/** Displays immutable provider evidence and routes explicit operator choices through the owner. */
export function WasteImpactAssessments({
  configuration,
  code,
  canAssess,
  canSelect,
  labels,
}: {
  configuration: WasteReviewClientConfiguration;
  code: string;
  canAssess: boolean;
  canSelect: boolean;
  labels: Record<string, string>;
}) {
  const [history, setHistory] = useState<WasteAssessmentHistory | null>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [intent, setIntent] = useState<{
    action: Action;
    assessment?: WasteSavedAssessment;
    revision: number;
    key: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const label = (key: string) => labels[key] || key;
  useEffect(() => {
    let cancelled = false;
    loadWasteAssessments(configuration, code, page)
      .then((value) => {
        if (!cancelled) {
          setHistory(value);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Assessment unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [configuration, code, page, refresh]);
  const begin = (action: Action, assessment?: WasteSavedAssessment) => {
    if (!history) return;
    setReason('');
    setError('');
    setNotice('');
    setIntent({
      action,
      ...(assessment ? { assessment } : {}),
      revision: history.assetRevision,
      key: crypto.randomUUID(),
    });
  };
  const submit = async () => {
    if (!intent || busy) return;
    setBusy(true);
    setError('');
    try {
      const value = await mutateWasteAssessment(configuration, code, intent.action, {
        expectedRevision: intent.revision,
        confirmed: true,
        ...(intent.action !== 'RECOVER'
          ? { reason: reason.trim(), idempotencyKey: intent.key }
          : {}),
        ...(intent.assessment ? { assessmentCode: intent.assessment.code } : {}),
      });
      setHistory(value);
      setIntent(null);
      setPage(1);
      setNotice(label(intent.action === 'SELECT' ? 'selected' : 'saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assessment command failed');
    } finally {
      setBusy(false);
    }
  };
  const evidence = (item: WasteSavedAssessment) => {
    const env = item.assessment,
      method = env?.methodology;
    const value = (key: string) =>
      env?.indicators.find((indicator) => indicator.key === key)?.value;
    return (
      <Box
        key={item.code}
        sx={{
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          overflowWrap: 'anywhere',
        }}
      >
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1 }}>
          <Typography variant="subtitle2">
            {method?.isMock
              ? label('legacy')
              : method?.providerCode || label('unavailable')}
            {method?.providerVersion ? ` · ${method.providerVersion}` : ''}
          </Typography>
          <Chip
            size="small"
            color={item.accepted ? 'success' : 'default'}
            label={label(item.accepted ? 'accepted' : 'candidate')}
          />
        </Stack>
        <Typography variant="caption">
          {item.calculatedAt ? new Date(item.calculatedAt).toLocaleString() : ''} ·{' '}
          {item.code}
        </Typography>
        {!method?.isMock && (
          <>
            <Typography>
              {label('potential')}: {value('avoidedEmissions') ?? '—'} kg CO₂e
            </Typography>
            <Typography>
              {label('equivalent')}: {value('carbonEquivalent') ?? '—'}
            </Typography>
          </>
        )}
        <Typography>
          {label('dataset')}:{' '}
          {method?.isMock ? '—' : env?.factors?.factorSetVersion || '—'}
        </Typography>
        <Typography>
          {label('weight')}: {env?.inputs?.weightKg ?? '—'} kg ·{' '}
          {env?.inputs?.weightSource?.toLowerCase().replaceAll('_', ' ') || '—'}
        </Typography>
        <Typography>
          {label('factor')}:{' '}
          {env?.factors?.factorKgCO2ePerKg?.toLocaleString(undefined, {
            maximumFractionDigits: 6,
          }) ?? '—'}{' '}
          kg CO₂e/kg · {env?.factors?.factorSource || '—'}
        </Typography>
        {method?.factorDatasetRef && (
          <Typography>
            {label('source')}:{' '}
            {/^(https?:)\/\//.test(method.factorDatasetRef) ? (
              <Link href={method.factorDatasetRef} target="_blank" rel="noreferrer">
                {method.factorDatasetRef}
              </Link>
            ) : (
              method.factorDatasetRef
            )}
          </Typography>
        )}
        <Typography>
          {label('baseline')}: {method?.baselineScenario || '—'}
        </Typography>
        <Typography>
          {label('treatment')}: {method?.treatmentScenario || '—'}
        </Typography>
        <Typography>
          {label('region')}: {method?.geography || '—'}
        </Typography>
        <Typography>
          {label('basis')}: {method?.systemBoundary || '—'}
        </Typography>
        {item.reason && (
          <Typography>
            {label('reason')}: {item.reason}
          </Typography>
        )}
        {canSelect &&
          !item.accepted &&
          ['ESTIMATED', 'CONFIRMED', 'RECALCULATED'].includes(
            item.calculationStatus,
          ) && (
            <Button
              disabled={busy || history?.recoveryRequired}
              onClick={() => begin('SELECT', item)}
            >
              {label('select')}
            </Button>
          )}
      </Box>
    );
  };
  return (
    <Box component="section" aria-label={label('title')} sx={{ mt: 2 }}>
      <Typography variant="h6">{label('title')}</Typography>
      <Typography sx={{ mb: 2 }}>{label('explanation')}</Typography>
      {error && !intent && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {!history ? (
        <Typography>{label('loading')}</Typography>
      ) : (
        <>
          {history.recoveryRequired && (
            <Alert severity="warning">
              {label('pending')}
              {(history.recoveryAction === 'SELECT' ? canSelect : canAssess) && (
                <Button onClick={() => begin('RECOVER')}>{label('recover')}</Button>
              )}
            </Alert>
          )}
          <Stack direction="row" spacing={1} sx={{ my: 2, flexWrap: 'wrap' }}>
            {canAssess && (
              <Button
                variant="outlined"
                disabled={busy || history.recoveryRequired}
                onClick={() => begin('ASSESS')}
              >
                {label('reassess')}
              </Button>
            )}
            <Button disabled={busy} onClick={() => setRefresh((v) => v + 1)}>
              {label('refresh')}
            </Button>
          </Stack>
          {history.acceptedAssessment && (
            <Box sx={{ mb: 2 }}>{evidence(history.acceptedAssessment)}</Box>
          )}
          <Typography variant="subtitle1">
            {label('history')} ({history.total})
          </Typography>
          <Stack spacing={1}>
            {history.items.filter((item) => !item.accepted).map(evidence)}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button disabled={page === 1 || busy} onClick={() => setPage((v) => v - 1)}>
              {label('previous')}
            </Button>
            <Button
              disabled={
                Math.max(history.total, history.selectionHistory.total) <=
                  page * history.limit || busy
              }
              onClick={() => setPage((v) => v + 1)}
            >
              {label('next')}
            </Button>
          </Stack>
          {history.selectionHistory.items.map((event) => (
            <Typography key={event.code} variant="caption" component="p">
              {label('accepted')}: {event.assessmentCode} ·{' '}
              {new Date(event.at).toLocaleString()} · {event.reason}
            </Typography>
          ))}
        </>
      )}
      <Dialog
        open={Boolean(intent)}
        onClose={() => {
          if (!busy) setIntent(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{label('confirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{label('explanation')}</Typography>
          {intent?.assessment && (
            <Typography sx={{ my: 2 }}>
              {intent.assessment.code} ·{' '}
              {intent.assessment.assessment?.methodology?.providerCode}
            </Typography>
          )}
          {intent?.action !== 'RECOVER' && (
            <TextField
              autoFocus
              fullWidth
              multiline
              margin="normal"
              label={label('reason')}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setIntent(null)}>
            {label('cancel')}
          </Button>
          <Button
            disabled={busy || (intent?.action !== 'RECOVER' && !reason.trim())}
            onClick={() => void submit()}
          >
            {label('confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
