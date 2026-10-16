/** Current-enterprise employee access adapter. Profile owns mappings, fingerprints, preservation and writes. */
import {
  invokeOperationalOwner,
  type OperationalOwnerConfiguration,
} from '../../shared/operationalOwnerClient';
import {
  parseBusinessAccessEditorContract,
  type BusinessAccessEditorContract,
} from './businessAccessContract';

/** Explicit business selection, never a permission list or an internal role choice. */
export interface EmployeeBusinessAccessSelection {
  readonly businessArea: string;
  readonly accessLevel: 'noAccess' | 'view' | 'edit' | 'fullControl';
}
/** Public employee projection; other groups remain visible but cannot be edited through this task. */
export interface BusinessAccessEmployee {
  readonly employeeCode: string;
  readonly loginId: string;
  readonly name: string;
  readonly assignmentCode?: string;
  readonly reviewFingerprint: string;
  readonly selections: readonly EmployeeBusinessAccessSelection[];
  readonly otherGroupCodes: readonly string[];
}
/** Profile's fresh employee catalogue for the authenticated immutable enterprise scope. */
export interface EnterpriseBusinessAccessWorkspace {
  readonly contractVersion: 1;
  readonly enterpriseCode: string;
  readonly businessAccess: BusinessAccessEditorContract;
  readonly employees: readonly BusinessAccessEmployee[];
}
/** Exact reviewed owner command. Unmentioned areas and all advanced groups are preserved by Profile. */
export interface EnterpriseBusinessAccessCommand {
  readonly employeeCode: string;
  readonly reviewFingerprint: string;
  readonly operationId: string;
  readonly changes: readonly EmployeeBusinessAccessSelection[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Employee access could not be confirmed.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 192, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max)
    throw new Error('Employee access could not be confirmed.');
  return value;
}
function selections(value: unknown): readonly EmployeeBusinessAccessSelection[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('Employee access selections could not be confirmed.');
  const areas = new Set<string>();
  return Object.freeze(
    value.map((entry) => {
      const item = record(entry),
        businessArea = text(item.businessArea);
      if (
        areas.has(businessArea) ||
        !['noAccess', 'view', 'edit', 'fullControl'].includes(String(item.accessLevel))
      )
        throw new Error('Employee access selections could not be confirmed.');
      areas.add(businessArea);
      return Object.freeze({
        businessArea,
        accessLevel: item.accessLevel as EmployeeBusinessAccessSelection['accessLevel'],
      });
    }),
  );
}

function fingerprint(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new Error('Employee access review could not be confirmed.');
  return value;
}

/** Validates bounded owner data, unique employees and selections against explicit catalogue mappings.
 * @param value Untrusted response from Profile's employee business-access endpoint.
 * @returns Frozen public fields only; malformed choices fail closed rather than hiding authority.
 */
export function parseEnterpriseBusinessAccessWorkspace(
  value: unknown,
): EnterpriseBusinessAccessWorkspace {
  const source = record(value),
    descriptor = parseBusinessAccessEditorContract(source.businessAccess);
  if (
    source.contractVersion !== 1 ||
    !Array.isArray(source.employees) ||
    source.employees.length > 100
  )
    throw new Error('Employee access workspace could not be confirmed.');
  const employees = new Set<string>();
  return Object.freeze({
    contractVersion: 1,
    enterpriseCode: text(source.enterpriseCode, 128),
    businessAccess: descriptor,
    employees: Object.freeze(
      source.employees.map((value) => {
        const item = record(value),
          employeeCode = text(item.employeeCode),
          selected = selections(item.selections);
        if (
          employees.has(employeeCode) ||
          !Array.isArray(item.otherGroupCodes) ||
          item.otherGroupCodes.length > 1000
        )
          throw new Error('Employee access workspace could not be confirmed.');
        employees.add(employeeCode);
        for (const selection of selected) {
          const area = descriptor.businessAreas.find(
            (area) => area.code === selection.businessArea,
          );
          if (
            !area ||
            (selection.accessLevel !== 'noAccess' &&
              !area.levels.some((level) => level.value === selection.accessLevel))
          )
            throw new Error('Employee access mapping could not be confirmed.');
        }
        const otherGroupCodes = item.otherGroupCodes.map((group) => text(group));
        if (new Set(otherGroupCodes).size !== otherGroupCodes.length)
          throw new Error('Employee advanced access could not be confirmed.');
        return Object.freeze({
          employeeCode,
          loginId: text(item.loginId, 320),
          name: text(item.name, 256, true),
          ...(item.assignmentCode === undefined
            ? {}
            : { assignmentCode: text(item.assignmentCode, 128) }),
          reviewFingerprint: fingerprint(item.reviewFingerprint),
          selections: selected,
          otherGroupCodes: Object.freeze(otherGroupCodes),
        });
      }),
    ),
  });
}

/** Reads the authenticated enterprise only; sends no employee, tenant or scope query selectors. */
export async function loadEnterpriseBusinessAccessWorkspace(
  configuration: OperationalOwnerConfiguration,
): Promise<EnterpriseBusinessAccessWorkspace> {
  const workspace = parseEnterpriseBusinessAccessWorkspace(
    await invokeOperationalOwner(
      configuration,
      'profile',
      '/enterprise-team/business-access',
    ),
  );
  if (workspace.enterpriseCode !== configuration.enterpriseCode)
    throw new Error('Employee access scope could not be confirmed.');
  return workspace;
}

/** Projects exactly the reviewed owner DTO and accepts only a matching employee's boolean outcome.
 * @param configuration Current admitted Profile connection and authenticated enterprise.
 * @param command Immutable reviewed fingerprint, operation ID and changed areas only.
 * @returns The owner's confirmed change/no-op result. Invalid replies are uncertain, never retried.
 */
export async function changeEnterpriseBusinessAccess(
  configuration: OperationalOwnerConfiguration,
  command: EnterpriseBusinessAccessCommand,
): Promise<{ readonly employeeCode: string; readonly changed: boolean }> {
  const changes = selections(command.changes);
  if (!changes.length || !/^[A-Za-z0-9_-]{16,128}$/.test(command.operationId))
    throw new Error('Employee access command is invalid.');
  const body = {
    employeeCode: text(command.employeeCode),
    reviewFingerprint: fingerprint(command.reviewFingerprint),
    operationId: command.operationId,
    changes,
  };
  const outcome = record(
    await invokeOperationalOwner(
      configuration,
      'profile',
      '/enterprise-team/business-access',
      body,
    ),
  );
  if (
    outcome.employeeCode !== body.employeeCode ||
    typeof outcome.changed !== 'boolean'
  )
    throw new Error('Employee access outcome could not be confirmed.');
  return Object.freeze({ employeeCode: body.employeeCode, changed: outcome.changed });
}
