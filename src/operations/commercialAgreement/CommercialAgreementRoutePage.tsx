/** Exact native agreement workspace: owner admission, CMS copy, explicit review and retained-command recovery. */
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import { selectModuleConnection } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { resolveCmsPage } from '../../cms/cmsClient';
import { LoadingScreen } from '../../app/LoadingScreen';
import { RecoveryScreen } from '../../app/RecoveryScreen';
import { BackendWorkspaceHttpError } from '../../app/backendWorkspaceClient';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { AgreementTermsFields } from './AgreementTermsFields';
import { emptyAgreementTerms, prepareAgreementTerms } from './agreementDraft';
import {
  admitsAgreementWorkspace,
  canonical,
  parseAgreementCopy,
  loadAgreementWorkspace,
  searchAgreements,
  readAgreement,
  recordAgreement,
  retainedCommand,
  type AgreementConfiguration,
  type AgreementCopy,
  type AgreementWorkspace,
  type AgreementPage,
  type AgreementRecord,
  type AgreementCommand,
} from './agreementClient';

interface Props {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly navigation: AxisNavigationItem;
  readonly accessToken: string;
  readonly sessionGeneration: number;
  readonly runtime: AxisRuntimeConfig;
  readonly cmsBaseUrl: string;
  readonly site: string;
  readonly locale: string;
  readonly channel: string;
}
/** Remounts private state only for a changed authority/binding, not equivalent bootstrap object refreshes. */
export function CommercialAgreementRoutePage(props: Props) {
  if (!admitsAgreementWorkspace(props.navigation))
    return <Alert severity="warning">{props.navigation.label}</Alert>;
  const identity = canonical({
    token: props.accessToken,
    generation: props.sessionGeneration,
    tenant: props.bootstrap.tenantCode,
    enterprise: props.runtime.enterpriseCode,
    navigation: props.navigation,
    connection: selectModuleConnection(
      props.bootstrap,
      'commercialAgreement',
      props.navigation.backendWorkspace?.ownerSelector,
    ),
    cms: props.cmsBaseUrl,
    site: props.site,
    locale: props.locale,
    channel: props.channel,
  });
  return <AgreementSession key={identity} {...props} />;
}

