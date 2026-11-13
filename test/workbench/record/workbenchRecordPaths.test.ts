import { describe, expect, it } from 'vitest';

import {
  compactWorkbenchDraft,
  containerFieldNames,
  setWorkbenchRecordValue,
  workbenchRecordValue,
} from '../../../src/workbench/record/workbenchRecordPaths';
import type { WorkbenchField } from '../../../src/workbench/api/workbenchContracts';

describe('workbenchRecordValue', () => {
  it('prefers exact field names before traversing dotted inline object paths', () => {
    expect(
      workbenchRecordValue(
        {
          'name.firstName': 'Projected Admin',
          name: { firstName: 'Nested Admin' },
        },
        'name.firstName',
      ),
    ).toBe('Projected Admin');
  });

  it('traverses inline nested objects when exact projected values are not present', () => {
    expect(
      workbenchRecordValue(
        {
          name: { firstName: 'Nested Admin', middleName: 'Ops' },
        },
        'name.middleName',
      ),
    ).toBe('Ops');
  });

  it('does not treat arrays as inline object containers', () => {
    expect(
      workbenchRecordValue(
        {
          channels: [{ code: 'defaultRejectChannel' }],
        },
        'channels.code',
      ),
    ).toBeUndefined();
  });
});

describe('setWorkbenchRecordValue', () => {
  it('creates inline nested objects for dotted field paths', () => {
    const record: Record<string, unknown> = {};

    setWorkbenchRecordValue(record, 'name.firstName', 'Admin');
    setWorkbenchRecordValue(record, 'name.lastName', 'User');

    expect(record).toEqual({
      name: {
        firstName: 'Admin',
        lastName: 'User',
      },
    });
  });
});

describe('compactWorkbenchDraft', () => {
  it('compacts flat dotted draft values into nested model objects', () => {
    expect(
      compactWorkbenchDraft({
        loginId: 'admin',
        'name.firstName': 'Admin',
        'name.middleName': '',
        'name.lastName': 'User',
      }),
    ).toEqual({
      loginId: 'admin',
      name: {
        firstName: 'Admin',
        lastName: 'User',
      },
    });
  });
});

describe('containerFieldNames', () => {
  it('detects inline parent object fields from dotted child fields', () => {
    const fields: readonly WorkbenchField[] = [
      {
        name: 'name',
        label: 'Name',
        type: 'object',
        required: true,
        readOnly: false,
        primary: false,
        description: '',
        searchable: false,
      },
      {
        name: 'name.firstName',
        label: 'First name',
        type: 'string',
        required: true,
        readOnly: false,
        primary: false,
        description: '',
        searchable: true,
      },
      {
        name: 'tenant',
        label: 'Tenant',
        type: 'string',
        required: true,
        readOnly: false,
        primary: false,
        description: '',
        searchable: true,
      },
    ];

    expect([...containerFieldNames(fields)]).toEqual(['name']);
  });
});

it('retains explicit text clears for an update without manufacturing absent values', () => {
  expect(
    compactWorkbenchDraft(
      {
        description: '',
        'name.middleName': '',
        untouched: undefined,
        active: false,
        priority: 0,
      },
      'update',
      { description: 'Before', name: { middleName: 'Before' } },
    ),
  ).toEqual({ description: '', name: { middleName: '' }, active: false, priority: 0 });
  expect(
    compactWorkbenchDraft({ description: '', untouched: undefined }, 'create'),
  ).toEqual({});
});

it('omits untouched empty text that had no original string value', () => {
  expect(
    compactWorkbenchDraft(
      { description: '', 'name.middleName': '', active: false },
      'update',
      { active: false, description: null },
    ),
  ).toEqual({ active: false });
});
