import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AxisLocalizationBoundary } from '../../../src/localization/AxisLocalizationContext';
import type { AxisLocalizationState } from '../../../src/localization/localizationContracts';
import { AxisSchemaDataListing } from '../../../src/app/table/AxisSchemaDataListing';
import type { WorkbenchSchema } from '../../../src/workbench/api/workbenchContracts';

const employeeSchema: WorkbenchSchema = {
  moduleName: 'profile',
  schemaName: 'employee',
  label: 'Employee',
  description: '',
  displayProperty: 'loginId',
  displayProperties: ['loginId', 'name.firstName', 'name.lastName'],
  queryCapabilities: {
    searchableFields: ['loginId', 'name.firstName', 'name.lastName'],
    sortableFields: ['loginId', 'name.firstName', 'name.lastName'],
    filterFields: [],
    groupOperators: ['AND', 'OR'],
    textOperator: 'CONTAINS',
    allowedPageSizes: [10, 25, 50],
    defaultPageSize: 25,
    maximumPageSize: 50,
    defaultSort: { field: 'loginId', direction: 'ASC' },
  },
  mutationMode: 'GENERATED_CRUD',
  operations: ['search', 'read'],
  fields: [
    {
      name: 'loginId',
      label: 'Login',
      type: 'string',
      required: true,
      readOnly: false,
      primary: true,
      description: '',
      searchable: true,
    },
    {
      name: 'name.firstName',
      label: 'First name',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
    {
      name: 'name.lastName',
      label: 'Last name',
      type: 'string',
      required: false,
      readOnly: false,
      primary: false,
      description: '',
      searchable: true,
    },
  ],
  relationships: [],
};

it('changes displayed date language without changing the record identity', () => {
  const value = '2026-11-09T16:15:00Z';
  const record = { loginId: 'axis-employee-71', createdAt: value };
  const schema: WorkbenchSchema = {
    ...employeeSchema,
    fields: [
      employeeSchema.fields[0]!,
      {
        name: 'createdAt',
        label: 'Created',
        type: 'date',
        required: false,
        readOnly: true,
        primary: false,
        description: '',
        searchable: false,
      },
    ],
  };
  const view = (locale: string) => (
    <AxisLocalizationBoundary
      value={
        {
          locale,
          direction: locale === 'ar' ? 'rtl' : 'ltr',
          supportedLocales: ['en', 'ar'],
          stale: false,
          setLocale: () => undefined,
          format: (_key: string, fallback: string) => fallback,
          formatError: (_error: unknown, fallback: string) => fallback,
        } satisfies AxisLocalizationState
      }
    >
      <AxisSchemaDataListing
        ariaLabel="Employee records"
        schema={schema}
        records={[record]}
        getRowKey={(row) => String(row.loginId)}
        emptyMessage="No records"
      />
    </AxisLocalizationBoundary>
  );
  const expected = (locale: string) =>
    new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZoneName: 'short',
    }).format(new Date(value));
  const page = render(view('en'));
  expect(screen.getByText(expected('en'))).toBeVisible();
  const original = screen.getByText('axis-employee-71');
  expect(original.tagName).toBe('BDI');
  page.rerender(view('ar'));
  expect(screen.getByText(expected('ar'))).toBeVisible();
  expect(screen.getByText('axis-employee-71')).toBe(original);
  expect(record.createdAt).toBe(value);
});

