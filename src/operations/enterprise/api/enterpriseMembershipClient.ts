/** Profile-owned membership commands. Axis projects outcomes, never tokens, tenant authority or credentials. */
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';

export interface EnterpriseMembership {
  readonly code: string;
  readonly revision: number;
  readonly enterpriseCode: string;
  readonly enterpriseName: string;
  readonly responsibility: string;
  readonly status: 'PENDING' | 'ACTIVE' | 'REGISTERED' | 'SUSPENDED' | 'REVOKED';
  readonly accepted: boolean;
}
export type EnterpriseTeamAction = 'SUSPEND' | 'REVOKE' | 'RESUME' | 'WITHDRAW';
export interface EnterpriseRecoveryWorkspace {
  readonly enterpriseCode: string;
  readonly operation: {
    id: string;
    phase: 'PENDING' | 'COMPLETE';
    teamRevision: number;
    recoverable: boolean;
  } | null;
  readonly presentation: Readonly<
    Record<
      | 'title'
      | 'inspectLabel'
      | 'reviewTitle'
      | 'confirmLabel'
      | 'cancelLabel'
      | 'unavailableMessage'
      | 'uncertainMessage',
      string
    >
  >;
}
/** Projects only inert operator evidence, never stored actor/hash/reviewed mutation input. */
export function parseEnterpriseRecoveryWorkspace(
  value: unknown,
): EnterpriseRecoveryWorkspace {
  const source = record(value),
    copy = record(source.presentation);
  if (source.contractVersion !== 1 || source.owner !== 'profile')
    throw new Error('Recovery workspace could not be confirmed.');
  let operation: EnterpriseRecoveryWorkspace['operation'] = null;
  if (source.operation !== null) {
    const op = record(source.operation);
    if (
      !['PENDING', 'COMPLETE'].includes(String(op.phase)) ||
      typeof op.recoverable !== 'boolean' ||
      (op.recoverable && op.phase !== 'PENDING')
    )
      throw new Error('Recovery evidence could not be confirmed.');
    if (typeof op.teamRevision !== 'number')
      throw new Error('Recovery evidence could not be confirmed.');
    operation = {
      id: operationId(text(op.id, 128)),
      phase: op.phase as 'PENDING' | 'COMPLETE',
      teamRevision: revision(op.teamRevision),
      recoverable: op.recoverable,
    };
  }
  return {
    enterpriseCode: text(source.enterpriseCode, 128),
    operation,
    presentation: {
      title: text(copy.title, 192),
      inspectLabel: text(copy.inspectLabel, 192),
      reviewTitle: text(copy.reviewTitle, 192),
      confirmLabel: text(copy.confirmLabel, 192),
      cancelLabel: text(copy.cancelLabel, 192),
      unavailableMessage: text(copy.unavailableMessage, 2000),
      uncertainMessage: text(copy.uncertainMessage, 2000),
    },
  };
}
/** Reads one explicit target through the discovered Profile owner. */
export async function loadEnterpriseRecoveryWorkspace(
  configuration: OperationalOwnerConfiguration,
  enterpriseCode: string,
): Promise<EnterpriseRecoveryWorkspace> {
  const code = text(enterpriseCode, 128);
  const value = parseEnterpriseRecoveryWorkspace(
    await invokeOperationalOwner(
      configuration,
      'profile',
      '/enterprise-team/recovery-workspace',
      { enterpriseCode: code },
    ),
  );
  if (value.enterpriseCode !== code)
    throw new Error('Recovery target could not be confirmed.');
  return value;
}
/** Finalizes only the exact inspected committed operation; authority stays with Profile. */
export async function reconcileEnterpriseOperation(
  configuration: OperationalOwnerConfiguration,
  workspace: EnterpriseRecoveryWorkspace,
): Promise<void> {
  const op = workspace.operation;
  if (!op?.recoverable || op.phase !== 'PENDING')
    throw new Error('No committed operation is eligible.');
  const result = parseEnterpriseMembership(
    await invokeOperationalOwner(
      configuration,
      'profile',
      '/enterprise-team/reconcile-committed',
      {
        enterpriseCode: workspace.enterpriseCode,
        teamRevision: revision(op.teamRevision),
        operationId: operationId(op.id),
      },
    ),
  );
  if (result.enterpriseCode !== workspace.enterpriseCode)
    throw new Error('Recovery target could not be confirmed.');
}
export type TeamAction = EnterpriseTeamAction | 'HANDOVER';
export type MembershipAction = 'ACCEPT' | 'SWITCH';
const membershipCopyKeys = [
  'title',
  'refreshLabel',
  'enterpriseLabel',
  'responsibilityLabel',
  'statusLabel',
  'ACCEPT',
  'SWITCH',
  'reviewTitle',
  'reviewMessage',
  'confirmLabel',
  'cancelLabel',
  'inspectLabel',
  'uncertainMessage',
  'successMessage',
  'emptyMessage',
  'PENDING',
  'ACTIVE',
  'REGISTERED',
  'SUSPENDED',
  'REVOKED',
] as const;
export interface EnterpriseMembershipWorkspace {
  readonly enterpriseCode: string;
  readonly presentation: Readonly<Record<(typeof membershipCopyKeys)[number], string>>;
  readonly items: readonly (EnterpriseMembership & {
    readonly actions: readonly MembershipAction[];
  })[];
}
/** Projects an inert own-person task; malformed actions or copy never become authority. */
export function parseEnterpriseMembershipWorkspace(
  value: unknown,
): EnterpriseMembershipWorkspace {
  const source = record(value),
    copy = record(source.presentation);
  if (
    source.contractVersion !== 1 ||
    source.owner !== 'profile' ||
    source.renderer !== 'axis.enterprise-memberships' ||
    !Array.isArray(source.items) ||
    source.items.length > 100
  )
    throw new Error('Membership workspace could not be confirmed.');
  const enterpriseCode = text(source.enterpriseCode, 128);
  const items = source.items.map((value) => {
    const source = record(value),
      item = parseEnterpriseMembership(value);
    if (
      !Array.isArray(source.actions) ||
      source.actions.length > 1 ||
      source.actions.some((action) => action !== 'ACCEPT' && action !== 'SWITCH') ||
      (source.actions.includes('SWITCH') &&
        (!item.accepted || item.enterpriseCode === enterpriseCode)) ||
      (source.actions.includes('ACCEPT') &&
        (item.accepted || !['PENDING', 'ACTIVE'].includes(item.status)))
    )
      throw new Error('Membership actions could not be confirmed.');
    return { ...item, actions: source.actions as MembershipAction[] };
  });
  if (new Set(items.map((item) => item.code)).size !== items.length)
    throw new Error('Membership workspace could not be confirmed.');
  return {
    enterpriseCode,
    items,
    presentation: Object.fromEntries(
      membershipCopyKeys.map((key) => [key, text(copy[key], 1000)]),
    ) as EnterpriseMembershipWorkspace['presentation'],
  };
}
/** Loads the admitted person's own task from the discovered Profile connection. */
export async function loadEnterpriseMembershipWorkspace(
  configuration: OperationalOwnerConfiguration,
): Promise<EnterpriseMembershipWorkspace> {
  const value = parseEnterpriseMembershipWorkspace(
    await invokeOperationalOwner<unknown>(
      configuration,
      'profile',
      '/enterprise-memberships/workspace',
    ),
  );
  if (value.enterpriseCode !== configuration.enterpriseCode)
    throw new Error('Membership context could not be confirmed.');
  return value;
}
const teamCopyKeys = [
  'title',
  'refreshLabel',
  'emailLabel',
  'responsibilityLabel',
  'statusLabel',
  'designatedLabel',
  'emptyMessage',
  'SUSPEND',
  'REVOKE',
  'RESUME',
  'WITHDRAW',
  'HANDOVER',
  'reviewTitle',
  'reviewMessage',
  'confirmLabel',
  'cancelLabel',
  'inspectLabel',
  'retryLabel',
  'uncertainMessage',
  'pendingMessage',
  'successMessage',
  'reconcileMessage',
  'PENDING',
  'ACTIVE',
  'REGISTERED',
  'SUSPENDED',
  'REVOKED',
] as const;
export interface EnterpriseTeamWorkspace {
  readonly contractVersion: 1;
  readonly enterpriseCode: string;
  readonly enterpriseName: string;
  readonly presentation: Readonly<Record<(typeof teamCopyKeys)[number], string>>;
  readonly items: readonly (EnterpriseMembership & {
    readonly email: string;
    readonly designated: boolean;
    readonly actions: readonly TeamAction[];
  })[];
  readonly operation: {
    readonly id: string;
    readonly phase: 'PENDING' | 'COMPLETE';
  } | null;
}
/** Validates a backend-owned team task; actions and labels are inert, not browser authorization. */
export function parseEnterpriseTeamWorkspace(value: unknown): EnterpriseTeamWorkspace {
  const source = record(value),
    copy = record(source.presentation);
  if (
    source.contractVersion !== 1 ||
    source.owner !== 'profile' ||
    source.renderer !== 'axis.enterprise-team' ||
    !Array.isArray(source.items) ||
    source.items.length > 100
  )
    throw new Error('Team workspace could not be confirmed.');
  const enterpriseCode = text(source.enterpriseCode, 128);
  const items = source.items.map((value) => {
    const item = record(value),
      membership = parseEnterpriseMembership(value);
    if (
      membership.enterpriseCode !== enterpriseCode ||
      typeof item.designated !== 'boolean' ||
      !Array.isArray(item.actions) ||
      item.actions.length > 4 ||
      new Set(item.actions).size !== item.actions.length ||
      (item.actions.includes('WITHDRAW') &&
        (membership.accepted ||
          item.designated ||
          !['PENDING', 'ACTIVE'].includes(membership.status) ||
          item.actions.length !== 1)) ||
      item.actions.some(
        (action) =>
          !['SUSPEND', 'REVOKE', 'RESUME', 'HANDOVER', 'WITHDRAW'].includes(
            String(action),
          ),
      )
    )
      throw new Error('Team workspace could not be confirmed.');
    return {
      ...membership,
      email: text(item.email, 320),
      designated: item.designated,
      actions: item.actions as TeamAction[],
    };
  });
  if (new Set(items.map((item) => item.code)).size !== items.length)
    throw new Error('Team workspace could not be confirmed.');
  let operation: EnterpriseTeamWorkspace['operation'] = null;
  if (source.operation !== null) {
    const item = record(source.operation);
    if (!['PENDING', 'COMPLETE'].includes(String(item.phase)))
      throw new Error('Team recovery state could not be confirmed.');
    operation = {
      id: operationId(text(item.id, 128)),
      phase: item.phase as 'PENDING' | 'COMPLETE',
    };
  }
  return {
    contractVersion: 1,
    enterpriseCode,
    enterpriseName: text(source.enterpriseName, 256),
    presentation: Object.fromEntries(
      teamCopyKeys.map((key) => [key, text(copy[key], 1000)]),
    ) as EnterpriseTeamWorkspace['presentation'],
    items,
    operation,
  };
}
/** Reads only the current admitted enterprise's workspace through Profile discovery. */
export async function loadEnterpriseTeamWorkspace(
  configuration: OperationalOwnerConfiguration,
): Promise<EnterpriseTeamWorkspace> {
  const workspace = parseEnterpriseTeamWorkspace(
    await invokeOperationalOwner<unknown>(
      configuration,
      'profile',
      '/enterprise-team/workspace',
    ),
  );
  if (workspace.enterpriseCode !== configuration.enterpriseCode)
    throw new Error('Team enterprise context could not be confirmed.');
  return workspace;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Membership outcome could not be confirmed.');
  return value as Record<string, unknown>;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new Error('Membership outcome could not be confirmed.');
  return value;
}
/** Projects business fields only; an acknowledgement/update count is never a saved membership. */
export function parseEnterpriseMembership(value: unknown): EnterpriseMembership {
  const item = record(value);
  if (
    typeof item.revision !== 'number' ||
    !Number.isSafeInteger(item.revision) ||
    item.revision < 1 ||
    typeof item.accepted !== 'boolean' ||
    !['PENDING', 'ACTIVE', 'REGISTERED', 'SUSPENDED', 'REVOKED'].includes(
      String(item.status),
    ) ||
    (item.accepted && item.status !== 'REGISTERED')
  )
    throw new Error('Membership outcome could not be confirmed.');
  return {
    code: text(item.code, 128),
    revision: item.revision,
    enterpriseCode: text(item.enterpriseCode, 128),
    enterpriseName: text(item.enterpriseName, 256),
    responsibility: text(item.responsibility, 256),
    status: item.status as EnterpriseMembership['status'],
    accepted: item.accepted,
  };
}
/** Loads a bounded own-person list through the discovered Profile owner, with no arbitrary identity selector. */
export async function loadOwnEnterpriseMemberships(
  configuration: OperationalOwnerConfiguration,
): Promise<readonly EnterpriseMembership[]> {
  const value = record(
    await invokeOperationalOwner<unknown>(
      configuration,
      'profile',
      '/enterprise-memberships',
    ),
  );
  if (
    value.contractVersion !== 1 ||
    !Array.isArray(value.items) ||
    value.items.length > 100
  )
    throw new Error('Membership list could not be confirmed.');
  const items = value.items.map(parseEnterpriseMembership);
  if (new Set(items.map((item) => item.code)).size !== items.length)
    throw new Error('Membership list could not be confirmed.');
  return items;
}
function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error('Membership revision is invalid.');
  return value;
}
function operationId(value: string): string {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(value))
    throw new Error('Team operation identity is invalid.');
  return value;
}
function targetOutcome(value: unknown, code: string): EnterpriseMembership {
  const result = parseEnterpriseMembership(value);
  if (result.code !== code)
    throw new Error('Membership target could not be confirmed.');
  return result;
}
/** Submits one explicit invitation acceptance. Uncertain responses never auto-retry or issue a browser session. */
export async function acceptEnterpriseMembership(
  configuration: OperationalOwnerConfiguration,
  membership: Pick<EnterpriseMembership, 'code' | 'revision'>,
): Promise<EnterpriseMembership> {
  return targetOutcome(
    await invokeOperationalOwner<unknown>(
      configuration,
      'profile',
      '/enterprise-memberships/accept',
      {
        assignmentCode: text(membership.code, 128),
        revision: revision(membership.revision),
      },
    ),
    membership.code,
  );
}
/** Sends one immutable lifecycle command. Retain the same operation ID/input for supported recovery; never generate a retry automatically. */
export async function changeEnterpriseMembership(
  configuration: OperationalOwnerConfiguration,
  action: EnterpriseTeamAction,
  membership: Pick<EnterpriseMembership, 'code' | 'revision'>,
  id: string,
): Promise<EnterpriseMembership> {
  const paths = {
    SUSPEND: '/enterprise-team/suspend',
    REVOKE: '/enterprise-team/revoke',
    RESUME: '/enterprise-team/resume',
    WITHDRAW: '/enterprise-team/withdraw',
  } as const;
  if (!Object.hasOwn(paths, action)) throw new Error('Team action is invalid.');
  return targetOutcome(
    await invokeOperationalOwner<unknown>(configuration, 'profile', paths[action], {
      assignmentCode: text(membership.code, 128),
      revision: revision(membership.revision),
      operationId: operationId(id),
    }),
    membership.code,
  );
}
/** Transfers a reviewed default-administrator designation without replacing identity or role authority. */
export async function handoverEnterpriseAdministrator(
  configuration: OperationalOwnerConfiguration,
  enterpriseCode: string,
  target: Pick<EnterpriseMembership, 'code' | 'revision'>,
  id: string,
): Promise<{
  readonly enterpriseCode: string;
  readonly defaultAdministratorAssignmentCode: string;
}> {
  const result = record(
    await invokeOperationalOwner<unknown>(
      configuration,
      'profile',
      '/enterprise-team/handover',
      {
        enterpriseCode: text(enterpriseCode, 128),
        assignmentCode: text(target.code, 128),
        revision: revision(target.revision),
        operationId: operationId(id),
      },
    ),
  );
  if (
    result.enterpriseCode !== enterpriseCode ||
    result.defaultAdministratorAssignmentCode !== target.code
  )
    throw new Error('Administrator designation could not be confirmed.');
  return {
    enterpriseCode,
    defaultAdministratorAssignmentCode: text(
      result.defaultAdministratorAssignmentCode,
      128,
    ),
  };
}
