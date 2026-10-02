/** Strict Profile administration DTO projection; no browser-owned identity, delegation or permission decisions. */
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';
const copyKeys = [
  'title',
  'grantLabel',
  'revokeLabel',
  'sourceLabel',
  'assignmentLabel',
  'roleLabel',
  'actionLabel',
  'recipientLabel',
  'expiryLabel',
  'confirmMessage',
  'uncertainMessage',
  'emptyMessage',
] as const;
type CopyKey = (typeof copyKeys)[number];
const taskCopyKeys = [
  'inspectLabel',
  'workingLabel',
  'reviewTitle',
  'confirmLabel',
  'cancelLabel',
  'unavailableMessage',
  'recordedMessage',
] as const;
type TaskCopyKey = (typeof taskCopyKeys)[number];
export interface EnterpriseAdministrationWorkspace {
  readonly version: 1;
  readonly kind: 'ENTERPRISE_ADMINISTRATION_CONSENT';
  readonly enterpriseCode: string;
  readonly revision: number;
  readonly presentation: Readonly<
    Record<CopyKey, string> & Partial<Record<TaskCopyKey, string>>
  >;
  readonly grants: readonly {
    readonly code: string;
    readonly revision: number;
    readonly sourceEnterpriseCode: string;
    readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
    readonly actions: readonly string[];
    readonly roleCodes: readonly string[];
    readonly expiresAt: string;
    readonly createdAt: string;
    readonly revokedAt?: string;
    readonly canRevoke?: boolean;
  }[];
  readonly availableCommands: readonly ('GRANT' | 'REVOKE')[];
  readonly options: {
    readonly sources: readonly {
      readonly enterpriseCode: string;
      readonly enterpriseName?: string;
      readonly assignments: readonly {
        readonly code: string;
        readonly roleCode: string;
        readonly recipientName?: string;
        readonly roleLabel?: string;
      }[];
    }[];
    readonly roleCodes: readonly string[];
    readonly actions: readonly string[];
    readonly maximumRecipients: number;
    readonly maximumLifetimeDays: number;
    readonly parentGrantCode?: string;
    readonly recipients?: readonly string[];
    readonly expiresNoLaterThan?: string;
  };
}
/** Rejects non-record and executable/unbounded structures before field-specific projection. */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Enterprise administration is unavailable.');
  return value as Record<string, unknown>;
}
/** A reference is a bounded selector, never permission or an identity locator. */
function selector(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(value))
    throw new Error('Enterprise administration is unavailable.');
  return value;
}
/** Optional owner labels are plain bounded text; they never replace command selectors. */
function businessLabel(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > 256 ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error('Enterprise administration is unavailable.');
  return value.trim();
}
/** Validates managed revisions/counts without coercing acknowledgement text into authority. */
function integer(value: unknown, minimum: number, maximum: number): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < minimum ||
    Number(value) > maximum
  )
    throw new Error('Enterprise administration is unavailable.');
  return Number(value);
}
/** Only valid owner timestamps may be presented as grant lifecycle evidence. */
function date(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 64 ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error('Enterprise administration is unavailable.');
  return value;
}
/** Requires bounded unique option sets; labels never become executable policy. */
function selections(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum)
    throw new Error('Enterprise administration is unavailable.');
  const rows = value.map(selector);
  if (new Set(rows).size !== rows.length)
    throw new Error('Enterprise administration is unavailable.');
  return rows;
}
/** Projects a published v1 consent workspace, discarding canonical identities and other private payload fields. */
export function parseEnterpriseAdministrationWorkspace(
  value: unknown,
  target: string,
): EnterpriseAdministrationWorkspace {
  selector(target);
  const source = record(value),
    options = record(source.options),
    mutation = record(source.mutation),
    copy = record(source.presentation);
  if (
    source.version !== 1 ||
    source.kind !== 'ENTERPRISE_ADMINISTRATION_CONSENT' ||
    source.enterpriseCode !== target ||
    mutation.revisionRequired !== true ||
    mutation.operationIdRequired !== true ||
    mutation.automaticRetry !== false ||
    mutation.recipientField !== 'recipientAssignmentCode'
  )
    throw new Error('Enterprise administration is unavailable.');
  const presentation = {} as Record<CopyKey, string> &
    Partial<Record<TaskCopyKey, string>>;
  for (const key of copyKeys) {
    if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 500)
      throw new Error('Enterprise administration is unavailable.');
    presentation[key] = copy[key];
  }
  for (const key of taskCopyKeys)
    if (copy[key] !== undefined) {
      if (typeof copy[key] !== 'string' || !copy[key].trim() || copy[key].length > 500)
        throw new Error('Enterprise administration is unavailable.');
      presentation[key] = copy[key];
    }
  if (
    !Array.isArray(source.grants) ||
    source.grants.length > 100 ||
    !Array.isArray(options.sources) ||
    options.sources.length > 100
  )
    throw new Error('Enterprise administration is unavailable.');
  const grants = source.grants.map(
    (value): EnterpriseAdministrationWorkspace['grants'][number] => {
      const grant = record(value),
        status = grant.status;
      if (status !== 'ACTIVE' && status !== 'REVOKED' && status !== 'EXPIRED')
        throw new Error('Enterprise administration is unavailable.');
      if (grant.canRevoke !== undefined && typeof grant.canRevoke !== 'boolean')
        throw new Error('Enterprise administration is unavailable.');
      return {
        code: selector(grant.code),
        revision: integer(grant.revision, 1, 2147483646),
        sourceEnterpriseCode: selector(grant.sourceEnterpriseCode),
        status,
        actions: selections(grant.actions, 3),
        roleCodes: selections(grant.roleCodes, 25),
        expiresAt: date(grant.expiresAt),
        createdAt: date(grant.createdAt),
        ...(grant.revokedAt === undefined ? {} : { revokedAt: date(grant.revokedAt) }),
        ...(grant.canRevoke === undefined ? {} : { canRevoke: grant.canRevoke }),
      };
    },
  );
  const sources = options.sources.map((value) => {
    const source = record(value);
    if (!Array.isArray(source.assignments) || source.assignments.length > 100)
      throw new Error('Enterprise administration is unavailable.');
    const assignments = source.assignments.map((value) => {
      const item = record(value);
      const recipientName = businessLabel(item.recipientName);
      const roleLabel = businessLabel(item.roleLabel);
      return {
        code: selector(item.code),
        roleCode: selector(item.roleCode),
        ...(recipientName === undefined ? {} : { recipientName }),
        ...(roleLabel === undefined ? {} : { roleLabel }),
      };
    });
    if (new Set(assignments.map((item) => item.code)).size !== assignments.length)
      throw new Error('Enterprise administration is unavailable.');
    const enterpriseName = businessLabel(source.enterpriseName);
    return {
      enterpriseCode: selector(source.enterpriseCode),
      ...(enterpriseName === undefined ? {} : { enterpriseName }),
      assignments,
    };
  });
  const availableCommands = selections(source.availableCommands, 2);
  if (sources.reduce((count, item) => count + item.assignments.length, 0) > 100)
    throw new Error('Enterprise administration is unavailable.');
  if (
    availableCommands.some((item) => !['GRANT', 'REVOKE'].includes(item)) ||
    new Set(grants.map((item) => item.code)).size !== grants.length ||
    new Set(sources.map((item) => item.enterpriseCode)).size !== sources.length
  )
    throw new Error('Enterprise administration is unavailable.');
  let recipients: string[] | undefined;
  if (options.recipients !== undefined) {
    if (
      !Array.isArray(options.recipients) ||
      options.recipients.length > 100 ||
      options.recipients.some(
        (item) => typeof item !== 'string' || !item || item.length > 320,
      )
    )
      throw new Error('Enterprise administration is unavailable.');
    recipients = (options.recipients as unknown[]).map((value) => {
      if (typeof value !== 'string')
        throw new Error('Enterprise administration is unavailable.');
      return value;
    });
    if (new Set(recipients).size !== recipients.length)
      throw new Error('Enterprise administration is unavailable.');
  }
  return {
    version: 1,
    kind: 'ENTERPRISE_ADMINISTRATION_CONSENT',
    enterpriseCode: target,
    revision: integer(source.revision, 0, 2147483646),
    presentation,
    grants,
    availableCommands: availableCommands as ('GRANT' | 'REVOKE')[],
    options: {
      sources,
      roleCodes: selections(options.roleCodes, 25),
      actions: selections(options.actions, 3),
      maximumRecipients: integer(options.maximumRecipients, 1, 100),
      maximumLifetimeDays: integer(options.maximumLifetimeDays, 1, 365),
      ...(options.parentGrantCode === undefined
        ? {}
        : { parentGrantCode: selector(options.parentGrantCode) }),
      ...(recipients === undefined ? {} : { recipients }),
      ...(options.expiresNoLaterThan === undefined
        ? {}
        : { expiresNoLaterThan: date(options.expiresNoLaterThan) }),
    },
  };
}

