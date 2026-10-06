/** @file Explicit, scoped live-read form for business users; authorization and query execution stay in Copilot owners. */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { ShellIcon } from '../app/shell/ShellIcon';
import type { CopilotLiveReads } from './api/copilotLiveReadContract';
import type {
  CopilotCollection,
  CopilotCollectionSource,
} from './api/copilotCollectionsClient';

interface Props {
  readonly contract: CopilotLiveReads;
  readonly disabled: boolean;
  readonly loadCollections: (
    source: CopilotCollectionSource,
    signal: AbortSignal,
  ) => Promise<readonly CopilotCollection[]>;
  readonly onSubmit: (message: string) => Promise<void>;
}

/** Formats a visible browser-local date input without interpreting it as UTC. */
function localInstant(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/** Keeps drafts only in component state and submits one inert command after explicit action. */
export function CopilotLiveReadComposer(props: Props) {
  const [open, setOpen] = useState(false);
  const copy = props.contract.presentation;
  return (
    <>
      <Button
        startIcon={<ShellIcon name="search" />}
        disabled={props.disabled || !props.contract.sources.length}
        onClick={() => setOpen(true)}
        sx={{ mx: { xs: 2, md: 3 }, mb: 1 }}
      >
        {copy.open}
      </Button>
      {open ? <LiveReadDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Aborts obsolete metadata and discards drafts on close or authorization-scope remount. */
function LiveReadDialog({
  contract,
  disabled,
  loadCollections,
  onSubmit,
  onClose,
}: Props & { readonly onClose: () => void }) {
  const copy = contract.presentation;
  const [source, setSource] = useState<CopilotLiveReads['sources'][number] | null>(
    null,
  );
  const [collections, setCollections] = useState<readonly CopilotCollection[]>([]);
  const [collection, setCollection] = useState<CopilotCollection | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState('1');
  const [from, setFrom] = useState(() =>
    localInstant(new Date(Date.now() - 15 * 60_000)),
  );
  const [to, setTo] = useState(() => localInstant(new Date()));
  const [correlation, setCorrelation] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitted = useRef(false);
  useEffect(() => {
    if (!source || source.sourceType !== 'DATABASE') return;
    const controller = new AbortController();
    void loadCollections(
      { ...source, enabled: true, canQuery: true },
      controller.signal,
    )
      .then((items) => {
        if (!controller.signal.aborted)
          setCollections(items.filter((item) => item.selected));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [source, loadCollections]);
  const database = source?.sourceType === 'DATABASE';
  /** Submits one fixed metadata intent; the server rechecks source and native authority. */
  function inspectCollection(
    intent: 'copilot.data.schema' | 'copilot.data.capabilities',
  ) {
    if (
      disabled ||
      loading ||
      failed ||
      !database ||
      !source ||
      !collection ||
      submitted.current ||
      !navigator.onLine
    )
      return;
    submitted.current = true;
    onClose();
    void onSubmit(
      JSON.stringify({
        intent,
        sourceCode: source.code,
        input: { schemaName: collection.schemaName },
      }),
    );
  }
  const valid =
    source &&
    !loading &&
    !failed &&
    (database
      ? collection &&
        search.trim() &&
        search.length <= 100 &&
        /^[1-9][0-9]{0,3}$/.test(page) &&
        Number(page) <= 1000
      : /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(correlation) &&
        Number.isFinite(Date.parse(from)) &&
        Number.isFinite(Date.parse(to)) &&
        Date.parse(to) >= Date.parse(from) &&
        Date.parse(to) - Date.parse(from) <= 86400000);
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      aria-labelledby="copilot-live-read-title"
    >
      <DialogTitle id="copilot-live-read-title">{copy.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            options={contract.sources}
            value={source}
            disabled={disabled}
            getOptionLabel={(item) =>
              `${item.code} (${item.sourceType === 'DATABASE' ? copy.database : copy.logs})`
            }
            isOptionEqualToValue={(a, b) => a.code === b.code}
            onChange={(_, value) => {
              setSource(value);
              setCollections([]);
              setCollection(null);
              setFailed(false);
              setLoading(value?.sourceType === 'DATABASE');
            }}
            renderInput={(params) => <TextField {...params} label={copy.source} />}
          />
          {database ? (
            <>
              <Autocomplete
                options={collections}
                value={collection}
                loading={loading}
                disabled={disabled || loading}
                getOptionLabel={(item) => item.label}
                isOptionEqualToValue={(a, b) => a.schemaName === b.schemaName}
                onChange={(_, value) => setCollection(value)}
                renderInput={(params) => (
                  <TextField {...params} label={copy.collection} />
                )}
              />
              {copy.inspectSchema || copy.inspectCapabilities ? (
                <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap' }} spacing={1}>
                  {copy.inspectSchema ? (
                    <Button
                      startIcon={<ShellIcon name="search" />}
                      disabled={disabled || loading || failed || !collection}
                      onClick={() => inspectCollection('copilot.data.schema')}
                    >
                      {copy.inspectSchema}
                    </Button>
                  ) : null}
                  {copy.inspectCapabilities ? (
                    <Button
                      startIcon={<ShellIcon name="search" />}
                      disabled={disabled || loading || failed || !collection}
                      onClick={() => inspectCollection('copilot.data.capabilities')}
                    >
                      {copy.inspectCapabilities}
                    </Button>
                  ) : null}
                </Stack>
              ) : null}
              <TextField
                label={copy.search}
                value={search}
                disabled={disabled}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
              />
              <TextField
                label={copy.page}
                type="number"
                value={page}
                disabled={disabled}
                onChange={(event) => setPage(event.target.value)}
                slotProps={{ htmlInput: { min: 1, max: 1000, step: 1 } }}
              />
            </>
          ) : source ? (
            <>
              <TextField
                label={copy.correlation}
                value={correlation}
                disabled={disabled}
                onChange={(event) => setCorrelation(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 128 } }}
              />
              <TextField
                label={copy.from}
                type="datetime-local"
                value={from}
                disabled={disabled}
                onChange={(event) => setFrom(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={copy.to}
                type="datetime-local"
                value={to}
                disabled={disabled}
                onChange={(event) => setTo(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </>
          ) : null}
          {failed ? <Alert severity="warning">{copy.failed}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{ flexWrap: 'wrap', gap: 1, '& > :not(style) ~ :not(style)': { ml: 0 } }}
      >
        <Button onClick={onClose}>{copy.cancel}</Button>
        {database && copy.inspectCollections ? (
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={disabled || loading || failed}
            onClick={() => {
              if (!source || submitted.current || !navigator.onLine) return;
              submitted.current = true;
              onClose();
              void onSubmit(
                JSON.stringify({
                  intent: 'copilot.data.collections',
                  sourceCode: source.code,
                  input: {},
                }),
              );
            }}
          >
            {copy.inspectCollections}
          </Button>
        ) : null}
        <Button
          variant="contained"
          startIcon={<ShellIcon name="search" />}
          disabled={disabled || !valid}
          onClick={() => {
            if (!valid || !source || submitted.current || !navigator.onLine) return;
            submitted.current = true;
            const input = database
              ? {
                  schemaName: collection!.schemaName,
                  search: search.trim(),
                  page: Number(page),
                }
              : {
                  correlationId: correlation,
                  from: new Date(from).toISOString(),
                  to: new Date(to).toISOString(),
                };
            onClose();
            void onSubmit(
              JSON.stringify({
                intent: database ? 'copilot.data.query' : 'copilot.logs.query',
                sourceCode: source.code,
                input,
              }),
            );
          }}
        >
          {copy.submit}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
