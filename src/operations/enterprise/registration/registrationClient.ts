/** Profile account-access DTOs and single-attempt transport; no browser identity authority. */
import { browserScopedProfileUrl } from '../../../auth/employeeAuthClient';
import {
  envelopeData,
  backendWorkspaceResponseError,
  loadPublicBackendWorkspacePayload,
} from '../../../app/backendWorkspaceClient';
import type { AxisRuntimeConfig } from '../../../runtime/runtimeConfig';

/** Profile owns these states. Axis renders outcomes and never grants access. */
export type RegistrationStage =
  | 'VERIFY_EMAIL'
  | 'RESOLVING'
  | 'DETAILS'
  | 'RECOVERY'
  | 'EXISTING_ACCOUNT'
  | 'APPLICATION_DETAILS'
  | 'APPLICATION_PENDING'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'APPLICATION_CLOSED'
  | 'RESET_PASSWORD'
  | 'RESETTING'
  | 'ACCOUNT_UNAVAILABLE'
  | 'SIGN_IN'
  | 'NO_INVITATION'
  | 'COMPLETE';
export type RegistrationAction =
  | 'start'
  | 'verify'
  | 'resend'
  | 'status'
  | 'complete'
  | 'apply'
  | 'withdrawApplication';
export type AccountAccessJourney = 'registration' | 'recovery';
export interface ApplicationWorkspace {
  readonly submitPath: string;
  readonly withdrawPath?: string;
  readonly maximumNoteLength: number;
  readonly presentation: Readonly<
    Record<ApplicationCopyKey, string> & { deadlineLabel?: string }
  >;
}
export interface RegistrationWorkspace {
  readonly contractVersion: 1 | 2;
  readonly owner: 'profile';
  readonly renderer: 'axis.enterprise-registration' | 'axis.employee-recovery';
  readonly method: 'PASSWORD';
  readonly endpoints: Readonly<
    Record<Exclude<RegistrationAction, 'apply' | 'withdrawApplication'>, string>
  >;
  readonly applications?: ApplicationWorkspace;
  readonly presentation: Readonly<
    Record<RegistrationCopyKey, string> &
      Partial<Record<ExistingAccountCopyKey, string>>
  >;
  readonly constraints: {
    readonly maximumNameLength: number;
    readonly minimumPasswordLength: number;
    readonly maximumPasswordLength: number;
  };
}
export interface RegistrationProgress {
  readonly contractVersion: 1 | 2;
  readonly stage: RegistrationStage;
  readonly email: string;
  readonly continuation?: string;
  readonly codeState: string;
  readonly resendAt: string;
  readonly expiresAt: string;
  readonly deliveryStatus: string;
  readonly notice?: 'INVALID_CODE' | 'CODE_UNAVAILABLE';
  readonly selectedAssignment?: string;
  readonly signInEnterpriseCode?: string;
  readonly assignments?: readonly {
    readonly code: string;
    readonly name: string;
    readonly recovery: boolean;
    readonly profile?: { readonly firstName: string; readonly lastName: string };
  }[];
  readonly applicationChoices?: readonly {
    readonly code: string;
    readonly name: string;
  }[];
  readonly applications?: readonly {
    readonly code: string;
    readonly enterpriseCode: string;
    readonly enterpriseName: string;
    readonly status:
      | 'AWAITING_REVIEW'
      | 'APPROVED'
      | 'REJECTED'
      | 'REGISTERED'
      | 'WITHDRAWN'
      | 'EXPIRED';
    readonly revision?: number;
    readonly attempt?: number;
    readonly canWithdraw?: boolean;
    readonly reason?: string;
    readonly closedAt?: string;
    readonly deadlineAt?: string;
    readonly submittedAt: string;
    readonly reviewStatus: 'STARTED' | 'NOT_CONFIRMED';
  }[];
}
const stages: readonly string[] = [
  'VERIFY_EMAIL',
  'RESOLVING',
  'DETAILS',
  'RECOVERY',
  'EXISTING_ACCOUNT',
  'APPLICATION_DETAILS',
  'APPLICATION_PENDING',
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
  'APPLICATION_CLOSED',
  'SIGN_IN',
  'NO_INVITATION',
  'COMPLETE',
];
const actions: readonly RegistrationAction[] = [
  'start',
  'verify',
  'resend',
  'status',
  'complete',
];
const recoveryStages = [
  'VERIFY_EMAIL',
  'RESOLVING',
  'RESET_PASSWORD',
  'RESETTING',
  'ACCOUNT_UNAVAILABLE',
  'COMPLETE',
];
const applicationCopy = [
  'title',
  'description',
  'enterpriseLabel',
  'noteLabel',
  'noteHelp',
  'submitLabel',
  'pendingTitle',
  'pendingMessage',
  'previousTitle',
  'submittedLabel',
  'pendingLabel',
  'approvedLabel',
  'rejectedLabel',
  'registeredLabel',
  'approvedMessage',
  'rejectedMessage',
  'reviewNotConfirmedMessage',
  'withdrawnLabel',
  'expiredLabel',
  'withdrawLabel',
  'withdrawConfirm',
  'cancelLabel',
  'resubmitLabel',
  'closedMessage',
] as const;
export type ApplicationCopyKey = (typeof applicationCopy)[number];
const requiredCopy = [
  'title',
  'subtitle',
  'emailLabel',
  'emailHelp',
  'sendLabel',
  'codeLabel',
  'codeHelp',
  'verifyLabel',
  'resendLabel',
  'statusLabel',
  'restartLabel',
  'enterpriseLabel',
  'firstNameLabel',
  'lastNameLabel',
  'passwordLabel',
  'passwordHelp',
  'completeLabel',
  'recoveryPasswordLabel',
  'recoveryPasswordHelp',
  'retryLabel',
  'workingLabel',
  'signInLabel',
  'recoveryLabel',
  'signInPath',
  'recoveryPath',
  'emailStep',
  'detailsStep',
  'completeStep',
  'sentMessage',
  'deliveryMessage',
  'invalidCodeMessage',
  'lockedCodeMessage',
  'resolvingMessage',
  'existingMessage',
  'noInvitationMessage',
  'completeMessage',
  'recoveryMessage',
  'statusErrorMessage',
] as const;
export type RegistrationCopyKey = (typeof requiredCopy)[number];
const existingAccountCopy = [
  'existingAccountMessage',
  'existingPasswordLabel',
  'existingPasswordHelp',
  'acceptMembershipLabel',
] as const;
export type ExistingAccountCopyKey = (typeof existingAccountCopy)[number];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Registration response is invalid.');
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new Error('Registration response is invalid.');
  return value;
}
/** Accepts inert same-origin relative paths only. No credential-bearing redirects or caller URLs. */
export function registrationPath(value: unknown): string {
  const path = text(value, 512);
  if (!/^\/[A-Za-z0-9/_-]+$/.test(path) || path.startsWith('//') || path.includes('//'))
    throw new Error('Registration endpoint is invalid.');
  return path;
}
/** Strictly parses the new Profile-owned contract instead of falling back to the legacy unverified form. */
export function parseRegistrationWorkspace(
  value: unknown,
  journey: AccountAccessJourney = 'registration',
): RegistrationWorkspace {
  const data = object(value),
    endpoints = object(data.endpoints),
    presentation = object(data.presentation),
    constraints = object(data.constraints);
  if (
    ![1, 2].includes(Number(data.contractVersion)) ||
    typeof data.contractVersion !== 'number' ||
    data.owner !== 'profile' ||
    data.renderer !==
      (journey === 'recovery'
        ? 'axis.employee-recovery'
        : 'axis.enterprise-registration') ||
    (journey === 'recovery' && data.contractVersion !== 1) ||
    data.method !== 'PASSWORD'
  )
    throw new Error(
      'This registration interface is not available for the current backend.',
    );
  for (const key of actions) registrationPath(endpoints[key]);
  for (const key of requiredCopy) text(presentation[key]);
  if (journey === 'registration' && data.contractVersion === 2)
    for (const key of existingAccountCopy) text(presentation[key]);
  registrationPath(presentation.signInPath);
  registrationPath(presentation.recoveryPath);
  const maxName = constraints.maximumNameLength,
    minPassword = constraints.minimumPasswordLength,
    maxPassword = constraints.maximumPasswordLength;
  if (
    typeof maxName !== 'number' ||
    typeof minPassword !== 'number' ||
    typeof maxPassword !== 'number' ||
    ![maxName, minPassword, maxPassword].every(Number.isSafeInteger) ||
    maxName < 1 ||
    maxName > 256 ||
    minPassword < 12 ||
    maxPassword < minPassword ||
    maxPassword > 1024
  )
    throw new Error('Registration field policy is invalid.');
  let applications: ApplicationWorkspace | undefined;
  if (data.applications !== undefined) {
    if (journey !== 'registration')
      throw new Error('Recovery cannot submit an application.');
    const application = object(data.applications),
      copy = object(application.presentation);
    const limit = application.maximumNoteLength;
    if (
      typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 10000
    )
      throw new Error('Application field policy is invalid.');
    const presentation = Object.fromEntries(
      applicationCopy.map((key) => [key, text(copy[key])]),
    ) as Record<ApplicationCopyKey, string>;
    applications = {
      submitPath: registrationPath(application.submitPath),
      ...(application.withdrawPath === undefined
        ? {}
        : { withdrawPath: registrationPath(application.withdrawPath) }),
      maximumNoteLength: limit,
      presentation: {
        ...presentation,
        ...(copy.deadlineLabel === undefined
          ? {}
          : { deadlineLabel: text(copy.deadlineLabel) }),
      },
    };
  }
  return {
    contractVersion: data.contractVersion as 1 | 2,
    owner: 'profile',
    renderer: data.renderer as RegistrationWorkspace['renderer'],
    method: 'PASSWORD',
    endpoints: Object.fromEntries(
      actions.map((key) => [key, registrationPath(endpoints[key])]),
    ) as RegistrationWorkspace['endpoints'],
    presentation: Object.fromEntries(
      [...requiredCopy, ...(data.contractVersion === 2 ? existingAccountCopy : [])].map(
        (key) => [key, text(presentation[key])],
      ),
    ) as RegistrationWorkspace['presentation'],
    constraints: {
      maximumNameLength: maxName,
      minimumPasswordLength: minPassword,
      maximumPasswordLength: maxPassword,
    },
    ...(applications ? { applications } : {}),
  };
}
/** Projects permitted browser fields; raw proof, scope and persistence evidence cannot leak through this parser. */
export function parseRegistrationProgress(
  value: unknown,
  journey: AccountAccessJourney = 'registration',
): RegistrationProgress {
  const data = object(value);
  if (
    ![1, 2].includes(Number(data.contractVersion)) ||
    typeof data.contractVersion !== 'number' ||
    !(journey === 'recovery' ? recoveryStages : stages).includes(String(data.stage)) ||
    (journey === 'recovery' && data.contractVersion !== 1) ||
    (data.stage === 'EXISTING_ACCOUNT' && data.contractVersion !== 2)
  )
    throw new Error('Registration progress could not be confirmed.');
  for (const key of ['resendAt', 'expiresAt'])
    if (!Number.isFinite(Date.parse(text(data[key]))))
      throw new Error('Registration progress could not be confirmed.');
  if (
    data.continuation !== undefined &&
    !/^[A-Za-z0-9_-]{43}$/.test(text(data.continuation))
  )
    throw new Error('Registration continuation is invalid.');
  let assignments: RegistrationProgress['assignments'];
  if (data.assignments !== undefined) {
    if (!Array.isArray(data.assignments) || data.assignments.length > 100)
      throw new Error('Registration choices are invalid.');
    const seen = new Set<string>();
    assignments = data.assignments.map((value) => {
      const item = object(value),
        code = text(item.code, 128),
        name = text(item.name, 256);
      if (seen.has(code) || typeof item.recovery !== 'boolean')
        throw new Error('Registration choices are invalid.');
      const profile = item.profile === undefined ? undefined : object(item.profile);
      seen.add(code);
      return {
        code,
        name,
        recovery: item.recovery,
        ...(profile
          ? {
              profile: {
                firstName: text(profile.firstName, 256),
                lastName: text(profile.lastName, 256),
              },
            }
          : {}),
      };
    });
    if (
      data.selectedAssignment !== undefined &&
      !seen.has(text(data.selectedAssignment, 128))
    )
      throw new Error('Registration choice is invalid.');
  }
  if (data.selectedAssignment !== undefined && assignments === undefined)
    throw new Error('Registration choice is invalid.');
  if (
    ['DETAILS', 'RECOVERY', 'EXISTING_ACCOUNT'].includes(String(data.stage)) &&
    !assignments?.length
  )
    throw new Error('Registration choices are unavailable.');
  if (
    data.signInEnterpriseCode !== undefined &&
    ((data.stage !== 'COMPLETE' &&
      !(data.stage === 'SIGN_IN' && data.codeState === 'VERIFIED')) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(text(data.signInEnterpriseCode, 128)))
  )
    throw new Error('Registration sign-in context is invalid.');
  if (data.stage === 'COMPLETE' && data.signInEnterpriseCode === undefined)
    throw new Error('Registration sign-in context is unavailable.');
  if (
    data.notice !== undefined &&
    (typeof data.notice !== 'string' ||
      !['INVALID_CODE', 'CODE_UNAVAILABLE'].includes(data.notice))
  )
    throw new Error('Registration progress could not be confirmed.');
  let applicationChoices: RegistrationProgress['applicationChoices'];
  let applications: RegistrationProgress['applications'];
  if (data.applicationChoices !== undefined || data.applications !== undefined) {
    if (journey !== 'registration' || !String(data.stage).startsWith('APPLICATION_'))
      throw new Error('Application progress is invalid.');
    if (
      !Array.isArray(data.applicationChoices) ||
      data.applicationChoices.length > 100 ||
      !Array.isArray(data.applications) ||
      data.applications.length > 2000
    )
      throw new Error('Application progress is invalid.');
    const choices = new Set<string>(),
      records = new Set<string>();
    applicationChoices = data.applicationChoices.map((value) => {
      const item = object(value),
        code = text(item.code, 128);
      if (choices.has(code)) throw new Error('Application choice is invalid.');
      choices.add(code);
      return { code, name: text(item.name, 256) };
    });
    applications = data.applications.map((value) => {
      const item = object(value),
        code = text(item.code, 128);
      const attempt = item.attempt === undefined ? 1 : item.attempt;
      if (
        typeof attempt !== 'number' ||
        !Number.isSafeInteger(attempt) ||
        attempt < 1 ||
        attempt > 20 ||
        (item.revision !== undefined &&
          (typeof item.revision !== 'number' ||
            !Number.isSafeInteger(item.revision) ||
            item.revision < 1)) ||
        (item.canWithdraw !== undefined &&
          (typeof item.canWithdraw !== 'boolean' ||
            (item.canWithdraw &&
              (item.status !== 'AWAITING_REVIEW' || item.revision === undefined)))) ||
        ![
          'AWAITING_REVIEW',
          'APPROVED',
          'REJECTED',
          'REGISTERED',
          'WITHDRAWN',
          'EXPIRED',
        ].includes(String(item.status)) ||
        !['STARTED', 'NOT_CONFIRMED'].includes(String(item.reviewStatus)) ||
        !Number.isFinite(Date.parse(text(item.submittedAt)))
      )
        throw new Error('Application record is invalid.');
      const identity = `${code}:${attempt}`;
      if (records.has(identity)) throw new Error('Application record is invalid.');
      records.add(identity);
      for (const key of ['closedAt', 'deadlineAt'])
        if (item[key] !== undefined && !Number.isFinite(Date.parse(text(item[key]))))
          throw new Error('Application record is invalid.');
      return {
        code,
        enterpriseCode: text(item.enterpriseCode, 128),
        enterpriseName: text(item.enterpriseName, 256),
        status: item.status as NonNullable<
          RegistrationProgress['applications']
        >[number]['status'],
        submittedAt: text(item.submittedAt),
        reviewStatus: item.reviewStatus as 'STARTED' | 'NOT_CONFIRMED',
        ...(item.revision === undefined ? {} : { revision: item.revision }),
        attempt,
        ...(item.canWithdraw === undefined ? {} : { canWithdraw: item.canWithdraw }),
        ...(item.reason === undefined ? {} : { reason: text(item.reason, 1000) }),
        ...(item.closedAt === undefined ? {} : { closedAt: text(item.closedAt) }),
        ...(item.deadlineAt === undefined ? {} : { deadlineAt: text(item.deadlineAt) }),
      };
    });
  }
  if (
    String(data.stage).startsWith('APPLICATION_') &&
    (applications === undefined ||
      applicationChoices === undefined ||
      (data.stage === 'APPLICATION_DETAILS' && !applicationChoices.length))
  )
    throw new Error('Application progress is unavailable.');
  if (
    journey === 'recovery' &&
    (data.assignments !== undefined || data.selectedAssignment !== undefined)
  )
    throw new Error('Recovery cannot change membership.');
  return {
    ...(applicationChoices ? { applicationChoices } : {}),
    ...(applications ? { applications } : {}),
    ...(data.notice === undefined
      ? {}
      : { notice: data.notice as 'INVALID_CODE' | 'CODE_UNAVAILABLE' }),
    ...(data.signInEnterpriseCode === undefined
      ? {}
      : { signInEnterpriseCode: text(data.signInEnterpriseCode, 128) }),
    contractVersion: data.contractVersion as 1 | 2,
    stage: data.stage as RegistrationStage,
    email: text(data.email, 320),
    codeState: text(data.codeState, 32),
    deliveryStatus: text(data.deliveryStatus, 32),
    resendAt: text(data.resendAt),
    expiresAt: text(data.expiresAt),
    ...(data.continuation === undefined
      ? {}
      : { continuation: text(data.continuation) }),
    ...(assignments === undefined ? {} : { assignments }),
    ...(data.selectedAssignment === undefined
      ? {}
      : { selectedAssignment: text(data.selectedAssignment) }),
  };
}
/** Reuses the existing public workspace discovery transport; no second bootstrap/endpoint registry. */
export async function loadRegistrationWorkspace(
  runtime: AxisRuntimeConfig,
  profileBaseUrl: string,
  signal?: AbortSignal,
  journey: AccountAccessJourney = 'registration',
): Promise<RegistrationWorkspace> {
  return parseRegistrationWorkspace(
    await loadPublicBackendWorkspacePayload(runtime, profileBaseUrl, signal, journey),
    journey,
  );
}
/** Performs one command. A timeout never triggers automatic provisioning or email replay. */
export async function sendRegistrationAction(
  runtime: AxisRuntimeConfig,
  profileBaseUrl: string,
  workspace: RegistrationWorkspace,
  action: RegistrationAction,
  body: Readonly<Record<string, string>>,
  signal: AbortSignal,
): Promise<RegistrationProgress> {
  const base = browserScopedProfileUrl(profileBaseUrl);
  const journey =
    workspace.renderer === 'axis.employee-recovery' ? 'recovery' : 'registration';
  if (
    ['apply', 'withdrawApplication'].includes(action) &&
    (journey === 'recovery' || !workspace.applications)
  )
    throw new Error('Application submission is unavailable.');
  const path =
    action === 'apply'
      ? workspace.applications?.submitPath
      : action === 'withdrawApplication'
        ? workspace.applications?.withdrawPath
        : workspace.endpoints[action];
  const url = new URL(registrationPath(path), base);
  if (url.origin !== base.origin)
    throw new Error('Registration connection is invalid.');
  const timeoutMs = runtime.requestTimeoutMs;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000)
    throw new Error('Registration timeout is invalid.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timer = globalThis.setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-enterprise-code': runtime.enterpriseCode,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await backendWorkspaceResponseError(response);
    const payload: unknown = await response.json();
    const envelope = object(payload);
    if (
      envelope.success === false ||
      envelope.error ||
      (envelope.code !== undefined &&
        (typeof envelope.code !== 'string' || envelope.code.startsWith('ERR_')))
    )
      throw new Error('Registration progress could not be confirmed.');
    return parseRegistrationProgress(envelopeData(payload), journey);
  } finally {
    globalThis.clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