describe('AxisSchemaDataListing', () => {
  it('resets stale column choices to the declared order while excluding unavailable fields', async () => {
    const onColumnKeysChange = vi.fn();
    render(
      <AxisSchemaDataListing
        ariaLabel="Employee records"
        schema={employeeSchema}
        records={[]}
        getRowKey={(_, index) => String(index)}
        emptyMessage="No records"
        defaultVisibleColumnKeys={[
          'name.firstName',
          'loginId',
          'name.lastName',
          'missing',
        ]}
        excludedColumnKeys={['name.lastName']}
        visibleColumnKeys={['loginId']}
        onColumnKeysChange={onColumnKeysChange}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reset columns' }));
    expect(onColumnKeysChange).toHaveBeenCalledExactlyOnceWith([
      'name.firstName',
      'loginId',
    ]);
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('omits inert column controls when no presentation change handler is supplied', () => {
    render(
      <AxisSchemaDataListing
        ariaLabel="Employee records"
        schema={employeeSchema}
        records={[]}
        getRowKey={(_, index) => String(index)}
        emptyMessage="No records"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Columns' })).toBeNull();
  });
  it('renders nested record values for dotted schema fields', () => {
    render(
      <AxisSchemaDataListing
        ariaLabel="Employee records"
        defaultVisibleColumnKeys={['loginId', 'name.firstName', 'name.lastName']}
        emptyMessage="No records"
        getRowKey={(record) => String(record.loginId)}
        records={[
          {
            loginId: 'admin',
            name: { firstName: 'Admin', lastName: 'User' },
          },
        ]}
        schema={employeeSchema}
      />,
    );

    expect(screen.getByRole('cell', { name: 'admin' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Admin' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'User' })).toBeVisible();
  });

  it('renders backend relationship columns as reference links without selecting the row', async () => {
    const user = userEvent.setup();
    const onReferenceClick = vi.fn();
    const onRowClick = vi.fn();
    const enterpriseSchema: WorkbenchSchema = {
      ...employeeSchema,
      schemaName: 'enterprise',
      label: 'Enterprise',
      displayProperty: 'code',
      displayProperties: ['code', 'tenant'],
      fields: [
        {
          name: 'code',
          label: 'Code',
          type: 'string',
          required: true,
          readOnly: false,
          primary: true,
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
      ],
      relationships: [
        {
          field: 'tenant',
          label: 'Tenant',
          description: '',
          targetModule: 'profile',
          targetSchema: 'tenant',
          cardinality: 'ONE',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: true,
          maximumDepth: 3,
        },
      ],
    };

    render(
      <AxisSchemaDataListing
        ariaLabel="Enterprise records"
        defaultVisibleColumnKeys={['code', 'tenant']}
        emptyMessage="No records"
        getRowKey={(record) => String(record.code)}
        records={[{ code: 'defaultEnterprise', tenant: 'default' }]}
        schema={enterpriseSchema}
        onReferenceClick={onReferenceClick}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'default' }));

    expect(onReferenceClick).toHaveBeenCalledWith(
      enterpriseSchema.relationships[0],
      'default',
      { code: 'defaultEnterprise', tenant: 'default' },
      0,
    );
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('renders one-to-many relationship columns as individual reference links', async () => {
    const user = userEvent.setup();
    const onReferenceClick = vi.fn();
    const onRowClick = vi.fn();
    const workflowActionSchema: WorkbenchSchema = {
      ...employeeSchema,
      moduleName: 'workflow',
      schemaName: 'workflowAction',
      label: 'Workflow Action',
      displayProperty: 'code',
      displayProperties: ['code'],
      fields: [
        {
          name: 'code',
          label: 'Code',
          type: 'string',
          required: true,
          readOnly: false,
          primary: true,
          description: '',
          searchable: true,
        },
        {
          name: 'channels',
          label: 'Channels',
          type: 'array',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: false,
        },
      ],
      relationships: [
        {
          field: 'channels',
          label: 'Channels',
          description: '',
          targetModule: 'workflow',
          targetSchema: 'workflowChannel',
          cardinality: 'MANY',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: false,
          maximumDepth: 3,
        },
      ],
    };

    render(
      <AxisSchemaDataListing
        ariaLabel="Workflow action records"
        defaultVisibleColumnKeys={['code', 'channels']}
        emptyMessage="No records"
        getRowKey={(record) => String(record.code)}
        records={[
          {
            code: 'reviewCmsPageAction',
            channels: ['publishCmsPageChannel', 'defaultRejectChannel'],
          },
        ]}
        schema={workflowActionSchema}
        onReferenceClick={onReferenceClick}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'defaultRejectChannel' }));

    expect(onReferenceClick).toHaveBeenCalledWith(
      workflowActionSchema.relationships[0],
      'defaultRejectChannel',
      {
        code: 'reviewCmsPageAction',
        channels: ['publishCmsPageChannel', 'defaultRejectChannel'],
      },
      0,
    );
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('expands additional one-to-many reference links inside table cells', async () => {
    const user = userEvent.setup();
    const onReferenceClick = vi.fn();
    const workflowActionSchema: WorkbenchSchema = {
      ...employeeSchema,
      moduleName: 'workflow',
      schemaName: 'workflowAction',
      label: 'Workflow Action',
      displayProperty: 'code',
      displayProperties: ['code'],
      fields: [
        {
          name: 'code',
          label: 'Code',
          type: 'string',
          required: true,
          readOnly: false,
          primary: true,
          description: '',
          searchable: true,
        },
        {
          name: 'channels',
          label: 'Channels',
          type: 'array',
          required: false,
          readOnly: false,
          primary: false,
          description: '',
          searchable: false,
        },
      ],
      relationships: [
        {
          field: 'channels',
          label: 'Channels',
          description: '',
          targetModule: 'workflow',
          targetSchema: 'workflowChannel',
          cardinality: 'MANY',
          referenceProperty: 'code',
          resolution: 'LOCAL_OR_REMOTE',
          actions: ['SELECT_EXISTING'],
          required: false,
          maximumDepth: 3,
        },
      ],
    };

    render(
      <AxisSchemaDataListing
        ariaLabel="Workflow action records"
        defaultVisibleColumnKeys={['code', 'channels']}
        emptyMessage="No records"
        getRowKey={(record) => String(record.code)}
        records={[
          {
            code: 'reviewCmsPageAction',
            channels: [
              'successChannel',
              'rejectChannel',
              'errorChannel',
              'auditChannel',
            ],
          },
        ]}
        schema={workflowActionSchema}
        onReferenceClick={onReferenceClick}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'auditChannel' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+1 more' }));
    await user.click(screen.getByRole('button', { name: 'auditChannel' }));

    expect(onReferenceClick).toHaveBeenCalledWith(
      workflowActionSchema.relationships[0],
      'auditChannel',
      {
        code: 'reviewCmsPageAction',
        channels: ['successChannel', 'rejectChannel', 'errorChannel', 'auditChannel'],
      },
      0,
    );
  });
});

it('shows bounded inert structured summaries rather than claiming an unrelated value is a relationship', () => {
  const copy = { en: 'Synthetic series', ar: 'سلسلة تجريبية', active: false, count: 0 };
  const schema: WorkbenchSchema = {
    ...employeeSchema,
    fields: [
      {
        ...employeeSchema.fields[0]!,
        name: 'description',
        label: 'Description',
        type: 'object',
      },
    ],
    displayProperty: 'description',
    displayProperties: ['description'],
  };
  const { rerender } = render(
    <AxisSchemaDataListing
      ariaLabel="Series"
      schema={schema}
      records={[{ description: copy }]}
      getRowKey={() => 'series'}
      emptyMessage="None"
    />,
  );
  expect(screen.getByRole('cell', { name: JSON.stringify(copy) })).toBeVisible();
  expect(screen.queryByText('Related data')).not.toBeInTheDocument();
  const text = '<img src=x onerror=alert(1)>'.repeat(20);
  rerender(
    <AxisSchemaDataListing
      ariaLabel="Series"
      schema={schema}
      records={[{ description: { en: text } }]}
      getRowKey={() => 'series'}
      emptyMessage="None"
    />,
  );
  const summary = JSON.stringify({ en: text }).slice(0, 157) + '…';
  expect(screen.getByRole('cell', { name: summary })).toBeVisible();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