/** One scoped browser session; all asynchronous continuations are retired on unmount/context replacement. */
function AgreementSession(props: Props) {
  const [configuration] = useState<AgreementConfiguration>(() => ({
    bootstrap: props.bootstrap,
    navigation: props.navigation,
    accessToken: props.accessToken,
    sessionGeneration: props.sessionGeneration,
    enterpriseCode: props.runtime.enterpriseCode,
    timeoutMs: props.runtime.requestTimeoutMs,
  }));
  const [copy, setCopy] = useState<AgreementCopy>(),
    [cmsError, setCmsError] = useState(''),
    [cmsAttempt, setCmsAttempt] = useState(0);
  const [workspace, setWorkspace] = useState<AgreementWorkspace>(),
    [page, setPage] = useState<AgreementPage>();
  const [target, setTarget] = useState(props.runtime.enterpriseCode),
    [record, setRecord] = useState<AgreementRecord>(),
    [version, setVersion] = useState(1);
  const [draft, setDraft] = useState<AgreementCommand>(),
    [review, setReview] = useState<AgreementCommand>(),
    [discard, setDiscard] = useState(false);
  const [uncertain, setUncertain] = useState(false),
    [inspected, setInspected] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const live = useRef(true),
    epoch = useRef(0),
    flight = useRef(false);
  const mutation = useMutation({
    mutationFn: async (input: {
      workspace: AgreementWorkspace;
      command: AgreementCommand;
    }) => recordAgreement(configuration, input.workspace, input.command),
  });
  useEffect(() => {
    const activeEpoch = epoch;
    live.current = true;
    return () => {
      live.current = false;
      activeEpoch.current++;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void resolveCmsPage({
      cmsBaseUrl: props.cmsBaseUrl,
      enterpriseCode: configuration.enterpriseCode,
      accessToken: configuration.accessToken,
      timeoutMs: configuration.timeoutMs,
      site: props.site,
      path: props.navigation.route,
      locale: props.locale,
      channel: props.channel,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted || !live.current) return;
        if (
          !result.page ||
          result.page.path !== props.navigation.route ||
          result.page.site !== props.site
        )
          throw new Error('CMS returned no matching page.');
        setCopy(parseAgreementCopy(result.page));
        setCmsError('');
      })
      .catch((reason) => {
        if (!controller.signal.aborted && live.current)
          setCmsError(
            reason instanceof Error ? reason.message : 'CMS delivery failed.',
          );
      });
    return () => controller.abort();
  }, [
    cmsAttempt,
    configuration,
    props.cmsBaseUrl,
    props.site,
    props.navigation.route,
    props.locale,
    props.channel,
  ]);

  const current = (attempt: number) => live.current && attempt === epoch.current;
  /** Refresh reads never grant access; a failed fresh read removes stale evidence and commands. */
  const load = async (enterprise = target, number = 1) => {
    if (flight.current || draft) return;
    const attempt = ++epoch.current;
    flight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setRecord(undefined);
    setPage(undefined);
    setWorkspace(undefined);
    try {
      const loaded = await loadAgreementWorkspace(configuration, enterprise);
      if (!current(attempt)) return;
      const found = await searchAgreements(configuration, loaded, number);
      if (current(attempt)) {
        setWorkspace(loaded);
        setPage(found);
      }
    } catch {
      if (current(attempt)) setError(copy!.unavailable);
    } finally {
      if (current(attempt)) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  const inspect = async (code: string) => {
    if (!workspace || flight.current || draft) return;
    const attempt = ++epoch.current;
    flight.current = true;
    setBusy(true);
    setRecord(undefined);
    setError('');
    setNotice('');
    try {
      const found = await readAgreement(configuration, workspace, code);
      if (current(attempt)) {
        setRecord(found);
        setVersion(found.revision);
      }
    } catch {
      if (current(attempt)) setError(copy!.unavailable);
    } finally {
      if (current(attempt)) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  /** Rechecks admission then reads exact history. An absent record remains uncertain, never fabricated. */
  const recover = async () => {
    if (!draft || !workspace || flight.current) return;
    const attempt = ++epoch.current;
    flight.current = true;
    setBusy(true);
    setError('');
    setInspected(false);
    let freshManage = false;
    try {
      const fresh = await loadAgreementWorkspace(configuration, draft.enterpriseCode);
      if (!current(attempt)) return;
      setWorkspace(fresh);
      freshManage = fresh.availableCommands.includes('record');
      const found = await readAgreement(configuration, fresh, draft.code);
      if (!current(attempt)) return;
      setRecord(found);
      setVersion(found.revision);
      if (retainedCommand(found, draft)) {
        setDraft(undefined);
        setUncertain(false);
        setNotice(copy!.recorded);
      } else {
        setInspected(fresh.availableCommands.includes('record'));
        setError(copy!.uncertain);
      }
    } catch (reason) {
      if (current(attempt)) {
        setInspected(
          freshManage &&
            reason instanceof BackendWorkspaceHttpError &&
            reason.code === 'ERR_AGREEMENT_MISSING',
        );
        setError(copy!.uncertain);
      }
    } finally {
      if (current(attempt)) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  /** The exact reviewed snapshot is sent once; late acknowledgement cannot trigger a dependent owner read. */
  const confirm = async () => {
    if (!workspace || !review || flight.current) return;
    const command = review,
      attempt = ++epoch.current;
    flight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setDraft(command);
    setInspected(false);
    try {
      await mutation.mutateAsync({ workspace, command });
      if (!current(attempt)) return;
      const found = await readAgreement(configuration, workspace, command.code);
      if (!current(attempt)) return;
      if (!retainedCommand(found, command)) throw new Error();
      setRecord(found);
      setVersion(found.revision);
      setDraft(undefined);
      setUncertain(false);
      setNotice(copy!.recorded);
      try {
        const foundPage = await searchAgreements(
          configuration,
          workspace,
          page?.pageNumber || 1,
        );
        if (current(attempt)) setPage(foundPage);
      } catch {
        if (current(attempt)) {
          setPage(undefined);
          setError(copy!.unavailable);
        }
      }
    } catch {
      if (current(attempt)) {
        setUncertain(true);
        setError(copy!.uncertain);
      }
    } finally {
      if (current(attempt)) {
        setReview(undefined);
        flight.current = false;
        setBusy(false);
      }
    }
  };
  const begin = (amend: boolean) => {
    if (!workspace || !workspace.availableCommands.includes('record') || busy) return;
    const latest = record?.versions.at(-1);
    if (amend && !latest) return;
    setDraft({
      code: amend ? record!.code : '',
      enterpriseCode: workspace.enterpriseCode,
      commandId: crypto.randomUUID(),
      expectedRevision: amend ? record!.revision : 0,
      terms: amend ? structuredClone(latest!.terms) : emptyAgreementTerms(),
    });
    setUncertain(false);
    setInspected(false);
    setNotice('');
    setError('');
  };
  if (!copy)
    return cmsError ? (
      <RecoveryScreen
        state={{ kind: 'cms', detail: cmsError, retryable: true }}
        onRetry={() => {
          setCmsError('');
          setCmsAttempt((value) => value + 1);
        }}
      />
    ) : (
      <LoadingScreen />
    );
  const selected = record?.versions[version - 1];
  const canRecord = !!workspace?.availableCommands.includes('record');
  return (
    <WorkspaceContainer>
      <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography component="h1" variant="h6">
          {copy.title}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            size="small"
            label={copy.enterpriseCode}
            value={target}
            disabled={busy || !!draft}
            onChange={(event) => {
              epoch.current++;
              setTarget(event.target.value);
              setWorkspace(undefined);
              setRecord(undefined);
              setPage(undefined);
              setError('');
              setNotice('');
            }}
          />
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={busy || !!draft || !target.trim()}
            onClick={() => void load()}
          >
            {copy.search}
          </Button>
          {canRecord && (
            <Button
              startIcon={<ShellIcon name="add" />}
              disabled={busy || !!draft}
              onClick={() => begin(false)}
            >
              {copy.create}
            </Button>
          )}
        </Stack>
        {busy && <Typography role="status">{copy.working}</Typography>}
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        {page && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0,1fr)',
                md: 'minmax(200px, 1fr) minmax(0,3fr)',
              },
              gap: 2,
            }}
          >
            <Stack sx={{ minWidth: 0 }}>
              {!page.agreements.length && <Typography>{copy.empty}</Typography>}
              <List aria-label={copy.title}>
                {page.agreements.map((item) => (
                  <ListItemButton
                    key={item.code}
                    disabled={busy || !!draft}
                    selected={record?.code === item.code}
                    onClick={() => void inspect(item.code)}
                  >
                    <ListItemText
                      primary={item.code}
                      secondary={copy.revision + ': ' + item.revision}
                    />
                  </ListItemButton>
                ))}
              </List>
              <Stack direction="row" spacing={1}>
                <Tooltip title={copy.previous}>
                  <span>
                    <IconButton
                      aria-label={copy.previous}
                      disabled={busy || !!draft || page.pageNumber <= 1}
                      onClick={() =>
                        void load(workspace!.enterpriseCode, page.pageNumber - 1)
                      }
                    >
                      <ShellIcon name="chevron-left" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Typography sx={{ alignSelf: 'center' }}>{page.pageNumber}</Typography>
                <Tooltip title={copy.next}>
                  <span>
                    <IconButton
                      aria-label={copy.next}
                      disabled={busy || !!draft || !page.hasMore}
                      onClick={() =>
                        void load(workspace!.enterpriseCode, page.pageNumber + 1)
                      }
                    >
                      <ShellIcon name="chevron-right" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              {!selected && !draft && <Typography>{copy.selectAgreement}</Typography>}
              {selected && !draft && workspace && (
                <>
                  <Typography component="h2" variant="subtitle1">
                    {copy.history}: {record.code}
                  </Typography>
                  <TextField
                    select
                    size="small"
                    label={copy.version}
                    value={version}
                    onChange={(event) => setVersion(Number(event.target.value))}
                  >
                    {record.versions.map((item) => (
                      <MenuItem key={item.version} value={item.version}>
                        {item.version}: {item.terms.effectiveFrom}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Typography>
                    {copy.actor}: {selected.actor}
                  </Typography>
                  <Typography>
                    {copy.recordedAt}: {selected.recordedAt}
                  </Typography>
                  <Typography>
                    {copy.agreedPrice}: {selected.agreedPrice.unitAmount}{' '}
                    {selected.agreedPrice.currency}
                  </Typography>
                  <Typography>
                    {copy.commandId}: {selected.commandId}
                  </Typography>
                  {canRecord && (
                    <Button
                      startIcon={<ShellIcon name="content" />}
                      disabled={
                        busy || record.revision >= workspace.limits.maximumVersions
                      }
                      onClick={() => begin(true)}
                    >
                      {copy.amend}
                    </Button>
                  )}
                  <AgreementTermsFields
                    terms={selected.terms}
                    workspace={workspace}
                    copy={copy}
                    readOnly
                  />
                </>
              )}
            </Stack>
          </Box>
        )}
        {draft && workspace && (
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || uncertain) return;
              try {
                const command = { ...draft, terms: prepareAgreementTerms(draft.terms) };
                setReview(command);
                setError('');
              } catch {
                setError(copy.invalid);
              }
            }}
          >
            <Stack spacing={2}>
              <TextField
                size="small"
                label={copy.code}
                value={draft.code}
                required
                disabled={draft.expectedRevision > 0 || busy || uncertain}
                onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              />
              <Typography>
                {copy.enterpriseCode}: {draft.enterpriseCode}
              </Typography>
              <Typography>
                {copy.revision}: {draft.expectedRevision}
              </Typography>
              <Typography>
                {copy.commandId}: {draft.commandId}
              </Typography>
              <AgreementTermsFields
                terms={draft.terms}
                workspace={workspace}
                copy={copy}
                readOnly={busy || uncertain}
                onChange={(terms) => setDraft({ ...draft, terms })}
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {!uncertain && (
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<ShellIcon name="approve" />}
                    disabled={busy || !canRecord}
                  >
                    {copy.review}
                  </Button>
                )}
                {uncertain && (
                  <Button
                    startIcon={<ShellIcon name="refresh" />}
                    disabled={busy}
                    onClick={() => void recover()}
                  >
                    {copy.inspect}
                  </Button>
                )}
                {uncertain && inspected && (
                  <Button
                    startIcon={<ShellIcon name="refresh" />}
                    disabled={busy || !canRecord}
                    onClick={() => setReview(draft)}
                  >
                    {copy.retry}
                  </Button>
                )}
                <Button
                  startIcon={<ShellIcon name="close" />}
                  disabled={busy}
                  onClick={() => setDiscard(true)}
                >
                  {copy.discard}
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
        <Dialog
          open={!!review}
          fullWidth
          maxWidth="md"
          onClose={() => {
            if (!busy) setReview(undefined);
          }}
        >
          <DialogTitle>{copy.review}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              <Typography>
                {copy.code}: {review?.code}
              </Typography>
              <Typography>
                {copy.enterpriseCode}: {review?.enterpriseCode}
              </Typography>
              <Typography>
                {copy.revision}: {review?.expectedRevision}
              </Typography>
              <Typography>
                {copy.commandId}: {review?.commandId}
              </Typography>
              {review && workspace && (
                <AgreementTermsFields
                  terms={review.terms}
                  workspace={workspace}
                  copy={copy}
                  readOnly
                />
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setReview(undefined)}>
              {copy.cancel}
            </Button>
            <Button
              startIcon={<ShellIcon name="approve" />}
              disabled={busy || !canRecord}
              onClick={() => void confirm()}
            >
              {copy.confirm}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={discard} onClose={() => setDiscard(false)}>
          <DialogTitle>{copy.discardTitle}</DialogTitle>
          <DialogActions>
            <Button onClick={() => setDiscard(false)}>{copy.cancel}</Button>
            <Button
              onClick={() => {
                setDraft(undefined);
                setReview(undefined);
                setUncertain(false);
                setInspected(false);
                setDiscard(false);
                setError('');
              }}
            >
              {copy.discard}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
