/** Profile setup projections and injected owner commands; no transport paths or private mutation keys. */
import {
  parseEnterpriseSetupDescriptor,
  type EnterpriseSetupDescriptor,
} from './enterpriseSetupDescriptor';
export interface EnterpriseSetupSnapshot {
  readonly descriptor?: EnterpriseSetupDescriptor | undefined;
  readonly contractVersion: 1;
  readonly enterprise: {
    readonly code: string;
    readonly name: string;
    readonly tenantCode: string;
  };
  readonly administrator: { readonly email: string; readonly status: string };
  readonly setup: {
    readonly revision: number | null;
    readonly state: 'HELD' | 'RESUMABLE' | 'COMPLETE';
    readonly canResume: boolean;
    readonly reasonCodes: readonly string[];
  };
}

export interface EnterpriseSetupOwnerAdapter {
  readonly inspect: (enterpriseCode: string) => Promise<unknown>;
  readonly resume?:
    | ((
        enterpriseCode: string,
        input: { readonly expectedRevision: number },
      ) => Promise<unknown>)
    | undefined;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Enterprise setup could not be confirmed.');
  return value as Record<string, unknown>;
}

function plainText(value: unknown, maximum: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maximum ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error('Enterprise setup could not be confirmed.');
  return value;
}

/** Projects the versioned owner snapshot, dropping private fields and rejecting contradictory execution flags. */
export function parseEnterpriseSetupSnapshot(value: unknown): EnterpriseSetupSnapshot {
  const source = record(value);
  const enterprise = record(source.enterprise);
  const administrator = record(source.administrator);
  const setup = record(source.setup);
  if (
    source.contractVersion !== 1 ||
    (!(
      setup.revision === null &&
      setup.state === 'HELD' &&
      setup.canResume === false
    ) &&
      (!Number.isSafeInteger(setup.revision) ||
        typeof setup.revision !== 'number' ||
        setup.revision < 0)) ||
    !['HELD', 'RESUMABLE', 'COMPLETE'].includes(String(setup.state)) ||
    typeof setup.canResume !== 'boolean' ||
    (setup.canResume && setup.state !== 'RESUMABLE') ||
    !Array.isArray(setup.reasonCodes) ||
    setup.reasonCodes.length > 32
  )
    throw new Error('Enterprise setup could not be confirmed.');
  const reasonCodes = setup.reasonCodes.map((reason: unknown) =>
    plainText(reason, 128),
  );
  if (new Set(reasonCodes).size !== reasonCodes.length)
    throw new Error('Enterprise setup could not be confirmed.');
  return {
    contractVersion: 1,
    descriptor:
      source.descriptor === undefined
        ? undefined
        : parseEnterpriseSetupDescriptor(source.descriptor),
    enterprise: {
      code: plainText(enterprise.code, 128),
      name: plainText(enterprise.name, 256),
      tenantCode: plainText(enterprise.tenantCode, 128),
    },
    administrator: {
      email: plainText(administrator.email, 320),
      status: plainText(administrator.status, 128),
    },
    setup: {
      revision: setup.revision,
      state: setup.state as EnterpriseSetupSnapshot['setup']['state'],
      canResume: setup.canResume,
      reasonCodes,
    },
  };
}

/** Reads through the caller's discovered owner adapter and rejects a different enterprise's response. */
export async function inspectEnterpriseSetup(
  owner: EnterpriseSetupOwnerAdapter,
  enterpriseCode: string,
): Promise<EnterpriseSetupSnapshot> {
  const code = plainText(enterpriseCode, 128);
  const snapshot = parseEnterpriseSetupSnapshot(await owner.inspect(code));
  if (snapshot.enterprise.code !== code)
    throw new Error('Enterprise setup target could not be confirmed.');
  return snapshot;
}

/** Sends only the exact reviewed revision once; no Team reconciliation or automatic retry. */
export async function resumeEnterpriseSetup(
  owner: EnterpriseSetupOwnerAdapter,
  snapshot: EnterpriseSetupSnapshot,
): Promise<EnterpriseSetupSnapshot> {
  const reviewed = parseEnterpriseSetupSnapshot(snapshot);
  if (
    !owner.resume ||
    !reviewed.setup.canResume ||
    reviewed.setup.state !== 'RESUMABLE' ||
    reviewed.setup.revision === null ||
    (reviewed.descriptor !== undefined &&
      (!reviewed.descriptor.available ||
        reviewed.descriptor.actions.resume?.qualified !== true))
  )
    throw new Error('Enterprise setup continuation is unavailable.');
  const result = parseEnterpriseSetupSnapshot(
    await owner.resume(reviewed.enterprise.code, {
      expectedRevision: reviewed.setup.revision,
    }),
  );
  if (result.enterprise.code !== reviewed.enterprise.code)
    throw new Error('Enterprise setup target could not be confirmed.');
  return result;
}
