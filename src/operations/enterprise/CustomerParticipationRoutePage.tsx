/** Explicit Profile-owned customer terms consumer; accepting consent never switches the Employee session. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
interface TermsWorkspace {
  contractVersion: 1;
  owner: 'profile';
  enterpriseCode: string;
  participation: {
    phase: 'COMPLETE' | 'WITHDRAWN';
    revision: number;
    currentTerms: boolean;
    canSwitch: boolean;
  } | null;
  lifecycleQualified: boolean;
  terms: {
    version: string;
    digest: string;
    documentCode: string;
    title: string;
    content: string;
  };
  presentation: {
    title: string;
    refreshLabel: string;
    consentLabel: string;
    acceptLabel: string;
    acceptedMessage: string;
    uncertainMessage: string;
    renewLabel: string;
    withdrawLabel: string;
    withdrawReviewTitle: string;
    confirmLabel: string;
    cancelLabel: string;
  };
}
/** Validates inert document/presentation bounds before displaying anything as consent evidence. */
function parseCustomerTermsWorkspace(
  value: unknown,
  enterpriseCode: string,
): TermsWorkspace {
  if (!value || typeof value !== 'object')
    throw new Error('Customer terms are unavailable.');
  const source = value as TermsWorkspace,
    terms = source.terms,
    copy = source.presentation;
  if (
    source.contractVersion !== 1 ||
    source.owner !== 'profile' ||
    source.enterpriseCode !== enterpriseCode ||
    !terms ||
    !copy ||
    !/^[a-f0-9]{64}$/.test(terms.digest) ||
    Object.values(copy).some(
      (item) => typeof item !== 'string' || !item || item.length > 2000,
    ) ||
    [
      'title',
      'refreshLabel',
      'consentLabel',
      'acceptLabel',
      'acceptedMessage',
      'uncertainMessage',
      'renewLabel',
      'withdrawLabel',
      'withdrawReviewTitle',
      'confirmLabel',
      'cancelLabel',
    ].some((key) => !Object.hasOwn(copy, key)) ||
    typeof terms.content !== 'string' ||
    !terms.content ||
    terms.content.length > 100000 ||
    typeof terms.title !== 'string' ||
    !terms.title ||
    terms.title.length > 192 ||
    typeof terms.version !== 'string' ||
    !terms.version ||
    terms.version.length > 128 ||
    typeof terms.documentCode !== 'string' ||
    !terms.documentCode ||
    terms.documentCode.length > 192
  )
    throw new Error('Customer terms are unavailable.');
  if (
    typeof source.lifecycleQualified !== 'boolean' ||
    (source.participation !== null &&
      (!source.participation ||
        !['COMPLETE', 'WITHDRAWN'].includes(source.participation.phase) ||
        !Number.isSafeInteger(source.participation.revision) ||
        source.participation.revision < 1))
  )
    throw new Error('Customer participation could not be confirmed.');
  if (
    source.participation &&
    (typeof source.participation.currentTerms !== 'boolean' ||
      typeof source.participation.canSwitch !== 'boolean' ||
      (source.participation.currentTerms &&
        source.participation.phase !== 'COMPLETE') ||
      (source.participation.canSwitch && !source.participation.currentTerms))
  )
    throw new Error('Customer participation could not be confirmed.');
  return {
    contractVersion: 1,
    owner: 'profile',
    enterpriseCode,
    lifecycleQualified: source.lifecycleQualified,
    participation:
      source.participation === null
        ? null
        : {
            phase: source.participation.phase,
            revision: source.participation.revision,
            currentTerms: source.participation.currentTerms,
            canSwitch: source.participation.canSwitch,
          },
    terms: {
      version: terms.version,
      digest: terms.digest,
      documentCode: terms.documentCode,
      title: terms.title,
      content: terms.content,
    },
    presentation: {
      title: copy.title,
      refreshLabel: copy.refreshLabel,
      consentLabel: copy.consentLabel,
      acceptLabel: copy.acceptLabel,
      acceptedMessage: copy.acceptedMessage,
      uncertainMessage: copy.uncertainMessage,
      renewLabel: copy.renewLabel,
      withdrawLabel: copy.withdrawLabel,
      withdrawReviewTitle: copy.withdrawReviewTitle,
      confirmLabel: copy.confirmLabel,
      cancelLabel: copy.cancelLabel,
    },
  };
}
/** Keeps consent unchecked across actor/terms changes and discards late responses. */
export function CustomerParticipationRoutePage({
  bootstrap,
  accessToken,
  runtime,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
}) {
  const configuration = useMemo(
    () => ({
      bootstrap,
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [bootstrap, accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const [snapshot, setSnapshot] = useState<{
    configuration: typeof configuration;
    workspace: TermsWorkspace;
  }>();
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const version = useRef(0),
    inFlight = useRef(false);
  const [withdrawReview, setWithdrawReview] = useState(false);
  const [acceptReview, setAcceptReview] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const workspace =
    snapshot?.configuration === configuration ? snapshot.workspace : undefined;
  useEffect(() => {
    const attempt = ++version.current;
    setSnapshot(undefined);
    setConsent(false);
    setWithdrawReview(false);
    setAcceptReview(false);
    setError('');
    setNotice('');
    setBusy(true);
    inFlight.current = true;
    void invokeOperationalOwner(
      configuration,
      'profile',
      '/customer/participation/workspace',
    )
      .then((value) => {
        const next = parseCustomerTermsWorkspace(value, configuration.enterpriseCode);
        if (attempt === version.current)
          setSnapshot({ configuration, workspace: next });
      })
      .catch((reason) => {
        if (attempt === version.current)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Customer terms are unavailable.',
          );
      })
      .finally(() => {
        if (attempt === version.current) {
          setBusy(false);
          inFlight.current = false;
        }
      });
    const epoch = version;
    return () => {
      epoch.current++;
    };
  }, [configuration, reloadVersion]);
  const accept = async () => {
    if (
      !workspace ||
      !consent ||
      !acceptReview ||
      inFlight.current ||
      workspace.participation?.phase === 'WITHDRAWN' ||
      workspace.participation?.currentTerms === true ||
      (workspace.participation && !workspace.lifecycleQualified)
    )
      return;
    const attempt = version.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await invokeOperationalOwner<{
        accepted?: unknown;
        enterpriseCode?: unknown;
        revision?: unknown;
      }>(
        configuration,
        'profile',
        workspace.participation
          ? '/customer/participation/renew'
          : '/customer/participation/accept',
        {
          ...(workspace.participation
            ? { revision: workspace.participation.revision }
            : {}),
          termsVersion: workspace.terms.version,
          termsDigest: workspace.terms.digest,
          accepted: true,
        },
      );
      if (
        result.accepted !== true ||
        result.enterpriseCode !== workspace.enterpriseCode ||
        result.revision !==
          (workspace.participation ? workspace.participation.revision + 1 : 1)
      )
        throw new Error('Customer acceptance could not be confirmed.');
      if (attempt === version.current) {
        setNotice(workspace.presentation.acceptedMessage);
        setConsent(false);
        setAcceptReview(false);
        setSnapshot(undefined);
      }
    } catch {
      if (attempt === version.current) {
        setError(workspace.presentation.uncertainMessage);
        setConsent(false);
        setAcceptReview(false);
        setSnapshot(undefined);
      }
    } finally {
      if (attempt === version.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  };
  const withdraw = async () => {
    if (
      !workspace?.lifecycleQualified ||
      !withdrawReview ||
      workspace.participation?.phase !== 'COMPLETE' ||
      inFlight.current
    )
      return;
    const attempt = version.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await invokeOperationalOwner<{
        phase?: unknown;
        revision?: unknown;
        enterpriseCode?: unknown;
      }>(configuration, 'profile', '/customer/participation/withdraw', {
        revision: workspace.participation.revision,
        confirmed: true,
      });
      if (
        result.phase !== 'WITHDRAWN' ||
        result.revision !== workspace.participation.revision + 1 ||
        result.enterpriseCode !== workspace.enterpriseCode
      )
        throw new Error('Customer withdrawal could not be confirmed.');
      if (attempt === version.current) {
        setSnapshot(undefined);
        setConsent(false);
        setWithdrawReview(false);
      }
    } catch {
      if (attempt === version.current) {
        setError(workspace.presentation.uncertainMessage);
        setSnapshot(undefined);
        setWithdrawReview(false);
      }
    } finally {
      if (attempt === version.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  };
  return (
    <WorkspaceContainer>
      <Stack spacing={2}>
        <Button
          startIcon={<ShellIcon name="refresh" />}
          disabled={busy}
          onClick={() => setReloadVersion((value) => value + 1)}
        >
          {workspace?.presentation.refreshLabel || 'Refresh'}
        </Button>
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        {busy && !workspace && <Typography role="status">Loading…</Typography>}
        {workspace && (
          <>
            <Typography variant="h6">{workspace.presentation.title}</Typography>
            <Typography variant="subtitle1">{workspace.terms.title}</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {workspace.terms.content}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={consent}
                  disabled={
                    busy ||
                    acceptReview ||
                    workspace.participation?.phase === 'WITHDRAWN' ||
                    workspace.participation?.currentTerms === true
                  }
                  onChange={(event) => setConsent(event.target.checked)}
                />
              }
              label={workspace.presentation.consentLabel}
            />
            <Button
              disabled={
                busy ||
                !consent ||
                workspace.participation?.phase === 'WITHDRAWN' ||
                workspace.participation?.currentTerms === true ||
                (!!workspace.participation && !workspace.lifecycleQualified)
              }
              startIcon={<ShellIcon name="approve" />}
              onClick={() => setAcceptReview(true)}
            >
              {workspace.participation
                ? workspace.presentation.renewLabel
                : workspace.presentation.acceptLabel}
            </Button>
            <Dialog
              open={acceptReview}
              onClose={() => {
                if (!busy) setAcceptReview(false);
              }}
            >
              <DialogTitle>{workspace.terms.title}</DialogTitle>
              <DialogContent>
                <Stack spacing={1} sx={{ overflowWrap: 'anywhere' }}>
                  <Typography>{workspace.enterpriseCode}</Typography>
                  <Typography>{workspace.terms.documentCode}</Typography>
                  <Typography>{workspace.terms.version}</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {workspace.terms.content}
                  </Typography>
                  <Typography>{workspace.presentation.consentLabel}</Typography>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button disabled={busy} onClick={() => setAcceptReview(false)}>
                  {workspace.presentation.cancelLabel}
                </Button>
                <Button disabled={busy || !consent} onClick={() => void accept()}>
                  {workspace.presentation.confirmLabel}
                </Button>
              </DialogActions>
            </Dialog>
            {workspace.lifecycleQualified &&
              workspace.participation?.phase === 'COMPLETE' && (
                <Button
                  startIcon={<ShellIcon name="close" />}
                  disabled={busy}
                  onClick={() => setWithdrawReview(true)}
                >
                  {workspace.presentation.withdrawLabel}
                </Button>
              )}
            <Dialog
              open={withdrawReview}
              onClose={() => {
                if (!busy) setWithdrawReview(false);
              }}
            >
              <DialogTitle>{workspace.presentation.withdrawReviewTitle}</DialogTitle>
              <DialogContent>
                <Typography>{workspace.enterpriseCode}</Typography>
              </DialogContent>
              <DialogActions>
                <Button disabled={busy} onClick={() => setWithdrawReview(false)}>
                  {workspace.presentation.cancelLabel}
                </Button>
                <Button disabled={busy} onClick={() => void withdraw()}>
                  {workspace.presentation.confirmLabel}
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Stack>
    </WorkspaceContainer>
  );
}