/** Exact owner input. Canonical identities, tenant, role permissions and endpoints never enter this body. */
export type EnterpriseAdministrationCommand =
  | {
      readonly operation: 'GRANT';
      readonly operationId: string;
      readonly revision: number;
      readonly sourceEnterpriseCode: string;
      readonly recipientAssignmentCode: string;
      readonly roleCodes: readonly string[];
      readonly actions: readonly string[];
      readonly recipients: readonly string[];
      readonly expiresAt: string;
      readonly parentGrantCode?: string;
    }
  | {
      readonly operation: 'REVOKE';
      readonly operationId: string;
      readonly revision: number;
      readonly grantCode: string;
      readonly parentGrantCode?: string;
    };

/** Reads the published fixed Profile route using the current acting enterprise, not a caller-selected authority. */
export async function loadEnterpriseAdministrationWorkspace(
  configuration: OperationalOwnerConfiguration,
  target: string,
) {
  selector(target);
  return parseEnterpriseAdministrationWorkspace(
    await invokeOperationalOwner(
      configuration,
      'profile',
      '/enterprise-administration/' + encodeURIComponent(target) + '/workspace',
    ),
    target,
  );
}

/** Sends one reviewed command and validates the public persisted owner projection; private identity checks stay Profile-owned. */
export async function changeEnterpriseAdministration(
  configuration: OperationalOwnerConfiguration,
  workspace: EnterpriseAdministrationWorkspace,
  input: EnterpriseAdministrationCommand,
): Promise<void> {
  if (
    !workspace.availableCommands.includes(input.operation) ||
    input.revision !== workspace.revision ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(input.operationId) ||
    input.parentGrantCode !== workspace.options.parentGrantCode
  )
    throw new Error('Enterprise administration could not be confirmed.');
  if (input.operation === 'GRANT') {
    const source = workspace.options.sources.find(
      (row) => row.enterpriseCode === input.sourceEnterpriseCode,
    );
    if (
      !source?.assignments.some((row) => row.code === input.recipientAssignmentCode) ||
      !input.roleCodes.length ||
      !input.actions.length ||
      !input.recipients.length ||
      input.roleCodes.some((value) => !workspace.options.roleCodes.includes(value)) ||
      input.actions.some((value) => !workspace.options.actions.includes(value)) ||
      input.recipients.length > workspace.options.maximumRecipients ||
      (workspace.options.recipients &&
        input.recipients.some(
          (value) => !workspace.options.recipients?.includes(value),
        ))
    )
      throw new Error('Enterprise administration could not be confirmed.');
  } else if (
    !workspace.grants.some(
      (row) => row.code === input.grantCode && row.canRevoke === true,
    )
  ) {
    throw new Error('Enterprise administration could not be confirmed.');
  }
  const body: EnterpriseAdministrationCommand =
    input.operation === 'GRANT'
      ? {
          operation: 'GRANT',
          operationId: input.operationId,
          revision: input.revision,
          sourceEnterpriseCode: input.sourceEnterpriseCode,
          recipientAssignmentCode: input.recipientAssignmentCode,
          roleCodes: [...input.roleCodes],
          actions: [...input.actions],
          recipients: [...input.recipients],
          expiresAt: input.expiresAt,
          ...(input.parentGrantCode === undefined
            ? {}
            : { parentGrantCode: input.parentGrantCode }),
        }
      : {
          operation: 'REVOKE',
          operationId: input.operationId,
          revision: input.revision,
          grantCode: input.grantCode,
          ...(input.parentGrantCode === undefined
            ? {}
            : { parentGrantCode: input.parentGrantCode }),
        };
  const value = record(
    await invokeOperationalOwner(
      configuration,
      'profile',
      '/enterprise-administration/' +
        encodeURIComponent(workspace.enterpriseCode) +
        '/consent',
      body,
    ),
  );
  if (
    value.enterpriseCode !== workspace.enterpriseCode ||
    value.revision !== workspace.revision + 1
  )
    throw new Error('Enterprise administration could not be confirmed.');
  const result = parseEnterpriseAdministrationWorkspace(
    {
      ...workspace,
      revision: value.revision,
      grants: value.grants,
      mutation: {
        revisionRequired: true,
        operationIdRequired: true,
        automaticRetry: false,
        recipientField: 'recipientAssignmentCode',
      },
    },
    workspace.enterpriseCode,
  );
  if (input.operation === 'REVOKE') {
    const previous = workspace.grants.find((row) => row.code === input.grantCode),
      changed = result.grants.find((row) => row.code === input.grantCode);
    if (
      !previous ||
      !changed ||
      changed.status !== 'REVOKED' ||
      changed.revision !== previous.revision + 1
    )
      throw new Error('Enterprise administration could not be confirmed.');
  } else {
    const added = result.grants.filter(
      (row) => !workspace.grants.some((previous) => previous.code === row.code),
    );
    if (
      added.length !== 1 ||
      added[0]?.sourceEnterpriseCode !== input.sourceEnterpriseCode ||
      added[0].status !== 'ACTIVE' ||
      Date.parse(added[0].expiresAt) !== Date.parse(input.expiresAt) ||
      JSON.stringify([...added[0].roleCodes].sort()) !==
        JSON.stringify([...input.roleCodes].sort()) ||
      JSON.stringify([...added[0].actions].sort()) !==
        JSON.stringify([...input.actions].sort())
    )
      throw new Error('Enterprise administration could not be confirmed.');
  }
}
