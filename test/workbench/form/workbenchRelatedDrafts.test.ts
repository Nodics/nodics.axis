import { describe, expect, it, vi } from 'vitest';
import type {
  WorkbenchRecord,
  WorkbenchRelationship,
  WorkbenchSchema,
} from '../../../src/workbench/api/workbenchContracts';
import {
  rememberRelatedDrafts,
  resolveRelatedDrafts,
  resolveWorkbenchRelationshipSchema,
} from '../../../src/workbench/form/workbenchRelatedDrafts';

const field = {
  name: 'code',
  label: 'Code',
  type: 'string',
  required: true,
  readOnly: false,
  primary: true,
  description: '',
  searchable: true,
};

it('resolves references within their runtime and rejects ambiguous remote copies', () => {
  const source = {
    ...schema('enterprise'),
    connectionServer: 'platform',
    connectionEnvironment: 'test',
  };
  const local = {
    ...schema('address'),
    connectionServer: 'platform',
    connectionEnvironment: 'test',
  };
  const remote = {
    ...schema('address'),
    connectionServer: 'other',
    connectionEnvironment: 'test',
  };
  expect(
    resolveWorkbenchRelationshipSchema([remote, local], source, reference('address')),
  ).toBe(local);
  expect(
    resolveWorkbenchRelationshipSchema(
      [remote, { ...remote, connectionServer: 'third' }],
      source,
      reference('address'),
    ),
  ).toBeUndefined();
  expect(
    resolveWorkbenchRelationshipSchema(
      [{ ...local, connectionEnvironment: 'production' }],
      source,
      reference('address'),
    ),
  ).toBeUndefined();
});
function schema(
  name: string,
  relationships: readonly WorkbenchRelationship[] = [],
): WorkbenchSchema {
  return {
    moduleName: 'profile',
    schemaName: name,
    label: name,
    description: '',
    displayProperty: 'code',
    displayProperties: ['code'],
    operations: ['create', 'read', 'update'],
    mutationMode: 'GENERATED_CRUD',
    fields: [field],
    relationships,
    queryCapabilities: {
      searchableFields: ['code'],
      sortableFields: ['code'],
      filterFields: [],
      groupOperators: ['AND'],
      textOperator: 'CONTAINS',
      allowedPageSizes: [10],
      defaultPageSize: 10,
      maximumPageSize: 10,
      defaultSort: { field: 'code', direction: 'ASC' },
    },
  };
}
function reference(
  name: string,
  cardinality: 'ONE' | 'MANY' = 'ONE',
): WorkbenchRelationship {
  return {
    field: name,
    label: name,
    description: '',
    targetModule: 'profile',
    targetSchema: name,
    cardinality,
    referenceProperty: 'identity.code',
    resolution: 'LOCAL_OR_REMOTE',
    actions: ['CREATE_RELATED', 'SELECT_EXISTING', 'UNLINK'],
    required: false,
  };
}

describe('hierarchical record drafts', () => {
  it('defers all writes, saves deepest first, and retains successful descendants after a failure', async () => {
    const contact = schema('contact');
    const address = schema('address', [reference('contact')]);
    const enterprise = schema('enterprise', [reference('address', 'MANY')]);
    const contactDraft = { code: 'PHONE' };
    const addressDraft = { code: 'OFFICE' };
    rememberRelatedDrafts(addressDraft, {
      contact: { references: [], pending: [contactDraft] },
    });
    const relationships = {
      address: { references: ['EXISTING'], pending: [addressDraft] },
    };
    const createRecord = vi
      .fn()
      .mockResolvedValueOnce({ identity: { code: 'PHONE-SAVED' } })
      .mockRejectedValueOnce(new Error('Address validation failed'))
      .mockResolvedValueOnce({ identity: { code: 'OFFICE-SAVED' } });
    const runtime = {
      schemas: [contact, address, enterprise],
      queryScope: ['default'],
      createRecord,
      loadRecords: vi.fn(),
    };
    expect(createRecord).not.toHaveBeenCalled();
    expect(JSON.stringify(addressDraft)).toBe('{"code":"OFFICE"}');
    await expect(
      resolveRelatedDrafts(enterprise, { code: 'ACME' }, relationships, runtime),
    ).rejects.toThrow('Address validation failed');
    const model = await resolveRelatedDrafts(
      enterprise,
      { code: 'ACME' },
      relationships,
      runtime,
    );
    expect(
      createRecord.mock.calls.map(([target]) => (target as WorkbenchSchema).schemaName),
    ).toEqual(['contact', 'address', 'address']);
    expect(createRecord).toHaveBeenLastCalledWith(address, {
      code: 'OFFICE',
      contact: 'PHONE-SAVED',
    });
    expect(model).toEqual({ code: 'ACME', address: ['EXISTING', 'OFFICE-SAVED'] });
    expect(
      await resolveRelatedDrafts(enterprise, { code: 'ACME' }, relationships, runtime),
    ).toEqual(model);
    expect(createRecord).toHaveBeenCalledTimes(3);
  });

  it('clears the final association while leaving unrelated data untouched', async () => {
    const original = {
      code: 'ACME',
      address: ['OFFICE'],
      contact: 'PHONE',
      settings: { enabled: true },
    };
    const model = await resolveRelatedDrafts(
      schema('enterprise', [reference('address', 'MANY'), reference('contact')]),
      original,
      {
        address: { references: [], pending: [] },
        contact: { references: [], pending: [] },
      },
      undefined,
    );
    expect(model).toEqual({
      code: 'ACME',
      address: [],
      contact: null,
      settings: { enabled: true },
    });
    expect(original.address).toEqual(['OFFICE']);
  });

  it('does not recreate a successful child whose response omitted its configured reference', async () => {
    const child = schema('address');
    const parent = schema('enterprise', [reference('address')]);
    const createRecord = vi.fn().mockResolvedValue({ other: 'value' });
    const runtime = {
      schemas: [child],
      queryScope: ['default'],
      createRecord,
      loadRecords: vi.fn(),
    };
    const draft: Record<string, { references: string[]; pending: WorkbenchRecord[] }> =
      { address: { references: [], pending: [{ code: 'OFFICE' }] } };
    await expect(resolveRelatedDrafts(parent, {}, draft, runtime)).rejects.toThrow(
      'saved but did not return',
    );
    await expect(resolveRelatedDrafts(parent, {}, draft, runtime)).rejects.toThrow(
      'saved but did not return',
    );
    expect(createRecord).toHaveBeenCalledTimes(1);
  });
});
