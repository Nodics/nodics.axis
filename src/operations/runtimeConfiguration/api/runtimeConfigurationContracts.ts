import type {
  RuntimeConfigurationEffective,
  RuntimeConfigurationEffectiveValue,
  RuntimeConfigurationFieldSchema,
  RuntimeConfigurationSchemaSummary,
  RuntimeConfigurationSecretPersistence,
} from './runtimeConfigurationClient';
const incompatible = () =>
  new Error(
    'Runtime configuration metadata is incompatible. Refresh readiness or choose another runtime.',
  );
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw incompatible();
  return value as Record<string, unknown>;
}
function identity(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(value) ||
    ['constructor', 'prototype', '__proto__'].includes(value)
  )
    throw incompatible();
  return value;
}
function optionalText(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, string> {
  const output: Record<string, string> = {};
  for (const key of keys) {
    const value = source[key];
    if (value === undefined) continue;
    if (
      typeof value !== 'string' ||
      value.length > 4096 ||
      Array.from(value).some((character) => {
        const code = character.charCodeAt(0);
        return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
      })
    )
      throw incompatible();
    output[key] = value;
  }
  return output;
}
function flags(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, boolean> {
  const output: Record<string, boolean> = {};
  for (const key of keys) {
    if (source[key] === undefined) continue;
    if (typeof source[key] !== 'boolean') throw incompatible();
    output[key] = source[key];
  }
  return output;
}
function readiness(value: unknown): RuntimeConfigurationSecretPersistence {
  const source = record(value);
  if (
    typeof source.required !== 'boolean' ||
    typeof source.ready !== 'boolean' ||
    source.reason !==
      (!source.required
        ? 'NOT_REQUIRED'
        : source.ready
          ? 'READY'
          : 'ENCRYPTION_KEY_REQUIRED') ||
    (!source.required && !source.ready)
  )
    throw incompatible();
  return {
    required: source.required,
    ready: source.ready,
    reason: source.reason as string,
  };
}
function field(value: unknown): RuntimeConfigurationFieldSchema {
  const source = record(value);
  const type = ['string', 'number', 'boolean'].find(
    (candidate) => candidate === source.type,
  );
  if (!type) throw incompatible();
  const path = source.path;
  if (
    (source.credentialReference !== undefined ||
      (Array.isArray(path) && path[0] === 'credentials') ||
      (typeof path === 'string' && path.startsWith('credentials.'))) &&
    source.sensitive !== true
  )
    throw incompatible();
  let options: readonly string[] | undefined;
  if (source.options !== undefined) {
    if (
      !Array.isArray(source.options) ||
      source.options.length > 512 ||
      source.options.some((option) => typeof option !== 'string' || option.length > 512)
    )
      throw incompatible();
    options = source.options as string[];
  }
  return {
    code: identity(source.code),
    type,
    ...optionalText(source, ['label', 'description', 'pattern']),
    ...flags(source, ['required', 'sensitive', 'restartRequired']),
    ...(options ? { options } : {}),
  };
}
/** Reject incomplete owner metadata before a renderer or effective-value request can consume it. */
export function parseRuntimeConfigurationSchemas(
  value: unknown,
): readonly RuntimeConfigurationSchemaSummary[] {
  if (!Array.isArray(value) || value.length > 512) throw incompatible();
  const codes = new Set<string>();
  return value.map((item) => {
    const source = record(item),
      code = identity(source.code),
      ownerModule = identity(source.ownerModule);
    if (
      codes.has(code) ||
      !Array.isArray(source.fields) ||
      !source.fields.length ||
      source.fields.length > 512
    )
      throw incompatible();
    codes.add(code);
    const fields = source.fields.map(field);
    if (new Set(fields.map((item) => item.code)).size !== fields.length)
      throw incompatible();
    const secretPersistence =
      source.secretPersistence === undefined
        ? undefined
        : readiness(source.secretPersistence);
    if (
      secretPersistence &&
      secretPersistence.required !== fields.some((item) => item.sensitive === true)
    )
      throw incompatible();
    return {
      code,
      ownerModule,
      fields,
      ...optionalText(source, [
        'label',
        'description',
        'category',
        'capabilityGroup',
        'updatePermission',
        'viewPermission',
        'refreshBehavior',
      ]),
      ...(secretPersistence ? { secretPersistence } : {}),
    };
  });
}
/** Drop all sensitive value material before React; only non-sensitive typed scalars can reach presentation. */
export function parseRuntimeConfigurationEffective(
  value: unknown,
  schemaCode: string,
): RuntimeConfigurationEffective {
  const source = record(value);
  if (
    identity(source.code) !== schemaCode ||
    (source.status !== 'CONFIGURED' && source.status !== 'UNCONFIGURED') ||
    !Array.isArray(source.missingRequired) ||
    source.missingRequired.length > 512
  )
    throw incompatible();
  const missingRequired = source.missingRequired.map(identity);
  if (new Set(missingRequired).size !== missingRequired.length) throw incompatible();
  const values: Record<string, RuntimeConfigurationEffectiveValue> = {};
  for (const [code, raw] of Object.entries(record(source.values))) {
    identity(code);
    const item = record(raw);
    if (typeof item.configured !== 'boolean' || typeof item.sensitive !== 'boolean')
      throw incompatible();
    const declared = flags(item, ['restartRequired']);
    if (item.sensitive && item.value !== undefined && typeof item.value !== 'string')
      throw incompatible();
    if (item.sensitive)
      values[code] = { configured: item.configured, sensitive: true, ...declared };
    else {
      const scalar = item.value;
      if (
        scalar !== undefined &&
        !(
          typeof scalar === 'string' ||
          typeof scalar === 'boolean' ||
          (typeof scalar === 'number' && Number.isFinite(scalar))
        )
      )
        throw incompatible();
      values[code] = {
        configured: item.configured,
        sensitive: false,
        ...declared,
        ...(scalar === undefined ? {} : { value: scalar }),
      };
    }
  }
  const secretPersistence =
    source.secretPersistence === undefined
      ? undefined
      : readiness(source.secretPersistence);
  return {
    code: schemaCode,
    ownerModule: identity(source.ownerModule),
    status: source.status,
    missingRequired,
    values,
    ...(secretPersistence ? { secretPersistence } : {}),
  };
}
