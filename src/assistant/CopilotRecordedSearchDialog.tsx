/** @file Explicit audited enterprise content search with bounded windows, inert excerpts and abort-on-close. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { AssistantTransportConfiguration } from './api/assistantTransport';
import type { TranscriptInspection } from './api/copilotTranscriptClient';
import {
  searchRecordedContent,
  type RecordedSearchCapability,
  type RecordedSearchCommand,
  type RecordedSearchResult,
} from './api/copilotRecordedSearchClient';

/** Displays no content until an explicit purpose-bound search; every page creates a separate access receipt. */
export function CopilotRecordedSearchDialog({
  configuration,
  capability,
  inspection,
  onClose,
}: {
  configuration: AssistantTransportConfiguration;
  capability: RecordedSearchCapability;
  inspection: TranscriptInspection;
  onClose: () => void;
}) {
  const copy = capability.presentation;
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const [term, setTerm] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [result, setResult] = useState<RecordedSearchResult>();
  const [submitted, setSubmitted] = useState<RecordedSearchCommand>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const clear = () => {
    setResult(undefined);
    setSubmitted(undefined);
    setFailed(false);
  };
  const valid =
    term.trim().length >= capability.minimumTermLength &&
    !!purpose &&
    Number.isFinite(Date.parse(from)) &&
    Number.isFinite(Date.parse(to)) &&
    Date.parse(to) >= Date.parse(from) &&
    Date.parse(to) - Date.parse(from) <= capability.maximumWindowDays * 86400000;
  const run = async (page: number) => {
    if (busy || !valid) return;
    const command = {
      term: term.trim(),
      purpose,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      page,
    };
    const guard = new AbortController();
    active.current?.abort();
    active.current = guard;
    setBusy(true);
    setFailed(false);
    setResult(undefined);
    try {
      const value = await searchRecordedContent(configuration, command, guard.signal);
      if (!guard.signal.aborted) {
        setResult(value);
        setSubmitted(command);
      }
    } catch {
      if (!guard.signal.aborted) setFailed(true);
    } finally {
      if (!guard.signal.aborted) setBusy(false);
    }
  };
  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose}>
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1, minWidth: 0 }}>
          <Alert severity="info">{copy.coverage}</Alert>
          <TextField
            label={copy.term}
            value={term}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 128 } }}
            onChange={(event) => {
              setTerm(event.target.value);
              clear();
            }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label={copy.from}
              type="datetime-local"
              value={from}
              disabled={busy}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(event) => {
                setFrom(event.target.value);
                clear();
              }}
            />
            <TextField
              fullWidth
              label={copy.to}
              type="datetime-local"
              value={to}
              disabled={busy}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(event) => {
                setTo(event.target.value);
                clear();
              }}
            />
          </Stack>
          <TextField
            select
            label={copy.purpose}
            value={purpose}
            disabled={busy}
            onChange={(event) => {
              setPurpose(event.target.value);
              clear();
            }}
          >
            {inspection.purposes.map((item) => (
              <MenuItem key={item.code} value={item.code}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row">
            <Button
              disabled={busy || !valid}
              startIcon={<ShellIcon name="search" />}
              onClick={() => void run(1)}
            >
              {copy.search}
            </Button>
          </Stack>
          {failed ? <Alert severity="warning">{copy.failure}</Alert> : null}
          {result ? (
            <>
              <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                {copy.audit}: {result.accessReceipt}
              </Typography>
              {!result.items.length ? (
                <Typography role="status">{copy.empty}</Typography>
              ) : (
                result.items.map((item) => (
                  <Stack
                    key={item.messageCode}
                    spacing={1}
                    sx={{
                      py: 1,
                      borderBottom: 1,
                      borderColor: 'divider',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <Typography variant="caption">
                      {item.conversationCode} / {item.principalCode} /{' '}
                      {item.role === 'user'
                        ? inspection.presentation.user
                        : inspection.presentation.assistant}{' '}
                      / {new Date(item.createdAt).toLocaleString()}
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {item.excerpt}
                    </Typography>
                  </Stack>
                ))
              )}
              <Stack
                direction="row"
                sx={{ alignItems: 'center', justifyContent: 'flex-end' }}
              >
                <Tooltip title={copy.previous}>
                  <span>
                    <IconButton
                      aria-label={copy.previous}
                      disabled={busy || result.page <= 1 || !submitted}
                      onClick={() => void run(result.page - 1)}
                    >
                      <ShellIcon name="chevron-left" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Typography>
                  {copy.page} {result.page}
                </Typography>
                <Tooltip title={copy.next}>
                  <span>
                    <IconButton
                      aria-label={copy.next}
                      disabled={
                        busy || !result.mayHaveMore || result.page >= 1000 || !submitted
                      }
                      onClick={() => void run(result.page + 1)}
                    >
                      <ShellIcon name="chevron-right" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{copy.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
