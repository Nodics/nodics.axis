/** Digital Core original-notification consumer; financial state, scope, frozen intents and retry eligibility remain backend-owned. */
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
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { invokeOperationalOwner } from '../shared/operationalOwnerClient';
type Kind = 'PURCHASED' | 'REFUNDED';
interface NotificationWorkspace {
  orderCode: string;
  orderRevision: number;
  financialState: string;
  featureState: 'ACTIVE' | 'DISABLED';
  title: string;
  events: {
    kind: Kind;
    status: string;
    retryEligible: boolean;
    outcomes: {
      channel: string;
      intentCode: string;
      status: string;
      revision?: number;
      observed: boolean;
    }[];
  }[];
  commands: {
    id: 'inspect' | 'retry';
    label: string;
    kindLabel: string;
    revisionLabel?: string;
    confirmedLabel?: string;
    enabled: boolean;
    eligibleKinds: Kind[];
  }[];
}
/** Accepts only the two published fixed commands, plain labels and redacted observation fields. */
function parse(value: unknown, code: string): NotificationWorkspace {
  const fail = () => {
    throw new Error('Order notifications could not be confirmed.');
  };
  const text = (value: unknown, max = 192): string =>
    typeof value === 'string' && value.length > 0 && value.length <= max
      ? value
      : fail();
  const source = value as Record<string, unknown> | null;
  if (
    !source ||
    source.contractVersion !== 1 ||
    source.workspaceCode !== 'commerce.orderNotifications' ||
    source.viewCode !== 'orderNotifications.detail' ||
    source.orderCode !== code ||
    !Number.isSafeInteger(source.orderRevision) ||
    Number(source.orderRevision) < 0 ||
    !['ACTIVE', 'DISABLED'].includes(String(source.featureState)) ||
    !Array.isArray(source.events) ||
    source.events.length !== 2 ||
    !Array.isArray(source.commands) ||
    source.commands.length !== 2
  )
    fail();
  const data = source!;
  const events = (data.events as Record<string, unknown>[]).map((event) => {
    if (
      !event ||
      !['PURCHASED', 'REFUNDED'].includes(String(event.kind)) ||
      typeof event.retryEligible !== 'boolean' ||
      !Array.isArray(event.outcomes) ||
      event.outcomes.length > 200
    )
      fail();
    const outcomes = (event.outcomes as Record<string, unknown>[]).map((item) => {
      if (
        !item ||
        !['EMAIL', 'SMS'].includes(String(item.channel)) ||
        typeof item.observed !== 'boolean' ||
        (item.observed === true && item.revision === undefined) ||
        !/^COMM_[a-f0-9]{64}$/.test(String(item.intentCode)) ||
        (item.revision !== undefined &&
          (!Number.isSafeInteger(item.revision) || Number(item.revision) < 0))
      )
        fail();
      return {
        channel: text(item.channel),
        intentCode: text(item.intentCode),
        status: text(item.status, 64),
        observed: item.observed as boolean,
        ...(item.revision === undefined ? {} : { revision: Number(item.revision) }),
      };
    });
    if (new Set(outcomes.map((item) => item.intentCode)).size !== outcomes.length)
      fail();
    return {
      kind: event.kind as Kind,
      status: text(event.status, 64),
      retryEligible: event.retryEligible as boolean,
      outcomes,
    };
  });
  const commands = (data.commands as Record<string, unknown>[]).map((command) => {
    const id = command.id;
    if (
      !['inspect', 'retry'].includes(String(id)) ||
      command.ownerModule !== 'digitalCore' ||
      command.handlerAction !== id ||
      command.httpMethod !== 'POST' ||
      command.operationRoute !== '/orders/:code/notifications/' + String(id) ||
      command.confirmationRequired !== (id === 'retry') ||
      typeof command.enabled !== 'boolean' ||
      !Array.isArray(command.eligibleKinds) ||
      command.eligibleKinds.some(
        (kind: unknown) =>
          typeof kind !== 'string' || !['PURCHASED', 'REFUNDED'].includes(kind),
      ) ||
      new Set(command.eligibleKinds).size !== command.eligibleKinds.length ||
      !Array.isArray(command.inputFields)
    )
      fail();
    const fields = command.inputFields as Record<string, unknown>[];
    const names = id === 'retry' ? ['kind', 'expectedRevision', 'confirmed'] : ['kind'];
    if (
      fields.length !== names.length ||
      fields.some(
        (field, index) =>
          !field || field.name !== names[index] || field.required !== true,
      ) ||
      fields[0]?.type !== 'SELECT' ||
      JSON.stringify(fields[0]?.options) !==
        JSON.stringify(['PURCHASED', 'REFUNDED']) ||
      (id === 'retry' &&
        (fields[1]?.type !== 'NUMBER' ||
          fields[1]?.hidden !== true ||
          fields[1]?.valueFromRecord !== 'orderRevision' ||
          fields[2]?.type !== 'BOOLEAN'))
    )
      fail();
    return {
      id: id as 'inspect' | 'retry',
      label: text(command.label),
      kindLabel: text(fields[0]?.label),
      enabled: command.enabled as boolean,
      eligibleKinds: [...(command.eligibleKinds as Kind[])],
      ...(id === 'retry'
        ? {
            revisionLabel: text(fields[1]?.label),
            confirmedLabel: text(fields[2]?.label),
          }
        : {}),
    };
  });
  if (
    new Set(events.map((item) => item.kind)).size !== 2 ||
    new Set(commands.map((item) => item.id)).size !== 2
  )
    fail();
  const presentation = data.presentation as Record<string, unknown> | null;
  return {
    orderCode: code,
    orderRevision: Number(data.orderRevision),
    financialState: text(data.financialState, 64),
    featureState: data.featureState as 'ACTIVE' | 'DISABLED',
    title: text(presentation?.title),
    events,
    commands,
  };
}
/** Looks up one explicitly entered order; no browser-query owner, recipient, template or intent selector is accepted. */
export function OrderNotificationRoutePage({
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
      workspace: NotificationWorkspace;
    }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [review, setReview] = useState<Kind>();
  const epoch = useRef(0),
    inFlight = useRef(false);
  const workspace =
    snapshot?.configuration === configuration ? snapshot.workspace : undefined;
  useEffect(() => {
    epoch.current++;
    inFlight.current = false;
    setSnapshot(undefined);
    setReview(undefined);
    setCode('');
    setBusy(false);
    setError('');
    setNotice('');
    const activeEpoch = epoch;
    return () => {
      activeEpoch.current++;
    };
  }, [configuration]);
  const load = async (target: string, attempt: number) => {
    const result = parse(
      await invokeOperationalOwner(
        configuration,
        'digitalCore',
        '/orders/' + encodeURIComponent(target) + '/notifications/workspace',
      ),
      target,
    );
    if (attempt === epoch.current) setSnapshot({ configuration, workspace: result });
  };
  /** A fresh owner workspace replaces all availability metadata; failures remove retry controls. */
  const inspect = async () => {
    const target = code.trim();
    if (inFlight.current || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(target)) return;
    const attempt = ++epoch.current;
    inFlight.current = true;
    setBusy(true);
    setSnapshot(undefined);
    setReview(undefined);
    setError('');
    setNotice('');
    try {
      await load(target, attempt);
    } catch {
      if (attempt === epoch.current)
        setError('Order notifications could not be confirmed.');
    } finally {
      if (attempt === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  /** Sends a declared fixed command once. Retry acknowledgement is not message delivery or financial success. */
  const command = async (id: 'inspect' | 'retry', kind: Kind) => {
    const declaration = workspace?.commands.find((item) => item.id === id);
    if (
      !workspace ||
      workspace.featureState !== 'ACTIVE' ||
      !declaration?.enabled ||
      !declaration.eligibleKinds.includes(kind) ||
      (id === 'retry' &&
        !workspace.events.find((event) => event.kind === kind)?.retryEligible) ||
      inFlight.current
    )
      return;
    const attempt = epoch.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await invokeOperationalOwner<Record<string, unknown>>(
        configuration,
        'digitalCore',
        '/orders/' + encodeURIComponent(workspace.orderCode) + '/notifications/' + id,
        {
          kind,
          ...(id === 'retry'
            ? { expectedRevision: workspace.orderRevision, confirmed: true }
            : {}),
        },
      );
      if (id === 'inspect') {
        if (
          result.orderCode !== workspace.orderCode ||
          !Number.isSafeInteger(result.orderRevision) ||
          result.kind !== kind
        )
          throw new Error();
        await load(workspace.orderCode, attempt);
      } else {
        const originals =
          workspace.events
            .find((event) => event.kind === kind)
            ?.outcomes.map((item) => item.intentCode) || [];
        if (
          result.status !== 'REQUESTED' ||
          !Array.isArray(result.outcomes) ||
          result.outcomes.length < 1 ||
          result.outcomes.length > 200
        )
          throw new Error();
        const intentCodes = (result.outcomes as unknown[]).map((value) => {
          if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error();
          const item = value as Record<string, unknown>;
          if (
            typeof item.intentCode !== 'string' ||
            !originals.includes(item.intentCode) ||
            typeof item.status !== 'string' ||
            !item.status ||
            item.status.length > 64
          )
            throw new Error();
          return item.intentCode;
        });
        if (new Set(intentCodes).size !== intentCodes.length) throw new Error();
        if (attempt === epoch.current)
          setNotice(
            'Retry was requested. Inspect current state before another action.',
          );
      }
    } catch {
      if (attempt === epoch.current) {
        setSnapshot(undefined);
        setError(
          'The notification outcome is unconfirmed. Inspect current state before another action.',
        );
      }
    } finally {
      if (attempt === epoch.current) {
        if (id === 'retry') setSnapshot(undefined);
        setReview(undefined);
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const retry = workspace?.commands.find((item) => item.id === 'retry');
  return (
    <WorkspaceContainer>
      <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="h6">{workspace?.title || title}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            label="Order reference"
            value={code}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 128 } }}
            onChange={(event) => {
              epoch.current++;
              setCode(event.target.value);
              setSnapshot(undefined);
              setReview(undefined);
              setError('');
              setNotice('');
            }}
          />
          <Button
            startIcon={<ShellIcon name="search" />}
            disabled={busy || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(code.trim())}
            onClick={() => void inspect()}
          >
            Inspect
          </Button>
        </Stack>
        {busy && <Typography role="status">Working…</Typography>}
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="info">{notice}</Alert>}
        {workspace && (
          <>
            <Typography>
              {workspace.orderCode} / {workspace.financialState} /{' '}
              {workspace.orderRevision}
            </Typography>
            {workspace.featureState === 'DISABLED' && (
              <Typography role="status">DISABLED</Typography>
            )}
            {workspace.events.map((event) => (
              <Stack key={event.kind} spacing={1}>
                <Typography>
                  {event.kind} / {event.status}
                </Typography>
                {event.outcomes.map((item) => (
                  <Typography key={item.intentCode}>
                    {item.channel} / {item.status} / {item.revision ?? '-'} /{' '}
                    {String(item.observed)}
                  </Typography>
                ))}
                {workspace.commands.map((declaration) => (
                  <Button
                    key={declaration.id}
                    startIcon={<ShellIcon name="refresh" />}
                    disabled={
                      busy ||
                      workspace.featureState !== 'ACTIVE' ||
                      !declaration.enabled ||
                      !declaration.eligibleKinds.includes(event.kind)
                    }
                    onClick={() =>
                      declaration.id === 'retry'
                        ? setReview(event.kind)
                        : void command('inspect', event.kind)
                    }
                  >
                    {declaration.label}
                  </Button>
                ))}
              </Stack>
            ))}
          </>
        )}
        <Dialog
          open={!!review && !!workspace}
          onClose={() => {
            if (!busy) setReview(undefined);
          }}
        >
          <DialogTitle>{retry?.label}</DialogTitle>
          <DialogContent>
            <Stack spacing={1}>
              <Typography>{workspace?.orderCode}</Typography>
              <Typography>
                {retry?.kindLabel}: {review}
              </Typography>
              <Typography>
                {retry?.revisionLabel}: {workspace?.orderRevision}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setReview(undefined)}>
              Cancel
            </Button>
            <Button
              startIcon={<ShellIcon name="refresh" />}
              disabled={busy || !review || !retry?.enabled}
              onClick={() => {
                if (review) void command('retry', review);
              }}
            >
              {retry?.confirmedLabel}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </WorkspaceContainer>
  );
}
