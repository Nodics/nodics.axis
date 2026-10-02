/** Profile-owned registration/application/password-recovery renderer. All authority remains on the backend. */
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogActions,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { WorkspaceContainer } from '../../../app/shell/ShellPrimitives';
import { BackendWorkspaceHttpError } from '../../../app/backendWorkspaceClient';
import type { AxisRuntimeConfig } from '../../../runtime/runtimeConfig';
import { ApplicationDeadline } from './ApplicationDeadline';
import {
  loadRegistrationWorkspace,
  sendRegistrationAction,
  type RegistrationAction,
  type RegistrationProgress,
  type RegistrationWorkspace,
  type AccountAccessJourney,
} from './registrationClient';

/**
 * Profile-owned invited registration, rendered with the established Axis/MUI
 * theme and primitives. One coherent task, no employee navigation or scope editor.
 * Passwords, OTPs and opaque continuation handles live in memory only and are
 * never put in URLs, browser storage or saved drafts. Backend state is authority.
 */
export function EmployeeRegistrationRoutePage({
  runtime,
  profileBaseUrl,
  journey = 'registration',
  onSignIn,
}: {
  readonly runtime: AxisRuntimeConfig;
  readonly profileBaseUrl: string;
  readonly journey?: AccountAccessJourney;
  readonly onSignIn?: ((enterpriseCode?: string) => void) | undefined;
}) {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<RegistrationWorkspace>();
  const [progress, setProgress] = useState<RegistrationProgress>();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [assignmentCode, setAssignmentCode] = useState('');
  const [enterpriseCode, setEnterpriseCode] = useState('');
  const [note, setNote] = useState('');
  const [withdrawal, setWithdrawal] =
    useState<NonNullable<RegistrationProgress['applications']>[number]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const continuation = useRef('');
  const inFlight = useRef(false);
  const sequence = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const mounted = useRef(true);
  const cancelPending = useCallback(() => {
    sequence.current++;
    controller.current?.abort();
    continuation.current = '';
    inFlight.current = false;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelPending();
    };
  }, [cancelPending]);
  useEffect(() => {
    let active = true;
    continuation.current = '';
    inFlight.current = false;
    setWorkspace(undefined);
    setProgress(undefined);
    setEmail('');
    setCode('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setAssignmentCode('');
    setEnterpriseCode('');
    setNote('');
    setWithdrawal(undefined);
    setBusy(false);
    setError(undefined);
    const discoveryController = new AbortController();
    void loadRegistrationWorkspace(
      runtime,
      profileBaseUrl,
      discoveryController.signal,
      journey,
    )
      .then((value) => {
        if (active) setWorkspace(value);
      })
      .catch((value) => {
        if (active)
          setError(
            value instanceof Error
              ? value.message
              : 'Registration could not be loaded.',
          );
      });
    return () => {
      active = false;
      discoveryController.abort();
      cancelPending();
    };
  }, [runtime, profileBaseUrl, loadAttempt, cancelPending, journey]);
  useEffect(() => {
    heading.current?.focus();
  }, [progress?.stage]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const copy = workspace?.presentation;
  const stage = progress?.stage;
  const existingAccount = stage === 'EXISTING_ACCOUNT';
  const reset = stage === 'RESET_PASSWORD' || stage === 'RESETTING';
  const applying = stage === 'APPLICATION_DETAILS';
  const applicationCopy = workspace?.applications?.presentation;
  const applicationStatus = stage?.startsWith('APPLICATION_') && !applying;
  const details =
    stage === 'DETAILS' || stage === 'RECOVERY' || existingAccount || reset || applying;
  const terminal =
    stage === 'COMPLETE' ||
    stage === 'SIGN_IN' ||
    stage === 'NO_INVITATION' ||
    stage === 'ACCOUNT_UNAVAILABLE';
  const resendReady = Boolean(progress && Date.parse(progress.resendAt) <= now);
  const restart = () => {
    sequence.current++;
    controller.current?.abort();
    continuation.current = '';
    setProgress(undefined);
    setCode('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setAssignmentCode('');
    setEnterpriseCode('');
    setNote('');
    setError(undefined);
    setBusy(false);
    inFlight.current = false;
  };
  const run = async (
    action: RegistrationAction,
    application?: NonNullable<RegistrationProgress['applications']>[number],
  ) => {
    if (!workspace || inFlight.current) return;
    inFlight.current = true;
    const id = ++sequence.current;
    controller.current?.abort();
    const activeController = new AbortController();
    controller.current = activeController;
    setBusy(true);
    setError(undefined);
    const body: Record<string, string> =
      action === 'start' ? { email } : { continuation: continuation.current };
    if (action === 'verify') body.code = code;
    if (action === 'complete') {
      Object.assign(
        body,
        existingAccount || reset ? { password } : { firstName, lastName, password },
      );
      if (assignmentCode) body.assignmentCode = assignmentCode;
    }
    if (action === 'apply')
      Object.assign(body, { enterpriseCode, firstName, lastName, note });
    if (action === 'withdrawApplication' && application)
      Object.assign(body, {
        applicationCode: application.code,
        expectedRevision: String(application.revision),
      });
    try {
      const result = await sendRegistrationAction(
        runtime,
        profileBaseUrl,
        workspace,
        action,
        body,
        activeController.signal,
      );
      if (result.stage === 'EXISTING_ACCOUNT' && workspace.contractVersion !== 2)
        throw new Error('Registration interface changed. Start again to reload it.');
      if (result.stage.startsWith('APPLICATION_') && !workspace.applications)
        throw new Error('Application interface changed. Start again to reload it.');
      if (!mounted.current || id !== sequence.current) return;
      if (action === 'start') {
        if (!result.continuation) throw new Error('Registration could not be started.');
        continuation.current = result.continuation;
      }
      setProgress(result);
      setEmail(result.email);
      if (result.selectedAssignment) setAssignmentCode(result.selectedAssignment);
      const onlyChoice = result.applicationChoices?.[0];
      if (result.applicationChoices?.length === 1 && onlyChoice)
        setEnterpriseCode(onlyChoice.code);
      const prepared = result.assignments?.find(
        (item) => item.code === result.selectedAssignment,
      )?.profile;
      if (prepared) {
        setFirstName(prepared.firstName);
        setLastName(prepared.lastName);
      }
      if (action === 'verify') setCode('');
    } catch (value) {
      if (
        mounted.current &&
        id === sequence.current &&
        !activeController.signal.aborted
      ) {
        // START may have applied without returning the continuation required by status.
        const missingProgressReference =
          action === 'start' &&
          !continuation.current &&
          value instanceof BackendWorkspaceHttpError &&
          value.code === 'ERR_PROFILE_REG_STORAGE';
        setError(
          missingProgressReference
            ? 'The request outcome could not be confirmed. Progress cannot be checked from this page. Contact your administrator before sending another code.'
            : value instanceof Error
              ? value.message
              : copy?.statusErrorMessage || 'Registration could not be completed.',
        );
      }
    } finally {
      // Clear secrets even when the request failed; keep non-sensitive task context.
      if (mounted.current && id === sequence.current) {
        inFlight.current = false;
        setBusy(false);
        if (action === 'complete') setPassword('');
      }
      delete body.password;
      delete body.code;
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(
      !progress
        ? 'start'
        : stage === 'VERIFY_EMAIL'
          ? 'verify'
          : applying
            ? 'apply'
            : 'complete',
    );
  };
  if (!workspace || !copy)
    return (
      <WorkspaceContainer>
        <Box sx={{ maxWidth: 640, mx: 'auto', p: { xs: 2, md: 4 } }}>
          {error ? (
            <Stack spacing={2}>
              <Alert severity="error">{error}</Alert>
              <Button onClick={() => setLoadAttempt((value) => value + 1)}>
                Retry
              </Button>
            </Stack>
          ) : (
            <Stack sx={{ alignItems: 'center' }} spacing={2} role="status">
              <CircularProgress />
              <Typography>Loading registration…</Typography>
            </Stack>
          )}
        </Box>
      </WorkspaceContainer>
    );
  const message = existingAccount
    ? copy.existingAccountMessage
    : stage === 'COMPLETE'
      ? copy.completeMessage
      : stage === 'SIGN_IN'
        ? copy.existingMessage
        : stage === 'NO_INVITATION' || stage === 'ACCOUNT_UNAVAILABLE'
          ? copy.noInvitationMessage
          : stage === 'RECOVERY' || stage === 'RESETTING'
            ? copy.recoveryMessage
            : stage === 'RESOLVING'
              ? copy.resolvingMessage
              : progress?.notice === 'INVALID_CODE'
                ? copy.invalidCodeMessage
                : progress?.deliveryStatus === 'UNAVAILABLE'
                  ? copy.deliveryMessage
                  : progress && ['LOCKED', 'EXPIRED'].includes(progress.codeState)
                    ? copy.lockedCodeMessage
                    : copy.sentMessage;
  return (
    <WorkspaceContainer>
      <Box
        sx={{
          maxWidth: 680,
          width: '100%',
          mx: 'auto',
          py: { xs: 2, md: 5 },
          px: { xs: 1, md: 2 },
        }}
      >
        <Paper
          variant="outlined"
          sx={{ borderRadius: 2, p: { xs: 2.5, sm: 4 } }}
          aria-busy={busy}
        >
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography ref={heading} tabIndex={-1} component="h1" variant="h4">
                {copy.title}
              </Typography>
              <Typography color="text.secondary">{copy.subtitle}</Typography>
            </Stack>
            <Stepper
              activeStep={stage === 'COMPLETE' ? 2 : details ? 1 : 0}
              alternativeLabel
            >
              {[copy.emailStep, copy.detailsStep, copy.completeStep].map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            {progress && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  {copy.emailLabel}:{' '}
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {email}
                  </Box>
                </Typography>
                {stage !== 'DETAILS' && stage !== 'RESET_PASSWORD' && (
                  <Alert
                    severity={
                      stage === 'COMPLETE'
                        ? 'success'
                        : stage === 'RECOVERY' ||
                            progress.deliveryStatus === 'UNAVAILABLE'
                          ? 'warning'
                          : 'info'
                    }
                    role="status"
                  >
                    {applying
                      ? applicationCopy?.description
                      : stage === 'APPLICATION_APPROVED'
                        ? applicationCopy?.approvedMessage
                        : stage === 'APPLICATION_REJECTED'
                          ? applicationCopy?.rejectedMessage
                          : stage === 'APPLICATION_CLOSED'
                            ? applicationCopy?.closedMessage
                            : applicationStatus
                              ? applicationCopy?.pendingMessage
                              : message}
                  </Alert>
                )}
              </Stack>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {!terminal && stage !== 'RESOLVING' && !applicationStatus && (
              <Stack component="form" onSubmit={submit} spacing={2.5}>
                {!progress && (
                  <TextField
                    autoFocus
                    fullWidth
                    required
                    type="email"
                    autoComplete="email"
                    label={copy.emailLabel}
                    helperText={copy.emailHelp}
                    value={email}
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 320 } }}
                  />
                )}
                {stage === 'VERIFY_EMAIL' && (
                  <>
                    <TextField
                      autoFocus
                      fullWidth
                      required
                      label={copy.codeLabel}
                      helperText={copy.codeHelp}
                      value={code}
                      autoComplete="one-time-code"
                      disabled={
                        busy ||
                        ['LOCKED', 'EXPIRED'].includes(progress?.codeState || '')
                      }
                      onChange={(event) => setCode(event.target.value.trim())}
                      slotProps={{
                        htmlInput: {
                          maxLength: 128,
                          autoCapitalize: 'none',
                          spellCheck: false,
                        },
                      }}
                    />
                    <Button
                      type="button"
                      variant="text"
                      disabled={busy || !resendReady}
                      onClick={() => void run('resend')}
                    >
                      {copy.resendLabel}
                    </Button>
                  </>
                )}
                {details && (
                  <>
                    {applying && applicationCopy && (
                      <TextField
                        select
                        fullWidth
                        required
                        label={applicationCopy.enterpriseLabel}
                        value={enterpriseCode}
                        disabled={busy}
                        onChange={(event) => setEnterpriseCode(event.target.value)}
                      >
                        {progress?.applicationChoices?.map((item) => (
                          <MenuItem key={item.code} value={item.code}>
                            {item.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                    {progress?.assignments && progress.assignments.length > 1 && (
                      <TextField
                        select
                        fullWidth
                        required
                        label={copy.enterpriseLabel}
                        value={assignmentCode}
                        disabled={busy}
                        onChange={(event) => {
                          const selected = progress.assignments?.find(
                            (item) => item.code === event.target.value,
                          );
                          setAssignmentCode(event.target.value);
                          setFirstName(selected?.profile?.firstName || '');
                          setLastName(selected?.profile?.lastName || '');
                          setPassword('');
                        }}
                      >
                        {progress.assignments.map((item) => (
                          <MenuItem key={item.code} value={item.code}>
                            {item.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                    {progress?.assignments?.length === 1 && (
                      <Typography variant="body2">
                        {copy.enterpriseLabel}: {progress.assignments[0]?.name}
                      </Typography>
                    )}
                    {!existingAccount && !reset && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                          fullWidth
                          required
                          label={copy.firstNameLabel}
                          autoComplete="given-name"
                          value={firstName}
                          disabled={busy}
                          onChange={(event) => setFirstName(event.target.value)}
                          slotProps={{
                            htmlInput: {
                              maxLength: workspace.constraints.maximumNameLength,
                            },
                          }}
                        />
                        <TextField
                          fullWidth
                          required
                          label={copy.lastNameLabel}
                          autoComplete="family-name"
                          value={lastName}
                          disabled={busy}
                          onChange={(event) => setLastName(event.target.value)}
                          slotProps={{
                            htmlInput: {
                              maxLength: workspace.constraints.maximumNameLength,
                            },
                          }}
                        />
                      </Stack>
                    )}
                    {applying && applicationCopy ? (
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label={applicationCopy.noteLabel}
                        helperText={applicationCopy.noteHelp}
                        value={note}
                        disabled={busy}
                        onChange={(event) => setNote(event.target.value)}
                        slotProps={{
                          htmlInput: {
                            maxLength: workspace.applications?.maximumNoteLength,
                          },
                        }}
                      />
                    ) : (
                      <TextField
                        fullWidth
                        required
                        type="password"
                        autoComplete={
                          stage === 'RECOVERY' ||
                          stage === 'RESETTING' ||
                          existingAccount
                            ? 'current-password'
                            : 'new-password'
                        }
                        label={
                          existingAccount
                            ? copy.existingPasswordLabel
                            : stage === 'RECOVERY' || stage === 'RESETTING'
                              ? copy.recoveryPasswordLabel
                              : copy.passwordLabel
                        }
                        helperText={
                          existingAccount
                            ? copy.existingPasswordHelp
                            : stage === 'RECOVERY' || stage === 'RESETTING'
                              ? copy.recoveryPasswordHelp
                              : copy.passwordHelp
                        }
                        value={password}
                        disabled={busy}
                        onChange={(event) => setPassword(event.target.value)}
                        slotProps={{
                          htmlInput: {
                            minLength:
                              existingAccount || stage === 'RECOVERY'
                                ? 1
                                : workspace.constraints.minimumPasswordLength,
                            maxLength: workspace.constraints.maximumPasswordLength,
                          },
                        }}
                      />
                    )}
                  </>
                )}
                <Button
                  type="submit"
                  size="large"
                  variant="contained"
                  disabled={
                    busy ||
                    (stage === 'VERIFY_EMAIL' &&
                      ['LOCKED', 'EXPIRED'].includes(progress?.codeState || ''))
                  }
                  startIcon={
                    busy ? <CircularProgress size={18} color="inherit" /> : undefined
                  }
                >
                  {busy
                    ? copy.workingLabel
                    : !progress
                      ? copy.sendLabel
                      : stage === 'VERIFY_EMAIL'
                        ? copy.verifyLabel
                        : applying
                          ? applicationCopy?.submitLabel
                          : existingAccount
                            ? copy.acceptMembershipLabel
                            : stage === 'RECOVERY' || stage === 'RESETTING'
                              ? copy.retryLabel
                              : copy.completeLabel}
                </Button>
              </Stack>
            )}
            {progress?.applications?.length && applicationCopy ? (
              <Stack spacing={1} aria-label={applicationCopy.previousTitle}>
                <Typography variant="h6">{applicationCopy.previousTitle}</Typography>
                {progress.applications.map((item) => (
                  <Stack key={`${item.code}:${item.attempt || 1}`} spacing={0.5}>
                    <Typography>{item.enterpriseName}</Typography>
                    <Typography variant="body2">
                      {item.status === 'APPROVED'
                        ? applicationCopy.approvedLabel
                        : item.status === 'REJECTED'
                          ? applicationCopy.rejectedLabel
                          : item.status === 'REGISTERED'
                            ? applicationCopy.registeredLabel
                            : item.status === 'WITHDRAWN'
                              ? applicationCopy.withdrawnLabel
                              : item.status === 'EXPIRED'
                                ? applicationCopy.expiredLabel
                                : applicationCopy.pendingLabel}
                    </Typography>
                    {item.reason && (
                      <Typography variant="body2">{item.reason}</Typography>
                    )}
                    {item.canWithdraw && workspace.applications?.withdrawPath && (
                      <Button disabled={busy} onClick={() => setWithdrawal(item)}>
                        {applicationCopy.withdrawLabel}
                      </Button>
                    )}
                    {['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(item.status) &&
                      !progress.applications?.some(
                        (other) =>
                          other.code === item.code &&
                          (other.attempt || 1) > (item.attempt || 1),
                      ) && (
                        <Button disabled={busy} onClick={restart}>
                          {applicationCopy.resubmitLabel}
                        </Button>
                      )}
                    {item.status === 'AWAITING_REVIEW' &&
                      item.reviewStatus === 'NOT_CONFIRMED' && (
                        <Alert severity="warning">
                          {applicationCopy.reviewNotConfirmedMessage}
                        </Alert>
                      )}
                    <Typography variant="body2" color="text.secondary">
                      {applicationCopy.submittedLabel}:{' '}
                      {new Date(item.submittedAt).toLocaleString()}
                    </Typography>
                    <ApplicationDeadline
                      deadlineAt={item.deadlineAt}
                      label={applicationCopy.deadlineLabel}
                    />
                  </Stack>
                ))}
              </Stack>
            ) : null}
            {applicationCopy && (
              <Dialog
                open={!!withdrawal}
                onClose={() => setWithdrawal(undefined)}
                aria-labelledby="withdraw-application-title"
              >
                <DialogTitle id="withdraw-application-title">
                  {applicationCopy.withdrawConfirm}
                </DialogTitle>
                <DialogActions>
                  <Button onClick={() => setWithdrawal(undefined)}>
                    {applicationCopy.cancelLabel}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      const selected = withdrawal;
                      setWithdrawal(undefined);
                      if (selected) void run('withdrawApplication', selected);
                    }}
                  >
                    {applicationCopy.withdrawLabel}
                  </Button>
                </DialogActions>
              </Dialog>
            )}
            {(stage === 'COMPLETE' || stage === 'SIGN_IN') && (
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => {
                    if (onSignIn) {
                      onSignIn(progress?.signInEnterpriseCode);
                      return;
                    }
                    void navigate(copy.signInPath, {
                      state: progress?.signInEnterpriseCode
                        ? {
                            registrationSignIn: {
                              enterpriseCode: progress.signInEnterpriseCode,
                            },
                          }
                        : undefined,
                    });
                  }}
                >
                  {copy.signInLabel}
                </Button>
                {stage === 'SIGN_IN' && (
                  <Button href={copy.recoveryPath}>{copy.recoveryLabel}</Button>
                )}
              </Stack>
            )}
            {progress && (
              <>
                <Divider />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  sx={{ justifyContent: 'space-between' }}
                  spacing={1}
                >
                  {!terminal && (
                    <Button disabled={busy} onClick={() => void run('status')}>
                      {copy.statusLabel}
                    </Button>
                  )}
                  {stage !== 'COMPLETE' && (
                    <Button disabled={busy} onClick={restart}>
                      {copy.restartLabel}
                    </Button>
                  )}
                </Stack>
              </>
            )}
          </Stack>
        </Paper>
      </Box>
    </WorkspaceContainer>
  );
}
