import { describe, expect, it } from 'vitest';
import {
  parseRuntimeConfigurationEffective,
  parseRuntimeConfigurationSchemas,
} from '../../../src/operations/runtimeConfiguration/api/runtimeConfigurationContracts';
const secretField = {
  code: 'botToken',
  type: 'string',
  sensitive: true,
  credentialReference: 'example.identity',
};
const schema = {
  code: 'identity',
  ownerModule: 'profile',
  fields: [secretField],
  secretPersistence: { required: true, ready: true, reason: 'READY' },
};
const effective = {
  code: 'identity',
  ownerModule: 'profile',
  status: 'CONFIGURED',
  missingRequired: [],
  values: {
    botToken: {
      configured: true,
      sensitive: true,
      value: 'synthetic-secret-not-for-ui',
    },
  },
  secretPersistence: schema.secretPersistence,
};
describe('Runtime configuration defensive owner contracts', () => {
  it('rejects orphan selector-only definitions before a value read can be selected', () => {
    expect(() =>
      parseRuntimeConfigurationSchemas([
        { code: 'identity', fields: [{ credentialReference: 'example.identity' }] },
      ]),
    ).toThrow(/metadata is incompatible/);
  });
  it.each([
    { ...secretField, code: undefined },
    { ...secretField, type: undefined },
    { ...secretField, code: 'constructor' },
    { ...secretField, sensitive: false },
  ])('rejects a malformed or unmasked credential field %j', (field) => {
    expect(() =>
      parseRuntimeConfigurationSchemas([{ ...schema, fields: [field] }]),
    ).toThrow(/metadata is incompatible/);
  });
  it('accepts empty owner registries and drops private/executable metadata from valid declarations', () => {
    expect(parseRuntimeConfigurationSchemas([])).toEqual([]);
    const result = parseRuntimeConfigurationSchemas([
      {
        ...schema,
        privateValue: 'private',
        fields: [{ ...secretField, privateValue: 'private' }],
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private|credentialReference/);
    expect(result[0]?.fields[0]).toMatchObject({
      code: 'botToken',
      type: 'string',
      sensitive: true,
    });
  });
  it('rejects duplicate identities and contradictory readiness', () => {
    for (const value of [
      [schema, schema],
      [{ ...schema, fields: [secretField, secretField] }],
      [
        {
          ...schema,
          secretPersistence: { required: false, ready: true, reason: 'NOT_REQUIRED' },
        },
      ],
      [
        {
          ...schema,
          secretPersistence: { required: true, ready: false, reason: 'READY' },
        },
      ],
    ])
      expect(() => parseRuntimeConfigurationSchemas(value)).toThrow();
  });
  it('drops every sensitive value before presentation even if the server mistakenly sends plaintext', () => {
    const result = parseRuntimeConfigurationEffective(effective, 'identity');
    expect(result.values.botToken).toEqual({ configured: true, sensitive: true });
    expect(JSON.stringify(result)).not.toContain('synthetic-secret-not-for-ui');
  });
  it('preserves ordinary false and zero values', () => {
    const result = parseRuntimeConfigurationEffective(
      {
        ...effective,
        values: {
          enabled: { configured: true, sensitive: false, value: false },
          limit: { configured: true, sensitive: false, value: 0 },
        },
      },
      'identity',
    );
    expect(result.values.enabled?.value).toBe(false);
    expect(result.values.limit?.value).toBe(0);
  });
  it('rejects wrong identity, unknown value flags and non-scalar values', () => {
    expect(() => parseRuntimeConfigurationEffective(effective, 'other')).toThrow();
    for (const values of [
      { botToken: { configured: true, value: 'synthetic' } },
      { token: { configured: true, sensitive: false, value: {} } },
      { token: { configured: true, sensitive: true, value: {} } },
    ])
      expect(() =>
        parseRuntimeConfigurationEffective({ ...effective, values }, 'identity'),
      ).toThrow();
  });
});
