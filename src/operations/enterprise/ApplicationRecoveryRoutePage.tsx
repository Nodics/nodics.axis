/** Profile application recovery consumer; Process retains approval and rejection authority. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
type Action = 'RETRY_REVIEW_START' | 'RETRY_NOTIFICATION' | 'RETRY_REVIEW_RETIREMENT';
interface RetirementAttempt {
  attempt: number;
  status: 'WITHDRAWN' | 'EXPIRED';
  closedAt?: string;
  reviewStarted: boolean;
  canRetireReview: boolean;
}
interface Recovery {
  application: {
    code: string;
    enterpriseCode: string;
    revision: number;
    status: string;
    reviewStatus: string;
    reviewInstanceCode?: string;
    notificationStatus: string;
    canRetireReview?: boolean;
    reviewRetirementAttempts?: readonly RetirementAttempt[];
  };
  presentation: Record<
    | 'title'
    | 'inspectLabel'
    | 'reviewTitle'
    | Action
    | 'confirmLabel'
    | 'cancelLabel'
    | 'uncertainMessage',
    string
  >;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Application recovery is unavailable.');
  return value as Record<string, unknown>;
}
function retirementAttempt(value: unknown): RetirementAttempt {
  const entry = record(value);
  if (
    typeof entry.attempt !== 'number' ||
    !Number.isSafeInteger(entry.attempt) ||
    entry.attempt < 1 ||
    entry.attempt > 20 ||
    (entry.status !== 'WITHDRAWN' && entry.status !== 'EXPIRED') ||
    typeof entry.reviewStarted !== 'boolean' ||
    typeof entry.canRetireReview !== 'boolean' ||
    (entry.closedAt !== undefined &&
      (typeof entry.closedAt !== 'string' ||
        entry.closedAt.length > 64 ||
        !Number.isFinite(Date.parse(entry.closedAt))))
  )
    throw new Error('Application recovery is unavailable.');
  return {
    attempt: entry.attempt,
    status: entry.status,
    reviewStarted: entry.reviewStarted,
    canRetireReview: entry.canRetireReview,
    ...(entry.closedAt === undefined ? {} : { closedAt: entry.closedAt }),
  };
}
/** Projects allowlisted inert fields rather than retaining private application payloads. */
function parse(value: unknown, code: string): Recovery {
  const source = record(value);
  const item = record(source.application),
    copy = record(source.presentation);
  if (
    source.contractVersion !== 1 ||
    source.owner !== 'profile' ||
    typeof item.code !== 'string' ||
    item.code !== code ||
    typeof item.revision !== 'number' ||
    !Number.isSafeInteger(item.revision) ||
    item.revision < 1 ||
    typeof item.enterpriseCode !== 'string' ||
    !/^[A-Za-z0-9_.:-]{1,128}$/.test(item.enterpriseCode) ||
    typeof item.status !== 'string' ||
    ![
      'AWAITING_REVIEW',
      'APPROVED',
      'REJECTED',
      'REGISTERED',
      'WITHDRAWN',
      'EXPIRED',
    ].includes(item.status) ||
    (item.canRetireReview !== undefined && typeof item.canRetireReview !== 'boolean') ||
    typeof item.reviewStatus !== 'string' ||
    !['STARTED', 'NOT_CONFIRMED'].includes(item.reviewStatus) ||
    typeof item.notificationStatus !== 'string' ||
    item.notificationStatus.length > 64 ||
    (item.reviewInstanceCode !== undefined &&
      (typeof item.reviewInstanceCode !== 'string' ||
        item.reviewInstanceCode.length > 192))
  )
    throw new Error('Application recovery is unavailable.');
  const presentation = {} as Recovery['presentation'];
  let attempts: RetirementAttempt[] | undefined;
  if (item.reviewRetirementAttempts !== undefined) {
    if (
      !Array.isArray(item.reviewRetirementAttempts) ||
      item.reviewRetirementAttempts.length > 20
    )
      throw new Error('Application recovery is unavailable.');
    attempts = item.reviewRetirementAttempts.map(retirementAttempt);
    if (new Set(attempts.map((entry) => entry.attempt)).size !== attempts.length)
      throw new Error('Application recovery is unavailable.');
  }
  for (const key of [
    'title',
    'inspectLabel',
    'reviewTitle',
    'RETRY_REVIEW_START',
    'RETRY_NOTIFICATION',
    'RETRY_REVIEW_RETIREMENT',
    'confirmLabel',
    'cancelLabel',
    'uncertainMessage',
  ] as const) {
    if (typeof copy[key] !== 'string' || !copy[key] || copy[key].length > 2000)
      throw new Error('Application recovery is unavailable.');
    presentation[key] = copy[key];
  }
  return {
    application: {
      code: item.code,
      enterpriseCode: item.enterpriseCode,
      revision: item.revision,
      status: item.status,
      reviewStatus: item.reviewStatus,
      ...(item.reviewInstanceCode === undefined
        ? {}
        : { reviewInstanceCode: item.reviewInstanceCode }),
      notificationStatus: item.notificationStatus,
      canRetireReview:
        item.canRetireReview === true && ['WITHDRAWN', 'EXPIRED'].includes(item.status),
      ...(attempts === undefined ? {} : { reviewRetirementAttempts: attempts }),
    },
    presentation,
  };
}
/** Requires inspection and explicit review for one fixed command; uncertain writes are never automatically retried. */
export function ApplicationRecoveryRoutePage({
  bootstrap,
  accessToken,
  runtime,
  title,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
  readonly title: string;
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
  const [code, setCode] = useState(''),
    [snapshot, setSnapshot] = useState<{
      configuration: typeof configuration;
      recovery: Recovery;
    }>();
  const [busy, setBusy] = useState(false),
    [action, setAction] = useState<Action>(),
    [retirementAttempt, setRetirementAttempt] = useState<number>(),
    [error, setError] = useState('');
  const version = useRef(0),
    inFlight = useRef(false);
  const recovery =
    snapshot?.configuration === configuration ? snapshot.recovery : undefined;
  useEffect(() => {
    version.current++;
    setSnapshot(undefined);
    setAction(undefined);
    setRetirementAttempt(undefined);
    setBusy(false);
    setError('');
    inFlight.current = false;
    const epoch = version;
    return () => {
      epoch.current++;
    };
  }, [configuration]);
  const inspect = async () => {
    if (inFlight.current) return;
    const target = code.trim();
    if (!/^enterpriseAccess_[a-f0-9]{64}$/.test(target)) {
      setError('Enter a valid application reference.');
      return;
    }
    const attempt = ++version.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setSnapshot(undefined);
    setAction(undefined);
    setRetirementAttempt(undefined);
    try {
      const value = await invokeOperationalOwner(
        configuration,
        'profile',
        '/enterprise-access/applications/' + encodeURIComponent(target) + '/recovery',
      );
      const result = parse(value, target);
      if (attempt === version.current) setSnapshot({ configuration, recovery: result });
    } catch {
      if (attempt === version.current)
        setError('Application recovery could not be confirmed.');
    } finally {
      if (attempt === version.current) {
        setBusy(false);
        inFlight.current = false;
      }
    }
  };
  const confirm = async () => {
    if (!recovery || !action || inFlight.current) return;
    const attempt = version.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await invokeOperationalOwner<unknown>(
        configuration,
        'profile',
        '/enterprise-access/applications/' +
          encodeURIComponent(recovery.application.code) +
          '/actions',
        {
          operation: action,
          revision: recovery.application.revision,
          ...(action === 'RETRY_REVIEW_RETIREMENT' && retirementAttempt !== undefined
            ? { attempt: retirementAttempt }
            : {}),
        },
      );
      parse(
        {
          contractVersion: 1,
          owner: 'profile',
          application: result,
          presentation: recovery.presentation,
        },
        recovery.application.code,
      );
      if (
        action === 'RETRY_REVIEW_RETIREMENT' &&
        (!result ||
          typeof result !== 'object' ||
          (result as { retirementStatus?: unknown }).retirementStatus !== 'RETIRED')
      )
        throw new Error(recovery.presentation.uncertainMessage);
      if (attempt === version.current) {
        setSnapshot(undefined);
        setAction(undefined);
        setRetirementAttempt(undefined);
      }
    } catch {
      if (attempt === version.current) {
        setError(recovery.presentation.uncertainMessage);
        setSnapshot(undefined);
        setAction(undefined);
        setRetirementAttempt(undefined);
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
      <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="h6">{recovery?.presentation.title || title}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Application"
            value={code}
            disabled={busy}
            onChange={(event) => {
              setCode(event.target.value);
              setSnapshot(undefined);
              setAction(undefined);
              setRetirementAttempt(undefined);
            }}
            slotProps={{ htmlInput: { maxLength: 192 } }}
          />
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={busy || !code.trim()}
            onClick={() => void inspect()}
          >
            {recovery?.presentation.inspectLabel || 'Inspect'}
          </Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {busy && <Typography role="status">Working…</Typography>}
        {recovery && (
          <>
            <Typography>
              {recovery.application.enterpriseCode} / {recovery.application.status} /{' '}
              {recovery.application.reviewStatus}
            </Typography>
            {recovery.application.reviewInstanceCode && (
              <Typography>{recovery.application.reviewInstanceCode}</Typography>
            )}
            <Typography>{recovery.application.notificationStatus}</Typography>
            {(
              [
                'RETRY_REVIEW_START',
                'RETRY_NOTIFICATION',
                'RETRY_REVIEW_RETIREMENT',
              ] as const
            )
              .filter((value) =>
                value === 'RETRY_REVIEW_START'
                  ? recovery.application.status === 'AWAITING_REVIEW'
                  : value === 'RETRY_REVIEW_RETIREMENT'
                    ? recovery.application.canRetireReview === true &&
                      recovery.application.reviewRetirementAttempts === undefined
                    : ['APPROVED', 'REJECTED', 'REGISTERED'].includes(
                        recovery.application.status,
                      ),
              )
              .map((value) => (
                <Button
                  key={value}
                  startIcon={<ShellIcon name="refresh" />}
                  disabled={busy}
                  onClick={() => {
                    setRetirementAttempt(undefined);
                    setAction(value);
                  }}
                >
                  {recovery.presentation[value]}
                </Button>
              ))}
            {recovery.application.reviewRetirementAttempts?.map((item) => (
              <Stack key={item.attempt} spacing={0.5}>
                <Typography variant="body2">
                  #{item.attempt} / {item.status}
                </Typography>
                {item.closedAt && (
                  <Typography component="time" dateTime={item.closedAt} variant="body2">
                    {new Date(item.closedAt).toLocaleString()}
                  </Typography>
                )}
                {item.canRetireReview && (
                  <Button
                    disabled={busy}
                    startIcon={<ShellIcon name="refresh" />}
                    onClick={() => {
                      setRetirementAttempt(item.attempt);
                      setAction('RETRY_REVIEW_RETIREMENT');
                    }}
                  >
                    {recovery.presentation.RETRY_REVIEW_RETIREMENT} / #{item.attempt}
                  </Button>
                )}
              </Stack>
            ))}
          </>
        )}
        <Dialog
          open={!!action && !!recovery}
          onClose={() => {
            if (!busy) setAction(undefined);
          }}
        >
          <DialogTitle>{recovery?.presentation.reviewTitle}</DialogTitle>
          <DialogContent>
            <Typography>{recovery?.application.code}</Typography>
            <Typography>{action && recovery?.presentation[action]}</Typography>
            {retirementAttempt !== undefined && (
              <Typography>#{retirementAttempt}</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setAction(undefined)}>
              {recovery?.presentation.cancelLabel}
            </Button>
            <Button
              startIcon={<ShellIcon name="approve" />}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {recovery?.presentation.confirmLabel}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
