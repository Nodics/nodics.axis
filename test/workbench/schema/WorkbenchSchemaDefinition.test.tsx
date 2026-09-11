import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';
import { WorkbenchSchemaDefinition } from '../../../src/workbench/schema/WorkbenchSchemaDefinition';

const address: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'address',
  label: 'Address',
  description: 'Reusable postal address',
  origin: {
    source: 'PROJECT',
    moduleName: 'profile',
    layer: 'custom',
    status: 'OVERRIDDEN',
  },
  hierarchy: [
    {
      source: 'FRAMEWORK',
      moduleName: 'profile',
      schemaName: 'address',
      layer: 'framework',
      status: 'BASE',
    },
    {
      source: 'PROJECT',
      moduleName: 'profile',
      schemaName: 'address',
      layer: 'custom',
      status: 'OVERRIDDEN',
    },
  ],
  displayProperty: 'code',
  displayProperties: ['code'],
  queryCapabilities: {
    searchableFields: ['code'],
    sortableFields: ['code'],
    filterFields: [],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25, 50],
    defaultPageSize: 25,
    maximumPageSize: 50,
    defaultSort: { field: 'code', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  mutationPolicy: {
    mode: 'GENERATED_CRUD',
    savePath: 'GENERATED_CRUD',
    lifecycle: 'DIRECT',
    createStrategy: 'TOP_LEVEL_WITH_REFERENCES',
    updateStrategy: 'DIRECT_OR_REFERENCED',
    deleteStrategy: 'TOP_LEVEL_ONLY',
    aggregateSave: false,
    publishRequired: false,
  },
  operations: ['search', 'read', 'create', 'update', 'delete'],
  fields: [
    {
      name: 'code',
      label: 'Code',
      type: 'string',
      required: true,
      readOnly: false,
      primary: true,
      description: '',
      component: 'text',
      validation: { minLength: 3, maxLength: 64 },
      origin: {
        source: 'FRAMEWORK',
        moduleName: 'profile',
        layer: 'framework',
        status: 'BASE',
      },
      searchable: true,
    },
    {
      name: 'verificationStatus',
      label: 'Verification status',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: 'Reusable address verification state',
      enum: ['UNVERIFIED', 'PENDING', 'VERIFIED'],
      enumOptions: [
        {
          value: 'UNVERIFIED',
          label: 'Unverified',
          description: '',
          disabled: false,
        },
        { value: 'PENDING', label: 'Pending', description: '', disabled: false },
        { value: 'VERIFIED', label: 'Verified', description: '', disabled: false },
      ],
      default: 'UNVERIFIED',
      component: 'select',
      validation: {},
      origin: {
        source: 'PROJECT',
        moduleName: 'profile',
        layer: 'custom',
        status: 'ADDED',
      },
      searchable: false,
    },
  ],
  relationships: [],
};

const enterprise: WorkbenchSchema = {
  ...address,
  schemaName: 'enterprise',
  label: 'Enterprise',
  description: 'Business account',
  fields: [
    address.fields[0]!,
    {
      name: 'name',
      label: 'Name',
      type: 'Object',
      required: true,
      readOnly: false,
      primary: false,
      description: 'Business display name',
      component: 'localizedText',
      validation: {},
      searchable: false,
    },
    {
      name: 'address',
      label: 'Registered address',
      type: 'Object',
      required: true,
      readOnly: false,
      primary: false,
      description: 'Primary registered address',
      component: 'referenceSelector',
      validation: {},
      reference: {
        field: 'address',
        label: 'Registered address',
        description: 'Primary registered address',
        targetModule: 'profile',
        targetSchema: 'address',
        cardinality: 'ONE',
        referenceProperty: 'code',
        component: 'referenceSelector',
        resolution: 'LOCAL_OR_REMOTE',
        actions: ['SELECT_EXISTING', 'CREATE_RELATED', 'EDIT_RELATED'],
        required: true,
        maximumDepth: 3,
      },
      searchable: false,
    },
  ],
  relationships: [],
};

describe('WorkbenchSchemaDefinition', () => {
  it('renders backend schema guidance and opens referenced schemas', async () => {
    const user = userEvent.setup();
    render(
      <WorkbenchSchemaDefinition schema={enterprise} schemas={[enterprise, address]} />,
    );

    expect(screen.getByText('Schema Contributions')).toBeVisible();
    expect(screen.getByText('profile.address BASE')).toBeVisible();
    expect(screen.getByText('profile.address OVERRIDDEN')).toBeVisible();
    expect(screen.getByText('Registered address')).toBeVisible();
    expect(screen.getByText('Business display name')).toBeVisible();
    expect(screen.getByText('Localized text')).toBeVisible();
    expect(screen.getAllByText('Object').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Primary registered address')).toBeVisible();
    expect(screen.getByText('Object reference')).toBeVisible();
    expect(screen.getByText('Single record by code')).toBeVisible();
    expect(screen.getByText('Reference schema')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: /Address \(profile.address\)/,
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', {
        name: /Address \(profile.address\)/,
      }),
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Address')).toBeVisible();
    expect(within(dialog).getByText('Verification status')).toBeVisible();
    expect(
      within(dialog).getByText('Options: Unverified, Pending, Verified'),
    ).toBeVisible();
    expect(within(dialog).getByText('Default: UNVERIFIED')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Close schema' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows reference schema names for object refs when target schemas are not loaded', () => {
    const wasteCollectionPoint: WorkbenchSchema = {
      ...enterprise,
      moduleName: 'wasteCollection',
      schemaName: 'wasteCollectionPoint',
      label: 'Waste Collection Point',
      description: 'Effective schema definition',
      origin: {
        source: 'MODULE',
        moduleName: 'wasteCollection',
        layer: 'module',
        status: 'EFFECTIVE',
      },
      hierarchy: [
        {
          source: 'MODULE',
          moduleName: 'wasteCollection',
          schemaName: 'wasteCollectionPoint',
          layer: 'module',
          status: 'EFFECTIVE',
        },
      ],
      fields: [
        {
          ...enterprise.fields[1]!,
          name: 'locationRef',
          label: 'Location Ref',
          type: 'Object',
          description: 'References the related location record used by this record.',
          reference: {
            ...enterprise.fields[1]!.reference!,
            field: 'locationRef',
            label: 'Location Ref',
            targetModule: 'locationCore',
            targetSchema: 'location',
          },
        },
        {
          ...enterprise.fields[1]!,
          name: 'operatorEnterpriseRef',
          label: 'Operator Enterprise Ref',
          type: 'Object',
          description:
            'References the related operator enterprise record used by this record.',
          reference: {
            ...enterprise.fields[1]!.reference!,
            field: 'operatorEnterpriseRef',
            label: 'Operator Enterprise Ref',
            targetModule: 'profile',
            targetSchema: 'enterprise',
          },
        },
      ],
      relationships: [],
    };

    render(
      <WorkbenchSchemaDefinition
        schema={wasteCollectionPoint}
        schemas={[wasteCollectionPoint]}
      />,
    );

    expect(screen.queryByText('Schema Contributions')).not.toBeInTheDocument();
    expect(
      screen.queryByText('wasteCollection.wasteCollectionPoint'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Reference schema')).toHaveLength(2);
    expect(
      screen.getByText('References the related location record used by this record.'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'References the related operator enterprise record used by this record.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /locationCore.location/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /profile.enterprise/ })).toBeVisible();
  });
});
