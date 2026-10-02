/** Profile-owned consent task; the browser selects inert options and never grants hierarchy authority. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { ShellIcon } from '../../app/shell/ShellIcon';
import { WorkspaceContainer } from '../../app/shell/ShellPrimitives';
import { EnterpriseConsentStampRepairRoutePage } from './EnterpriseConsentStampRepairRoutePage';
import type { AxisAuthenticatedBootstrap } from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import {
  EnterpriseAdministrationTaskRenderer,
  type EnterpriseAdministrationTaskCommand,
} from './EnterpriseAdministrationTaskRenderer';
import {
  changeEnterpriseAdministration,
  loadEnterpriseAdministrationWorkspace,
  type EnterpriseAdministrationCommand,
  type EnterpriseAdministrationWorkspace,
} from './api/enterpriseAdministrationClient';

/** Renders only a discovered owner workspace, retaining the acting context separately from the selected target. */
export function EnterpriseAdministrationRoutePage({
  title = 'profile.enterpriseAdministration',
  ...props
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
  readonly title?: string;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const targets = query.getAll('enterpriseCode'),
    tasks = query.getAll('task');
  const target =
    targets.length === 0
      ? props.runtime.enterpriseCode
      : targets.length === 1
        ? targets[0]
        : '';
  const task = tasks.length === 0 ? 'consent' : tasks.length === 1 ? tasks[0] : '';
  if (
    !target ||
    !/^[A-Za-z0-9_.:-]{1,128}$/.test(target) ||
    !['consent', 'stamp-repair'].includes(task || '')
  )
    return (
      <WorkspaceContainer>
        <Alert severity="error">Enter a valid enterprise reference.</Alert>
      </WorkspaceContainer>
    );
  return (
    <WorkspaceContainer>
      <Stack spacing={2}>
        <Tabs
          value={task}
          variant="fullWidth"
          onChange={(_event, next: string) => {
            if (!['consent', 'stamp-repair'].includes(next)) return;
            const selected = new URLSearchParams(location.search);
            selected.set('task', next);
            void navigate({ pathname: location.pathname, search: selected.toString() });
          }}
        >
          <Tab
            value="consent"
            label={title}
            wrapped
            sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
          />
          <Tab
            value="stamp-repair"
            label="ENTERPRISE_ADMINISTRATION_STAMP_REPAIR"
            wrapped
            sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
          />
        </Tabs>
        {task === 'stamp-repair' ? (
          <EnterpriseConsentStampRepairRoutePage
            {...props}
            target={target}
            title={title}
            embedded
          />
        ) : (
          <EnterpriseAdministrationConsentPage {...props} />
        )}
      </Stack>
    </WorkspaceContainer>
  );
}

/** Loads only the ordinary consent subview; never mounted by standalone stamp recovery. */
function EnterpriseAdministrationConsentPage({
  bootstrap,
  accessToken,
  runtime,
}: {
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly accessToken: string;
  readonly runtime: AxisRuntimeConfig;
}) {
  const location = useLocation();
  const target = useMemo(() => {
    const values = new URLSearchParams(location.search).getAll('enterpriseCode');
    const value =
      values.length === 0
        ? runtime.enterpriseCode
        : values.length === 1
          ? values[0]
          : '';
    return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value)
      ? value
      : '';
  }, [location.search, runtime.enterpriseCode]);
  const configuration = useMemo(
    () => ({
      bootstrap,
      accessToken,
      enterpriseCode: runtime.enterpriseCode,
      timeoutMs: runtime.requestTimeoutMs,
    }),
    [bootstrap, accessToken, runtime.enterpriseCode, runtime.requestTimeoutMs],
  );
  const context = useMemo(() => ({ configuration, target }), [configuration, target]);
  const [snapshot, setSnapshot] = useState<{
      context: typeof context;
      workspace: EnterpriseAdministrationWorkspace;
    }>(),
    [busy, setBusy] = useState(false),
    [readRequired, setReadRequired] = useState(false),
    [error, setError] = useState('');
  const [source, setSource] = useState(''),
    [assignment, setAssignment] = useState(''),
    [roles, setRoles] = useState<string[]>([]),
    [actions, setActions] = useState<string[]>([]),
    [recipients, setRecipients] = useState<string[]>([]),
    [emails, setEmails] = useState(''),
    [expiry, setExpiry] = useState('');
  const epoch = useRef(0),
    inFlight = useRef(false);
  const workspace = snapshot?.context === context ? snapshot.workspace : undefined;
  /** A fresh read resets all drafts rather than rebasing a reviewed command onto a new revision. */
  const resetDraft = () => {
    setSource('');
    setAssignment('');
    setRoles([]);
    setActions([]);
    setRecipients([]);
    setEmails('');
    setExpiry('');
  };
  const inspect = async (): Promise<'INSPECTED' | 'UNCONFIRMED'> => {
    if (!target || inFlight.current) return 'UNCONFIRMED';
    const attempt = epoch.current;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setReadRequired(true);
    try {
      const result = await loadEnterpriseAdministrationWorkspace(configuration, target);
      if (attempt !== epoch.current) return 'UNCONFIRMED';
      setSnapshot({ context, workspace: result });
      resetDraft();
      setReadRequired(false);
      return 'INSPECTED';
    } catch {
      if (attempt === epoch.current) {
        setSnapshot(undefined);
        setError('Enterprise administration could not be confirmed.');
      }
      return 'UNCONFIRMED';
    } finally {
      if (attempt === epoch.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    epoch.current++;
    inFlight.current = false;
    setSnapshot(undefined);
    setReadRequired(false);
    setError('');
    resetDraft();
    if (!target) setError('Enter a valid enterprise reference.');
    else void inspect();
    const activeEpoch = epoch;
    return () => {
      activeEpoch.current++;
    };
    // The exact context controls owner reads; draft fields must never trigger requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);
  const choices =
    workspace?.options.sources.find((item) => item.enterpriseCode === source)
      ?.assignments || [];
  const prepared = useMemo(() => {
    if (!workspace)
      return {
        commands: [] as EnterpriseAdministrationTaskCommand[],
        bodies: new Map<string, EnterpriseAdministrationCommand>(),
      };
    const copy = workspace.presentation,
      bodies = new Map<string, EnterpriseAdministrationCommand>();
    const selectedEmails = workspace.options.recipients
      ? [...recipients]
      : emails
          .split(/[,\n]/)
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);
    const expires = expiry ? new Date(expiry).getTime() : NaN;
    const canGrant =
      !busy &&
      !readRequired &&
      workspace.availableCommands.includes('GRANT') &&
      workspace.options.sources.some(
        (item) =>
          item.enterpriseCode === source &&
          item.assignments.some((item) => item.code === assignment),
      ) &&
      roles.length > 0 &&
      actions.length > 0 &&
      selectedEmails.length > 0 &&
      selectedEmails.length <= workspace.options.maximumRecipients &&
      new Set(selectedEmails).size === selectedEmails.length &&
      selectedEmails.every(
        (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320,
      ) &&
      Number.isFinite(expires) &&
      expires > Date.now() &&
      expires <= Date.now() + workspace.options.maximumLifetimeDays * 86400000 &&
      (!workspace.options.expiresNoLaterThan ||
        expires <= Date.parse(workspace.options.expiresNoLaterThan));
    if (canGrant)
      bodies.set('GRANT', {
        operation: 'GRANT',
        operationId: crypto.randomUUID().replace(/-/g, ''),
        revision: workspace.revision,
        sourceEnterpriseCode: source,
        recipientAssignmentCode: assignment,
        roleCodes: [...roles],
        actions: [...actions],
        recipients: selectedEmails,
        expiresAt: new Date(expires).toISOString(),
        ...(workspace.options.parentGrantCode
          ? { parentGrantCode: workspace.options.parentGrantCode }
          : {}),
      });
    const commands: EnterpriseAdministrationTaskCommand[] = [
      {
        code: 'GRANT',
        label: copy.grantLabel,
        enabled: canGrant,
        summary: [
          { label: copy.title, value: workspace.enterpriseCode },
          { label: copy.sourceLabel, value: source },
          { label: copy.assignmentLabel, value: assignment },
          { label: copy.roleLabel, value: roles.join(', ') },
          { label: copy.actionLabel, value: actions.join(', ') },
          { label: copy.recipientLabel, value: selectedEmails.join(', ') },
          {
            label: copy.expiryLabel,
            value: Number.isFinite(expires) ? new Date(expires).toISOString() : '',
          },
        ],
      },
    ];
    for (const grant of workspace.grants) {
      const key = 'REVOKE:' + grant.code;
      const enabled =
        !busy &&
        !readRequired &&
        workspace.availableCommands.includes('REVOKE') &&
        grant.canRevoke === true;
      if (enabled)
        bodies.set(key, {
          operation: 'REVOKE',
          operationId: crypto.randomUUID().replace(/-/g, ''),
          revision: workspace.revision,
          grantCode: grant.code,
          ...(workspace.options.parentGrantCode
            ? { parentGrantCode: workspace.options.parentGrantCode }
            : {}),
        });
      commands.push({
        code: key,
        label: copy.revokeLabel + ': ' + grant.code,
        enabled,
        summary: [
          { label: copy.title, value: workspace.enterpriseCode },
          { label: copy.sourceLabel, value: grant.sourceEnterpriseCode },
          { label: copy.roleLabel, value: grant.roleCodes.join(', ') },
          { label: copy.actionLabel, value: grant.actions.join(', ') },
          { label: copy.expiryLabel, value: grant.expiresAt },
        ],
      });
    }
    return { commands, bodies };
  }, [
    workspace,
    busy,
    readRequired,
    source,
    assignment,
    roles,
    actions,
    recipients,
    emails,
    expiry,
  ]);
  /** Sends the captured reviewed body once; never changes its revision or opaque recipient after review. */
  const execute = async (
    command: EnterpriseAdministrationTaskCommand,
  ): Promise<'CONFIRMED' | 'UNCONFIRMED'> => {
    const body = prepared.bodies.get(command.code);
    if (!workspace || !body || inFlight.current || readRequired) return 'UNCONFIRMED';
    const attempt = epoch.current;
    inFlight.current = true;
    setBusy(true);
    try {
      await changeEnterpriseAdministration(configuration, workspace, body);
      return attempt === epoch.current ? 'CONFIRMED' : 'UNCONFIRMED';
    } catch {
      return 'UNCONFIRMED';
    } finally {
      if (attempt === epoch.current) {
        setBusy(false);
        inFlight.current = false;
        setReadRequired(true);
      }
    }
  };
  const locked =
    busy || readRequired || !workspace?.availableCommands.includes('GRANT');
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  if (!workspace)
    return (
      <Stack spacing={2}>
        <Typography role="status">{busy ? 'Loading…' : ''}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {!busy && (
          <Button
            startIcon={<ShellIcon name="refresh" />}
            disabled={!target}
            onClick={() => void inspect()}
          >
            Refresh
          </Button>
        )}
      </Stack>
    );
  const copy = workspace.presentation;
  return (
    <Stack spacing={2} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Typography>{workspace.enterpriseCode}</Typography>
      {workspace.grants.length === 0 && <Typography>{copy.emptyMessage}</Typography>}
      {workspace.grants.map((grant) => (
        <Stack key={grant.code} spacing={0.5}>
          <Typography>
            {grant.code} / {grant.status}
          </Typography>
          <Typography>
            {copy.sourceLabel}: {grant.sourceEnterpriseCode}
          </Typography>
          <Typography>
            {copy.roleLabel}: {grant.roleCodes.join(', ')}
          </Typography>
          <Typography>
            {copy.actionLabel}: {grant.actions.join(', ')}
          </Typography>
          <Typography>
            {copy.expiryLabel}:{' '}
            <time dateTime={grant.expiresAt}>
              {new Date(grant.expiresAt).toLocaleString()}
            </time>
          </Typography>
        </Stack>
      ))}
      <TextField
        select
        label={copy.sourceLabel}
        value={source}
        disabled={locked}
        onChange={(event) => {
          setSource(event.target.value);
          setAssignment('');
        }}
      >
        {workspace.options.sources.map((item) => (
          <MenuItem
            key={item.enterpriseCode}
            value={item.enterpriseCode}
            aria-label={
              item.enterpriseName
                ? `${item.enterpriseName} (${item.enterpriseCode})`
                : undefined
            }
          >
            {item.enterpriseName ? (
              <Stack
                sx={{ minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
              >
                <Typography component="span">{item.enterpriseName}</Typography>
                <Typography component="span" variant="caption" color="text.secondary">
                  {item.enterpriseCode}
                </Typography>
              </Stack>
            ) : (
              item.enterpriseCode
            )}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label={copy.assignmentLabel}
        value={assignment}
        disabled={locked || !source}
        onChange={(event) => setAssignment(event.target.value)}
      >
        {choices.map((item) => (
          <MenuItem
            key={item.code}
            value={item.code}
            aria-label={
              item.recipientName || item.roleLabel
                ? `${[item.recipientName, item.roleLabel].filter(Boolean).join(' / ')} (${item.code} / ${item.roleCode})`
                : undefined
            }
          >
            {item.recipientName || item.roleLabel ? (
              <Stack
                sx={{ minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
              >
                <Typography component="span">
                  {[item.recipientName, item.roleLabel].filter(Boolean).join(' / ')}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary">
                  {item.code} / {item.roleCode}
                </Typography>
              </Stack>
            ) : (
              `${item.code} / ${item.roleCode}`
            )}
          </MenuItem>
        ))}
      </TextField>
      <Stack>
        <Typography>{copy.roleLabel}</Typography>
        {workspace.options.roleCodes.map((code) => (
          <FormControlLabel
            key={code}
            label={code}
            control={
              <Checkbox
                disabled={locked}
                checked={roles.includes(code)}
                onChange={() => setRoles(toggle(roles, code))}
              />
            }
          />
        ))}
      </Stack>
      <Stack>
        <Typography>{copy.actionLabel}</Typography>
        {workspace.options.actions.map((code) => (
          <FormControlLabel
            key={code}
            label={code}
            control={
              <Checkbox
                disabled={locked}
                checked={actions.includes(code)}
                onChange={() => setActions(toggle(actions, code))}
              />
            }
          />
        ))}
      </Stack>
      {workspace.options.recipients ? (
        <Stack>
          <Typography>{copy.recipientLabel}</Typography>
          {workspace.options.recipients.map((email) => (
            <FormControlLabel
              key={email}
              label={email}
              control={
                <Checkbox
                  disabled={locked}
                  checked={recipients.includes(email)}
                  onChange={() => setRecipients(toggle(recipients, email))}
                />
              }
            />
          ))}
        </Stack>
      ) : (
        <TextField
          multiline
          minRows={2}
          label={copy.recipientLabel}
          value={emails}
          disabled={locked}
          onChange={(event) => setEmails(event.target.value)}
          slotProps={{
            htmlInput: { maxLength: workspace.options.maximumRecipients * 321 },
          }}
        />
      )}
      <TextField
        type="datetime-local"
        label={copy.expiryLabel}
        value={expiry}
        disabled={locked}
        onChange={(event) => setExpiry(event.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <EnterpriseAdministrationTaskRenderer
        context={context}
        commands={prepared.commands}
        inspect={inspect}
        execute={execute}
        presentation={{
          title: copy.title,
          inspectLabel: copy.inspectLabel || 'Inspect',
          emptyMessage: copy.emptyMessage,
          workingLabel: copy.workingLabel || 'Working…',
          reviewTitle: copy.reviewTitle || copy.confirmMessage,
          confirmLabel: copy.confirmLabel || 'Confirm',
          cancelLabel: copy.cancelLabel || 'Cancel',
          uncertainMessage: copy.uncertainMessage,
          unavailableMessage:
            copy.unavailableMessage ||
            'Enterprise administration could not be confirmed.',
          recordedMessage:
            copy.recordedMessage ||
            'The owner recorded the change. Inspect current state before another action.',
        }}
      />
    </Stack>
  );
}
